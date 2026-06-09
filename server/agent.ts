// ─────────────────────────────────────────────────────────────────────────
// server/agent.ts — the tool-using feasibility agent (puts a model in the
// RUNTIME loop). Claude orchestrates live French open-data tools (BAN, GPU,
// Géorisques, RTE, Hub'Eau, FCU) + the computed model + the server-side
// web_search tool, then answers feasibility questions with citations.
//
//   #4 — POST /api/ask drives a manual tool-use loop; every step is captured
//        and returned so the UI can show HOW the answer was reached.
//   #1 — web_search lets the agent re-derive ICPE classification / read the
//        current règlement live, instead of replaying frozen research.ts.
//
// Requires ANTHROPIC_API_KEY (the one non-keyless layer). Degrades with a
// clear message if unset. Model: claude-opus-4-8 (adaptive thinking + effort).
// ─────────────────────────────────────────────────────────────────────────
import Anthropic from '@anthropic-ai/sdk'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchWithRetry, geomParam, haversineM } from '../src/adapters/_util.ts'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CACHE = resolve(ROOT, 'cache')

export const AGENT_MODEL = process.env.AGENT_MODEL || 'claude-opus-4-8'
export const agentConfigured = () => !!process.env.ANTHROPIC_API_KEY

// La Janais defaults — tools fall back to these when args are omitted.
const SITE = { lon: -1.706499, lat: 48.058832, insee: '35066', commune: 'Chartres-de-Bretagne' }

