import { useState, type ReactNode } from 'react'
import { usd } from '../checks/helpers'
import { mask } from '../domain/people'
import { adjustedLine, findingStatus, isResolved, type FindingStatus } from '../domain/derived'
import { resolveRef, splitRef } from '../domain/refs'
import type { ReturnLine } from '../packet/types'
import { useStore } from '../store/Store'
import { useUi } from './Ui'
import { SEVERITY } from './words'

export function Pill({ tone, children, title }: { tone?: 'good' | 'warn' | 'bad' | 'info'; children: ReactNode; title?: string }) {
  return <span className={`pill ${tone ?? ''}`} title={title}>{children}</span>
}

export function SeverityPill({ severity }: { severity: 'error' | 'warning' | 'info' }) {
  const s = SEVERITY[severity]
  return <Pill tone={s.tone} title={s.hint}>{s.label}</Pill>
}

const STATUS_LABEL: Record<FindingStatus, [string, 'good' | 'warn' | 'bad' | 'info' | undefined]> = {
  open: ['To do', 'bad'], proposed: ['Fix waiting for approval', 'warn'], fixed: ['Fixed', 'good'],
  accepted: ['No change needed', 'good'], informed: ['Client told', 'good'], asked: ['Asked the client', 'info'],
}

export function StatusPill({ status }: { status: FindingStatus }) {
  const [label, tone] = STATUS_LABEL[status]
  return <Pill tone={tone}>{label}</Pill>
}

export function who(actors: { id: string; name: string }[], id: string): string {
  return actors.find((a) => a.id === id)?.name ?? id
}

export function when(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function day(iso: string): string {
  return new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/** A reference rendered as a small clickable chip that opens it in the evidence drawer. */
export function RefChip({ r }: { r: string }) {
  const { idx } = useStore()
  const { openTrace } = useUi()
  const { kind, id } = splitRef(r)
  if (kind === 'py' || kind === 'agency' || kind === 'text') {
    const res = resolveRef(idx, r)
    return <button className="chip" onClick={() => openTrace(r)} title={res.detail}><span className="k">{res.kind}</span><span className="t">{res.title}</span></button>
  }
  const res = resolveRef(idx, r)
  return (
    <button className="chip" onClick={() => openTrace(r)} title={res.title}>
      <span className="k">{kind === 'ev' ? 'Value' : res.kind}</span>
      <span className="t">{kind === 'line' || kind === 'ev' ? id : res.title}</span>
    </button>
  )
}

export function RefList({ refs }: { refs: string[] }) {
  return <div className="row wrap" style={{ gap: 6 }}>{refs.map((r) => <RefChip key={r} r={r} />)}</div>
}

/**
 * A figure from the return. Click it to see where it came from. Shows the tax software's value
 * struck through when we have adjusted it, and small dots for how it was checked.
 */
export function Num({ line, cents, plain }: { line: ReturnLine; cents?: boolean; plain?: boolean }) {
  const { state, findings } = useStore()
  const { openTrace, findingsByRef } = useUi()
  const adj = adjustedLine(state, line)
  const ref = `line:${line.key}`
  const flagged = (findingsByRef.get(ref) ?? []).some((f) => f.severity !== 'info' && !isResolved(findingStatus(f, state)))
  const verified = state.verifications.some((v) => v.target === ref)
  const asked = state.threads.some((t) => t.target === ref && t.kind === 'question' && t.status !== 'cleared')
  void findings
  if (typeof line.value !== 'number') return <span className="n" onClick={() => openTrace(ref)}>{String(line.value ?? '')}</span>
  const money = (n: number) => (plain ? n.toLocaleString('en-US') : usd(n, cents))
  const cls = `n ${adj.delta !== 0 || adj.pending ? 'adjusted' : ''} ${flagged ? 'flagged' : ''}`
  return (
    <span className={cls} onClick={() => openTrace(ref)} title="Show where this came from">
      {adj.delta !== 0 && <span className="was">{money(line.value)}</span>}
      {money(adj.value as number)}
      <span className="stamps">
        {verified && <i className="stamp" title="Verified" />}
        {asked && <i className="stamp ask" title="Question open with the client" />}
        {adj.pending && <i className="stamp adj" title="Adjustment waiting for approval" />}
        {flagged && <i className="stamp flag" title="Open finding" />}
      </span>
    </span>
  )
}

export function Money({ n, cents, tone }: { n: number; cents?: boolean; tone?: boolean }) {
  const cls = tone ? (n > 0 ? 'effect up' : n < 0 ? 'effect down' : '') : ''
  return <span className={`num ${cls}`}>{usd(n, cents)}</span>
}

/** A tax effect (+ means the client owes more). */
export function EffectText({ n }: { n: number }) {
  if (n === 0) return <span className="muted">no tax effect</span>
  return <span className={`effect ${n > 0 ? 'up' : 'down'}`}>{n > 0 ? '+' : '−'}{usd(Math.abs(n))}</span>
}

/** An SSN, bank or IP PIN: masked unless the viewer is cleared and chooses to reveal it (which is logged). */
export function Masked({ value, kind, label }: { value: string; kind: 'ssn' | 'account' | 'pin'; label: string }) {
  const { actor, state, commit, say } = useStore()
  const [shown, setShown] = useState(false)
  const needsMask = state.standards.maskWithoutClearance
  if (!needsMask) return <span className="mono">{value}</span>
  if (shown) return <span className="mono">{value}</span>
  const reveal = () => {
    const r = commit([{ type: 'sensitive.view', data: { field: label, label } }])
    if (r.ok) setShown(true)
    else say(r.error ?? 'Not allowed')
  }
  return (
    <span className="mono">
      {mask(value, kind)}{' '}
      {actor.clearance
        ? <button className="btn small" onClick={reveal} title="Showing this is logged">Show</button>
        : <span className="muted small" title="You do not have sensitive-data clearance">masked</span>}
    </span>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="muted" style={{ padding: '14px 4px' }}>{children}</div>
}

export function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="card">
      <header className="row spread" style={{ marginBottom: 8 }}>
        <h2>{title}</h2>
        {aside}
      </header>
      {children}
    </section>
  )
}
