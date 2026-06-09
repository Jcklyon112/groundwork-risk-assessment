// ─────────────────────────────────────────────────────────────────────────
// FeasibilityInstrument.tsx — the radial Pareto instrument for the La Janais
// feasibility engine. Light theme; black/white + status colour ONLY; no
// external deps; pure SVG. Reads a computed FeasibilityModel.
//
//   wedge angular span = risk weight (Pareto)      colour = status
//   radial fill within the wedge = readiness       centre = composite
//   bold tick = the 80%-cumulative-risk marker
//
// Select a gate → its live value (with full provenance drill-down), supporting
// facts, and ordered permitting route. A pathway stepper shows the application
// route with the computed bottleneck flagged.
// ─────────────────────────────────────────────────────────────────────────
import { useMemo, useState } from 'react'
import type { FeasibilityModel, Gate, Status } from '../model/types'
import { CountUp, useCountUp } from './CountUp'
import { Fr } from './Fr'
import { GATE_HEADLINE } from '../model/playbook'

// the biggest issue + the concrete next action for a gate, for the header box
const issueFor = (g: Gate): { issue: string; action: string } =>
  GATE_HEADLINE[g.id] ?? { issue: g.live.value, action: g.permitting[0] ?? '' }

// Colour is reserved for DIFFICULTY — the status encoding (toned, not loud):
// green = clear / easy · ochre = conditional · terracotta = gating / hardest.
const STATUS_COLOR: Record<Status, string> = {
  clear: 'var(--clear)',
  conditional: 'var(--conditional)',
  gating: 'var(--gating)',
}
// neutral line tones — the chrome stays greyscale for a light, modern look
const HAIRLINE = '#e6e7ea'
const STROKE_SOFT = '#c2c5ca'
const STROKE_DEF = '#4a4f55'
const STATUS_LABEL: Record<Status, string> = {
  clear: 'Clear',
  conditional: 'Conditional',
  gating: 'Gating',
}

// polar → cartesian, angle in degrees measured CLOCKWISE from the top (12 o'clock)
function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) }
}

function annularSector(
  cx: number, cy: number, rInner: number, rOuter: number, a0: number, a1: number,
) {
  const p0 = polar(cx, cy, rOuter, a0)
  const p1 = polar(cx, cy, rOuter, a1)
  const p2 = polar(cx, cy, rInner, a1)
  const p3 = polar(cx, cy, rInner, a0)
  const large = a1 - a0 > 180 ? 1 : 0
  return [
    `M ${p0.x} ${p0.y}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${p1.x} ${p1.y}`,
    `L ${p2.x} ${p2.y}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${p3.x} ${p3.y}`,
    'Z',
  ].join(' ')
}

interface Wedge {
  gate: Gate
  a0: number
  a1: number
  mid: number
  cumStart: number
  cumEnd: number
}

// super-short risk blurb per gate — shown on the callout tag when a slice is clicked
const RISK_BLURB: Record<string, string> = {
  'env-auth': 'Autorisation · 12–18 mo',
  power: '100 MW raccordement TBD',
  brownfield: 'Legacy soils · clean-up',
  water: 'Make-up vs. captage',
  'land-use': 'Industry OK · limits TBD',
  heat: 'Not a blocker',
}
const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s)
const blurbFor = (g: Gate) => RISK_BLURB[g.id] ?? truncate(g.live.value, 40)