// ── tool implementations (live fetchers; compact normalized output) ─────────
const tools = {
  async geocode_address({ address }: { address: string }) {
    const url = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(address)}&limit=1`
    const r = await fetchWithRetry(url)
    const f = r.json?.features?.[0]
    if (!f) return { ok: false, note: 'no result', url }
    return { ok: true, label: f.properties.label, lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1], insee: f.properties.citycode, url }
  },

  async get_landuse({ lon = SITE.lon, lat = SITE.lat }: { lon?: number; lat?: number }) {
    const pt = { type: 'Point', coordinates: [lon, lat] }
    const zUrl = `https://apicarto.ign.fr/api/gpu/zone-urba?geom=${geomParam(pt)}`
    const dUrl = `https://apicarto.ign.fr/api/gpu/document?geom=${geomParam(pt)}`
    const pUrl = `https://apicarto.ign.fr/api/gpu/prescription-surf?geom=${geomParam(pt)}`
    const [z, d, p] = [await fetchWithRetry(zUrl), await fetchWithRetry(dUrl), await fetchWithRetry(pUrl)]
    return {
      zones: (z.json?.features ?? []).map((f: any) => ({ typezone: f.properties?.typezone, libelle: f.properties?.libelle })),
      document_partition: d.json?.features?.[0]?.properties?.partition,
      prescriptions: (p.json?.features ?? []).map((f: any) => f.properties?.libelle).slice(0, 8),
      urls: { zone: zUrl, document: dUrl, prescription: pUrl },
    }
  },

  async get_brownfield({ lon = SITE.lon, lat = SITE.lat, radius_m = 2000 }: { lon?: number; lat?: number; radius_m?: number }) {
    const latlon = `${lon}%2C${lat}`
    const icpeUrl = `https://www.georisques.gouv.fr/api/v1/installations_classees?latlon=${latlon}&rayon=${radius_m}&page=1&page_size=15`
    const casiasUrl = `https://www.georisques.gouv.fr/api/v1/ssp/casias?latlon=${latlon}&rayon=${radius_m}&page=1&page_size=15`
    const [icpe, casias] = [await fetchWithRetry(icpeUrl), await fetchWithRetry(casiasUrl)]
    return {
      icpe_count: icpe.json?.results ?? 0,
      icpe_top: (icpe.json?.data ?? []).slice(0, 5).map((d: any) => ({ raisonSociale: d.raisonSociale, regime: d.regime, etat: d.etatActivite, prioriteNationale: d.prioriteNationale })),
      casias_count: casias.json?.results ?? 0,
      urls: { icpe: icpeUrl, casias: casiasUrl },
    }
  },

  async get_power({ insee = SITE.insee }: { insee?: string }) {
    const dept = insee.slice(0, 2)
    const base = 'https://odre.opendatasoft.com/api/explore/v2.1/catalog/datasets/registre-national-installation-production-stockage-electricite-agrege/records'
    const cUrl = `${base}?where=codeinseecommune%3D%22${insee}%22&select=filiere,postesource,puismaxrac,regime,tensionraccordement&limit=15`
    const dUrl = `${base}?where=codedepartement%3D%22${dept}%22&group_by=postesource&select=postesource,sum(puismaxrac)%20as%20puis&order_by=puis%20desc&limit=6`
    const [c, d] = [await fetchWithRetry(cUrl), await fetchWithRetry(dUrl)]
    return {
      note: 'INJECTION (production/storage) capacity register — NOT the 100 MW consumption draw (separate RTE study).',
      commune_postes: [...new Set((c.json?.results ?? []).map((r: any) => r.postesource).filter(Boolean))],
      dept_top_postes: (d.json?.results ?? []).map((r: any) => ({ poste: r.postesource, connected_MW: Math.round((r.puis ?? 0) / 1000) })),
      urls: { commune: cUrl, department: dUrl },
    }
  },

  async get_water({ insee = SITE.insee }: { insee?: string }) {
    const url = `https://hubeau.eaufrance.fr/api/v1/prelevements/referentiel/points_prelevement?code_commune_insee=${insee}&size=20`
    const r = await fetchWithRetry(url)
    return {
      withdrawal_point_count: r.json?.count ?? 0,
      points: (r.json?.data ?? []).map((p: any) => ({ name: p.nom_point_prelevement, milieu: p.code_type_milieu, since: p.date_exploitation_debut })),
      basin: 'SDAGE Loire-Bretagne / SAGE Vilaine',
      url,
    }
  },

  async get_heat({ lon = SITE.lon, lat = SITE.lat }: { lon?: number; lat?: number }) {
    const url = `https://france-chaleur-urbaine.beta.gouv.fr/api/v1/eligibility?lat=${lat}&lon=${lon}`
    const r = await fetchWithRetry(url)
    const j = r.json ?? {}
    const NET: [number, number] = [-1.707566, 48.08444]
    return {
      eligible_at_point: !!j.isEligible,
      distance_m: j.distance ?? null,
      nearest_network: j.name ? { id: j.id, name: j.name, gestionnaire: j.gestionnaire, enrr_pct: j.rateENRR, co2: j.rateCO2 } : null,
      straight_line_to_documented_main_m: j.isEligible ? 0 : Math.round(haversineM([lon, lat], NET)),
      threshold: '<100 m strongly connectable, 100–200 m feasible; beyond = transport-main cost',
      url,
    }
  },

  async get_feasibility_model() {
    const p = resolve(CACHE, 'model.json')
    if (!existsSync(p)) return { note: 'model not yet computed; run the pipeline' }
    const m = JSON.parse(readFileSync(p, 'utf8'))
    return {
      composite: m.composite, verdict: m.verdict, bottleneck: m.bottleneck,
      gates: m.gates.map((g: any) => ({ id: g.id, status: g.status, weight: g.weight, readiness: g.readiness, value: g.live?.value, rule: g.rule })),
      unresolved: m.unresolved,
    }
  },

  async list_sources() {
    const dir = resolve(CACHE, 'raw')
    if (!existsSync(dir)) return { sources: [] }
    return { sources: readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, '')) }
  },

  async get_source({ name }: { name: string }) {
    const safe = name.replace(/[^a-z0-9_-]/gi, '')
    const p = resolve(CACHE, 'raw', `${safe}.json`)
    if (!existsSync(p)) return { error: `no source '${safe}'` }
    const j = JSON.parse(readFileSync(p, 'utf8'))
    // trim huge bodies for context economy
    const text = typeof j.text === 'string' ? j.text.slice(0, 4000) : undefined
    return { request: j.request, status: j.status, fetched_at: j.fetched_at, json: j.json ?? undefined, text }
  },
}

