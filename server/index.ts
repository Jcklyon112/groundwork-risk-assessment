// ─────────────────────────────────────────────────────────────────────────
// server/index.ts — local backend API for the La Janais Feasibility Engine.
// Serves the computed model, per-gate data, the permitting pathway, the raw
// source audit trail, and a live POST /api/refresh that re-runs the keyless
// adapters and recomputes the model. Pure Node + Express; no secrets (keyless).
//   npm run server     (tsx watch)
// ─────────────────────────────────────────────────────────────────────────
// Load .env (for ANTHROPIC_API_KEY) if present — built-in, no dependency.
try { (process as any).loadEnvFile?.() } catch { /* no .env — fine */ }

import express from 'express'
import cors from 'cors'
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runFetch } from '../src/pipeline/fetchAll.ts'
import { buildModel, loadSnapshot, writeModel } from '../src/pipeline/evaluate.ts'
import type { FeasibilityModel } from '../src/model/types.ts'
import { fetchWithRetry, siteFromPoint } from '../src/adapters/_util.ts'
import { runAgent, agentConfigured, AGENT_MODEL } from './agent.ts'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CACHE = resolve(ROOT, 'cache')
const CACHE_RAW = resolve(CACHE, 'raw')
const PORT = Number(process.env.PORT ?? 8787)

// ── in-memory model state ─────────────────────────────────────────────────
let model: FeasibilityModel
let lastRefresh: string | null = null

function loadModelFromDisk(): FeasibilityModel {
  const cached = resolve(CACHE, 'model.json')
  if (existsSync(cached)) return JSON.parse(readFileSync(cached, 'utf8'))
  // fall back to recomputing from the normalized snapshot
  return buildModel(loadSnapshot())
}
model = loadModelFromDisk()

// ── app ────────────────────────────────────────────────────────────────────
const app = express()
app.use(cors())
app.use(express.json())

