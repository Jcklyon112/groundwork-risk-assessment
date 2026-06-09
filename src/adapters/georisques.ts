// ─────────────────────────────────────────────────────────────────────────
// Géorisques (keyless). Brownfield & soil gate.
// Doc: https://api.gouv.fr/les-api/api-georisques
// Pulls, around the site: ICPE installations (incl. the Stellantis/Citroën
// legacy), and CASIAS/BASIAS legacy industrial sites (sites & sols pollués).
// SIS (Secteurs d'Information sur les Sols) is attempted across candidate
// paths and recorded as a gap if none of the tested endpoints resolves.
// ─────────────────────────────────────────────────────────────────────────
import { fetchWithRetry, persistRaw, type SiteGeometry } from './_util.ts'

export interface IcpeRecord {
  raisonSociale?: string
  commune?: string
  codeInsee?: string
  regime?: string
  etatActivite?: string
  statutSeveso?: string
  prioriteNationale?: boolean
  industrie?: boolean
  longitude?: number
  latitude?: number
}

export interface CasiasRecord {
  identifiant_casias?: string
  nom_etablissement?: string
  adresse?: string
  statut?: string
  nom_commune?: string
}

export interface GeorisquesResult {
  ok: boolean
  icpe: { count: number; records: IcpeRecord[] }
  casias: { count: number; records: CasiasRecord[] }
  sis: { resolved: boolean; count: number; endpoint?: string; note: string }
  url: { icpe: string; casias: string }
  fetched_at: string
}

const G = 'https://www.georisques.gouv.fr/api/v1'

export async function runGeorisques(site: SiteGeometry): Promise<GeorisquesResult> {
  const [lon, lat] = site.centroid
  const latlon = `${lon}%2C${lat}`

  // ICPE within 2 km of the site centroid (captures the Stellantis plant)
  const icpeUrl = `${G}/installations_classees?latlon=${latlon}&rayon=2000&page=1&page_size=20`
  const icpe = await fetchWithRetry(icpeUrl)
  persistRaw('georisques_icpe', { request: icpeUrl, ...icpe })

  // CASIAS / BASIAS legacy industrial sites within 2 km
  const casiasUrl = `${G}/ssp/casias?latlon=${latlon}&rayon=2000&page=1&page_size=30`
  const casias = await fetchWithRetry(casiasUrl)
  persistRaw('georisques_casias', { request: casiasUrl, ...casias })

  // SIS — try candidate endpoints; record which (if any) resolves.
  const sisCandidates = [
    `${G}/sis?latlon=${latlon}&rayon=3000&page_size=10`,
    `${G}/ssp/sis?latlon=${latlon}&rayon=3000&page_size=10`,
    `${G}/sis/sis?code_insee=${site.insee}&page_size=10`,
  ]
  let sis = { resolved: false, count: 0, endpoint: undefined as string | undefined, note: '' }
  for (const u of sisCandidates) {
    const r = await fetchWithRetry(u, { retries: 1 })
    if (r.ok && r.json) {
      persistRaw('georisques_sis', { request: u, ...r })
      sis = {
        resolved: true,
        count: r.json.results ?? r.json.data?.length ?? 0,
        endpoint: u,
        note: 'SIS endpoint resolved',
      }
      break
    }
  }
  if (!sis.resolved) {
    sis.note =
      'Brownfield coverage from ICPE + CASIAS/BASIAS; confirm any SIS (Secteurs d’Information sur les Sols) over the parcels on the Géorisques portal.'
    persistRaw('georisques_sis', { request: sisCandidates, resolved: false, note: sis.note })
  }

  const icpeRecords: IcpeRecord[] = (icpe.json?.data ?? []).map((d: any) => ({
    raisonSociale: d.raisonSociale,
    commune: d.commune,
    codeInsee: d.codeInsee,
    regime: d.regime,
    etatActivite: d.etatActivite,
    statutSeveso: d.statutSeveso,
    prioriteNationale: d.prioriteNationale,
    industrie: d.industrie,
    longitude: d.longitude,
    latitude: d.latitude,
  }))
  const casiasRecords: CasiasRecord[] = (casias.json?.data ?? []).map((d: any) => ({
    identifiant_casias: d.identifiant_casias,
    nom_etablissement: d.nom_etablissement,
    adresse: d.adresse,
    statut: d.statut,
    nom_commune: d.nom_commune,
  }))

  return {
    ok: icpe.ok,
    icpe: { count: icpe.json?.results ?? icpeRecords.length, records: icpeRecords },
    casias: { count: casias.json?.results ?? casiasRecords.length, records: casiasRecords },
    sis,
    url: { icpe: icpeUrl, casias: casiasUrl },
    fetched_at: icpe.fetched_at,
  }
}
