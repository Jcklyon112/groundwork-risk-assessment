// ─────────────────────────────────────────────────────────────────────────
// src/model/types.ts — the data contract between the fetch/compute pipeline
// and the FeasibilityInstrument. The pipeline writes a FeasibilityModel as
// JSON; the instrument reads it. Nothing here is invented at render time.
// ─────────────────────────────────────────────────────────────────────────

export type Status = 'clear' | 'conditional' | 'gating'
export type Confidence = 'high' | 'medium' | 'low'

/** One fetched / researched value with its full provenance (the audit trail). */
export interface LiveValue {
  /** human-readable headline value for the gate */
  value: string
  /** the source system / dataset */
  source: string
  /** drill-down URL to the source */
  url: string
  /** ISO timestamp when fetched (or when the research was recorded) */
  fetched_at: string
  confidence: Confidence
  /** true when the figure is a forward-looking design target, not a fetched fact */
  designTarget?: boolean
  /** true when the value is a non-binding snapshot (e.g. capacity registers) */
  snapshot?: boolean
  /** optional extra provenance lines shown in the drill-down */
  notes?: string[]
}

/** A supporting fact behind a gate (kept separate from the headline LiveValue). */
export interface Fact {
  label: string
  value: string
  source: string
  url: string
  fetched_at: string
  confidence: Confidence
  designTarget?: boolean
  snapshot?: boolean
}

export interface Gate {
  id: string
  name: string
  /** short label for the wedge */
  short: string
  status: Status
  /** risk share, sums to 100 across gates → drives wedge angle (Pareto) */
  weight: number
  /** 0–1, how far the gate is from clearable → inner gauge */
  readiness: number
  /** the regulation / framework that governs this gate */
  regulation: string
  /** ordered actions that push the paperwork through this gate */
  permitting: string[]
  /** the headline fetched/derived value with provenance */
  live: LiveValue
  /** the explicit rule that mapped value → status/readiness (documented here) */
  rule: string
  /** supporting fetched facts */
  facts: Fact[]
}

/** One step in the global application pathway. */
export interface PathwayStep {
  id: string
  label: string
  authority: string
  /** which gate(s) this step depends on */
  gates: string[]
  /** cleared | active (current bottleneck) | pending */
  state: 'cleared' | 'active' | 'pending'
  note?: string
}

export interface FeasibilityModel {
  site: {
    name: string
    commune: string
    insee: string
    centroid: [number, number]
    campus_point: [number, number]
  }
  /**
   * 'reference' = the canonical La Janais assessment (data axes + site-specific
   * research). 'screening' = an arbitrary parcel: the fetchable data axes are
   * live for that point, but the discretionary/researched parts (exact ICPE
   * classification, PLUi règlement specifics) are NOT re-researched — they are
   * flagged as needing per-parcel work. Defaults to 'reference' when absent.
   */
  mode?: 'reference' | 'screening'
  /** screening only — what was carried from the reference vs. fetched live */
  referenceNote?: string
  generated_at: string
  gates: Gate[]
  /** Σ(readiness·weight)/Σweight, 0–1 */
  composite: number
  /** overall verdict derived from composite */
  verdict: 'CLEAR' | 'CONDITIONAL' | 'GATING'
  pathway: PathwayStep[]
  /** id of the current bottleneck step */
  bottleneck: string
  /** items that could not be resolved from open data / research */
  unresolved: string[]
}
