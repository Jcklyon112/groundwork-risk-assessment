// ─────────────────────────────────────────────────────────────────────────
// src/model/schedule.ts — the TIMELINE layer. The permitting pathway encodes
// order + the regulatory bottleneck; this adds DURATIONS and DEPENDENCIES so we
// can run a critical-path method (CPM) pass and answer the developer's real
// question: "when can we energise / break ground, and what's the long pole?"
//
// The point it surfaces: the regulatory BOTTLENECK (env-auth) and the schedule
// LONG POLE need not be the same activity — the HTB raccordement runs in
// PARALLEL with the environmental chain, so CPM shows their slack relationship
// instead of collapsing everything onto one "bottleneck".
//
// Durations are PLANNING ASSUMPTIONS (month ranges), not fetched facts — the
// UI labels them as such. Pure + isomorphic.
// ─────────────────────────────────────────────────────────────────────────

export type Track = 'Site' | 'Environmental' | 'Power' | 'Construction'

export interface Activity {
  id: string
  label: string
  track: Track
  /** the feasibility gate this activity belongs to (links back to the model) */
  gate?: string
  /** optimistic / conservative duration in months */
  min: number
  max: number
  dependsOn: string[]
  note: string
  /** discretionary external decision (vs. project-controlled work) */
  discretionary?: boolean
}

// Ordered roughly by start; the CPM pass derives the real timing from dependsOn.
export const SCHEDULE: Activity[] = [
  { id: 'site-control', label: 'Site control (land assembly)', track: 'Site', gate: 'brownfield', min: 0, max: 6, dependsOn: [], note: '240 ha former Citroën/PSA/Stellantis plant; ~100 ha reconversion pole. Public development zone (ZAC) exists; data-centre end-use not yet secured (Rennes Métropole steers the site to a low-carbon industrial park).' },
  { id: 'icpe-classification', label: 'Industrial classification (ICPE)', track: 'Environmental', gate: 'env-auth', min: 1, max: 3, dependsOn: ['site-control'], note: 'Confirm heading 3110 genset total with the regional authority (DREAL Bretagne).' },
  { id: 'etude-impact', label: 'Environmental impact assessment', track: 'Environmental', gate: 'env-auth', min: 6, max: 12, dependsOn: ['icpe-classification'], note: 'Mandatory for the IED installation; the first deliverable feeding the environmental authorisation.' },
  { id: 'auth-env', label: 'Environmental authorisation', track: 'Environmental', gate: 'env-auth', min: 9, max: 15, dependsOn: ['etude-impact'], discretionary: true, note: 'Single procedure: DREAL review + public inquiry + environmental-authority opinion + prefectural order. The Green Industry Law parallelised it (~17→9 mo for complete dossiers). Discretionary — route mapped, outcome with the authorities.' },
  { id: 'remediation', label: 'Soil remediation (build-ready)', track: 'Site', gate: 'brownfield', min: 6, max: 18, dependsOn: ['site-control'], note: 'Diagnostic + management plan + works, once the Stellantis closure releases the soil-condition report.' },
  { id: 'rte-study', label: 'Grid connection study (RTE)', track: 'Power', gate: 'power', min: 6, max: 12, dependsOn: ['site-control'], note: 'Connection study for the ~100 MW HTB draw on the Brittany peninsula.' },
  { id: 'raccordement', label: 'HTB grid connection works', track: 'Power', gate: 'power', min: 24, max: 36, dependsOn: ['rte-study'], note: 'Connection agreement + network reinforcement — the long-lead grid item, runs in parallel with permitting.' },
  { id: 'permis-construire', label: 'Building permit', track: 'Environmental', gate: 'land-use', min: 5, max: 8, dependsOn: ['etude-impact'], note: 'Local plan (zone UI1/UI1j); can run partly in parallel with the environmental authorisation.' },
  { id: 'build', label: 'Construction', track: 'Construction', min: 18, max: 24, dependsOn: ['auth-env', 'permis-construire', 'remediation'], note: 'Starts once the environmental authorisation and the building permit are both in hand and the site is remediated.' },
  { id: 'energization', label: 'Energisation', track: 'Power', gate: 'power', min: 1, max: 3, dependsOn: ['raccordement', 'build'], note: 'Commissioning once both the grid connection works and the building are complete.' },
]

