// ─────────────────────────────────────────────────────────────────────────
// AskPanel.tsx — "Ask the engine" (#4). A chat-style surface over the
// tool-using agent (POST /api/ask). Renders the final answer AND the visible
// agent trace — every live tool call and web search — so the reasoning is
// transparent, not a black box. Example prompts include a live ICPE
// re-derivation (#1: model reasoning over current sources at runtime).
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react'
import { api, type AgentTurn, type AgentStep } from '../api/client'

const EXAMPLES = [
  'Re-derive the ICPE classification for a 100 MW liquid-cooled data centre live, and tell me whether it needs autorisation environnementale.',
  'What is the current land-use zoning at the La Janais site, and does it permit an industrial data centre?',
  'How far is the nearest district-heating network, and is heat offtake a blocker?',
  'Summarise the feasibility composite and the current bottleneck, with the top unresolved item.',
  'Is the 100 MW power draw feasible here? Be precise about injection vs consumption.',
]

interface Exchange {
  question: string
  turn?: AgentTurn
  pending: boolean
}

export default function AskPanel() {
  const [configured, setConfigured] = useState<boolean | null>(null)
  const [model, setModel] = useState('')
  const [input, setInput] = useState('')
  const [log, setLog] = useState<Exchange[]>([])
  const [busy, setBusy] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api.agent().then((a) => { setConfigured(a.configured); setModel(a.model) }).catch(() => setConfigured(false))
  }, [])
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [log])

  async function ask(q: string) {
    const question = q.trim()
    if (!question || busy) return
    setInput('')
    setBusy(true)
    setLog((l) => [...l, { question, pending: true }])
    const turn = await api.ask(question)
    setLog((l) => l.map((e, i) => (i === l.length - 1 ? { ...e, turn, pending: false } : e)))
    setBusy(false)
  }

  return (
    <div style={S.wrap}>
      <div style={S.head}>
        <h2 style={S.title}>Ask the engine</h2>
        <p style={S.sub}>
          A tool-using agent ({model || '…'}) orchestrates the live French open-data sources and
          web search at runtime, then answers with citations. Every tool call and search is shown.
        </p>
        {configured === false && (
          <div style={S.warn}>
            <b>Agent not configured.</b> Set <code style={S.code}>ANTHROPIC_API_KEY</code> in the
            server environment and restart it (<code style={S.code}>npm run server</code>). The rest
            of the platform works without it.
          </div>
        )}
      </div>

      {log.length === 0 && (
        <div style={S.examples}>
          <div style={S.examplesLabel}>Try</div>
          {EXAMPLES.map((e) => (
            <button key={e} onClick={() => ask(e)} disabled={configured === false} style={S.chip}>{e}</button>
          ))}
        </div>
      )}

      <div style={S.thread}>
        {log.map((ex, i) => (
          <div key={i} style={S.exchange}>
            <div style={S.q}>{ex.question}</div>
            {ex.pending && <div style={S.pending}>◷ agent working — calling live tools…</div>}
            {ex.turn && <TurnView turn={ex.turn} />}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <form
        style={S.form}
        onSubmit={(e) => { e.preventDefault(); ask(input) }}
      >
        <input
          style={S.input}
          placeholder={configured === false ? 'Set ANTHROPIC_API_KEY to enable…' : 'Ask about feasibility, zoning, ICPE, power, water, heat…'}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={busy || configured === false}
        />
        <button type="submit" style={S.send} disabled={busy || configured === false || !input.trim()}>
          {busy ? '…' : 'Ask'}
        </button>
      </form>
    </div>
  )
}

function TurnView({ turn }: { turn: AgentTurn }) {
  if (!turn.ok) return <div style={S.error}>{turn.error ?? 'Agent error'}</div>
  return (
    <div>
      {turn.steps.filter((s) => s.type !== 'text').length > 0 && (
        <details style={S.trace}>
          <summary style={S.traceSummary}>
            agent trace — {turn.steps.filter((s) => s.type === 'tool').length} tool calls,{' '}
            {turn.steps.filter((s) => s.type === 'search').length} web searches
          </summary>
          <div style={{ marginTop: 8 }}>
            {turn.steps.map((s, i) => <StepView key={i} step={s} />)}
          </div>
        </details>
      )}
      <div style={S.answer}>{turn.answer || '(no answer)'}</div>
      {turn.usage && (
        <div style={S.usage}>{turn.model} · {turn.usage.input.toLocaleString()} in / {turn.usage.output.toLocaleString()} out tokens</div>
      )}
    </div>
  )
}

function StepView({ step }: { step: AgentStep }) {
  if (step.type === 'text') return null
  if (step.type === 'search') {
    return <div style={S.step}><span style={{ ...S.stepTag, background: '#0b6bcb' }}>web_search</span><span style={S.stepBody}>{step.query}</span></div>
  }
  return (
    <div style={S.step}>
      <span style={{ ...S.stepTag, background: 'var(--ink)' }}>{step.name}</span>
      <span style={S.stepBody}>
        {!!step.input && Object.keys(step.input as object).length > 0 && (
          <code style={S.stepInput}>{JSON.stringify(step.input)}</code>
        )}
        <span style={S.stepResult}>→ {step.resultSummary}</span>
      </span>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  wrap: { maxWidth: 900, margin: '0 auto', padding: '24px 22px 40px', display: 'flex', flexDirection: 'column', minHeight: '70vh' },
  head: { marginBottom: 14 },
  title: { margin: 0, fontSize: 22, fontWeight: 800 },
  sub: { color: 'var(--muted)', fontSize: 14, margin: '6px 0 0', lineHeight: 1.5 },
  warn: { marginTop: 12, border: '1px solid var(--line)', borderLeft: '4px solid var(--conditional)', borderRadius: 8, padding: 14, fontSize: 14, background: '#fffdf5' },
  code: { fontFamily: 'ui-monospace, monospace', background: '#f4f4f5', borderRadius: 4, padding: '1px 6px', fontSize: 13 },
  examples: { display: 'flex', flexDirection: 'column', gap: 8, margin: '8px 0 18px', alignItems: 'flex-start' },
  examplesLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--muted)', fontWeight: 700 },
  chip: { textAlign: 'left', border: '1px solid var(--line)', background: 'var(--paper)', borderRadius: 8, padding: '8px 12px', fontSize: 13, cursor: 'pointer', lineHeight: 1.4, maxWidth: '100%' },
  thread: { flex: 1, display: 'flex', flexDirection: 'column', gap: 18 },
  exchange: { display: 'flex', flexDirection: 'column', gap: 8 },
  q: { alignSelf: 'flex-end', background: 'var(--ink)', color: 'var(--paper)', borderRadius: '12px 12px 2px 12px', padding: '8px 13px', fontSize: 14, maxWidth: '85%', lineHeight: 1.45 },
  pending: { color: 'var(--muted)', fontSize: 13 },
  answer: { whiteSpace: 'pre-wrap', fontSize: 14.5, lineHeight: 1.6, border: '1px solid var(--line)', borderRadius: '12px 12px 12px 2px', padding: '12px 14px', background: '#fafafa' },
  error: { color: 'var(--gating)', fontSize: 14, border: '1px solid var(--line)', borderLeft: '4px solid var(--gating)', borderRadius: 8, padding: 12 },
  usage: { fontSize: 11, color: 'var(--muted)', marginTop: 6 },
  trace: { border: '1px solid var(--line)', borderRadius: 8, padding: '8px 12px', marginBottom: 8, background: 'var(--paper)' },
  traceSummary: { fontSize: 12.5, color: 'var(--muted)', cursor: 'pointer', fontWeight: 600 },
  step: { display: 'flex', gap: 8, alignItems: 'baseline', padding: '4px 0', borderBottom: '1px dashed var(--line)' },
  stepTag: { color: 'var(--paper)', borderRadius: 4, padding: '1px 7px', fontSize: 11, fontWeight: 700, fontFamily: 'ui-monospace, monospace', flex: '0 0 auto' },
  stepBody: { fontSize: 12, color: 'var(--ink)', minWidth: 0, lineHeight: 1.5, overflowWrap: 'anywhere' },
  stepInput: { fontFamily: 'ui-monospace, monospace', color: 'var(--muted)', marginRight: 6 },
  stepResult: { color: 'var(--muted)' },
  form: { display: 'flex', gap: 8, marginTop: 16, position: 'sticky', bottom: 0, background: 'var(--paper)', paddingTop: 8 },
  input: { flex: 1, border: '1px solid var(--line-strong)', borderRadius: 10, padding: '11px 14px', fontSize: 14, outline: 'none' },
  send: { border: '1px solid var(--ink)', background: 'var(--ink)', color: 'var(--paper)', borderRadius: 10, padding: '0 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer' },
}
