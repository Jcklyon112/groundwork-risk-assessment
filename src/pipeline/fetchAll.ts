// ─────────────────────────────────────────────────────────────────────────
// src/pipeline/fetchAll.ts — run every keyless adapter against the canonical
// site geometry, persist raw responses (audit trail), and return + write a
// single normalized snapshot for the evaluation step.
//   import { runFetch } from './fetchAll'   → programmatic (used by the server)
//   npm run fetch                           → CLI
// ─────────────────────────────────────────────────────────────────────────
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { loadSite, setRawNamespace, ROOT, type SiteGeometry } from '../adapters/_util.ts'
import { runBan } from '../adapters/ban.ts'
import { runGpu } from '../adapters/gpu.ts'
import { runGeorisques } from '../adapters/georisques.ts'
import { runRte } from '../adapters/rte.ts'
import { runHubeau } from '../adapters/hubeau.ts'
import { runFcu } from '../adapters/fcu.ts'
import { runReglement } from '../adapters/reglement.ts'

export interface Snapshot {
  site: SiteGeometry
  generated_at: string
  ban: any
  gpu: any
  georisques: any
  rte: any
  hubeau: any
  fcu: any
  reglement: any
}

type Logger = (msg: string) => void

export interface FetchOptions {
  /** override the canonical La Janais geometry (screening an arbitrary parcel) */
  site?: SiteGeometry
  /** route the raw audit trail + normalized snapshot into cache/raw/<ns> (screening) */
  namespace?: string
  /** BAN geocode query (screening passes the typed address) */
  banQuery?: string
}

/** Run all adapters; persist raw + normalized; return the snapshot. */
export async function runFetch(log: Logger = () => {}, opts: FetchOptions = {}): Promise<Snapshot> {
  const site = opts.site ?? loadSite()
  if (opts.namespace) setRawNamespace(opts.namespace)
  log(`fetching live data for ${site.commune} (INSEE ${site.insee})`)

  const step = async <T>(name: string, fn: () => Promise<T>): Promise<T | { error: string }> => {
    try {
      const r = await fn()
      log(`  • ${name} … ok`)
      return r
    } catch (e: any) {
      log(`  • ${name} … FAILED: ${e?.message ?? e}`)
      return { error: e?.message ?? String(e) }
    }
  }

  try {
    const [ban, gpu, georisques, rte, hubeau, fcu, reglement] = [
      await step('BAN geocode', () => runBan(site, opts.banQuery)),
      await step('GPU land-use (apicarto)', () => runGpu(site)),
      await step('Géorisques brownfield/soil', () => runGeorisques(site)),
      await step('RTE/ODRÉ power register', () => runRte(site)),
      await step("Hub'Eau water", () => runHubeau(site)),
      await step('France Chaleur Urbaine heat', () => runFcu(site)),
      await step('PLUi règlement graphique (Rennes SIG)', () => runReglement(site)),
    ]

    const snapshot: Snapshot = {
      site,
      generated_at: new Date().toISOString(),
      ban, gpu, georisques, rte, hubeau, fcu, reglement,
    }

    const out = resolve(ROOT, 'cache', opts.namespace ? `${opts.namespace}-normalized.json` : 'normalized.json')
    writeFileSync(out, JSON.stringify(snapshot, null, 2), 'utf8')
    log(`wrote ${out}`)
    return snapshot
  } finally {
    if (opts.namespace) setRawNamespace('') // always restore the canonical namespace
  }
}

// ── CLI ─────────────────────────────────────────────────────────────────────
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) {
  console.log('▶ La Janais feasibility — fetch')
  runFetch((m) => console.log(m))
    .then((snap) => {
      console.log('\n── snapshot summary ──')
      const g = snap.gpu, ge = snap.georisques, rt = snap.rte, hb = snap.hubeau, fc = snap.fcu
      if (g && !g.error) console.log(`  land-use zones: ${g.zones.map((z: any) => z.libelle ?? z.typezone ?? '?').join(', ') || '(none)'}`)
      if (ge && !ge.error) console.log(`  ICPE: ${ge.icpe.count}  CASIAS: ${ge.casias.count}  SIS: ${ge.sis.resolved ? ge.sis.count : 'unresolved'}`)
      if (rt && !rt.error) console.log(`  RTE poste(s): ${rt.communePostes.map((p: any) => p.postesource).filter(Boolean).join(', ') || '(none)'}`)
      if (hb && !hb.error) console.log(`  water withdrawal points: ${hb.prelevements.count}`)
      if (fc && !fc.error) console.log(`  heat nearest main: ${fc.nearestMainDistanceM} m`)
    })
    .catch((e) => { console.error(e); process.exit(1) })
}
