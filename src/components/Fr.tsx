// ─────────────────────────────────────────────────────────────────────────
// Fr.tsx — renders English prose with the official French legal/document names
// kept in French and italicised, so a non-French reader sees English copy and
// the exact instrument names their counsel will file. <Fr t="…" />.
// ─────────────────────────────────────────────────────────────────────────
import { Fragment } from 'react'

// official French instrument / procedure names to keep + italicise (longest first)
const TERMS = [
  'raison impérative d’intérêt public majeur',
  'autorisation environnementale',
  'dérogation espèces protégées',
  'recours pour excès de pouvoir',
  'éviter-réduire-compenser',
  'arrêté préfectoral',
  'permis de construire',
  'règlement graphique',
  'règlement littéral',
  'maîtrise foncière',
  'enquête publique',
  'recours des tiers',
  'mise sous tension',
  'procédure unique',
  'étude d’impact',
  'état des sols',
  'Fonds Chaleur',
  'raccordement',
  'captage',
  'gabarit',
].sort((a, b) => b.length - a.length)

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/['’]/g, "['’]")
const PATTERN = '(' + TERMS.map(esc).join('|') + ')'
const SPLIT = new RegExp(PATTERN, 'i')
const TEST = new RegExp('^' + PATTERN + '$', 'i')

export function Fr({ t }: { t: string }) {
  if (!t) return null
  const parts = t.split(SPLIT)
  return (
    <>
      {parts.map((p, i) =>
        TEST.test(p) ? <i key={i} style={{ fontStyle: 'italic' }}>{p}</i> : <Fragment key={i}>{p}</Fragment>,
      )}
    </>
  )
}
