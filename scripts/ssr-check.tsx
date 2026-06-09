// Server-render the instrument to static HTML and assert it renders correctly
// (no browser needed). Run: npx tsx scripts/ssr-check.tsx
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import FeasibilityInstrument from '../src/components/FeasibilityInstrument.tsx'
import type { FeasibilityModel } from '../src/model/types.ts'

// npm scripts run from the project root; resolve from cwd so this works whether
// run via tsx (scripts/) or as a bundle (cache/raw/).
const ROOT = process.cwd()
const model = JSON.parse(readFileSync(resolve(ROOT, 'src/data/model.json'), 'utf8')) as FeasibilityModel

const raw = renderToStaticMarkup(createElement(FeasibilityInstrument, { model }))
// decode the few entities React escapes so plain-text assertions match (e.g. d'impact)
const html = raw
  .replace(/&#x27;/g, "'")
  .replace(/&#x2F;/g, '/')
  .replace(/&quot;/g, '"')
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')

const checks: [string, boolean][] = [
  ['renders an <svg>', html.includes('<svg')],
  ['composite % in centre', html.includes(`${Math.round(model.composite * 100)}%`)],
  ['verdict shown', html.includes(model.verdict)],
  ['80% risk marker', html.includes('80% risk')],
  ['all six gates labelled', model.gates.every((g) => html.includes(g.short))],
  ['pathway steps present', model.pathway.every((s) => html.includes(s.label))],
  ['bottleneck tag', html.includes('bottleneck')],
  ['no NaN in SVG paths', !/NaN/.test(html)],
  ['open-items ledger', html.includes('Open items') && model.unresolved.every((u) => html.includes(u))],
  ['scope stated', html.includes('build permit') && html.includes('binding constraint')],
  ['provenance timestamp', html.includes(model.generated_at.slice(0, 10))],
]

let ok = true
for (const [name, pass] of checks) {
  console.log(`${pass ? '✓' : '✗'} ${name}`)
  if (!pass) ok = false
}
// count wedge paths (each gate → multiple <path>); sanity that geometry emitted
const pathCount = (html.match(/<path /g) || []).length
console.log(`  emitted ${pathCount} <path> elements, html length ${html.length}`)
console.log(ok ? '\nSSR CHECK PASSED' : '\nSSR CHECK FAILED')
process.exit(ok ? 0 : 1)