export interface Scheduled extends Activity {
  dur: number
  /** earliest start / finish (months from t0) */
  es: number
  ef: number
  /** latest start / finish without delaying the project */
  ls: number
  lf: number
  /** lf − ef; 0 = on the critical path */
  slack: number
  critical: boolean
}

export interface ScheduleResult {
  activities: Scheduled[]
  /** total project duration in months for this scenario (max EF) */
  totalMonths: number
  /** ids on the critical path, in start order */
  criticalPath: string[]
  /** the single longest activity on the critical path */
  longPole: Scheduled
  /** the near-critical parallel activity with the least non-zero slack */
  nearCritical?: Scheduled
  /** EF of the env-auth autorisation step — the regulatory bottleneck finish */
  regulatoryBottleneckMonth: number
}

/**
 * Critical-path method over SCHEDULE. `which` picks optimistic vs conservative
 * durations; `overrides` lets scenario levers bend specific activity durations
 * (months) so the Gantt + critical path react to resolved unknowns.
 */
export function computeSchedule(
  which: 'min' | 'max' = 'max',
  overrides: Record<string, { min?: number; max?: number }> = {},
): ScheduleResult {
  const acts: Scheduled[] = SCHEDULE.map((a) => {
    const ov = overrides[a.id] ?? {}
    const min = ov.min ?? a.min
    const max = ov.max ?? a.max
    return {
      ...a, min, max, dur: which === 'max' ? max : min,
      es: 0, ef: 0, ls: 0, lf: 0, slack: 0, critical: false,
    }
  })
  const byId = new Map(acts.map((a) => [a.id, a]))

  // topological order (Kahn) so forward/backward passes are single-sweep
  const order: Scheduled[] = []
  const indeg = new Map(acts.map((a) => [a.id, a.dependsOn.length]))
  const queue = acts.filter((a) => a.dependsOn.length === 0)
  const dependents = new Map<string, string[]>()
  for (const a of acts) for (const d of a.dependsOn) (dependents.get(d) ?? dependents.set(d, []).get(d)!).push(a.id)
  while (queue.length) {
    const a = queue.shift()!
    order.push(a)
    for (const depId of dependents.get(a.id) ?? []) {
      indeg.set(depId, (indeg.get(depId) ?? 0) - 1)
      if (indeg.get(depId) === 0) queue.push(byId.get(depId)!)
    }
  }

  // forward pass — earliest start/finish
  for (const a of order) {
    a.es = a.dependsOn.reduce((m, d) => Math.max(m, byId.get(d)!.ef), 0)
    a.ef = a.es + a.dur
  }
  const totalMonths = Math.max(...acts.map((a) => a.ef))

  // backward pass — latest start/finish
  for (let i = order.length - 1; i >= 0; i--) {
    const a = order[i]
    const succ = dependents.get(a.id) ?? []
    a.lf = succ.length ? Math.min(...succ.map((s) => byId.get(s)!.ls)) : totalMonths
    a.ls = a.lf - a.dur
    a.slack = a.lf - a.ef
    a.critical = a.slack === 0
  }

  const criticalPath = order.filter((a) => a.critical).sort((a, b) => a.es - b.es).map((a) => a.id)
  const longPole = acts.filter((a) => a.critical).sort((a, b) => b.dur - a.dur)[0]
  const nearCritical = acts
    .filter((a) => !a.critical && a.slack > 0)
    .sort((a, b) => a.slack - b.slack)[0]
  const regulatoryBottleneckMonth = byId.get('auth-env')!.ef

  return { activities: order.sort((a, b) => a.es - b.es || a.ef - b.ef), totalMonths, criticalPath, longPole, nearCritical, regulatoryBottleneckMonth }
}