// small request log
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString().slice(11, 19)}  ${req.method} ${req.url}`)
  next()
})

const ok = (res: express.Response, data: unknown) => res.json(data)

app.get('/api/health', (_req, res) =>
  ok(res, { ok: true, service: 'la-janais-feasibility-engine', generated_at: model.generated_at, lastRefresh }),
)

// full computed model
app.get('/api/model', (_req, res) => ok(res, model))

// site summary + verdict + composite
app.get('/api/summary', (_req, res) =>
  ok(res, {
    site: model.site,
    composite: model.composite,
    verdict: model.verdict,
    bottleneck: model.bottleneck,
    generated_at: model.generated_at,
    gateCount: model.gates.length,
    unresolvedCount: model.unresolved.length,
  }),
)

// all gates / one gate
app.get('/api/gates', (_req, res) => ok(res, model.gates))
app.get('/api/gates/:id', (req, res) => {
  const g = model.gates.find((x) => x.id === req.params.id)
  if (!g) return res.status(404).json({ error: `no gate '${req.params.id}'`, gates: model.gates.map((x) => x.id) })
  ok(res, g)
})

// permitting pathway + computed bottleneck
app.get('/api/pathway', (_req, res) => ok(res, { pathway: model.pathway, bottleneck: model.bottleneck }))

// unresolved ledger
app.get('/api/unresolved', (_req, res) => ok(res, { unresolved: model.unresolved }))

// canonical site geometry (GeoJSON)
app.get('/api/site', (_req, res) => {
  const geo = JSON.parse(readFileSync(resolve(ROOT, 'src', 'data', 'site.geojson'), 'utf8'))
  ok(res, geo)
})

// ── raw source audit trail ───────────────────────────────────────────────
function listSources() {
  if (!existsSync(CACHE_RAW)) return []
  return readdirSync(CACHE_RAW)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const path = resolve(CACHE_RAW, f)
      const name = f.replace(/\.json$/, '')
      let fetched_at: string | undefined
      let status: number | undefined
      let request: string | undefined
      try {
        const j = JSON.parse(readFileSync(path, 'utf8'))
        fetched_at = j.fetched_at ?? j.fetched_at
        status = j.status
        request = typeof j.request === 'string' ? j.request : Array.isArray(j.request) ? j.request[0] : undefined
      } catch { /* ignore */ }
      return { name, file: f, bytes: statSync(path).size, fetched_at, status, request }
    })
}

app.get('/api/sources', (_req, res) => ok(res, { sources: listSources() }))
app.get('/api/sources/:name', (req, res) => {
  const safe = req.params.name.replace(/[^a-z0-9_-]/gi, '')
  const path = resolve(CACHE_RAW, `${safe}.json`)
  if (!existsSync(path)) return res.status(404).json({ error: `no source '${safe}'`, sources: listSources().map((s) => s.name) })
  ok(res, JSON.parse(readFileSync(path, 'utf8')))
})

// ── live refresh — re-run adapters + recompute ────────────────────────────
let refreshing = false
app.post('/api/refresh', async (_req, res) => {
  if (refreshing) return res.status(409).json({ error: 'refresh already in progress' })
  refreshing = true
  const log: string[] = []
  try {
    console.log('↻ live refresh requested')
    const snap = await runFetch((m) => { log.push(m); console.log('   ' + m) })
    model = buildModel(snap)
    writeModel(model)
    lastRefresh = new Date().toISOString()
    ok(res, { ok: true, lastRefresh, composite: model.composite, verdict: model.verdict, bottleneck: model.bottleneck, log })
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message ?? String(e), log })
  } finally {
    refreshing = false
  }
})

// ── any-parcel screening — geocode + fetch the data axes + evaluate ───────
// Does NOT touch the canonical La Janais model/cache: raw goes to cache/raw/screen,
// the model is returned to the caller only (mode='screening').
app.post('/api/screen', async (req, res) => {
  const address = (req.body?.address ?? '').toString().trim()
  if (!address) return res.status(400).json({ error: 'missing "address"' })
  if (refreshing) return res.status(409).json({ error: 'a fetch is already in progress' })
  refreshing = true
  const log: string[] = []
  try {
    // 1) geocode via BAN
    const gUrl = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(address)}&limit=1`
    const g = await fetchWithRetry(gUrl)
    const f = g.json?.features?.[0]
    if (!f) return res.status(404).json({ error: `could not geocode "${address}"` })
    const [lon, lat] = f.geometry.coordinates
    const insee: string = f.properties.citycode
    const commune: string = f.properties.city ?? f.properties.context ?? 'commune'
    const label: string = f.properties.label ?? address
    log.push(`geocoded "${address}" → ${label} (${lon.toFixed(5)}, ${lat.toFixed(5)}) INSEE ${insee}`)

    // 2) build a screening footprint + run the keyless adapters into cache/raw/screen
    const site = siteFromPoint(lon, lat, insee, commune)
    const snap = await runFetch((m) => { log.push(m); console.log('   ' + m) }, { site, namespace: 'screen', banQuery: address })

    // 3) evaluate in screening mode (researched gates flagged, not carried)
    const screened = buildModel(snap, { mode: 'screening', siteName: `Screening — ${label}` })
    ok(res, { ok: true, model: screened, geocode: { label, lon, lat, insee }, log })
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message ?? String(e), log })
  } finally {
    refreshing = false
  }
})

// ── agent (#1 live reasoning + #4 tool-using endpoint) ────────────────────
app.get('/api/agent', (_req, res) =>
  ok(res, { configured: agentConfigured(), model: AGENT_MODEL }),
)

app.post('/api/ask', async (req, res) => {
  const question = (req.body?.question ?? '').toString().trim()
  if (!question) return res.status(400).json({ error: 'missing "question"' })
  if (!agentConfigured())
    return res.status(503).json({
      error: 'Agent not configured. Set ANTHROPIC_API_KEY in the server environment and restart (npm run server).',
    })
  try {
    console.log(`◆ ask: ${question.slice(0, 80)}`)
    const turn = await runAgent(question)
    ok(res, turn)
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? String(e) })
  }
})

app.listen(PORT, () => {
  console.log(`\n▶ La Janais Feasibility API on http://localhost:${PORT}`)
  console.log(`  model: ${(model.composite * 100).toFixed(1)}% ${model.verdict} · bottleneck ${model.bottleneck}`)
  console.log('  GET  /api/health  /api/model  /api/summary  /api/gates[/:id]')
  console.log('  GET  /api/pathway  /api/unresolved  /api/site  /api/sources[/:name]')
  console.log('  POST /api/refresh  (re-runs the keyless adapters live)')
  console.log('  POST /api/screen   (geocode + score any French parcel · screening mode)')
  console.log(`  POST /api/ask      (tool-using agent · ${AGENT_MODEL} · ${agentConfigured() ? 'configured' : 'set ANTHROPIC_API_KEY'})\n`)
})
