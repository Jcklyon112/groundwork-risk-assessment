// ─────────────────────────────────────────────────────────────────────────
// ScreenPanel.tsx — any-parcel screening. Type a French address; the backend
// geocodes it (BAN), fetches the five keyless data axes for that point, and
// evaluates them in SCREENING mode. The discretionary/researched gates
// (env-auth classification, PLU/PLUi règlement specifics) are flagged as
// needing per-parcel research rather than carried from La Janais — the honesty
// boundary, made explicit. Same light, black/white + status-colour language.
// ─────────────────────────────────────────────────────────────────────────
import { useState } from 'react'
import { api, type ScreenResult } from '../api/client'
import type { FeasibilityModel, Status } from '../model/types'

const STATUS_COLOR: Record<Status, string> = {
  clear: 'var(--clear)', conditional: 'var(--conditional)', gating: 'var(--gating)',
}
const STATUS_LABEL: Record<Status, string> = { clear: 'Clear', conditional: 'Conditional', gating: 'Gating' }
const verdictStatus = (v: FeasibilityModel['verdict']): Status =>
  v === 'CLEAR' ? 'clear' : v === 'CONDITIONAL' ? 'conditional' : 'gating'

// the two gates whose substance is carried from the reference (not fetched for this parcel)
const RESEARCH_GATES = new Set(['env-auth'])

const EXAMPLES = [
  '2 Rue de la Châtaigneraie, Cesson-Sévigné',
  'Zone industrielle de la Turbanière, Bruz',
  'Aéroport Rennes Bretagne',
]

