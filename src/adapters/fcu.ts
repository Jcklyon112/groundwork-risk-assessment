// ─────────────────────────────────────────────────────────────────────────
// Heat-offtake gate — France Chaleur Urbaine (ADEME, keyless).
// Doc: https://france-chaleur-urbaine.beta.gouv.fr  (api.gouv.fr listing)
// Endpoint: /api/v1/eligibility?lat=&lon=  → distance to nearest réseau de
// chaleur, network id, gestionnaire, EnR&R rate, CO2 content, eligibility.
// Threshold applied (CLAUDE.md): <100 m strongly connectable, 100–200 m
// feasible; beyond that the gap is a transport-main cost, not a blocker.
// ─────────────────────────────────────────────────────────────────────────
import { fetchWithRetry, persistRaw, haversineM, type SiteGeometry } from './_util.ts'

export interface FcuPoint {
  label: string
  point: [number, number]
  isEligible: boolean
  distance_m: number | null
  network_id: string | null
  network_name: string | null
  gestionnaire: string | null
  rateENRR: number | null
  rateCO2: number | null
  futurNetwork: boolean
  inPDP: boolean
}

export interface FcuResult {
  ok: boolean
  points: FcuPoint[]
  /** straight-line distance from campus to the nearest connectable main found */
  nearestMainDistanceM: number | null
  url: string
  fetched_at: string
}

async function eligibility(label: string, lon: number, lat: number): Promise<{ pt: FcuPoint; raw: any; url: string }> {
  const url = `https://france-chaleur-urbaine.beta.gouv.fr/api/v1/eligibility?lat=${lat}&lon=${lon}`
  const r = await fetchWithRetry(url)
  const j = r.json ?? {}
  return {
    url,
    raw: { request: url, ...r },
    pt: {
      label,
      point: [lon, lat],
      isEligible: !!j.isEligible,
      distance_m: j.distance ?? null,
      network_id: j.id ?? null,
      network_name: j.name ?? null,
      gestionnaire: j.gestionnaire ?? null,
      rateENRR: j.rateENRR ?? null,
      rateCO2: j.rateCO2 ?? null,
      futurNetwork: !!j.futurNetwork,
      inPDP: !!j.inPDP,
    },
  }
}

export async function runFcu(site: SiteGeometry): Promise<FcuResult> {
  // Test the campus point itself, and the website-documented network-link point
  // ~2.7 km north (the nearest main of the Rennes Sud network).
  const NETWORK_LINK: [number, number] = [-1.707566, 48.08444]
  const a = await eligibility('campus centroid', site.centroid[0], site.centroid[1])
  const b = await eligibility('campus point', site.campus_point[0], site.campus_point[1])
  const c = await eligibility('nearest documented main (Rennes Sud link)', NETWORK_LINK[0], NETWORK_LINK[1])

  persistRaw('fcu_centroid', a.raw)
  persistRaw('fcu_campus', b.raw)
  persistRaw('fcu_network_link', c.raw)

  const points = [a.pt, b.pt, c.pt]

  // If the campus point isn't itself eligible, the nearest connectable main is
  // the documented Rennes Sud link — report the straight-line gap to it.
  const eligibleAtSite = a.pt.isEligible || b.pt.isEligible
  const nearestMainDistanceM = eligibleAtSite
    ? 0
    : Math.round(haversineM(site.campus_point, NETWORK_LINK))

  return {
    ok: a.raw.ok || b.raw.ok || c.raw.ok,
    points,
    nearestMainDistanceM,
    url: a.url,
    fetched_at: a.raw.fetched_at,
  }
}
