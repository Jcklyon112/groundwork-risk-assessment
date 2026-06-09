// ─────────────────────────────────────────────────────────────────────────
// SourceExplorer.tsx — the trust layer. One row per live source: the actual API
// endpoint it draws from is the primary, clickable link; the raw response code
// sits in a dropdown underneath, revealed only on request.
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react'
import { api, type SourceMeta } from '../api/client'

const PRETTY: Record<string, string> = {
  ban: 'Base Adresse Nationale — geocode',
  gpu_document: 'Géoportail de l’Urbanisme — document',
  gpu_zone_urba: 'Géoportail de l’Urbanisme — zonage',
  gpu_prescription_surf: 'Géoportail de l’Urbanisme — prescriptions',
  georisques_icpe: 'Géorisques — ICPE installations',
  georisques_casias: 'Géorisques — CASIAS / BASIAS',
  georisques_sis: 'Géorisques — SIS (sols pollués)',
  rte_commune: 'RTE / ODRÉ — commune register',
  rte_department: 'RTE / ODRÉ — department poste capacity',
  hubeau_prelevements: "Hub'Eau — withdrawal points",
  hubeau_qualite_rivieres: "Hub'Eau — river quality",
  fcu_centroid: 'France Chaleur Urbaine — centroid',
  fcu_campus: 'France Chaleur Urbaine — campus',
  fcu_network_link: 'France Chaleur Urbaine — nearest network',
  reglement_hauteur: 'Rennes Métropole — plan thématique hauteurs',
  reglement_vegetalisation: 'Rennes Métropole — plan thématique végétalisation',
  reglement_stationnement: 'Rennes Métropole — plan thématique stationnement',
}

// the portal/home each endpoint belongs to, for the "provider" label
const PROVIDER = (name: string): string => {
  if (name.startsWith('gpu')) return 'apicarto.ign.fr'
  if (name.startsWith('georisques')) return 'georisques.gouv.fr'
  if (name.startsWith('rte')) return 'odre.opendatasoft.com'
  if (name.startsWith('hubeau')) return 'hubeau.eaufrance.fr'
  if (name.startsWith('fcu')) return 'france-chaleur-urbaine.beta.gouv.fr'
  if (name.startsWith('reglement')) return 'data.rennesmetropole.fr'
  if (name === 'ban') return 'api-adresse.data.gouv.fr'
  return ''
}

export default function SourceExplorer() {
  const [sources, setSources] = useState<SourceMeta[] | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [raw, setRaw] = useState<Record<string, unknown>>({})
  const [loading, setLoading] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    api.sources()
      .then((r) => setSources(r.sources.filter((s) => s.name !== 'ssr' && s.name !== 'server')))
      .catch((e) => setErr(String(e)))
  }, [])

  function toggle(name: string) {
    if (open === name) { setOpen(null); return }
    setOpen(name)
    if (raw[name] === undefined) {
      setLoading(name)
      api.source(name)
        .then((d) => setRaw((m) => ({ ...m, [name]: d })))
        .catch((e) => setErr(String(e)))
        .finally(() => setLoading(null))
    }
  }

  if (err) return <div style={{ padding: 20, color: 'var(--gating)' }}>Failed to load sources: {err}</div>
  if (!sources) return <div style={{ padding: 20, color: 'var(--muted)' }}>Loading sources…</div>

  return (
    <div style={S.list}>
      {sources.map((s) => {
        const isOpen = open === s.name
        return (
          <div key={s.name} className="gw-row" style={S.row}>
            <div style={S.rowMain}>
              <div style={S.rowText}>
                <div style={S.name}>{PRETTY[s.name] ?? s.name}</div>
                {/* the live link — where the data is drawn from */}
                {s.request ? (
                  <a href={s.request} target="_blank" rel="noreferrer" style={S.link} title={s.request}>
                    ↗ {PROVIDER(s.name) || 'open endpoint'} <span style={S.linkUrl}>{s.request}</span>
                  </a>
                ) : (
                  <span style={S.muted}>no request URL recorded</span>
                )}
              </div>
              <div style={S.rowMeta}>
                {s.status != null && (
                  <span style={{ ...S.badge, color: s.status === 200 ? 'var(--clear)' : 'var(--gating)', borderColor: s.status === 200 ? 'var(--clear)' : 'var(--gating)' }}>
                    {s.status === 200 ? 'live' : s.status}
                  </span>
                )}
                {s.fetched_at && <span style={S.when}>{s.fetched_at.slice(0, 16).replace('T', ' ')}</span>}
                <button onClick={() => toggle(s.name)} style={S.codeToggle}>
                  {isOpen ? 'Hide code ▴' : 'Raw response ▾'}
                </button>
              </div>
            </div>

            {isOpen && (
              <pre style={S.pre}>
                {loading === s.name ? 'Loading…' : typeof raw[s.name] === 'string' ? (raw[s.name] as string) : JSON.stringify(raw[s.name] ?? {}, null, 2)}
              </pre>
            )}
          </div>
        )
      })}
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  list: { border: '1px solid var(--line)', borderRadius: 'var(--radius)', overflow: 'hidden' },
  row: { borderBottom: '1px solid var(--line)' },
  rowMain: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, padding: '14px 16px', flexWrap: 'wrap' },
  rowText: { minWidth: 0, flex: '1 1 420px' },
  name: { fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em' },
  link: { display: 'inline-block', marginTop: 5, fontSize: 12.5, color: 'var(--ink)', textDecoration: 'none', wordBreak: 'break-all' },
  linkUrl: { color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: 11.5 },
  muted: { fontSize: 12, color: 'var(--faint)', marginTop: 5, display: 'inline-block' },
  rowMeta: { display: 'flex', alignItems: 'center', gap: 12, flex: '0 0 auto' },
  badge: { fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', border: '1px solid', borderRadius: 999, padding: '1px 8px' },
  when: { fontSize: 11.5, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' },
  codeToggle: { border: '1px solid var(--line-strong)', background: 'var(--paper)', borderRadius: 7, padding: '5px 11px', fontSize: 12, fontWeight: 590, cursor: 'pointer', color: 'var(--ink)', whiteSpace: 'nowrap' },
  pre: { margin: 0, padding: 16, overflow: 'auto', fontSize: 12, lineHeight: 1.5, fontFamily: 'var(--font-mono)', maxHeight: 460, borderTop: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink-soft)' },
}
