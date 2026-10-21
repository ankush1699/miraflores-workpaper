import { useMemo, useState } from 'react'
import type { Finding } from '../checks/types'
import { DIAGNOSTIC_COVERAGE } from '../checks'
import { findingStatus, isResolved } from '../domain/derived'
import { findingEffect } from '../domain/recon'
import { areaLabel } from '../packet'
import { useStore } from '../store/Store'
import { EffectText, Pill, RefList, SeverityPill, StatusPill } from '../ui/Common'
import { PageHeader } from '../ui/Shell'
import { useUi } from '../ui/Ui'

const KIND_LABEL: Record<Finding['kind'], string> = {
  engine_error: 'Engine got it wrong', extraction_error: 'Misread or missed', data_conflict: 'Sources disagree',
  judgment: 'Needs a judgment', outside_scope: 'Outside the engagement', tie_out: 'Does not tie',
}

export function IssuesPage() {
  const { findings, state, idx, ran, commit, can, say, uid } = useStore()
  const [filter, setFilter] = useState<'open' | 'all' | 'resolved'>('open')
  const [sev, setSev] = useState<'all' | 'error' | 'warning' | 'info'>('all')
  const [picked, setPicked] = useState<Set<string>>(new Set())

  const shown = useMemo(() => findings.filter((f) => {
    const st = findingStatus(f, state)
    if (filter === 'open' && isResolved(st)) return false
    if (filter === 'resolved' && !isResolved(st)) return false
    return sev === 'all' || f.severity === sev
  }), [findings, state, filter, sev])

  // judgment calls (like the health insurance deduction) are never swept in by a bulk action
  const proposable = shown.filter((f) => f.fix && f.kind !== 'judgment' && findingStatus(f, state) === 'open')
  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })

  /** Propose every picked fix in one action, so one Undo takes them all back. */
  const proposeMany = () => {
    const batchId = uid('batch')
    const items = proposable.filter((f) => picked.has(f.id)).flatMap((f) =>
      f.fix!.drafts.map((d) => ({
        type: 'adjust.propose',
        data: { id: uid('adj'), batchId, target: d.target, label: d.label, lineDelta: d.lineDelta, textFix: d.textFix, effects: d.effects, reason: f.detail, authority: f.fix!.authority, findingId: f.id, evidence: f.refs },
      })))
    if (!items.length) return say('Pick findings that have a proposed fix.')
    const r = commit(items)
    if (!r.ok) return say(r.error ?? 'Not allowed')
    say(`Proposed ${items.length} adjustments. Undo takes them all back.`)
    setPicked(new Set())
  }

  const diagnostics = idx.current.diagnostics

  return (
    <div className="page stack">
      <PageHeader title="Issues">
        Found by checks that recompute from the source documents and never read the engine's own diagnostics. Each one says what is wrong, shows the evidence, estimates the tax effect and offers a fix that someone else has to approve.
      </PageHeader>

      <div className="row wrap spread">
        <div className="row">
          {(['open', 'all', 'resolved'] as const).map((f) => <button key={f} className={`btn small ${filter === f ? 'primary' : ''}`} onClick={() => setFilter(f)}>{f[0].toUpperCase() + f.slice(1)}</button>)}
          <select value={sev} onChange={(e) => setSev(e.target.value as typeof sev)} style={{ width: 'auto' }}>
            <option value="all">All severities</option><option value="error">Errors</option><option value="warning">Checks</option><option value="info">Notes</option>
          </select>
          <span className="muted small">{shown.length} shown</span>
        </div>
        {can('adjust.propose') && (
          <div className="row">
            <button className="btn small" onClick={() => setPicked(new Set(proposable.map((f) => f.id)))}>Select all with a fix ({proposable.length})</button>
            <button className="btn small primary" disabled={!picked.size} onClick={proposeMany}>Propose {picked.size} fixes</button>
          </div>
        )}
      </div>

      {shown.map((f) => <FindingCard key={f.id} f={f} picked={picked.has(f.id)} onPick={() => toggle(f.id)} canPick={!!f.fix && f.kind !== 'judgment' && findingStatus(f, state) === 'open' && can('adjust.propose')} />)}
      {shown.length === 0 && <div className="card muted">Nothing here.</div>}

      <section className="card">
        <h2>The engine's own diagnostics, and what became of them</h2>
        <table className="tbl"><tbody>
          {diagnostics.map((d) => {
            const cov = DIAGNOSTIC_COVERAGE[d.code]
            const f = cov?.findingId ? findings.find((x) => x.id === cov.findingId) : undefined
            return (
              <tr key={d.code}>
                <td><Pill tone={d.severity === 'warning' ? 'warn' : 'info'}>{d.severity}</Pill></td>
                <td><strong className="mono">{d.code}</strong><div className="small">{d.message}</div></td>
                <td className="small">{cov?.note}{f && <div><StatusPill status={findingStatus(f, state)} /> <span className="muted">{f.title.slice(0, 60)}</span></div>}</td>
              </tr>
            )
          })}
        </tbody></table>
        <p className="muted small">The engine raised {diagnostics.length} diagnostics. It did not raise any of the {findings.filter((f) => f.kind === 'engine_error').length} engine errors above.</p>
      </section>

      <section className="card">
        <h2>Checks that ran</h2>
        <table className="tbl"><tbody>
          {ran.map((r) => <tr key={r.id}><td>{r.title}</td><td style={{ width: 110 }}>{r.findingIds.length ? <Pill tone="warn">{r.findingIds.length} flagged</Pill> : <Pill tone="good">clean</Pill>}</td></tr>)}
        </tbody></table>
      </section>
    </div>
  )
}

