// ─────────────────────────────────────────────────────────────────────────
// App.tsx — the platform shell. Fetches the computed model from the backend
// API at runtime (no build-time import), with loading/error states, a live
// "Refresh data" action (re-runs the keyless adapters server-side), and tabbed
// views: the feasibility instrument, the raw-source audit trail, and the raw
// model JSON. Build out the user platform from here.
// ─────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useState } from 'react'
import Synthesis from './components/Synthesis'
import FeasibilityInstrument from './components/FeasibilityInstrument'
import ScenarioTimeline from './components/ScenarioTimeline'
import SourceExplorer from './components/SourceExplorer'
import { CountUp } from './components/CountUp'
import { api } from './api/client'
import type { FeasibilityModel } from './model/types'

type Tab = 'synthesis' | 'instrument' | 'planner' | 'sources'

export default function App() {
  const [model, setModel] = useState<FeasibilityModel | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('instrument')
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<string | null>(null)
  const [apiUp, setApiUp] = useState<boolean | null>(null)

  const load = useCallback(async () => {
    // api.model() always resolves — it falls back to the bundled model when no backend.
    const m = await api.model()
    setModel(m)
    setError(null)
    // a live backend enables Refresh; otherwise we're on a static snapshot.
    api.health().then(() => setApiUp(true)).catch(() => setApiUp(false))
  }, [])

  useEffect(() => { load() }, [load])

  const doRefresh = useCallback(async () => {
    setRefreshing(true)
    setError(null)
    try {
      const r = await api.refresh()
      if (!r.ok) throw new Error(r.error ?? 'refresh failed')
      setLastRefresh(r.lastRefresh ?? new Date().toISOString())
      await load()
    } catch (e) {
      setError(String(e))
    } finally {
      setRefreshing(false)
    }
  }, [load])

  return (
    <div>
      {/* ── platform app bar ─────────────────────────────────────────── */}
      <div style={S.appbar}>
        <div style={S.brand}>
          <span style={S.brandMark}>◷</span>
          <div>
            <div style={S.brandName}>GROUNDWORK</div>
            <div style={S.brandSub}>Brownfield data-centre deployment · regulatory risk assessment</div>
          </div>
        </div>

        <nav style={S.nav}>
          <TabBtn id="synthesis" tab={tab} setTab={setTab}>Synthesis</TabBtn>
          <TabBtn id="instrument" tab={tab} setTab={setTab}>Instrument</TabBtn>
          <TabBtn id="planner" tab={tab} setTab={setTab}>Scenario &amp; timeline</TabBtn>
          <TabBtn id="sources" tab={tab} setTab={setTab}>Data sources</TabBtn>
        </nav>

        <div style={S.actions}>
          <span style={S.statusDot} title={apiUp ? 'Live backend connected' : 'Serving the computed data snapshot'}>
            <span style={{ ...S.dot, background: apiUp === null ? 'var(--muted)' : apiUp ? 'var(--clear)' : 'var(--ink)' }} />
            {apiUp === null ? 'connecting' : apiUp ? 'live backend' : 'live data snapshot'}
          </span>
          {apiUp && (
            <button onClick={doRefresh} disabled={refreshing} style={{ ...S.refresh, opacity: refreshing ? 0.6 : 1 }}>
              {refreshing ? '↻ refreshing…' : '↻ Refresh data'}
            </button>
          )}
        </div>
      </div>

      {/* ── the goal — stated plainly, pinned to the top of every view ──── */}
      {model && <GoalBanner model={model} />}

      {lastRefresh && (
        <div style={S.refreshNote}>Re-fetched live at {lastRefresh.slice(0, 19).replace('T', ' ')}Z</div>
      )}

      {/* ── body ─────────────────────────────────────────────────────── */}
      {error && !model && (
        <div style={S.errorBox}>
          <b>Cannot reach the backend API.</b>
          <p style={{ margin: '8px 0 0' }}>
            Start it with <code style={S.code}>npm run server</code> (or run both with{' '}
            <code style={S.code}>npm run dev:all</code>), then this view will load.
          </p>
          <p style={{ margin: '8px 0 0', color: 'var(--muted)', fontSize: 13 }}>{error}</p>
          <button onClick={load} style={{ ...S.refresh, marginTop: 12 }}>Retry</button>
        </div>
      )}

      {!error && !model && <div style={S.loading}>Loading feasibility model…</div>}

      {model && (
        <main key={tab} className="rise">
          {tab === 'synthesis' && <Synthesis model={model} />}
          {tab === 'instrument' && <FeasibilityInstrument model={model} />}
          {tab === 'planner' && <ScenarioTimeline model={model} />}
          {tab === 'sources' && (
            <div style={S.view}>
              <h2 style={S.viewTitle}>Data sources — raw API audit trail</h2>
              <p style={S.viewSub}>
                Every value in the instrument traces to one of these raw responses, captured with its
                request URL, HTTP status and <span style={S.mono}>fetched_at</span>. This is the trust layer.
              </p>
              <SourceExplorer />
            </div>
          )}
        </main>
      )}
    </div>
  )
}

