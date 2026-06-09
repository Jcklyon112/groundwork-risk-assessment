// ─────────────────────────────────────────────────────────────────────────
// src/api/client.ts — typed fetch client for the local backend API.
// Uses relative /api/* URLs (Vite proxies to the Express server in dev; in
// production both sit behind one origin).
// ─────────────────────────────────────────────────────────────────────────
import type { FeasibilityModel } from '../model/types'
import bundledModel from '../data/model.json'

// Static fallback: when no backend is reachable (e.g. the published Vercel site),
// read the computed model bundled at build time and the trimmed sources manifest.
let staticSources: Promise<any[]> | null = null
const loadStaticSources = () => (staticSources ??= fetch('/sources.json').then((r) => r.json()))

export interface SourceMeta {
  name: string
  file: string
  bytes: number
  fetched_at?: string
  status?: number
  request?: string
}

export interface RefreshResult {
  ok: boolean
  lastRefresh?: string
  composite?: number
  verdict?: string
  bottleneck?: string
  log?: string[]
  error?: string
}

export interface Health {
  ok: boolean
  service: string
  generated_at: string
  lastRefresh: string | null
}

export interface AgentStep {
  type: 'text' | 'tool' | 'search'
  text?: string
  name?: string
  input?: unknown
  resultSummary?: string
  query?: string
}

export interface AgentTurn {
  ok: boolean
  answer: string
  steps: AgentStep[]
  model: string
  usage?: { input: number; output: number }
  error?: string
}

export interface AgentInfo {
  configured: boolean
  model: string
}

export interface ScreenResult {
  ok: boolean
  model?: FeasibilityModel
  geocode?: { label: string; lon: number; lat: number; insee: string }
  log?: string[]
  error?: string
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`/api${path}`)
  if (!res.ok) throw new Error(`GET /api${path} → ${res.status}`)
  return res.json() as Promise<T>
}

export const api = {
  health: () => get<Health>('/health'),
  async model(): Promise<FeasibilityModel> {
    try { return await get<FeasibilityModel>('/model') } catch { return bundledModel as unknown as FeasibilityModel }
  },
  async sources(): Promise<{ sources: SourceMeta[] }> {
    try { return await get<{ sources: SourceMeta[] }>('/sources') } catch {
      const arr = await loadStaticSources()
      return { sources: arr.map((s: any) => ({ name: s.name, file: `${s.name}.json`, bytes: s.bytes, fetched_at: s.fetched_at, status: s.status, request: s.request })) }
    }
  },
  async source(name: string): Promise<any> {
    try { return await get<any>(`/sources/${name}`) } catch {
      const arr = await loadStaticSources()
      return arr.find((s: any) => s.name === name)?.sample ?? 'unavailable'
    }
  },
  site: () => get<any>('/site'),
  async refresh(): Promise<RefreshResult> {
    const res = await fetch('/api/refresh', { method: 'POST' })
    return res.json() as Promise<RefreshResult>
  },
  agent: () => get<AgentInfo>('/agent'),
  async screen(address: string): Promise<ScreenResult> {
    const res = await fetch('/api/screen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: body.error ?? `HTTP ${res.status}` }
    return body as ScreenResult
  },
  async ask(question: string): Promise<AgentTurn> {
    const res = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      return { ok: false, answer: '', steps: [], model: '', error: body.error ?? `HTTP ${res.status}` }
    }
    return res.json() as Promise<AgentTurn>
  },
}
