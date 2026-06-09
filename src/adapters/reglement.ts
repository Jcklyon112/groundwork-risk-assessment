// ─────────────────────────────────────────────────────────────────────────
// Règlement graphique reads (Rennes Métropole open data, keyless). Resolves the
// PLUi graphic prescription VALUES at the parcel that the national GPU export
// leaves blank: the height plan, the coefficient de végétalisation (biotope),
// the parking sector, and OAP coverage. Queries the three thematic datasets on
// data.rennesmetropole.fr by point (v1 geofilter.distance = contains/touches).
//   Step 3 (CLAUDE.md): "read the règlement graphique at the parcel."
// ─────────────────────────────────────────────────────────────────────────
import { fetchWithRetry, persistRaw, type SiteGeometry } from './_util.ts'

const V1 = 'https://data.rennesmetropole.fr/api/records/1.0/search'
const DS = {
  hauteur: 'plui-de-rennes-metropole-plan-thematique-du-reglement-des-hauteurs',
  vegetalisation: 'plui-de-rennes-metropole-plan-thematique-des-regles-du-coefficient-de-vegetalisa',
  stationnement: 'plui-de-rennes-metropole-plan-thematique-stationnement',
}

export interface ReglementResult {
  ok: boolean
  hauteur: { code?: string; label: string; etiquette?: string } | null
  biotope: { code?: string; label: string; pleineTerre?: string; bonus?: string } | null
  stationnement: { secteur?: string; reglesParticulieres?: string; label: string } | null
  oap: boolean
  url: Record<string, string>
  fetched_at: string
  notes: string[]
}

const isRL = (s: unknown) => /(^|_)rl$/i.test(String(s ?? ''))

/** Query one thematic dataset for the polygon(s) containing the point. */
async function atPoint(dataset: string, lon: number, lat: number, r = 10) {
  const url = `${V1}/?dataset=${dataset}&geofilter.distance=${lat}%2C${lon}%2C${r}&rows=5`
  const res = await fetchWithRetry(url, { retries: 2 })
  const records = (res.json?.records ?? []).map((x: any) => x.fields)
  return { url, records }
}

export async function runReglement(site: SiteGeometry): Promise<ReglementResult> {
  const [lon, lat] = site.campus_point
  const notes: string[] = []
  const url: Record<string, string> = {}

  const [h, v, s] = [
    await atPoint(DS.hauteur, lon, lat),
    await atPoint(DS.vegetalisation, lon, lat),
    await atPoint(DS.stationnement, lon, lat),
  ]
  url.hauteur = h.url; url.vegetalisation = v.url; url.stationnement = s.url
  persistRaw('reglement_hauteur', { request: h.url, records: h.records })
  persistRaw('reglement_vegetalisation', { request: v.url, records: v.records })
  persistRaw('reglement_stationnement', { request: s.url, records: s.records })

  // ── height ────────────────────────────────────────────────────────────────
  const hf = h.records[0]
  const hauteur = hf
    ? {
        code: hf.semio ?? hf.etiquette,
        etiquette: hf.etiquette,
        label: isRL(hf.semio)
          ? 'Renvoi au règlement littéral (zone UI1 — gabarit 3,5 m + 45° aux limites; pas de plafond métrique au plan graphique)'
          : `Étiquette graphique : ${hf.etiquette ?? hf.semio}`,
      }
    : null

  // ── végétalisation / biotope (+ OAP detection across overlapping polygons) ──
  const oap = v.records.some((f: any) => /oap/i.test(String(f.etiquette ?? '')))
  const vf = v.records.find((f: any) => f.surf_min_ecoamenagee != null || /^\d+$/.test(String(f.semio ?? '')) || isRL(f.semio))
  const biotope = vf
    ? {
        code: vf.surf_min_ecoamenagee ?? vf.semio,
        pleineTerre: vf.surf_min_pleine_terre ?? undefined,
        bonus: vf.bonus ?? undefined,
        label: isRL(vf.surf_min_ecoamenagee) || isRL(vf.semio)
          ? 'Renvoi au règlement littéral'
          : `${vf.semio}% de surface éco-aménageable${vf.surf_min_pleine_terre ? ` · ${vf.surf_min_pleine_terre}% pleine terre` : ''}${vf.bonus ? ` · bonus ${vf.bonus}` : ''}`,
      }
    : null

  // ── stationnement ───────────────────────────────────────────────────────────
  const sf = s.records[0]
  const secteur = sf?.semio ? String(sf.semio).replace(/^station_/i, '').toUpperCase() : undefined
  const stationnement = sf
    ? { secteur, reglesParticulieres: sf.regles_particulieres, label: `Secteur ${secteur ?? '?'}${sf.regles_particulieres ? ` · règles particulières ${sf.regles_particulieres}` : ''}` }
    : null

  if (!hf && !vf && !sf) notes.push('No thematic-plan polygon returned at the campus point; widen the radius or confirm the point.')

  return {
    ok: !!(hauteur || biotope || stationnement),
    hauteur, biotope, stationnement, oap, url,
    fetched_at: h.records.length || v.records.length || s.records.length ? new Date().toISOString() : new Date().toISOString(),
    notes,
  }
}
