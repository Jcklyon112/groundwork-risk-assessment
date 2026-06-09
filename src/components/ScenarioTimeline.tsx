// ─────────────────────────────────────────────────────────────────────────
// ScenarioTimeline.tsx — the decision planner. The decisions (left) scroll; the
// live programme — Gantt + critical path + the score — stays fixed on the right,
// in view the whole time. Each option shows its impact on the readiness score
// and the schedule before you pick it; selecting drives the live timeline.
// ─────────────────────────────────────────────────────────────────────────
import { useMemo, useState } from 'react'
import type { FeasibilityModel, Status } from '../model/types'
import { LEVERS, applyScenario, scheduleOverrides, type Selection } from '../model/scenarios'
import { computeSchedule } from '../model/schedule'
import { CountUp } from './CountUp'
import { Fr } from './Fr'

const STATUS_COLOR: Record<Status, string> = {
  clear: 'var(--clear)', conditional: 'var(--conditional)', gating: 'var(--gating)',
}
const verdictStatus = (v: FeasibilityModel['verdict']): Status =>
  v === 'CLEAR' ? 'clear' : v === 'CONDITIONAL' ? 'conditional' : 'gating'
const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s)
const deltaColor = (d: number) => (d > 0.05 ? 'var(--clear)' : d < -0.05 ? 'var(--gating)' : 'var(--muted)')

