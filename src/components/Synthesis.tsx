// ─────────────────────────────────────────────────────────────────────────
// Synthesis.tsx — the partner-level deliverable, answer-first (pyramid): the
// recommendation, the value at stake, the few moves that matter, the risk
// register with de-risking levers (what to HIT), the sequenced roadmap, and the
// regulatory tailwinds. Reads the cited playbook; nothing asserts an outcome.
// ─────────────────────────────────────────────────────────────────────────
import type { FeasibilityModel, Status } from '../model/types'
import { CountUp } from './CountUp'
import { Fr } from './Fr'
import {
  RECOMMENDATION, VALUE_AT_STAKE, MOVES, RISK_REGISTER, ROADMAP, TAILWINDS, TIMELINE_EVIDENCE, SOURCES,
} from '../model/playbook'

const STATUS_COLOR: Record<Status, string> = {
  clear: 'var(--clear)', conditional: 'var(--conditional)', gating: 'var(--gating)',
}
const verdictStatus = (v: FeasibilityModel['verdict']): Status =>
  v === 'CLEAR' ? 'clear' : v === 'CONDITIONAL' ? 'conditional' : 'gating'

function Cite({ k }: { k?: string }) {
  const s = SOURCES.find((x) => x.key === k)
  if (!s) return null
  return <a href={s.url} target="_blank" rel="noreferrer" style={S.cite} title={s.label}>↗</a>
}

