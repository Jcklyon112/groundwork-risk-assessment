// ─────────────────────────────────────────────────────────────────────────
// Power gate — RTE / Enedis grid-connection register via ODRÉ (keyless).
// Dataset: registre-national-installation-production-stockage-electricite-agrege
//   https://odre.opendatasoft.com/explore/dataset/registre-national-installation-production-stockage-electricite-agrege/
//
// HARD DISTINCTION (CLAUDE.md rule 5): this register is INJECTION capacity —
// production/storage connected per poste source (the S3REnR / Caparéseau world,
// relevant to the campus's OWN generation). The 100 MW CONSUMPTION draw is a
// SEPARATE, non-binding RTE connection study and is NOT in this dataset. We
// record both facts separately and never merge them.
// ─────────────────────────────────────────────────────────────────────────
import { fetchWithRetry, persistRaw, type SiteGeometry } from './_util.ts'

const ODRE =
  'https://odre.opendatasoft.com/api/explore/v2.1/catalog/datasets/' +
  'registre-national-installation-production-stockage-electricite-agrege/records'

export interface PosteAgg {
  postesource: string | null
  connected_kw: number
}

export interface RteResult {
  ok: boolean
  /** poste source(s) serving installations in the site commune */
  communePostes: { postesource: string | null; filiere?: string; puismaxrac_kw?: number; regime?: string; tension?: string }[]
  /** department-wide injection capacity connected per poste source (top) */
  departmentPostes: PosteAgg[]
  injectionNote: string
  consumptionNote: string
  url: { commune: string; department: string }
  fetched_at: string
}

export async function runRte(site: SiteGeometry): Promise<RteResult> {
  const dept = site.insee.slice(0, 2)

  const communeUrl =
    `${ODRE}?where=codeinseecommune%3D%22${site.insee}%22` +
    `&select=nominstallation,filiere,postesource,puismaxrac,regime,tensionraccordement&limit=20`
  const commune = await fetchWithRetry(communeUrl)
  persistRaw('rte_commune', { request: communeUrl, ...commune })

  const deptUrl =
    `${ODRE}?where=codedepartement%3D%22${dept}%22` +
    `&group_by=postesource&select=postesource,sum(puismaxrac)%20as%20puis&order_by=puis%20desc&limit=10`
  const department = await fetchWithRetry(deptUrl)
  persistRaw('rte_department', { request: deptUrl, ...department })

  const communePostes = (commune.json?.results ?? []).map((r: any) => ({
    postesource: r.postesource,
    filiere: r.filiere,
    puismaxrac_kw: r.puismaxrac,
    regime: r.regime,
    tension: r.tensionraccordement,
  }))

  const departmentPostes: PosteAgg[] = (department.json?.results ?? []).map((r: any) => ({
    postesource: r.postesource,
    connected_kw: r.puis,
  }))

  return {
    ok: commune.ok,
    communePostes,
    departmentPostes,
    injectionNote:
      'Values are INJECTION (production/storage) capacity already connected per poste source — ' +
      'the S3REnR/Caparéseau register. This is a non-binding snapshot and relates to the campus’s ' +
      'own generation, NOT to consumption.',
    consumptionNote:
      'The 100 MW consumption draw is a SEPARATE process: an RTE connection study (HTB) for a new ' +
      'large consumer. It is not represented in this injection register and its acceptance/MVA rating ' +
      'at the on-site Poste de La Janais (90 kV, OSM way 182891598) is not publicly confirmed.',
    url: { commune: communeUrl, department: deptUrl },
    fetched_at: commune.fetched_at,
  }
}