export function FindingCard({ f, picked, onPick, canPick }: { f: Finding; picked?: boolean; onPick?: () => void; canPick?: boolean }) {
  const { state, idx, commit, can, say, uid, actor } = useStore()
  const { openAdjust } = useUi()
  const [mode, setMode] = useState<null | 'accept' | 'inform'>(null)
  const [note, setNote] = useState('')
  const [authority, setAuthority] = useState('')
  const st = findingStatus(f, state)
  const done = isResolved(st)
  const eff = findingEffect(idx, f)
  const decision = state.findingDecisions[f.id]

  const decide = (d: 'accepted' | 'informed' | 'reopened') => {
    const r = commit([{ type: 'finding.decide', data: { findingId: f.id, decision: d, note, authority } }])
    if (!r.ok) return say(r.error ?? 'Not allowed')
    setMode(null); setNote(''); setAuthority('')
  }
  const askClient = () => {
    const r = commit([
      { type: 'thread.open', data: { id: uid('thr'), target: f.refs.find((x) => x.startsWith('line:') || x.startsWith('ev:') || x.startsWith('household:')) ?? f.refs[0], kind: 'question', blocking: false, text: f.ask } },
      { type: 'finding.decide', data: { findingId: f.id, decision: 'asked', note: 'Question sent to the client.', authority: '' } },
    ])
    say(r.ok ? 'Sent to the client.' : r.error ?? 'Not allowed')
  }

  return (
    <article className={`card finding ${f.severity} ${done ? 'done' : ''}`}>
      <div className="row spread wrap">
        <div className="row wrap">
          {canPick && <input type="checkbox" checked={!!picked} onChange={onPick} aria-label="Select" />}
          <SeverityPill severity={f.severity} />
          <Pill>{KIND_LABEL[f.kind]}</Pill>
          <Pill>{areaLabel(f.area)}</Pill>
          <StatusPill status={st} />
        </div>
        {f.fix && <span className="small">Federal <EffectText n={eff.federalBalance} /> · California <EffectText n={eff.californiaBalance} /></span>}
      </div>
      <h3 style={{ margin: '8px 0 4px', fontSize: 15 }}>{f.title}</h3>
      <p className="small" style={{ marginBottom: 8 }}>{f.detail}</p>
      <div className="small muted" style={{ marginBottom: 6 }}><strong>How the workpaper surfaced it:</strong> {f.surfacedBy}</div>
      <RefList refs={f.refs} />
      {decision && decision.decision !== 'reopened' && <div className="small" style={{ marginTop: 8 }}><strong>{decision.decision}:</strong> {decision.note} {decision.authority && <span className="muted">Authority: {decision.authority}</span>}</div>}

      {!done && (
        <div className="row wrap" style={{ marginTop: 10 }}>
          {f.fix && st === 'open' && can('adjust.propose') && <button className="btn primary small" onClick={() => openAdjust({ kind: 'finding', finding: f })}>Propose: {f.fix.summary}</button>}
          {f.ask && st !== 'asked' && can('question.ask') && <button className="btn small" onClick={askClient}>Ask the client</button>}
          {can('finding.decide') && f.kind !== 'outside_scope' && <button className="btn small" onClick={() => setMode(mode === 'accept' ? null : 'accept')}>Accept as is…</button>}
          {can('finding.decide') && f.kind === 'outside_scope' && <button className="btn small" onClick={() => setMode(mode === 'inform' ? null : 'inform')}>Client informed…</button>}
        </div>
      )}
      {done && can('finding.decide') && st !== 'fixed' && <button className="btn small" style={{ marginTop: 8 }} onClick={() => decide('reopened')}>Reopen</button>}
      {mode && (
        <div className="card" style={{ marginTop: 10 }}>
          <label className="field"><span>{mode === 'accept' ? 'Why is it fine as it is?' : 'How and when was the client told?'}</span><textarea value={note} onChange={(e) => setNote(e.target.value)} /></label>
          <label className="field"><span>Authority relied on</span><input type="text" value={authority} onChange={(e) => setAuthority(e.target.value)} placeholder="Code section, document, or the client's written confirmation" /></label>
          <button className="btn primary" disabled={!note.trim() || (mode === 'accept' && !authority.trim())} onClick={() => decide(mode === 'accept' ? 'accepted' : 'informed')}>Record</button>
        </div>
      )}
      <span className="hide">{actor.id}</span>
    </article>
  )
}
