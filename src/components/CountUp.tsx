// ─────────────────────────────────────────────────────────────────────────
// CountUp — a tiny rAF count-up so figures animate to their value when they
// mount or change (the dial composite, gate readiness, scenario deltas…).
// Makes the instrument feel live. easeOutCubic, respects reduced-motion.
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react'

// Settle to the final value (no animation) on the server / in non-DOM test
// renders, and when the user prefers reduced motion. The app renders client-only
// (no hydration), so there's no mismatch — the browser still animates from 0.
const settleImmediately =
  typeof window === 'undefined' ||
  !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches

/** Animate from the previous value to `target` (from 0 on first mount). */
export function useCountUp(target: number, duration = 650): number {
  const [val, setVal] = useState(settleImmediately ? target : 0)
  const from = useRef(settleImmediately ? target : 0)
  const raf = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (settleImmediately || typeof performance === 'undefined') {
      setVal(target); from.current = target; return
    }
    const a = from.current
    const b = target
    if (a === b) { setVal(b); return }
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3) // easeOutCubic
      const v = a + (b - a) * eased
      setVal(v)
      if (t < 1) raf.current = requestAnimationFrame(tick)
      else from.current = b
    }
    raf.current = requestAnimationFrame(tick)
    return () => { if (raf.current) cancelAnimationFrame(raf.current) }
  }, [target, duration])

  return val
}

/** Inline animated number, e.g. <CountUp value={39} suffix="%" />. */
export function CountUp({
  value, duration = 650, decimals = 0, prefix = '', suffix = '', signed = false,
}: {
  value: number
  duration?: number
  decimals?: number
  prefix?: string
  suffix?: string
  /** show an explicit + for non-negative values (deltas) */
  signed?: boolean
}) {
  const v = useCountUp(value, duration)
  const sign = signed && v > 0 ? '+' : ''
  const n = decimals > 0 ? v.toFixed(decimals) : Math.round(v).toString()
  return <>{sign}{prefix}{n}{suffix}</>
}
