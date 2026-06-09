// ─────────────────────────────────────────────────────────────────────────
// src/model/scenarios.ts — the WHAT-IF layer. Turns the unresolved unknowns
// (the leverage-ranked items the engine cannot fetch) into interactive levers,
// recomputes the composite under any combination, and runs a one-at-a-time
// sensitivity sweep (the tornado) to rank which single unknown moves the
// composite most.
//
// Pure + isomorphic — no node, no fetch. The instrument imports it directly.
// Baseline (option 0 of every lever) reproduces the model exactly: each option
// carries only the OVERRIDE it applies, so an unselected/baseline lever changes
// nothing. This keeps the levers honest against whatever the pipeline computed.
// ─────────────────────────────────────────────────────────────────────────
import type { FeasibilityModel, Gate, Status } from './types'

export interface LeverOption {
  label: string
  /** one-line consequence shown under the control */
  detail: string
  /** the override this option applies to its gate (empty = baseline, no change) */
  set: { readiness?: number; status?: Status; weight?: number }
}

export interface Lever {
  id: string
  /** the gate this lever drives */
  gate: string
  title: string
  /** the open question this lever resolves */
  question: string
  /** leverage rank tag carried from the unresolved ledger, e.g. '#1' */
  leverage?: string
  /** option 0 MUST be the current/baseline state (empty override) */
  options: LeverOption[]
}

// ── the levers — one per high-leverage unknown in the model.unresolved ledger ─
export const LEVERS: Lever[] = [
  {
    id: 'genset-total',
    gate: 'env-auth',
    leverage: '#1',
    title: 'ICPE genset thermal total',
    question:
      'What is the backup genset fleet’s puissance thermique nominale totale? It sets the 2910-vs-3110 boundary — the whole env-auth régime and timeline.',
    options: [
      { label: 'Unconfirmed → assume 3110 (current)', detail: 'Baseline: Autorisation track assumed, dossier not filed → gating, readiness 0.20.', set: {} },
      { label: '≥50 MW → 3110 Autorisation (confirmed)', detail: 'Classification confirmed but still the full étude d’impact + enquête publique route.', set: { status: 'gating', readiness: 0.28 } },
      { label: '20–<50 MW → 2910 Enregistrement', detail: 'Drops to the registration régime — no enquête publique; months not years.', set: { status: 'conditional', readiness: 0.6 } },
      { label: '<20 MW → 2910 Déclaration', detail: 'Lightest régime — a declaration only. Env-auth ceases to gate.', set: { status: 'clear', readiness: 0.85 } },
    ],
  },
  {
    id: 'rte-acceptance',
    gate: 'power',
    leverage: '#2',
    title: 'RTE 100 MW connection',
    question:
      'Where does the ~100 MW HTB consumption raccordement stand? Brittany is an electrical peninsula and the study is not initiated.',
    options: [
      { label: 'Study not initiated (current)', detail: 'Baseline: on-site 90 kV poste is a head-start but no capacity confirmation → readiness 0.40.', set: {} },
      { label: 'Study filed; capacity available', detail: 'PTF returned with capacity at the Poste de La Janais → readiness 0.70.', set: { readiness: 0.7 } },
      { label: 'Convention signed; capacity firm', detail: 'Raccordement secured — power ceases to be a feasibility risk.', set: { status: 'clear', readiness: 0.9 } },
      { label: 'No HTB capacity → reinforcement', detail: 'Multi-year grid reinforcement on the peninsula → power becomes gating.', set: { status: 'gating', readiness: 0.2 } },
    ],
  },
  {
    id: 'soil-state',
    gate: 'brownfield',
    leverage: '#3',
    title: 'Stellantis état des sols',
    question:
      'What does the ICPE cessation / état des sols reveal once the title is released? Drives the remediation scope.',
    options: [
      { label: 'Cessation not released (current)', detail: 'Baseline: legacy site, reconversion is the public plan → readiness 0.55.', set: {} },
      { label: 'Light remediation', detail: 'État des sols manageable for the build-ready usage → readiness 0.78.', set: { readiness: 0.78 } },
      { label: 'Heavy contamination + SIS', detail: 'Significant remediation and SIS construction constraints → brownfield gates.', set: { status: 'gating', readiness: 0.32 } },
    ],
  },
  {
    id: 'water-source',
    gate: 'water',
    title: 'Cooling make-up source',
    question:
      'Is the closed-loop make-up source defined and the IOTA authorisation routed away from the drinking-water captages?',
    options: [
      { label: 'Source undefined (current)', detail: 'Baseline: closed-loop lowers draw; make-up source and IOTA to be secured → readiness 0.55.', set: {} },
      { label: 'REUT / rainwater secured; IOTA filed', detail: 'Make-up secured off the potable aquifer → readiness 0.80.', set: { readiness: 0.8 } },
      { label: 'Must draw the protected aquifer', detail: 'No alternative make-up → conflict with the captage protection perimeter.', set: { status: 'gating', readiness: 0.3 } },
    ],
  },
  {
    id: 'reglement-graphique',
    gate: 'land-use',
    title: 'PLUi règlement graphique',
    question:
      'What do the parcel-level graphic numbers (height H, emprise, biotope V%, parking) and the OAP allow?',
    options: [
      { label: 'Graphic numbers unread (current)', detail: 'Baseline: zonage permits the use; binding numbers deferred → readiness 0.70.', set: {} },
      { label: 'Height/emprise/biotope compatible', detail: 'Graphic reads confirm the program fits → readiness 0.88.', set: { readiness: 0.88 } },
      { label: 'Graphic caps constrain the program', detail: 'Height or biotope caps force a redesign → readiness 0.45.', set: { readiness: 0.45 } },
    ],
  },
]

