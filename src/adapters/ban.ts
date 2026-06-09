// ─────────────────────────────────────────────────────────────────────────
// Base Adresse Nationale (BAN) — keyless geocode. Upstream helper used to
// resolve the commune INSEE (citycode) and a representative point.
// Doc: https://adresse.data.gouv.fr/api-doc/adresse
// ─────────────────────────────────────────────────────────────────────────
import { fetchWithRetry, persistRaw, type SiteGeometry } from './_util.ts'

export interface BanResult {
  ok: boolean
  query: string
  label?: string
  citycode?: string
  city?: string
  point?: [number, number]
  score?: number
  url: string
  fetched_at: string
  error?: string
}

export async function runBan(site: SiteGeometry, query?: string): Promise<BanResult> {
  const q = query ?? 'La Janais Chartres-de-Bretagne'
  const url = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&limit=1`
  const r = await fetchWithRetry(url)
  persistRaw('ban', { request: url, ...r })
  if (!r.ok || !r.json?.features?.length) {
    return { ok: false, query: q, url, fetched_at: r.fetched_at, error: r.error ?? 'no features' }
  }
  const f = r.json.features[0]
  return {
    ok: true,
    query: q,
    label: f.properties.label,
    citycode: f.properties.citycode,
    city: f.properties.city,
    point: f.geometry.coordinates,
    score: f.properties.score,
    url,
    fetched_at: r.fetched_at,
  }
}