// ── tool schemas (prescriptive descriptions — when to call, not just what) ──
const TOOL_DEFS: Anthropic.Tool[] = [
  { name: 'geocode_address', description: 'Resolve a French address/place to lon/lat + INSEE commune code via the Base Adresse Nationale. Call this FIRST whenever the user asks about a location other than the default La Janais site.', input_schema: { type: 'object', properties: { address: { type: 'string' } }, required: ['address'] } },
  { name: 'get_landuse', description: 'Live PLU/PLUi zonage (typezone, libelle), urbanism document partition, and prescription overlays at a point via the Géoportail de l’Urbanisme (API Carto). Use for land-use / zoning questions. Defaults to the La Janais site if lon/lat omitted.', input_schema: { type: 'object', properties: { lon: { type: 'number' }, lat: { type: 'number' } } } },
  { name: 'get_brownfield', description: 'Live ICPE installations and CASIAS/BASIAS legacy polluted-soil sites around a point via Géorisques. Use for brownfield/contamination/soil questions. Defaults to La Janais.', input_schema: { type: 'object', properties: { lon: { type: 'number' }, lat: { type: 'number' }, radius_m: { type: 'number' } } } },
  { name: 'get_power', description: 'Live RTE/Enedis grid INJECTION capacity register by commune + department poste source via ODRÉ. Use for grid/power questions. NOTE injection ≠ the 100 MW consumption draw. Defaults to INSEE 35066.', input_schema: { type: 'object', properties: { insee: { type: 'string' } } } },
  { name: 'get_water', description: 'Live water withdrawal points in a commune via Hub’Eau, plus basin context. Use for water abstraction/discharge questions. Defaults to INSEE 35066.', input_schema: { type: 'object', properties: { insee: { type: 'string' } } } },
  { name: 'get_heat', description: 'Live distance to the nearest réseau de chaleur (district heating) and its EnR&R/CO2 rates via France Chaleur Urbaine. Use for heat-offtake questions. Defaults to La Janais.', input_schema: { type: 'object', properties: { lon: { type: 'number' }, lat: { type: 'number' } } } },
  { name: 'get_feasibility_model', description: 'The current computed feasibility model for La Janais: composite, verdict, per-gate status/weight/readiness/rule, bottleneck, and unresolved items. Call this to ground answers about the overall assessment.', input_schema: { type: 'object', properties: {} } },
  { name: 'list_sources', description: 'List the names of the raw API audit-trail responses already captured for La Janais.', input_schema: { type: 'object', properties: {} } },
  { name: 'get_source', description: 'Fetch one raw API audit-trail response by name (from list_sources) — the exact bytes an adapter received, with request URL and fetched_at. Use to quote provenance precisely.', input_schema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } },
]

const SYSTEM = `You are the La Janais Feasibility Engine assistant — a runtime agent that answers questions about the feasibility and French permitting route for a proposed 100 MW liquid-cooled data-centre campus on the La Janais brownfield (former Citroën/PSA/Stellantis plant), Chartres-de-Bretagne, Rennes Métropole. Default site: lon -1.706499, lat 48.058832, INSEE 35066.

You have LIVE tools for hard French open data (land use, brownfield, power, water, heat), the current computed model, the raw audit trail, and a web_search tool. Use them — do not answer regulatory questions from memory alone.

Method:
- For data-axis questions (zoning, contamination, grid, water, heat), call the matching live tool and ground the answer in what it returns, with the source URL.
- For the discretionary/researchable parts — ICPE rubrique classification (autorisation vs enregistrement vs déclaration), the PLUi règlement rules, permitting timelines — use web_search to verify against the CURRENT nomenclature/règlement and cite the pages you used. Re-derive rather than asserting from memory.
- Use get_feasibility_model to ground statements about the composite, gates, bottleneck, and unresolved items.

Hard rules (non-negotiable):
1. Never fabricate a value, endpoint, rubrique number, or article. If unconfirmed, say so.
2. Never assert the permitting DECISION — it is discretionary. Surface data, risk, and route only.
3. Label forward-looking figures (≈65 MW recoverable heat, closed-loop water draw) as design targets.
4. Grid INJECTION capacity ≠ the 100 MW CONSUMPTION draw — keep them separate.
5. Cite source URLs for fetched facts and web findings.

Be concise and concrete. Prefer short paragraphs and tight bullet lists. End with a one-line note on confidence and any key unresolved item when relevant.`