function GoalBanner({ model }: { model: FeasibilityModel }) {
  const pct = Math.round(model.composite * 100)
  const vStatus = model.verdict === 'CLEAR' ? 'var(--clear)' : model.verdict === 'CONDITIONAL' ? 'var(--conditional)' : 'var(--gating)'
  const [lon, lat] = model.site.centroid
  const coords = `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(4)}° ${lon >= 0 ? 'E' : 'W'}`
  return (
    <div style={S.goal}>
      <div style={S.goalInner}>
        <div style={S.goalMain}>
          <span style={S.goalKicker}>Deployable brownfield diagnostics — France</span>
          <p style={S.goalText}>
            A framework that runs a live regulatory-risk and permitting diagnostic on any brownfield in
            France, and outputs a tailored consultancy profile.
          </p>

          {/* the chosen target — a swappable input, set apart from the framework copy */}
          <div style={S.targetBox}>
            <div style={S.targetTop}>
              <span style={S.targetLabel}>Running on</span>
              <span style={S.targetSwap}>swappable input</span>
            </div>
            <div style={S.targetName}>{model.site.commune} brownfield</div>
            <div style={S.targetMeta}>{coords}</div>
            <div style={S.targetMeta}>INSEE {model.site.insee} · program: 100 MW data centre</div>
          </div>
        </div>
        <div style={S.goalStanding}>
          <span style={S.standLabel}>Composite readiness</span>
          <div style={S.standRow}>
            <span style={{ ...S.standPct, color: vStatus }}><CountUp value={pct} suffix="%" duration={900} /></span>
            <span style={{ ...S.standVerdict, color: vStatus }}>{model.verdict}</span>
          </div>
          <span style={S.standBottleneck}>
            risk-weighted progress to build-ready · 100% = every gate clearable
          </span>
        </div>
      </div>
    </div>
  )
}

function TabBtn({ id, tab, setTab, children }: { id: Tab; tab: Tab; setTab: (t: Tab) => void; children: React.ReactNode }) {
  const active = tab === id
  return (
    <button onClick={() => setTab(id)} style={{ ...S.tab, ...(active ? S.tabActive : {}) }}>
      {children}
    </button>
  )
}