export default function FeasibilityInstrument({ model }: { model: FeasibilityModel }) {
  const [selected, setSelected] = useState<string | null>(null)
  const [hover, setHover] = useState<string | null>(null)

  // Pareto order: largest risk weight first.
  const wedges = useMemo<Wedge[]>(() => {
    const sorted = [...model.gates].sort((a, b) => b.weight - a.weight)
    const total = sorted.reduce((s, g) => s + g.weight, 0)
    let angle = 0 // 0° = top (12 o'clock); polar() measures clockwise from there
    let cum = 0
    return sorted.map((gate) => {
      const span = (gate.weight / total) * 360
      const a0 = angle
      const a1 = angle + span
      angle = a1
      const cumStart = cum
      cum += gate.weight
      return { gate, a0, a1, mid: (a0 + a1) / 2, cumStart, cumEnd: cum }
    })
  }, [model.gates])

  const totalWeight = model.gates.reduce((s, g) => s + g.weight, 0)

  // 80%-risk marker angle (Pareto): boundary where cumulative weight crosses 80%.
  const marker80 = useMemo(() => {
    const target = 0.8 * totalWeight
    for (const w of wedges) {
      if (w.cumEnd >= target) {
        const frac = (target - w.cumStart) / (w.cumEnd - w.cumStart)
        return w.a0 + frac * (w.a1 - w.a0)
      }
    }
    return 360
  }, [wedges, totalWeight])

  const SIZE = 460
  const PAD = 176            // breathing room so outer wedge labels + callout tags never clip
  const VB = SIZE + PAD * 2  // padded viewBox extent (keeps the ring centred)
  const cx = SIZE / 2
  const cy = SIZE / 2
  const rOuter = 200
  const rInner = 120

  const active = selected ?? hover
  const activeGate = model.gates.find((g) => g.id === active) ?? null
  const detailGate = model.gates.find((g) => g.id === selected) ?? null

  const composedPct = Math.round(model.composite * 100)
  const compositeAnim = useCountUp(composedPct, 800)

  return (
    <div style={S.page}>
      <header style={S.header}>
        <div>
          <h1 style={S.h1}>La Janais — Regulatory Risk Profile</h1>
          <p style={S.sub}>
            {model.site.name} · {model.site.commune} (INSEE {model.site.insee}) ·{' '}
            <span style={S.mono}>live regulatory data, computed feasibility &amp; permitting route</span>
          </p>
        </div>
        <div style={S.genAt}>
          generated {new Date(model.generated_at).toISOString().slice(0, 16).replace('T', ' ')}Z
        </div>
      </header>

      {/* ── scope, or the selected gate's biggest issue (changes on tap) ── */}
      {activeGate ? (
        <div style={{ ...S.objective, borderLeft: `3px solid ${STATUS_COLOR[activeGate.status]}` }}>
          <span style={S.objectiveKicker}>
            Biggest issue · {activeGate.name}
            <span style={{ ...S.issueSev, color: STATUS_COLOR[activeGate.status] }}>{STATUS_LABEL[activeGate.status]}</span>
          </span>
          <p style={S.objectiveText}><Fr t={issueFor(activeGate).issue} /></p>
          <p style={S.issueLever}>
            <span style={{ ...S.issueLeverLabel, color: STATUS_COLOR[activeGate.status] }}>Do now</span>
            <Fr t={issueFor(activeGate).action} />
          </p>
        </div>
      ) : (
        <div style={S.objective}>
          <span style={S.objectiveKicker}>Scope</span>
          <p style={S.objectiveText}>
            Six regulatory gates stand between the site and a build permit. Each is sized by risk and
            assessed for readiness. The dial shows current standing; the pathway identifies the binding
            constraint and the actions to clear it. Tap a wedge for its biggest issue.
          </p>
        </div>
      )}

      <div style={S.main}>
        {/* ── the instrument ──────────────────────────────────────────── */}
        <div style={S.instrumentWrap}>
          <svg viewBox={`${-PAD} ${-PAD} ${VB} ${VB}`} width="100%" style={{ maxWidth: 980, display: 'block' }}>
            {/* track ring */}
            <circle cx={cx} cy={cy} r={rOuter} fill="none" stroke={HAIRLINE} strokeWidth={0.75} />
            <circle cx={cx} cy={cy} r={rInner} fill="none" stroke={HAIRLINE} strokeWidth={0.75} />

            {wedges.map((w) => {
              const color = STATUS_COLOR[w.gate.status]
              const isActive = active === w.gate.id
              const isSelected = selected === w.gate.id
              const rFill = rInner + (rOuter - rInner) * w.gate.readiness
              return (
                <g
                  key={w.gate.id}
                  onMouseEnter={() => setHover(w.gate.id)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => setSelected(selected === w.gate.id ? null : w.gate.id)}
                  style={{
                    cursor: 'pointer',
                    // a clicked wedge grows a little — smoothly, via transform (the d-geometry stays put)
                    transformBox: 'fill-box',
                    transformOrigin: 'center',
                    transform: isSelected ? 'scale(1.055)' : 'scale(1)',
                    transition: 'transform 260ms cubic-bezier(.22,.61,.36,1), opacity 200ms ease',
                  }}
                >
                  {/* light status-tinted track for the full wedge */}
                  <path d={annularSector(cx, cy, rInner, rOuter, w.a0, w.a1)} fill={color} opacity={0.1} style={{ transition: 'opacity 200ms ease' }} />
                  {/* readiness fill (inner gauge): height ∝ readiness */}
                  <path d={annularSector(cx, cy, rInner, rFill, w.a0, w.a1)} fill={color} opacity={isActive ? 0.95 : 0.78} style={{ transition: 'opacity 200ms ease' }} />
                  {/* wedge separators + active outline */}
                  <path
                    d={annularSector(cx, cy, rInner, rOuter, w.a0, w.a1)}
                    fill="none"
                    stroke={isSelected ? STROKE_DEF : isActive ? STROKE_SOFT : 'var(--paper)'}
                    strokeWidth={isSelected ? 1.25 : 1}
                    style={{ transition: 'stroke 200ms ease' }}
                  />
                  {/* gate short label along the wedge — hidden when selected (the callout tag shows it) */}
                  {!isSelected && (() => {
                    const lp = polar(cx, cy, rOuter + 22, w.mid)
                    const anchor = w.mid > 180 ? 'end' : w.mid < 180 ? 'start' : 'middle'
                    return (
                      <text
                        x={lp.x} y={lp.y}
                        textAnchor={Math.abs(w.mid - 180) < 8 || w.mid < 8 ? 'middle' : anchor}
                        dominantBaseline="middle"
                        style={{ fontSize: 12, fontWeight: isActive ? 700 : 500, fill: 'var(--ink)' }}
                      >
                        {w.gate.short}
                        <tspan style={{ fill: 'var(--muted)', fontWeight: 400 }}> · {w.gate.weight}%</tspan>
                      </text>
                    )
                  })()}
                </g>
              )
            })}

            {/* ── callout: leader line + tag from the clicked wedge ─────────── */}
            {(() => {
              const w = wedges.find((x) => x.gate.id === selected)
              if (!w) return null
              const color = STATUS_COLOR[w.gate.status]
              const ro = rOuter + 9                           // just outside the scaled wedge
              const right = w.mid <= 180
              const tip = polar(cx, cy, ro, w.mid)            // wedge edge
              const knee = polar(cx, cy, ro + 28, w.mid)      // leader knee
              const elbowX = knee.x + (right ? 18 : -18)      // short horizontal elbow
              // tag geometry (estimate width from text length, then clamp inside the viewBox)
              const blurb = blurbFor(w.gate)
              const title = `${w.gate.short} · ${w.gate.weight}% risk`
              const tagW = Math.max(title.length, blurb.length) * 6.2 + 22
              const tagH = 44
              let tagX = right ? elbowX + 6 : elbowX - 6 - tagW
              const minX = -PAD + 6, maxX = -PAD + VB - 6
              tagX = Math.max(minX, Math.min(tagX, maxX - tagW))
              let tagY = knee.y - tagH / 2
              const minY = -PAD + 6, maxY = -PAD + VB - 6
              tagY = Math.max(minY, Math.min(tagY, maxY - tagH))
              const textX = tagX + 12
              return (
                <g style={{ pointerEvents: 'none' }}>
                  <line x1={tip.x} y1={tip.y} x2={knee.x} y2={knee.y} stroke={STROKE_SOFT} strokeWidth={1} strokeLinecap="round" />
                  <line x1={knee.x} y1={knee.y} x2={elbowX} y2={knee.y} stroke={STROKE_SOFT} strokeWidth={1} strokeLinecap="round" />
                  <circle cx={tip.x} cy={tip.y} r={2.5} fill={color} />
                  <rect x={tagX} y={tagY} width={tagW} height={tagH} rx={8} fill="var(--paper)" stroke={HAIRLINE} strokeWidth={1} />
                  <rect x={tagX} y={tagY + 8} width={3} height={tagH - 16} rx={1.5} fill={color} />
                  <text x={textX} y={tagY + 18} style={{ fontSize: 12, fontWeight: 700, fill: 'var(--ink)' }}>{title}</text>
                  <text x={textX} y={tagY + 33} style={{ fontSize: 11, fill: 'var(--muted)' }}>{blurb}</text>
                </g>
              )
            })()}

            {/* 80% cumulative-risk marker */}
            {(() => {
              const o = polar(cx, cy, rOuter + 6, marker80)
              const i = polar(cx, cy, rInner - 6, marker80)
              const lab = polar(cx, cy, rOuter + 40, marker80)
              return (
                <g>
                  <line x1={i.x} y1={i.y} x2={o.x} y2={o.y} stroke={STROKE_SOFT} strokeWidth={1} strokeDasharray="3 3" />
                  <text x={lab.x} y={lab.y} textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 10, fontWeight: 600, fill: 'var(--muted)' }}>
                    80% risk
                  </text>
                </g>
              )
            })()}

            {/* centre — composite (generous vertical rhythm so nothing overlaps) */}
            <circle cx={cx} cy={cy} r={rInner - 6} fill="var(--paper)" />
            <text x={cx} y={cy - 48} textAnchor="middle" style={{ fontSize: 12, letterSpacing: 2, fill: 'var(--muted)' }}>
              COMPOSITE
            </text>
            <text x={cx} y={cy + 8} textAnchor="middle" style={{ fontSize: 52, fontWeight: 600, fill: 'var(--ink)', fontFamily: 'var(--font-serif)' }}>
              {Math.round(compositeAnim)}%
            </text>
            <text x={cx} y={cy + 36} textAnchor="middle" style={{ fontSize: 13, letterSpacing: 1, fill: 'var(--muted)' }}>
              readiness
            </text>
            <text x={cx} y={cy + 64} textAnchor="middle" style={{ fontSize: 16, fontWeight: 800, fill: STATUS_COLOR[verdictStatus(model.verdict)] }}>
              {model.verdict}
            </text>
          </svg>

          <div style={S.legend}>
            <LegendDot color="var(--clear)" label="Clear" />
            <LegendDot color="var(--conditional)" label="Conditional" />
            <LegendDot color="var(--gating)" label="Gating" />
            <span style={S.legendNote}>
              wedge width = risk share · fill height = readiness · colour = difficulty · centre = composite
            </span>
          </div>

          <p style={S.scoreCaption}>
            <b>Composite readiness</b> measures how far the project has progressed toward a build-ready
            position across the six regulatory gates, weighted by where the risk sits. <b>0%</b> = nothing
            secured; <b>100%</b> = every gate clearable. Each wedge’s fill is that gate’s own readiness.
          </p>

          {/* supporting facts + the process to clear the gate sit under the diagram */}
          {detailGate && <div style={S.summary}><GateExtras gate={detailGate} /></div>}
        </div>

        {/* ── detail panel — the gate summary when pinned, overview otherwise ─ */}
        <aside style={S.panel}>
          {detailGate ? (
            <GateSummary gate={detailGate} onClose={() => setSelected(null)} />
          ) : activeGate ? (
            <GateBrief gate={activeGate} />
          ) : (
            <Overview model={model} />
          )}
        </aside>
      </div>

      {/* ── pathway stepper ───────────────────────────────────────────── */}
      <Pathway model={model} onPick={(gid) => gid && setSelected(gid)} />

      {/* ── unresolved ledger ─────────────────────────────────────────── */}
      <section style={S.unresolved}>
        <h3 style={S.h3}>Open items, ranked by leverage</h3>
        <ul style={S.ul}>
          {model.unresolved.map((u, i) => (
            <li key={i} style={S.li}>{u}</li>
          ))}
        </ul>
      </section>

      <footer style={S.footer}>
        Every value links to its source, URL, and <span style={S.mono}>fetched_at</span>. Data axes return
        measured values; the permitting decision rests with the authorities, and the assessment sets out the
        route and the levers to secure it.
      </footer>
    </div>
  )
}

