// ─────────────────────────────────────────────────────────────────────────
// Géoportail de l'Urbanisme via API Carto (keyless). Land-use gate.
// Doc: https://apicarto.ign.fr/api/doc/gpu
// Returns: the urbanism document (PLUi partition), the zonage (typezone +
// libelle) intersecting the site, and any surface prescriptions/overlays.
// The règlement RULES (emprise/hauteur/reculs…) are extracted agentically
// (Step 3) — this adapter captures the machine-readable zonage + provenance.
// ─────────────────────────────────────────────────────────────────────────
import { fetchWithRetry, persistRaw, geomParam, type SiteGeometry } from './_util.ts'

export interface GpuZone {
  typezone?: string
  libelle?: string
  libelong?: string
  partition?: string
}

export interface GpuResult {
  ok: boolean
  document?: { partition?: string; count: number }
  zones: GpuZone[]
  prescriptions: { libelle?: string; typepsc?: string }[]
  url: { document: string; zoneUrba: string; prescription: string }
  fetched_at: string
  notes: string[]
}

async function gpuCall(path: string, geom: unknown) {
  const url = `https://apicarto.ign.fr/api/gpu/${path}?geom=${geomParam(geom)}`
  const r = await fetchWithRetry(url)
  return { url, r }
}

export async function runGpu(site: SiteGeometry): Promise<GpuResult> {
  const notes: string[] = []
  // 1) document — the PLUi partition governing the site
  const doc = await gpuCall('document', site.polygon)
  // 2) zone-urba — the zonage; try polygon first, fall back to centroid point
  let zoneCall = await gpuCall('zone-urba', site.polygon)
  if (!zoneCall.r.ok || !zoneCall.r.json?.features?.length) {
    notes.push('zone-urba: polygon returned nothing/failed → retried with centroid point')
    zoneCall = await gpuCall('zone-urba', { type: 'Point', coordinates: site.centroid })
  }
  // 3) prescription-surf — overlay constraints touching the site
  const presc = await gpuCall('prescription-surf', site.polygon)

  persistRaw('gpu_document', { request: doc.url, ...doc.r })
  persistRaw('gpu_zone_urba', { request: zoneCall.url, ...zoneCall.r })
  persistRaw('gpu_prescription_surf', { request: presc.url, ...presc.r })

  const docFeatures = doc.r.json?.features ?? []
  const partition: string | undefined =
    docFeatures[0]?.properties?.partition ?? docFeatures[0]?.properties?.idurba

  const zones: GpuZone[] = (zoneCall.r.json?.features ?? []).map((f: any) => ({
    typezone: f.properties?.typezone,
    libelle: f.properties?.libelle,
    libelong: f.properties?.libelong,
    partition: f.properties?.partition,
  }))

  const prescriptions = (presc.r.json?.features ?? []).map((f: any) => ({
    libelle: f.properties?.libelle,
    typepsc: f.properties?.typepsc,
  }))

  return {
    ok: zones.length > 0,
    document: { partition, count: docFeatures.length },
    zones,
    prescriptions,
    url: { document: doc.url, zoneUrba: zoneCall.url, prescription: presc.url },
    fetched_at: zoneCall.r.fetched_at,
    notes,
  }
}