const S: Record<string, React.CSSProperties> = {
  appbar: { display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap', padding: '12px 24px', borderBottom: '1px solid var(--line-strong)', position: 'sticky', top: 0, background: 'var(--paper)', zIndex: 30 },
  brand: { display: 'flex', alignItems: 'center', gap: 11, marginRight: 'auto' },
  brandMark: { fontSize: 20, color: 'var(--ink)', opacity: 0.85 },
  brandName: { fontWeight: 700, fontSize: 16, letterSpacing: '0.14em', fontFamily: 'var(--font-serif)' },
  brandSub: { fontSize: 11.5, color: 'var(--muted)', letterSpacing: 0, marginTop: 1 },
  nav: { display: 'flex', gap: 2, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 7, padding: 2 },
  tab: { border: '1px solid transparent', background: 'transparent', borderRadius: 5, padding: '6px 13px', fontSize: 13, fontWeight: 500, cursor: 'pointer', color: 'var(--ink-soft)', transition: 'background 160ms ease, color 160ms ease' },
  tabActive: { background: 'var(--paper)', color: 'var(--ink)', fontWeight: 600, borderColor: 'var(--line-strong)' },
  actions: { display: 'flex', alignItems: 'center', gap: 14, marginLeft: 'auto' },
  statusDot: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted)' },
  dot: { width: 7, height: 7, borderRadius: 999, display: 'inline-block' },
  refresh: { border: '1px solid var(--ink)', background: 'var(--ink)', color: 'var(--paper)', borderRadius: 7, padding: '8px 15px', fontSize: 13, fontWeight: 590, cursor: 'pointer', transition: 'opacity 180ms ease' },
  goal: { borderBottom: '1px solid var(--line)' },
  goalInner: { maxWidth: 1120, margin: '0 auto', padding: '22px 24px', display: 'flex', gap: 32, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' },
  goalMain: { flex: '1 1 520px', minWidth: 320 },
  goalKicker: { display: 'inline-block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--faint)', marginBottom: 8 },
  goalText: { margin: 0, fontSize: 16.5, lineHeight: 1.55, color: 'var(--ink-soft)', maxWidth: 720, fontWeight: 400, letterSpacing: '-0.01em' },
  targetBox: { marginTop: 14, display: 'inline-block', minWidth: 320, border: '1px solid var(--line-strong)', borderLeft: '3px solid var(--ink)', borderRadius: 8, padding: '10px 14px', background: 'var(--bg)' },
  targetTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 6 },
  targetLabel: { fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--faint)' },
  targetSwap: { fontSize: 9.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', border: '1px dashed var(--line-strong)', borderRadius: 4, padding: '1px 6px' },
  targetName: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 15, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.01em' },
  targetMeta: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12, color: 'var(--muted)', marginTop: 3 },
  goalStanding: { flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, paddingLeft: 24, borderLeft: '1px solid var(--line)' },
  standLabel: { fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--faint)' },
  standRow: { display: 'flex', alignItems: 'baseline', gap: 8 },
  standPct: { fontSize: 40, fontWeight: 600, lineHeight: 1.02, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', fontFamily: 'var(--font-serif)' },
  standVerdict: { fontSize: 13, fontWeight: 700, letterSpacing: '0.04em' },
  standBottleneck: { fontSize: 12, color: 'var(--muted)', maxWidth: 260, textAlign: 'right', marginTop: 2 },
  refreshNote: { fontSize: 12, color: 'var(--muted)', padding: '8px 24px 0', maxWidth: 1120, margin: '0 auto' },
  errorBox: { maxWidth: 720, margin: '60px auto', border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: 24, fontSize: 15, background: 'var(--paper)', boxShadow: 'var(--shadow-md)' },
  loading: { maxWidth: 1120, margin: '80px auto', textAlign: 'center', color: 'var(--muted)', fontSize: 15 },
  view: { maxWidth: 1120, margin: '0 auto', padding: '32px 24px 72px' },
  viewTitle: { margin: 0, fontSize: 24, fontWeight: 600, letterSpacing: '-0.03em' },
  viewSub: { color: 'var(--muted)', fontSize: 14, margin: '8px 0 22px', maxWidth: 760, lineHeight: 1.6 },
  json: { border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: 18, overflow: 'auto', fontSize: 12, lineHeight: 1.5, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', maxHeight: 640, background: 'var(--paper)', boxShadow: 'var(--shadow-sm)' },
  code: { fontFamily: 'ui-monospace, monospace', background: 'var(--bg)', borderRadius: 6, padding: '2px 6px', fontSize: 13 },
  mono: { fontFamily: 'ui-monospace, monospace', fontSize: 12.5 },
}