// verdict thresholds — mirror of evaluate.ts (kept local so this stays node-free)
export function verdictFromComposite(c: number): FeasibilityModel['verdict'] {
  return c >= 0.7 ? 'CLEAR' : c >= 0.35 ? 'CONDITIONAL' : 'GATING'
}

export type Selection = Record<string, number>

// ── how lever options bend the SCHEDULE ──────────────────────────────────────
// Non-baseline options can override activity durations (months) in schedule.ts,
// so resolving an unknown reshapes the Gantt and the critical path live.
//   leverId → optionIndex → { activityId: { min?, max? } }
type DurOverride = { min?: number; max?: number }
const SCHEDULE_EFFECTS: Record<string, Record<number, Record<string, DurOverride>>> = {
  'genset-total': {
    // 2910 Enregistrement — no enquête publique, lighter dossier
    2: { 'auth-env': { min: 4, max: 7 }, 'etude-impact': { min: 3, max: 6 } },
    // 2910 Déclaration — env-auth becomes a formality
    3: { 'auth-env': { min: 1, max: 2 }, 'etude-impact': { min: 1, max: 3 } },
  },
  'rte-acceptance': {
    1: { raccordement: { min: 18, max: 28 } },                          // capacity available
    2: { raccordement: { min: 12, max: 20 }, 'rte-study': { min: 0, max: 2 } }, // convention signed
    3: { raccordement: { min: 36, max: 54 } },                          // reinforcement needed
  },
  'soil-state': {
    1: { remediation: { min: 4, max: 9 } },    // light
    2: { remediation: { min: 18, max: 30 } },  // heavy + SIS
  },
  'reglement-graphique': {
    1: { 'permis-construire': { min: 4, max: 6 } },   // compatible
    2: { 'permis-construire': { min: 8, max: 14 } },  // caps → redesign
  },
}

/** Merge the schedule overrides implied by a lever selection (for computeSchedule). */
export function scheduleOverrides(sel: Selection): Record<string, DurOverride> {
  const out: Record<string, DurOverride> = {}
  for (const [id, idx] of Object.entries(sel)) {
    const eff = SCHEDULE_EFFECTS[id]?.[idx]
    if (eff) for (const [act, d] of Object.entries(eff)) out[act] = { ...out[act], ...d }
  }
  return out
}

const compositeOf = (gates: Pick<Gate, 'readiness' | 'weight'>[]) => {
  const w = gates.reduce((s, g) => s + g.weight, 0)
  return w ? gates.reduce((s, g) => s + g.readiness * g.weight, 0) / w : 0
}

export interface ScenarioResult {
  gates: Gate[]
  composite: number
  verdict: FeasibilityModel['verdict']
  /** composite delta vs the model baseline, in points (e.g. +6.3) */
  deltaPts: number
  /** ids of gates an active (non-baseline) lever touched */
  changed: string[]
}

/** Apply a selection of lever options to the model — pure, returns a derived view. */
export function applyScenario(model: FeasibilityModel, sel: Selection): ScenarioResult {
  const byId = new Map(LEVERS.map((l) => [l.id, l]))
  const changed = new Set<string>()
  const gates: Gate[] = model.gates.map((g) => ({ ...g }))
  const gateById = new Map(gates.map((g) => [g.id, g]))

  for (const [leverId, optIdx] of Object.entries(sel)) {
    if (!optIdx) continue // 0 = baseline
    const lever = byId.get(leverId)
    const gate = lever && gateById.get(lever.gate)
    const opt = lever?.options[optIdx]
    if (!lever || !gate || !opt) continue
    if (opt.set.readiness != null) gate.readiness = opt.set.readiness
    if (opt.set.status) gate.status = opt.set.status
    if (opt.set.weight != null) gate.weight = opt.set.weight
    changed.add(gate.id)
  }

  const composite = compositeOf(gates)
  return {
    gates,
    composite,
    verdict: verdictFromComposite(composite),
    deltaPts: (composite - model.composite) * 100,
    changed: [...changed],
  }
}

export interface TornadoBar {
  leverId: string
  title: string
  gate: string
  leverage?: string
  /** lowest composite reachable by this lever alone (others at baseline), 0–1 */
  low: number
  /** highest composite reachable by this lever alone, 0–1 */
  high: number
  /** swing = high − low, in points — the sort key */
  swingPts: number
  /** option labels at the low and high ends */
  lowLabel: string
  highLabel: string
}

/**
 * One-at-a-time sensitivity: vary each lever across all its options with the
 * rest at baseline, measure the composite span. Sorted by swing — the classic
 * tornado. Answers "which single unknown should we resolve first?".
 */
export function sensitivity(model: FeasibilityModel): {
  baseline: number
  bars: TornadoBar[]
} {
  const baseline = model.composite
  const bars: TornadoBar[] = LEVERS.map((lever) => {
    let low = { c: Infinity, label: '' }
    let high = { c: -Infinity, label: '' }
    lever.options.forEach((_, i) => {
      const c = applyScenario(model, { [lever.id]: i }).composite
      if (c < low.c) low = { c, label: lever.options[i].label }
      if (c > high.c) high = { c, label: lever.options[i].label }
    })
    return {
      leverId: lever.id,
      title: lever.title,
      gate: lever.gate,
      leverage: lever.leverage,
      low: low.c,
      high: high.c,
      swingPts: (high.c - low.c) * 100,
      lowLabel: low.label,
      highLabel: high.label,
    }
  }).sort((a, b) => b.swingPts - a.swingPts)
  return { baseline, bars }
}
