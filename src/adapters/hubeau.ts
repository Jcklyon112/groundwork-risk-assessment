// ─────────────────────────────────────────────────────────────────────────
// Water gate — Hub'Eau (keyless), Eaufrance.
// Doc: https://hubeau.eaufrance.fr/page/apis
// Establishes basin context (SDAGE Loire-Bretagne / SAGE Vilaine) and the
// withdrawal points on/near the site (the historic Stellantis groundwater
// abstraction). Captures withdrawal volumes relevant to a closed cooling loop.
// ─────────────────────────────────────────────────────────────────────────
import { fetchWithRetry, persistRaw, type SiteGeometry } from './_util.ts'

export interface PrelevementPoint {
  code_point_prelevement?: string
  nom_point_prelevement?: string
  code_type_milieu?: string
  date_exploitation_debut?: string
  date_exploitation_fin?: string | null
}

export interface HubeauResult {
  ok: boolean
  prelevements: { count: number; points: PrelevementPoint[] }
  riverStations: { count: number; resolved: boolean; note: string }
  url: { prelevements: string }
  fetched_at: string
}

const HUB = 'https://hubeau.eaufrance.fr/api'

export async function runHubeau(site: SiteGeometry): Promise<HubeauResult> {
  // Withdrawal points in the site commune (groundwater / surface)
  const prelUrl =
    `${HUB}/v1/prelevements/referentiel/points_prelevement?code_commune_insee=${site.insee}&size=20`
  const prel = await fetchWithRetry(prelUrl)
  persistRaw('hubeau_prelevements', { request: prelUrl, ...prel })

  // River water-quality stations in the commune (basin context). This endpoint
  // can return 503 under maintenance — record the gap rather than fail.
  const riverUrl = `${HUB}/v2/qualite_rivieres/station_pc?code_commune=${site.insee}&size=10`
  const river = await fetchWithRetry(riverUrl, { retries: 2 })
  persistRaw('hubeau_qualite_rivieres', { request: riverUrl, ...river })

  const points: PrelevementPoint[] = (prel.json?.data ?? []).map((d: any) => ({
    code_point_prelevement: d.code_point_prelevement,
    nom_point_prelevement: d.nom_point_prelevement,
    code_type_milieu: d.code_type_milieu,
    date_exploitation_debut: d.date_exploitation_debut,
    date_exploitation_fin: d.date_exploitation_fin,
  }))

  return {
    ok: prel.ok,
    prelevements: { count: prel.json?.count ?? points.length, points },
    riverStations: {
      count: river.json?.count ?? 0,
      resolved: river.ok,
      note: river.ok
        ? 'qualite_rivieres station_pc resolved'
        : `qualite_rivieres unavailable at fetch time (status ${river.status}); basin context from SDAGE Loire-Bretagne / SAGE Vilaine instead.`,
    },
    url: { prelevements: prelUrl },
    fetched_at: prel.fetched_at,
  }
}
