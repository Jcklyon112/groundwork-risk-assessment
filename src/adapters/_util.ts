// ─────────────────────────────────────────────────────────────────────────
// src/adapters/_util.ts — shared helpers for the keyless data adapters.
// Runs under node (via tsx). Provides: geometry math, fetch-with-retry, and
// the cache writer that persists raw response + ISO fetched_at (audit trail).
// ─────────────────────────────────────────────────────────────────────────
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
export const ROOT = resolve(__dirname, '..', '..')
export const CACHE_RAW = resolve(ROOT, 'cache', 'raw')

export type Lng = number
export type Lat = number
export type Position = [Lng, Lat]

export interface SiteGeometry {
  insee: string
  commune: string
  campus_point: Position
  centroid: Position
  /** outer ring of the brownfield boundary polygon */
  ring: Position[]
  /** the full Polygon geometry, ready to pass to GeoJSON APIs */
  polygon: { type: 'Polygon'; coordinates: Position[][] }
}

/** Load the canonical site geometry from src/data/site.geojson. */
export function loadSite(): SiteGeometry {
  const raw = JSON.parse(readFileSync(resolve(ROOT, 'src', 'data', 'site.geojson'), 'utf8'))
  const props = raw.properties
  const boundary = raw.features.find((f: any) => f.properties?.kind === 'boundary')
  const ring: Position[] = boundary.geometry.coordinates[0]
  return {
    insee: props.insee,
    commune: props.commune,
    campus_point: props.campus_point,
    centroid: props.centroid,
    ring,
    polygon: { type: 'Polygon', coordinates: [ring] },
  }
}

/**
 * Synthesize a SiteGeometry from a single point (screening mode). Builds a
 * square ring ~`halfM` metres around the point so polygon-intersect adapters
 * (GPU) still work; centroid = campus_point = the point. This is a screening
 * footprint, not a cadastral parcel — the UI flags it as such.
 */
export function siteFromPoint(
  lon: number, lat: number, insee: string, commune: string, halfM = 200,
): SiteGeometry {
  const dLat = halfM / 111_320
  const dLon = halfM / (111_320 * Math.cos((lat * Math.PI) / 180))
  const ring: Position[] = [
    [lon - dLon, lat - dLat], [lon + dLon, lat - dLat],
    [lon + dLon, lat + dLat], [lon - dLon, lat + dLat],
    [lon - dLon, lat - dLat],
  ]
  return {
    insee, commune,
    campus_point: [lon, lat], centroid: [lon, lat],
    ring, polygon: { type: 'Polygon', coordinates: [ring] },
  }
}

/** Haversine distance in metres between two [lng,lat] points. */
export function haversineM(a: Position, b: Position): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b[1] - a[1])
  const dLng = toRad(a[0] - b[0]) * -1 // sign irrelevant after square
  const lat1 = toRad(a[1])
  const lat2 = toRad(b[1])
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Bounding box [minLng, minLat, maxLng, maxLat] of a ring. */
export function bbox(ring: Position[]): [number, number, number, number] {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [x, y] of ring) {
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  }
  return [minX, minY, maxX, maxY]
}

/** Sleep helper. */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export interface FetchResult {
  ok: boolean
  status: number
  url: string
  /** parsed JSON if the response was JSON, else null */
  json: any
  /** raw text body */
  text: string
  fetched_at: string
  attempts: number
  error?: string
}

/**
 * Fetch with up to `retries` attempts and exponential backoff. Never throws —
 * returns a FetchResult describing success or the gap. Always records the ISO
 * fetched_at so the caller can persist provenance even on failure.
 */
export async function fetchWithRetry(
  url: string,
  opts: RequestInit & { retries?: number; timeoutMs?: number } = {},
): Promise<FetchResult> {
  const retries = opts.retries ?? 3
  const timeoutMs = opts.timeoutMs ?? 30000
  let lastErr = ''
  let lastStatus = 0
  for (let attempt = 1; attempt <= retries; attempt++) {
    const fetched_at = new Date().toISOString()
    try {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), timeoutMs)
      const res = await fetch(url, {
        ...opts,
        signal: ctrl.signal,
        headers: { 'User-Agent': 'la-janais-feasibility-engine/0.1 (keyless research tool)', ...opts.headers },
      })
      clearTimeout(timer)
      lastStatus = res.status
      const text = await res.text()
      let json: any = null
      try { json = JSON.parse(text) } catch { /* not JSON */ }
      if (res.ok) {
        return { ok: true, status: res.status, url, json, text, fetched_at, attempts: attempt }
      }
      lastErr = `HTTP ${res.status}: ${text.slice(0, 200)}`
    } catch (e: any) {
      lastErr = e?.message ?? String(e)
    }
    if (attempt < retries) await sleep(500 * 2 ** (attempt - 1))
  }
  return {
    ok: false, status: lastStatus, url, json: null, text: '',
    fetched_at: new Date().toISOString(), attempts: retries, error: lastErr,
  }
}

// Raw-cache namespace: screening fetches route their audit trail into a
// subfolder so they never clobber the canonical La Janais raw responses.
let RAW_NS = ''
export function setRawNamespace(ns: string): void {
  RAW_NS = ns.replace(/[^a-z0-9_-]/gi, '')
}
function rawDir(): string {
  return RAW_NS ? resolve(CACHE_RAW, RAW_NS) : CACHE_RAW
}

/** Persist a raw response (the audit trail) to cache/raw[/<ns>]/<name>.json. */
export function persistRaw(name: string, payload: unknown): string {
  const dir = rawDir()
  mkdirSync(dir, { recursive: true })
  const path = resolve(dir, `${name}.json`)
  writeFileSync(path, JSON.stringify(payload, null, 2), 'utf8')
  return path
}

/** Encode a GeoJSON geometry for the apicarto `geom` query param. */
export function geomParam(geom: unknown): string {
  return encodeURIComponent(JSON.stringify(geom))
}