export default function Synthesis({ model }: { model: FeasibilityModel }) {
  const vColor = STATUS_COLOR[verdictStatus(model.verdict)]
  const pct = Math.round(model.composite * 100)
  return (
    <div style={S.view}>
      {/* ── recommendation (answer first) ───────────────────────────── */}
      <section style={S.hero}>
        <div style={S.heroMain}>
          <span style={S.kicker}>Recommendation</span>
          <h1 style={S.stance}>
            {RECOMMENDATION.stance}
            <span style={{ ...S.stanceDot, background: vColor }} />
          </h1>
          <p style={S.oneLiner}><Fr t={RECOMMENDATION.oneLiner} /></p>
          <ul style={S.rationale}>
            {RECOMMENDATION.rationale.map((r, i) => (
              <li key={i} style={S.rationaleLi}><span style={S.marker}>—</span><Fr t={r} /></li>
            ))}
          </ul>
        </div>
        <div style={S.heroStat}>
          <span style={S.heroStatLabel}>Composite readiness</span>
          <div style={{ ...S.heroPct, color: vColor }}><CountUp value={pct} suffix="%" duration={900} /></div>
          <span style={{ ...S.heroVerdict, color: vColor }}>{model.verdict}</span>
        </div>
      </section>

      {/* ── value at stake ──────────────────────────────────────────── */}
      <div style={S.stats}>
        {VALUE_AT_STAKE.map((s, i) => (
          <div key={i} style={S.stat}>
            <span style={S.statLabel}>{s.label}</span>
            <div style={S.statValue}>{s.value} <Cite k={s.src} /></div>
            <span style={S.statSub}><Fr t={s.sub} /></span>
          </div>
        ))}
      </div>

      {/* ── the moves that matter ───────────────────────────────────── */}
      <Section title="The moves that matter" sub="No-regret actions, sequenced to protect the critical path.">
        <div style={S.moves}>
          {MOVES.map((m) => (
            <div key={m.n} style={S.move}>
              <div style={S.moveHead}>
                <span style={S.moveNum}>{m.n}</span>
                <span style={S.moveTitle}><Fr t={m.title} /> <Cite k={m.src} /></span>
              </div>
              <p style={S.moveWhy}><Fr t={m.why} /></p>
              <div style={S.moveFoot}>
                <span style={S.chip}>{m.gate}</span>
                <span style={S.horizon}>{m.horizon}</span>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── risk register (what to hit) ─────────────────────────────── */}
      <Section title="Risk register" sub="Each gate, its principal de-risking lever, owner, timing, and effect.">
        <div style={S.tableWrap}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Gate</th>
                <th style={S.th}>Risk</th>
                <th style={S.th}>De-risking lever — what to hit</th>
                <th style={S.th}>Owner</th>
                <th style={S.thC}>When</th>
                <th style={S.th}>Effect</th>
              </tr>
            </thead>
            <tbody>
              {RISK_REGISTER.map((r, i) => (
                <tr key={i}>
                  <td style={S.td}>
                    <span style={{ ...S.sev, background: STATUS_COLOR[r.severity] }} />
                    <b>{r.gate}</b>
                  </td>
                  <td style={S.tdMuted}><Fr t={r.risk} /><div style={S.driver}><Fr t={r.driver} /></div></td>
                  <td style={S.tdLever}><Fr t={r.lever} /> <Cite k={r.src} /></td>
                  <td style={S.tdMuted}>{r.owner}</td>
                  <td style={S.tdC}>{r.horizon}</td>
                  <td style={S.tdMuted}><Fr t={r.effect} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* ── roadmap ─────────────────────────────────────────────────── */}
      <Section title="Sequenced roadmap" sub="Actions to start ahead of the investment decision. Seasonal and long-lead items cannot be recovered later.">
        <div style={S.roadmap}>
          {ROADMAP.map((p, i) => (
            <div key={i} style={S.phase}>
              <div style={S.phaseHead}>
                <span style={S.phaseWindow}>{p.window}</span>
                <span style={S.phaseTitle}>{p.title}</span>
              </div>
              <ul style={S.phaseList}>
                {p.actions.map((a, j) => (
                  <li key={j} style={S.phaseLi}><span style={S.marker}>·</span><Fr t={a} /></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      {/* ── tailwinds ───────────────────────────────────────────────── */}
      <Section title="Regulatory tailwinds" sub="Recent reforms shorten both gating items. They reward only complete dossiers filed early.">
        <div style={S.tailwinds}>
          {TAILWINDS.map((t, i) => (
            <div key={i} style={S.tail}>
              <div style={S.tailTitle}><Fr t={t.title} /> <Cite k={t.src} /></div>
              <p style={S.tailDetail}><Fr t={t.detail} /></p>
            </div>
          ))}
        </div>
      </Section>

      {/* ── timeline evidence ───────────────────────────────────────── */}
      <Section title="Timeline evidence" sub="Each schedule band traced to a government objective, regulatory deadline, or comparable build.">
        <div style={S.tailwinds}>
          {TIMELINE_EVIDENCE.map((e, i) => (
            <div key={i} style={S.tail}>
              <div style={S.tailTitle}>{e.item} <Cite k={e.src} /></div>
              <p style={S.tailDetail}><Fr t={e.basis} /></p>
            </div>
          ))}
        </div>
      </Section>

      {/* ── methodology ─────────────────────────────────────────────── */}
      <section style={S.method}>
        <span style={S.sourcesLabel}>Methodology &amp; data provenance</span>
        <p style={S.methodText}>
          Six data axes are fetched live, per parcel, from named French open APIs — land use (Géoportail de
          l’Urbanisme / IGN), brownfield (Géorisques), grid (RTE/ODRÉ), water (Hub’Eau), heat (France Chaleur
          Urbaine), with the PLUi graphic plans read from the Rennes Métropole open-data portal. Every fetched
          value carries its source URL and timestamp (see Data sources). Regulatory classifications and timelines
          are cited to government, legal, or industry sources below. Forward-looking figures (capex per MW,
          offtake volumes) are planning ranges with the basis stated above, not measured values.
        </p>
      </section>

      {/* ── sources ─────────────────────────────────────────────────── */}
      <section style={S.sources}>
        <span style={S.sourcesLabel}>Sources</span>
        <div style={S.sourcesList}>
          {SOURCES.map((s) => (
            <a key={s.key} href={s.url} target="_blank" rel="noreferrer" style={S.sourceLink}>{s.label}</a>
          ))}
        </div>
        <p style={S.disclaimer}>
          The permitting decision rests with the authorities; this assessment sets out the route and the
          levers to secure it. Forward-looking figures (capex per MW, offtake volumes) are planning ranges.
        </p>
      </section>
    </div>
  )
}

function Section({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <section style={S.section}>
      <h2 style={S.h2}>{title}</h2>
      <p style={S.sectionSub}>{sub}</p>
      {children}
    </section>
  )
}

const S: Record<string, React.CSSProperties> = {
  view: { maxWidth: 1120, margin: '0 auto', padding: '32px 24px 80px', color: 'var(--ink)' },

  hero: { display: 'flex', gap: 32, alignItems: 'stretch', flexWrap: 'wrap', border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)', padding: 28, background: 'var(--paper)', boxShadow: 'var(--shadow-md)' },
  heroMain: { flex: '1 1 520px', minWidth: 320 },
  kicker: { display: 'inline-block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--faint)', marginBottom: 10 },
  stance: { margin: 0, fontSize: 38, fontWeight: 600, letterSpacing: '-0.035em', display: 'flex', alignItems: 'center', gap: 12 },
  stanceDot: { width: 12, height: 12, borderRadius: 999, display: 'inline-block' },
  oneLiner: { margin: '12px 0 0', fontSize: 17, lineHeight: 1.55, color: 'var(--ink-soft)', maxWidth: 640, letterSpacing: '-0.01em' },
  rationale: { margin: '16px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7 },
  rationaleLi: { fontSize: 13.5, lineHeight: 1.5, color: 'var(--muted)' },
  marker: { color: 'var(--faint)', marginRight: 8 },
  heroStat: { flex: '0 0 auto', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-end', paddingLeft: 28, borderLeft: '1px solid var(--line)', minWidth: 150 },
  heroStatLabel: { fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--faint)' },
  heroPct: { fontSize: 66, fontWeight: 600, lineHeight: 1, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums', margin: '6px 0 2px', fontFamily: 'var(--font-serif)' },
  heroVerdict: { fontSize: 14, fontWeight: 700, letterSpacing: '0.04em' },

  stats: { display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 16 },
  stat: { flex: '1 1 240px', minWidth: 220, border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: '16px 18px', background: 'var(--paper)', boxShadow: 'var(--shadow-sm)' },
  statLabel: { fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--faint)' },
  statValue: { fontSize: 23, fontWeight: 600, margin: '7px 0 4px', letterSpacing: '-0.01em', fontFamily: 'var(--font-serif)' },
  statSub: { fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.45 },

  section: { marginTop: 40 },
  h2: { margin: 0, fontSize: 21, fontWeight: 600, letterSpacing: '-0.02em' },
  sectionSub: { margin: '7px 0 18px', fontSize: 14, color: 'var(--muted)', maxWidth: 820, lineHeight: 1.55 },

  moves: { display: 'flex', gap: 14, flexWrap: 'wrap' },
  move: { flex: '1 1 240px', minWidth: 240, border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: 18, background: 'var(--paper)', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column' },
  moveHead: { display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 8 },
  moveNum: { flex: '0 0 auto', width: 24, height: 24, borderRadius: 999, background: 'var(--ink)', color: 'var(--paper)', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  moveTitle: { fontSize: 14.5, fontWeight: 600, lineHeight: 1.3, letterSpacing: '-0.01em' },
  moveWhy: { fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.55, margin: '0 0 14px', flex: 1 },
  moveFoot: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  chip: { fontSize: 11, fontWeight: 600, color: 'var(--muted)', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 999, padding: '2px 9px' },
  horizon: { fontSize: 11.5, fontWeight: 600, color: 'var(--ink)' },

  tableWrap: { border: '1px solid var(--line)', borderRadius: 'var(--radius)', overflow: 'hidden', background: 'var(--paper)', boxShadow: 'var(--shadow-sm)' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { textAlign: 'left', padding: '11px 14px', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--faint)', fontWeight: 600, borderBottom: '1px solid var(--line)', background: 'var(--bg)' },
  thC: { textAlign: 'center', padding: '11px 10px', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--faint)', fontWeight: 600, borderBottom: '1px solid var(--line)', background: 'var(--bg)' },
  td: { padding: '12px 14px', borderBottom: '1px solid var(--line)', verticalAlign: 'top', whiteSpace: 'nowrap' },
  tdMuted: { padding: '12px 14px', borderBottom: '1px solid var(--line)', verticalAlign: 'top', color: 'var(--muted)', maxWidth: 200 },
  tdLever: { padding: '12px 14px', borderBottom: '1px solid var(--line)', verticalAlign: 'top', color: 'var(--ink-soft)', fontWeight: 500, maxWidth: 320, lineHeight: 1.5 },
  tdC: { padding: '12px 10px', borderBottom: '1px solid var(--line)', verticalAlign: 'top', textAlign: 'center', color: 'var(--ink-soft)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' },
  sev: { width: 8, height: 8, borderRadius: 999, display: 'inline-block', marginRight: 8, verticalAlign: 'middle' },
  driver: { fontSize: 11.5, color: 'var(--faint)', marginTop: 3, whiteSpace: 'normal' },

  roadmap: { display: 'flex', gap: 14, flexWrap: 'wrap' },
  phase: { flex: '1 1 280px', minWidth: 260, border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: 18, background: 'var(--paper)', boxShadow: 'var(--shadow-sm)' },
  phaseHead: { display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid var(--line)' },
  phaseWindow: { fontSize: 11, fontWeight: 700, color: 'var(--ink)', letterSpacing: '0.02em' },
  phaseTitle: { fontSize: 12.5, color: 'var(--muted)' },
  phaseList: { margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 9 },
  phaseLi: { fontSize: 13, lineHeight: 1.5, color: 'var(--ink-soft)' },

  tailwinds: { display: 'flex', flexDirection: 'column', gap: 0, border: '1px solid var(--line)', borderRadius: 'var(--radius)', overflow: 'hidden', background: 'var(--paper)', boxShadow: 'var(--shadow-sm)' },
  tail: { padding: '14px 18px', borderBottom: '1px solid var(--line)' },
  tailTitle: { fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em' },
  tailDetail: { margin: '4px 0 0', fontSize: 13, color: 'var(--muted)', lineHeight: 1.5, maxWidth: 880 },

  method: { marginTop: 40, border: '1px solid var(--line)', borderLeft: '3px solid var(--ink)', borderRadius: 'var(--radius)', padding: '16px 18px', background: 'var(--bg)' },
  methodText: { margin: '8px 0 0', fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.6, maxWidth: 920 },
  sources: { marginTop: 28, borderTop: '1px solid var(--line)', paddingTop: 18 },
  sourcesLabel: { fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--faint)' },
  sourcesList: { display: 'flex', flexWrap: 'wrap', gap: '6px 16px', marginTop: 10 },
  sourceLink: { fontSize: 12, color: 'var(--muted)', textDecoration: 'underline', textDecorationColor: 'var(--line-strong)', textUnderlineOffset: 2 },
  disclaimer: { marginTop: 14, fontSize: 12, color: 'var(--faint)', lineHeight: 1.5, maxWidth: 820 },

  cite: { fontSize: 11, color: 'var(--faint)', textDecoration: 'none', marginLeft: 2, verticalAlign: 'super' },
}