export default function ScreenPanel() {
  const [address, setAddress] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<ScreenResult | null>(null)

  const run = async (q: string) => {
    const query = q.trim()
    if (!query || busy) return
    setBusy(true); setResult(null)
    try {
      setResult(await api.screen(query))
    } catch (e) {
      setResult({ ok: false, error: String(e) })
    } finally {
      setBusy(false)
    }
  }

  const model = result?.model
  return (
    <div style={S.view}>
      <h2 style={S.viewTitle}>Screen any parcel</h2>
      <p style={S.viewSub}>
        Score any French site for a 100 MW data-centre against the five live data axes — land use,
        brownfield, power, water, heat. The <b>fetchable</b> axes are evaluated live for the point;
        the <b>discretionary</b> gates (ICPE classification, PLU/PLUi règlement specifics) are flagged
        for per-parcel research, never asserted from the La Janais reference.
      </p>

      <div style={S.searchRow}>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') run(address) }}
          placeholder="French address or place — e.g. ZA de la Janais, Chartres-de-Bretagne"
          style={S.input}
        />
        <button onClick={() => run(address)} disabled={busy || !address.trim()} style={{ ...S.go, opacity: busy || !address.trim() ? 0.55 : 1 }}>
          {busy ? '↻ screening…' : 'Screen site'}
        </button>
      </div>
      <div style={S.examples}>
        <span style={S.exLabel}>try:</span>
        {EXAMPLES.map((ex) => (
          <button key={ex} onClick={() => { setAddress(ex); run(ex) }} disabled={busy} style={S.exChip}>{ex}</button>
        ))}
      </div>

      {busy && <div style={S.loading}>Geocoding + fetching the data axes for this parcel…</div>}

      {result && !result.ok && (
        <div style={S.errorBox}><b>Screening failed.</b><p style={{ margin: '6px 0 0', color: 'var(--muted)' }}>{result.error}</p></div>
      )}

      {model && (
        <div style={S.result}>
          {/* banner — the honesty boundary */}
          <div style={S.banner}>
            <span style={S.bannerKicker}>Screening mode</span>
            <p style={S.bannerText}>{model.referenceNote}</p>
            {result?.geocode && (
              <p style={S.geocode}>
                {result.geocode.label} · INSEE {result.geocode.insee} · {result.geocode.lon.toFixed(5)}, {result.geocode.lat.toFixed(5)}
              </p>
            )}
          </div>

          {/* composite */}
          <div style={S.head}>
            <div>
              <div style={S.kLabel}>Composite readiness</div>
              <div style={S.bigPct}>{Math.round(model.composite * 100)}%</div>
              <div style={{ ...S.verdict, color: STATUS_COLOR[verdictStatus(model.verdict)] }}>{model.verdict}</div>
            </div>
            <div style={S.headNote}>
              Risk-weighted across six gates. Two gates ({'env-auth'}) are reference-carried — treat the
              composite as a <i>data-axis screen</i>, not a permitting verdict.
            </div>
          </div>

          {/* gate table */}
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Gate</th>
                <th style={S.th}>Live value</th>
                <th style={S.thR}>Readiness</th>
                <th style={S.th}>Status</th>
                <th style={S.th}>Provenance</th>
              </tr>
            </thead>
            <tbody>
              {model.gates.map((g) => {
                const research = RESEARCH_GATES.has(g.id)
                return (
                  <tr key={g.id}>
                    <td style={S.td}><b>{g.short}</b></td>
                    <td style={{ ...S.td, color: 'var(--muted)', maxWidth: 360 }}>{g.live.value}</td>
                    <td style={S.tdR}>{Math.round(g.readiness * 100)}%</td>
                    <td style={S.td}><span style={{ color: STATUS_COLOR[g.status], fontWeight: 700 }}>{STATUS_LABEL[g.status]}</span></td>
                    <td style={S.td}>
                      <span style={{ ...S.provTag, ...(research ? S.provRef : S.provLive) }}>
                        {research ? 'reference · research' : 'live'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <p style={S.footNote}>
            Footprint is a ~200 m screening square around the geocoded point, not the cadastral parcel.
            Raw responses are written to <span style={S.mono}>cache/raw/screen</span> and do not affect the
            canonical La Janais model.
          </p>
        </div>
      )}
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  view: { maxWidth: 1120, margin: '0 auto', padding: '24px 22px 60px', color: 'var(--ink)' },
  viewTitle: { margin: 0, fontSize: 22, fontWeight: 800 },
  viewSub: { color: 'var(--muted)', fontSize: 14, margin: '6px 0 18px', maxWidth: 880, lineHeight: 1.55 },
  searchRow: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  input: { flex: '1 1 420px', minWidth: 280, border: '1px solid var(--line-strong)', borderRadius: 8, padding: '10px 13px', fontSize: 14, color: 'var(--ink)', background: 'var(--paper)' },
  go: { border: '1px solid var(--ink)', background: 'var(--ink)', color: 'var(--paper)', borderRadius: 8, padding: '10px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer' },
  examples: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 10 },
  exLabel: { fontSize: 12, color: 'var(--muted)' },
  exChip: { fontSize: 12, border: '1px solid var(--line)', background: 'var(--paper)', borderRadius: 999, padding: '4px 10px', cursor: 'pointer', color: 'var(--ink)' },
  loading: { marginTop: 24, color: 'var(--muted)', fontSize: 14 },
  errorBox: { marginTop: 20, border: '1px solid var(--line)', borderLeft: '4px solid var(--gating)', borderRadius: 8, padding: 16, fontSize: 14 },
  result: { marginTop: 22 },
  banner: { border: '1px solid var(--line)', borderLeft: '4px solid var(--ink)', borderRadius: 10, padding: '14px 16px', background: '#fafafa' },
  bannerKicker: { display: 'inline-block', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--muted)', marginBottom: 4 },
  bannerText: { margin: 0, fontSize: 13.5, lineHeight: 1.55, maxWidth: 880 },
  geocode: { margin: '8px 0 0', fontSize: 12, color: 'var(--muted)', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' },
  head: { display: 'flex', alignItems: 'flex-start', gap: 24, marginTop: 20, flexWrap: 'wrap' },
  kLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--muted)' },
  bigPct: { fontSize: 46, fontWeight: 800, lineHeight: 1.05, fontVariantNumeric: 'tabular-nums' },
  verdict: { fontSize: 15, fontWeight: 800, letterSpacing: 0.5 },
  headNote: { flex: '1 1 280px', fontSize: 13, color: 'var(--muted)', lineHeight: 1.55, maxWidth: 460, paddingTop: 6 },
  table: { width: '100%', borderCollapse: 'collapse', marginTop: 20, fontSize: 13 },
  th: { textAlign: 'left', borderBottom: '1px solid var(--line-strong)', padding: '7px 6px', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--muted)' },
  thR: { textAlign: 'right', borderBottom: '1px solid var(--line-strong)', padding: '7px 6px', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--muted)' },
  td: { textAlign: 'left', borderBottom: '1px solid var(--line)', padding: '8px 6px', verticalAlign: 'top' },
  tdR: { textAlign: 'right', borderBottom: '1px solid var(--line)', padding: '8px 6px', fontVariantNumeric: 'tabular-nums', verticalAlign: 'top' },
  provTag: { fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, borderRadius: 3, padding: '2px 7px', whiteSpace: 'nowrap' },
  provLive: { background: 'var(--ink)', color: 'var(--paper)' },
  provRef: { background: 'var(--paper)', color: 'var(--muted)', border: '1px solid var(--line-strong)' },
  footNote: { marginTop: 16, fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 },
  mono: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11.5 },
}