// ── the manual tool-use loop ────────────────────────────────────────────────
export interface AgentStep {
  type: 'text' | 'tool' | 'search'
  text?: string
  name?: string
  input?: unknown
  resultSummary?: string
  query?: string
}

export interface AgentTurn {
  ok: boolean
  answer: string
  steps: AgentStep[]
  model: string
  usage?: { input: number; output: number }
  error?: string
}

function summarize(result: unknown): string {
  const s = JSON.stringify(result)
  return s.length > 280 ? s.slice(0, 280) + '…' : s
}

export async function runAgent(question: string, useWebSearch = true): Promise<AgentTurn> {
  if (!agentConfigured()) {
    return { ok: false, answer: '', steps: [], model: AGENT_MODEL, error: 'ANTHROPIC_API_KEY not set on the server.' }
  }
  const client = new Anthropic()
  const allTools: any[] = [...TOOL_DEFS]
  if (useWebSearch) allTools.push({ type: 'web_search_20260209', name: 'web_search' })

  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: question }]
  const steps: AgentStep[] = []
  let usageIn = 0, usageOut = 0
  let finalText = ''

  for (let round = 0; round < 8; round++) {
    let resp: Anthropic.Message
    try {
      resp = await client.messages.create({
        model: AGENT_MODEL,
        max_tokens: 6000,
        thinking: { type: 'adaptive' },
        output_config: { effort: 'medium' },
        system: SYSTEM,
        tools: allTools,
        messages,
      } as any)
    } catch (e: any) {
      // If web_search isn't available on this account/model, retry once without it.
      if (useWebSearch && /web_search|tool/i.test(e?.message ?? '')) {
        return runAgent(question, false)
      }
      return { ok: false, answer: finalText, steps, model: AGENT_MODEL, error: e?.message ?? String(e) }
    }

    usageIn += resp.usage?.input_tokens ?? 0
    usageOut += resp.usage?.output_tokens ?? 0
    messages.push({ role: 'assistant', content: resp.content })

    // record text + server web searches
    for (const block of resp.content as any[]) {
      if (block.type === 'text' && block.text?.trim()) {
        steps.push({ type: 'text', text: block.text })
        finalText = block.text
      } else if (block.type === 'server_tool_use' && block.name === 'web_search') {
        steps.push({ type: 'search', query: (block.input as any)?.query })
      }
    }

    if (resp.stop_reason === 'pause_turn') continue // server tool needs continuation

    if (resp.stop_reason === 'tool_use') {
      const toolResults: Anthropic.ToolResultBlockParam[] = []
      for (const block of resp.content as any[]) {
        if (block.type !== 'tool_use') continue
        const fn = (tools as any)[block.name]
        let result: unknown
        try {
          result = fn ? await fn(block.input ?? {}) : { error: `unknown tool ${block.name}` }
        } catch (e: any) {
          result = { error: e?.message ?? String(e) }
        }
        steps.push({ type: 'tool', name: block.name, input: block.input, resultSummary: summarize(result) })
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) })
      }
      messages.push({ role: 'user', content: toolResults })
      continue
    }

    break // end_turn (or other terminal)
  }

  return { ok: true, answer: finalText, steps, model: AGENT_MODEL, usage: { input: usageIn, output: usageOut } }
}