function verdictStatus(v: FeasibilityModel['verdict']): Status {
  return v === 'CLEAR' ? 'clear' : v === 'CONDITIONAL' ? 'conditional' : 'gating'
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
      <span style={{ width: 11, height: 11, borderRadius: 2, background: color, display: 'inline-block' }} />
      {label}
    </span>
  )
}

function StatusPill({ status }: { status: Status }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase',
      color: STATUS_COLOR[status], border: `1px solid ${STATUS_COLOR[status]}`,
      borderRadius: 999, padding: '2px 9px',
    }}>
      {STATUS_LABEL[status]}
    </span>
  )
}

function Badge({ text, title }: { text: string; title?: string }) {
  return (
    <span title={title} style={{
      fontSize: 10, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase',
      background: 'var(--ink)', color: 'var(--paper)', borderRadius: 3, padding: '1px 6px', marginLeft: 6,
    }}>
      {text}
    </span>
  )
}

function ConfidenceTag({ c }: { c: 'high' | 'medium' | 'low' }) {
  const fill = c === 'high' ? 'var(--ink)' : c === 'medium' ? 'var(--muted)' : 'var(--line-strong)'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--muted)' }}>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{
          width: 6, height: 6, borderRadius: 999,
          background: (c === 'high' ? i <= 2 : c === 'medium' ? i <= 1 : i === 0) ? fill : 'var(--line)',
        }} />
      ))}
      {c} confidence
    </span>
  )
}