export default function ScenarioTimeline({ model }: { model: FeasibilityModel }) {
  const [sel, setSel] = useState<Selection>({})
  const [mode, setMode] = useState<'max' | 'min'>('max')

  const scenario = useMemo(() => applyScenario(model, sel), [model, sel])
  const overrides = useMemo(() => scheduleOverrides(sel), [sel])
  const sched = useMemo(() => computeSchedule(mode, overrides), [mode, overrides])
  const optimistic = useMemo(() => computeSchedule('min', overrides), [overrides])
  const conservative = useMemo(() => computeSchedule('max', overrides), [overrides])

  const baseConservative = useMemo(() => computeSchedule('max'), [])

  const impacts = useMemo(() => {
    const out: Record<string, ({ dPts: number; dMo: number } | null)[]> = {}
    for (const lever of LEVERS) {
      out[lever.id] = lever.options.map((_, i) => {
        if (i === 0) return null
        const comp = applyScenario(model, { [lever.id]: i }).composite
        const months = computeSchedule('max', scheduleOverrides({ [lever.id]: i })).totalMonths
        return { dPts: (comp - model.composite) * 100, dMo: months - baseConservative.totalMonths }
      })
    }
    return out
  }, [model, baseConservative])

  const dirty = Object.values(sel).some((v) => v)
  const nowPct = Math.round(scenario.composite * 100)
  const compDelta = scenario.deltaPts
  const timeDelta = conservative.totalMonths - baseConservative.totalMonths
  const longPoleIsPower = sched.longPole?.track === 'Power'

  return (
    <div style={S.view}>
      <h2 style={S.viewTitle}>Decision planner</h2>
      <p style={S.viewSub}>
        Five decisions govern this project’s readiness and schedule. Each option shows its impact on the
        readiness score and the time to power before you choose. The programme on the right updates live.
      </p>

      <div style={S.grid}>
        {/* ── LEFT: the decisions (scroll) ────────────────────────────── */}
        <section style={S.decisions}>
          <div className="gw-card" style={S.explainer}>
            <span style={S.explainKicker}>Reading the score</span>
            <p style={S.explainText}>
              <b>Composite readiness</b> is how far the project has progressed toward a build-ready position
              across the six regulatory gates, weighted by where the risk sits. <b>0%</b> = nothing secured;
              <b> 100%</b> = every gate clearable.
            </p>
          </div>

          <div style={S.decisionsHead}>
            <span style={S.decisionsKicker}>Key decisions</span>
            <button onClick={() => setSel({})} disabled={!dirty} style={{ ...S.reset, opacity: dirty ? 1 : 0.4 }}>
              Reset to baseline
            </button>
          </div>

          {LEVERS.map((lever, di) => {
            const cur = sel[lever.id] ?? 0
            return (
              <div key={lever.id} className="gw-card" style={S.decision}>
                <div style={S.decisionHead}>
                  <span style={S.decisionNum}>{di + 1}</span>
                  <div style={{ flex: 1 }}>
                    <div style={S.decisionTitleRow}>
                      <span style={S.decisionTitle}>{lever.title}</span>
                      {lever.leverage && <span style={S.leverageTag}>{lever.leverage} leverage</span>}
                      <span style={S.decisionGate}>{lever.gate}</span>
                    </div>
                    <p style={S.decisionQ}><Fr t={lever.question} /></p>
                  </div>
                </div>

                <div style={S.options}>
                  {lever.options.map((o, i) => {
                    const active = cur === i
                    const imp = impacts[lever.id][i]
                    return (
                      <button
                        key={i}
                        onClick={() => setSel((s) => ({ ...s, [lever.id]: i }))}
                        style={{ ...S.optRow, ...(active ? S.optRowActive : {}) }}
                      >
                        <span style={{ ...S.radio, borderColor: active ? 'var(--ink)' : 'var(--line-strong)' }}>
                          {active && <span style={S.radioDot} />}
                        </span>
                        <span style={S.optLabel}>{i === 0 ? 'Current position' : o.label.replace(/ \(.*\)$/, '')}</span>
                        <span style={S.optImpact}>
                          {i === 0 || !imp ? (
                            <span style={S.baselineTag}>baseline</span>
                          ) : (
                            <>
                              <span style={{ ...S.impChip, color: deltaColor(imp.dPts) }}>{imp.dPts > 0 ? '+' : ''}{imp.dPts.toFixed(0)} pts</span>
                              <span style={{ ...S.impChip, color: deltaColor(-imp.dMo) }}>{imp.dMo === 0 ? '±0 mo' : `${imp.dMo > 0 ? '+' : ''}${imp.dMo} mo`}</span>
                            </>
                          )}
                        </span>
                      </button>
                    )
                  })}
                </div>
                <p style={S.optDetail}><Fr t={lever.options[cur].detail} /></p>
              </div>
            )
          })}
        </section>

        {/* ── RIGHT: the live programme (fixed / sticky) ───────────────── */}
        <aside style={S.timeline}>
          <div className="gw-card" style={S.scoreStrip}>
            <div style={S.scoreCol}>
              <span style={S.scoreLabel}>Composite readiness</span>
              <div style={{ ...S.scoreVal, color: STATUS_COLOR[verdictStatus(scenario.verdict)] }}>
                <CountUp value={nowPct} suffix="%" duration={450} />
              </div>
              <span style={{ ...S.scoreSub, color: dirty ? deltaColor(compDelta) : 'var(--muted)' }}>
                {dirty ? <CountUp value={compDelta} decimals={1} signed suffix=" pts" duration={450} /> : scenario.verdict}
              </span>
            </div>
            <div style={S.scoreDiv} />
            <div style={S.scoreCol}>
              <span style={S.scoreLabel}>Time to power</span>
              <div style={S.scoreVal}>
                <CountUp value={optimistic.totalMonths} duration={450} />–<CountUp value={conservative.totalMonths} duration={450} /><span style={S.unit}> mo</span>
              </div>
              <span style={{ ...S.scoreSub, color: dirty && timeDelta !== 0 ? deltaColor(-timeDelta) : 'var(--muted)' }}>
                {dirty && timeDelta !== 0 ? <CountUp value={timeDelta} signed suffix=" mo" duration={450} /> : `≈ ${(conservative.totalMonths / 12).toFixed(1)} yr`}
              </span>
            </div>
            <div style={S.scoreDiv} />
            <div style={S.scoreCol}>
              <span style={S.scoreLabel}>Long pole</span>
              <div style={S.scoreValSm}>{sched.longPole?.label.split(' (')[0]}</div>
              <span style={S.scoreSub}>{sched.longPole?.dur} mo · {sched.longPole?.track}</span>
            </div>
          </div>

          <div style={S.modeRow}>
            <span style={S.modeLabel}>Durations:</span>
            <button onClick={() => setMode('min')} style={{ ...S.modeBtn, ...(mode === 'min' ? S.modeActive : {}) }}>Optimistic</button>
            <button onClick={() => setMode('max')} style={{ ...S.modeBtn, ...(mode === 'max' ? S.modeActive : {}) }}>Conservative</button>
            <span style={S.legendInline}>
              <span style={{ ...S.swatch, background: 'var(--ink)' }} /> critical
              <span style={{ ...S.swatch, background: 'var(--line-strong)', marginLeft: 10 }} /> slack
              <span style={{ ...S.swatch, background: 'var(--gating)', opacity: 0.5, marginLeft: 10 }} /> discretionary
            </span>
          </div>

          <Gantt sched={sched} />

          <div className="gw-card" style={S.cpBox}>
            <div style={S.sectionLabel}>Critical path — <CountUp value={sched.totalMonths} duration={450} /> months</div>
            <div style={S.cpChain}>
              {sched.criticalPath.map((id, i) => {
                const a = sched.activities.find((r) => r.id === id)!
                return (
                  <span key={id} style={S.cpNodeWrap}>
                    {i > 0 && <span style={S.cpArrow}>→</span>}
                    <span style={S.cpNode}>{a.label.split(' (')[0]} <span style={S.cpDur}>{a.dur}mo</span></span>
                  </span>
                )
              })}
            </div>
            <p style={S.note}>
              {longPoleIsPower
                ? 'The HTB connection is the long pole. Power, not the authorisation, sets the energisation date.'
                : `The environmental chain and build form the long pole. The HTB connection holds ${sched.nearCritical?.slack ?? 0} months of slack; resolve the genset classification or grid capacity to move the date.`}
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}

function Gantt({ sched }: { sched: ReturnType<typeof computeSchedule> }) {
  const total = sched.totalMonths || 1
  const years = Math.ceil(total / 12)
  const W = 1040, padL = 330, padR = 22, rowH = 60, padT = 42, padB = 14
  const barH = 26
  const rows = sched.activities
  const H = padT + rows.length * rowH + padB
  const x = (m: number) => padL + (m / total) * (W - padL - padR)
  return (
    <div style={S.ganttWrap}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 640, display: 'block' }}>
        {Array.from({ length: years + 1 }, (_, k) => k * 12).filter((m) => m <= total).map((m) => (
          <g key={m}>
            <line x1={x(m)} y1={padT - 12} x2={x(m)} y2={H - padB} stroke="var(--line)" strokeWidth={1} />
            <text x={x(m)} y={padT - 18} textAnchor="middle" style={{ fontSize: 13, fill: 'var(--muted)' }}>{m === 0 ? 't0' : `yr ${m / 12}`}</text>
          </g>
        ))}
        {rows.map((a, i) => {
          const y = padT + i * rowH
          const cy = y + rowH / 2
          const top = cy - barH / 2
          const x0 = x(a.es), x1 = x(a.ef)
          const w = Math.max(4, x1 - x0)
          const fill = a.critical ? 'var(--ink)' : 'var(--line-strong)'
          return (
            <g key={a.id}>
              {a.dependsOn.map((d) => {
                const p = rows.find((r) => r.id === d)
                if (!p) return null
                return <line key={d} x1={x(p.ef)} y1={cy} x2={x0} y2={cy} stroke="var(--line)" strokeWidth={1} strokeDasharray="2 2" />
              })}
              <text x={8} y={cy - 6} style={{ fontSize: 15, fontWeight: a.critical ? 700 : 500, fill: 'var(--ink)' }}>{truncate(a.label, 40)}</text>
              <text x={8} y={cy + 13} style={{ fontSize: 12, fill: 'var(--muted)' }}>
                {a.track}{a.gate ? ` · ${a.gate}` : ''} · {a.dur} mo{a.slack > 0 ? ` · ${a.slack} slack` : ' · critical'}
              </text>
              {a.slack > 0 && <rect x={x0} y={top} width={Math.max(4, x(a.lf) - x0)} height={barH} rx={4} fill="var(--line)" opacity={0.6} />}
              <rect x={x0} y={top} width={w} height={barH} rx={4} fill={fill} opacity={a.critical ? 0.92 : 0.8} style={{ transition: 'x 300ms ease, width 300ms ease' }} />
              {a.discretionary && <rect x={x0} y={top} width={w} height={barH} rx={4} fill="var(--gating)" opacity={0.42} />}
              {a.critical && <rect x={x0} y={top} width={w} height={barH} rx={4} fill="none" stroke="var(--ink)" strokeWidth={1.5} />}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  view: { maxWidth: 1560, margin: '0 auto', padding: '32px 28px 80px', color: 'var(--ink)' },
  viewTitle: { margin: 0, fontSize: 28, fontWeight: 600, letterSpacing: '-0.03em' },
  viewSub: { color: 'var(--muted)', fontSize: 15, margin: '9px 0 24px', maxWidth: 920, lineHeight: 1.6 },
  grid: { display: 'flex', flexWrap: 'wrap', gap: 28, alignItems: 'flex-start' },

  decisions: { flex: '1 1 440px', minWidth: 340, display: 'flex', flexDirection: 'column', gap: 14 },
  explainer: { border: '1px solid var(--line)', borderLeft: '2px solid var(--accent)', borderRadius: 'var(--radius)', padding: '13px 15px', background: 'var(--paper)' },
  explainKicker: { fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--faint)' },
  explainText: { margin: '6px 0 0', fontSize: 12.5, lineHeight: 1.55, color: 'var(--ink-soft)' },
  decisionsHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  decisionsKicker: { fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--faint)' },
  reset: { border: '1px solid var(--line-strong)', background: 'var(--paper)', borderRadius: 7, padding: '6px 12px', fontSize: 12.5, fontWeight: 590, cursor: 'pointer', color: 'var(--ink)' },

  decision: { border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: 18, background: 'var(--paper)' },
  decisionHead: { display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 12 },
  decisionNum: { flex: '0 0 auto', width: 26, height: 26, borderRadius: 7, background: 'var(--ink)', color: 'var(--paper)', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-serif)' },
  decisionTitleRow: { display: 'flex', alignItems: 'baseline', gap: 9, flexWrap: 'wrap' },
  decisionTitle: { fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em' },
  leverageTag: { fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', background: 'var(--ink)', color: 'var(--paper)', borderRadius: 5, padding: '1px 6px' },
  decisionGate: { fontSize: 12, color: 'var(--faint)' },
  decisionQ: { fontSize: 13, color: 'var(--muted)', lineHeight: 1.5, margin: '5px 0 0' },

  options: { display: 'flex', flexDirection: 'column', gap: 7 },
  optRow: { display: 'flex', alignItems: 'center', gap: 11, width: '100%', textAlign: 'left', border: '1px solid var(--line)', background: 'var(--paper)', borderRadius: 9, padding: '10px 12px', cursor: 'pointer', transition: 'border-color 150ms ease' },
  optRowActive: { borderColor: 'var(--ink)', boxShadow: 'inset 0 0 0 1px var(--ink)' },
  radio: { flex: '0 0 auto', width: 16, height: 16, borderRadius: 999, border: '1.5px solid var(--line-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 8, height: 8, borderRadius: 999, background: 'var(--ink)' },
  optLabel: { flex: 1, fontSize: 13.5, fontWeight: 500 },
  optImpact: { flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 7 },
  impChip: { fontSize: 12, fontWeight: 600, fontVariantNumeric: 'tabular-nums', minWidth: 46, textAlign: 'right' },
  baselineTag: { fontSize: 11, color: 'var(--faint)', fontWeight: 500 },
  optDetail: { fontSize: 12.5, lineHeight: 1.55, margin: '12px 0 0', color: 'var(--ink-soft)' },

  // right column: sticky — caught under the app bar, slides with the page as the
  // decisions on the left scroll. No inner scrollbar; the page scrolls.
  timeline: { flex: '1 1 880px', minWidth: 560, alignSelf: 'flex-start', position: 'sticky', top: 64, display: 'flex', flexDirection: 'column', gap: 14 },
  scoreStrip: { display: 'flex', alignItems: 'stretch', gap: 0, border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: '16px 8px', background: 'var(--paper)' },
  scoreCol: { flex: 1, padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 },
  scoreDiv: { width: 1, background: 'var(--line)', alignSelf: 'stretch' },
  scoreLabel: { fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--faint)' },
  scoreVal: { fontSize: 42, fontWeight: 600, lineHeight: 1.04, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-serif)' },
  scoreValSm: { fontSize: 19, fontWeight: 600, lineHeight: 1.2, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis' },
  unit: { fontSize: 20, fontWeight: 600, color: 'var(--muted)', fontFamily: 'var(--font-sans)' },
  scoreSub: { fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums' },

  modeRow: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  modeLabel: { fontSize: 12, color: 'var(--muted)', fontWeight: 500 },
  modeBtn: { border: '1px solid var(--line)', background: 'var(--paper)', borderRadius: 6, padding: '5px 11px', fontSize: 12, fontWeight: 500, cursor: 'pointer', color: 'var(--muted)', transition: 'all 160ms ease' },
  modeActive: { borderColor: 'var(--ink)', color: 'var(--ink)', fontWeight: 600, boxShadow: 'inset 0 0 0 1px var(--ink)' },
  legendInline: { fontSize: 10.5, color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', marginLeft: 'auto', flexWrap: 'wrap' },
  swatch: { width: 10, height: 10, borderRadius: 3, display: 'inline-block', marginRight: 5, verticalAlign: 'middle' },

  ganttWrap: { border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: '10px 12px', overflowX: 'auto', background: 'var(--paper)' },
  cpBox: { border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: 14, background: 'var(--paper)' },
  sectionLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--faint)', marginBottom: 10, fontWeight: 600 },
  cpChain: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4 },
  cpNodeWrap: { display: 'inline-flex', alignItems: 'center', gap: 4 },
  cpArrow: { color: 'var(--faint)', fontSize: 13 },
  cpNode: { fontSize: 11.5, fontWeight: 600, border: '1px solid var(--line)', borderRadius: 6, padding: '3px 8px', background: 'var(--bg)' },
  cpDur: { fontSize: 10, color: 'var(--muted)', fontWeight: 600 },
  note: { fontSize: 12.5, color: 'var(--ink-soft)', margin: '11px 0 0', lineHeight: 1.55 },
}