function Overview({ model }: { model: FeasibilityModel }) {
  const bn = model.pathway.find((p) => p.id === model.bottleneck)
  return (
    <div>
      <h2 style={S.h2}>Feasibility — {model.verdict}</h2>
      <p style={S.p}>
        Composite readiness <b><CountUp value={Math.round(model.composite * 100)} suffix="%" /></b>, risk-weighted across six gates.
        Select a gate for its value, provenance, and actions.
      </p>
      <div style={S.kv}><span style={S.k}>Current bottleneck</span><span style={S.v}>{bn?.label}</span></div>
      <div style={S.kv}><span style={S.k}>Authority</span><span style={S.v}>{bn?.authority}</span></div>
      <p style={{ ...S.p, color: 'var(--muted)', marginTop: 10 }}><Fr t={bn?.note ?? ''} /></p>
      <table style={S.table}>
        <thead>
          <tr><th style={S.th}>Gate</th><th style={S.thR}>Risk</th><th style={S.thR}>Readiness</th><th style={S.th}>Status</th></tr>
        </thead>
        <tbody>
          {[...model.gates].sort((a, b) => b.weight - a.weight).map((g) => (
            <tr key={g.id}>
              <td style={S.td}>{g.name}</td>
              <td style={S.tdR}><CountUp value={g.weight} suffix="%" /></td>
              <td style={S.tdR}><CountUp value={Math.round(g.readiness * 100)} suffix="%" /></td>
              <td style={S.td}><span style={{ color: STATUS_COLOR[g.status], fontWeight: 700 }}>{STATUS_LABEL[g.status]}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function GateBrief({ gate }: { gate: Gate }) {
  return (
    <div>
      <div style={S.panelHead}>
        <h2 style={S.h2}>{gate.name}</h2>
        <StatusPill status={gate.status} />
      </div>
      <p style={S.p}><Fr t={gate.live.value} /></p>
      <div style={S.kv}><span style={S.k}>Risk share</span><span style={S.v}><CountUp value={gate.weight} suffix="%" /></span></div>
      <div style={S.kv}><span style={S.k}>Readiness</span><span style={S.v}><CountUp value={Math.round(gate.readiness * 100)} suffix="%" /></span></div>
      <p style={{ ...S.p, color: 'var(--muted)', fontSize: 13 }}>Click the wedge to pin the full provenance &amp; permitting route.</p>
    </div>
  )
}

// Gate summary — sits UNDER the diagram (fills the space the big ring leaves).
// Header, risk/readiness, the live value with provenance, the rule, regulation.
function GateSummary({ gate, onClose }: { gate: Gate; onClose: () => void }) {
  return (
    <div>
      <div style={S.panelHead}>
        <h2 style={S.h2}>{gate.name}</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <StatusPill status={gate.status} />
          <button onClick={onClose} style={S.close} aria-label="Close">×</button>
        </div>
      </div>

      <div style={S.kvRow}>
        <div style={S.kv}><span style={S.k}>Risk share</span><span style={S.v}><CountUp value={gate.weight} suffix="%" /></span></div>
        <div style={S.kv}><span style={S.k}>Readiness</span><span style={S.v}><CountUp value={Math.round(gate.readiness * 100)} suffix="%" /></span></div>
      </div>

      {/* headline live value with provenance */}
      <div style={S.liveBox}>
        <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700 }}><Fr t={gate.live.value} /></span>
          {gate.live.designTarget && <Badge text="design target" title="forward-looking, not a fetched fact" />}
          {gate.live.snapshot && <Badge text="snapshot" title="non-binding point-in-time value" />}
        </div>
        <div style={S.prov}>
          <a href={gate.live.url} target="_blank" rel="noreferrer" style={S.link}>{gate.live.source}</a>
          <span style={S.mono}> · fetched {gate.live.fetched_at}</span>
        </div>
        <div style={{ marginTop: 6 }}><ConfidenceTag c={gate.live.confidence} /></div>
        {gate.live.notes?.map((n, i) => <p key={i} style={S.note}><Fr t={n} /></p>)}
      </div>

      <div style={S.summaryCols}>
        <div style={{ ...S.section, flex: '1 1 300px' }}>
          <div style={S.sectionLabel}>Rule applied</div>
          <p style={{ ...S.p, fontSize: 13 }}><Fr t={gate.rule} /></p>
        </div>
        <div style={{ ...S.section, flex: '1 1 240px' }}>
          <div style={S.sectionLabel}>Regulation</div>
          <p style={{ ...S.p, fontSize: 13 }}><Fr t={gate.regulation} /></p>
        </div>
      </div>
    </div>
  )
}

// Detached facts + steps — the right-hand panel when a gate is pinned.
function GateExtras({ gate }: { gate: Gate }) {
  return (
    <div>
      <div style={{ ...S.section, marginTop: 0, borderTop: 'none', paddingTop: 0 }}>
        <div style={S.sectionLabel}>Supporting facts</div>
        {gate.facts.map((f, i) => (
          <div key={i} style={S.fact}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>{f.label}</span>
              <span style={{ fontSize: 13, fontWeight: 600, textAlign: 'right' }}>
                <Fr t={f.value} />
                {f.designTarget && <Badge text="design" />}
                {f.snapshot && <Badge text="snapshot" />}
              </span>
            </div>
            <div style={S.prov}>
              <a href={f.url} target="_blank" rel="noreferrer" style={S.link}>{f.source}</a>
              <span style={S.mono}> · {f.fetched_at} · {f.confidence}</span>
            </div>
          </div>
        ))}
      </div>

      <div style={S.section}>
        <div style={S.sectionLabel}>Process to clear this gate</div>
        <p style={{ ...S.note, margin: '0 0 10px' }}>
          Ordered actions to establish feasibility for this gate.
        </p>
        <VerticalSteps steps={gate.permitting} color={STATUS_COLOR[gate.status]} />
      </div>
    </div>
  )
}

// Vertical step-by-step process for a single gate — numbered, connected,
// tinted by the gate's status. The actions are encoded locally per gate
// (gate.permitting); this renders them as the ordered feasibility procedure.
function VerticalSteps({ steps, color }: { steps: string[]; color: string }) {
  return (
    <ol style={S.vsteps}>
      {steps.map((s, i) => {
        const last = i === steps.length - 1
        return (
          <li key={i} style={S.vstep}>
            <div style={S.vstepGutter}>
              <span style={{ ...S.vstepNum, borderColor: color }}>{i + 1}</span>
              {!last && <span style={S.vstepLine} />}
            </div>
            <div style={{ ...S.vstepBody, paddingBottom: last ? 0 : 14 }}>
              <Fr t={s} />
              {last && <span style={{ ...S.vstepFlag, color }}> → gate feasible</span>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function Pathway({ model, onPick }: { model: FeasibilityModel; onPick: (gateId: string | undefined) => void }) {
  const [open, setOpen] = useState<string | null>(model.bottleneck)
  const step = model.pathway.find((s) => s.id === open)
  return (
    <section style={S.pathway}>
      <h3 style={S.h3}>Application pathway, binding constraint flagged</h3>
      <div style={S.stepper}>
        {model.pathway.map((s, i) => {
          const isActive = s.state === 'active'
          const color = s.state === 'cleared' ? 'var(--clear)' : isActive ? 'var(--gating)' : 'var(--muted)'
          return (
            <div key={s.id} style={S.stepWrap}>
              {i > 0 && <div style={{ ...S.connector, background: s.state === 'pending' ? 'var(--line)' : 'var(--line-strong)' }} />}
              <button
                onClick={() => setOpen(open === s.id ? null : s.id)}
                style={{
                  ...S.step,
                  borderColor: open === s.id ? 'var(--ink)' : 'var(--line)',
                  boxShadow: isActive ? `inset 0 0 0 2px ${color}` : 'none',
                }}
              >
                <span style={{ ...S.stepDot, background: color }} />
                <span style={{ fontSize: 12, fontWeight: isActive ? 800 : 500 }}>{s.label}</span>
                {isActive && <span style={S.bottleneckTag}>bottleneck</span>}
              </button>
            </div>
          )
        })}
      </div>
      {step && (
        <div style={S.stepDetail}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
            <b>{step.label}</b>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>· {step.authority}</span>
            {step.gates.map((g) => (
              <button key={g} onClick={() => onPick(g)} style={S.gateChip}>{g}</button>
            ))}
          </div>
          <p style={{ ...S.p, fontSize: 13, marginTop: 6 }}><Fr t={step.note ?? ''} /></p>
        </div>
      )}
    </section>
  )
}

// ── styles ──────────────────────────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
  page: { maxWidth: 1120, margin: '0 auto', padding: '32px 24px 72px', color: 'var(--ink)' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, borderBottom: '1px solid var(--line)', paddingBottom: 18 },
  h1: { margin: 0, fontSize: 26, fontWeight: 600, letterSpacing: '-0.03em' },
  sub: { margin: '7px 0 0', color: 'var(--muted)', fontSize: 14 },
  genAt: { fontSize: 12, color: 'var(--faint)', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', whiteSpace: 'nowrap' },
  mono: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12 },
  objective: { marginTop: 20, border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: '18px 22px', background: 'var(--paper)', minHeight: 104, transition: 'border-color 200ms ease' },
  objectiveKicker: { display: 'inline-flex', alignItems: 'baseline', gap: 10, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--faint)', marginBottom: 7 },
  objectiveText: { margin: 0, fontSize: 15.5, lineHeight: 1.6, maxWidth: 880, color: 'var(--ink)' },
  issueSev: { fontSize: 10.5, fontWeight: 700, letterSpacing: '0.05em' },
  issueLever: { margin: '11px 0 0', fontSize: 14, lineHeight: 1.6, color: 'var(--ink-soft)', maxWidth: 880 },
  issueLeverLabel: { display: 'inline-block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', border: '1px solid currentColor', borderRadius: 5, padding: '1px 6px', marginRight: 9, verticalAlign: 'middle' },
  main: { display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 32, marginTop: 28 },
  instrumentWrap: { flex: '1 1 640px', minWidth: 380, display: 'flex', flexDirection: 'column', alignItems: 'center' },
  legend: { display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', marginTop: 12, justifyContent: 'center' },
  legendNote: { fontSize: 11, color: 'var(--faint)' },
  scoreCaption: { fontSize: 12, color: 'var(--muted)', textAlign: 'center', maxWidth: 480, margin: '12px auto 0', lineHeight: 1.55 },
  panel: { flex: '1 1 380px', minWidth: 340, border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: 22, background: 'var(--paper)', boxShadow: 'var(--shadow-md)' },
  summary: { width: '100%', maxWidth: 840, marginTop: 22, paddingTop: 20, borderTop: '1px solid var(--line)', textAlign: 'left' },
  summaryCols: { display: 'flex', gap: 24, flexWrap: 'wrap' },
  panelHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 10 },
  h2: { margin: 0, fontSize: 19, fontWeight: 600, letterSpacing: '-0.02em' },
  h3: { margin: '0 0 14px', fontSize: 12.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--faint)' },
  p: { margin: '8px 0', fontSize: 14, lineHeight: 1.55, color: 'var(--ink-soft)' },
  kvRow: { display: 'flex', gap: 28 },
  kv: { display: 'flex', flexDirection: 'column', margin: '8px 0' },
  k: { fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--faint)', fontWeight: 600 },
  v: { fontSize: 16, fontWeight: 600, fontVariantNumeric: 'tabular-nums' },
  liveBox: { border: '1px solid var(--line)', borderRadius: 12, padding: 14, margin: '12px 0', background: 'var(--bg)' },
  prov: { fontSize: 12, color: 'var(--muted)', marginTop: 4 },
  link: { color: 'var(--ink)', textDecoration: 'underline', textUnderlineOffset: 2, textDecorationColor: 'var(--line-strong)' },
  note: { fontSize: 12.5, color: 'var(--muted)', margin: '6px 0 0', lineHeight: 1.45 },
  section: { marginTop: 16, borderTop: '1px solid var(--line)', paddingTop: 14 },
  sectionLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--faint)', marginBottom: 8, fontWeight: 600 },
  fact: { padding: '8px 0', borderBottom: '1px solid var(--line)' },
  ol: { margin: 0, paddingLeft: 18 },
  liStep: { fontSize: 13, lineHeight: 1.5, marginBottom: 4 },
  vsteps: { listStyle: 'none', margin: '2px 0 0', padding: 0 },
  vstep: { display: 'flex', gap: 12, alignItems: 'stretch' },
  vstepGutter: { display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '0 0 auto' },
  vstepNum: { width: 24, height: 24, borderRadius: 999, border: '1.5px solid', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, background: 'var(--paper)', color: 'var(--ink)', flex: '0 0 auto' },
  vstepLine: { width: 1.5, flex: '1 1 auto', minHeight: 12, background: 'var(--line)', margin: '3px 0' },
  vstepBody: { fontSize: 13, lineHeight: 1.5, paddingTop: 2, color: 'var(--ink-soft)' },
  vstepFlag: { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' },
  close: { border: '1px solid var(--line)', background: 'var(--paper)', borderRadius: 999, width: 28, height: 28, fontSize: 17, cursor: 'pointer', lineHeight: 1, color: 'var(--muted)', transition: 'background 180ms ease' },
  table: { width: '100%', borderCollapse: 'collapse', marginTop: 14, fontSize: 13 },
  th: { textAlign: 'left', borderBottom: '1px solid var(--line)', padding: '8px 4px', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--faint)', fontWeight: 600 },
  thR: { textAlign: 'right', borderBottom: '1px solid var(--line)', padding: '8px 4px', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--faint)', fontWeight: 600 },
  td: { textAlign: 'left', borderBottom: '1px solid var(--line)', padding: '8px 4px', color: 'var(--ink-soft)' },
  tdR: { textAlign: 'right', borderBottom: '1px solid var(--line)', padding: '8px 4px', fontVariantNumeric: 'tabular-nums', color: 'var(--ink-soft)' },
  pathway: { marginTop: 40, borderTop: '1px solid var(--line)', paddingTop: 22 },
  stepper: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0 },
  stepWrap: { display: 'flex', alignItems: 'center' },
  connector: { width: 16, height: 1.5, flex: '0 0 auto' },
  step: { display: 'inline-flex', alignItems: 'center', gap: 7, border: '1px solid var(--line)', background: 'var(--paper)', borderRadius: 999, padding: '7px 13px', margin: '4px 0', cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: 'var(--shadow-sm)', transition: 'border-color 200ms ease, box-shadow 200ms ease' },
  stepDot: { width: 8, height: 8, borderRadius: 999, flex: '0 0 auto' },
  bottleneckTag: { fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--paper)', background: 'var(--gating)', borderRadius: 999, padding: '2px 7px' },
  stepDetail: { marginTop: 14, border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', padding: 16, background: 'var(--paper)', boxShadow: 'var(--shadow-sm)' },
  gateChip: { fontSize: 11, border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 999, padding: '2px 9px', cursor: 'pointer', color: 'var(--ink-soft)', transition: 'background 180ms ease' },
  unresolved: { marginTop: 34, borderTop: '1px solid var(--line)', paddingTop: 20 },
  ul: { margin: 0, paddingLeft: 18 },
  li: { fontSize: 13, lineHeight: 1.6, marginBottom: 6, color: 'var(--ink-soft)' },
  footer: { marginTop: 34, paddingTop: 18, borderTop: '1px solid var(--line)', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.55 },
}
