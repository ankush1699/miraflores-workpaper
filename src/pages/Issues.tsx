import { useMemo, useState } from 'react'
import type { Finding } from '../checks/types'
import { DIAGNOSTIC_COVERAGE } from '../checks'
import { findingStatus, isResolved } from '../domain/derived'
import { findingEffect } from '../domain/recon'
import { areaLabel } from '../packet'
import { useStore } from '../store/Store'
import { Pill, RefList, StatusPill } from '../ui/Common'
import { usd } from '../checks/helpers'
import { PageHeader } from '../ui/Shell'
import { useUi } from '../ui/Ui'
import { KIND, SEVERITY } from '../ui/words'

const GROUPS: Finding['severity'][] = ['error', 'warning', 'info']

export function IssuesPage() {
  const { findings, state, idx, ran, commit, can, say, uid } = useStore()
  const [tab, setTab] = useState<'todo' | 'waiting' | 'done' | 'all'>('todo')

  // three buckets a newcomer can follow: still to do, fix waiting for someone to approve, done
  const bucket = (f: Finding) => { const st = findingStatus(f, state); return isResolved(st) ? 'done' : st === 'proposed' ? 'waiting' : 'todo' }
  const counts = useMemo(() => {
    const c = { todo: 0, waiting: 0, done: 0, all: findings.length }
    for (const f of findings) c[bucket(f)]++
    return c
  }, [findings, state]) // eslint-disable-line react-hooks/exhaustive-deps

  const shown = findings.filter((f) => tab === 'all' || bucket(f) === tab)

  // judgment calls (like the health insurance deduction) are never swept in by a bulk action
  const bulk = findings.filter((f) => f.fix && f.kind !== 'judgment' && findingStatus(f, state) === 'open')

  /** Propose every clear fix in one action, so one Undo takes them all back. */
  const proposeAll = () => {
    const batchId = uid('batch')
    const items = bulk.flatMap((f) =>
      f.fix!.drafts.map((d) => ({
        type: 'adjust.propose',
        data: { id: uid('adj'), batchId, target: d.target, label: d.label, lineDelta: d.lineDelta, textFix: d.textFix, effects: d.effects, reason: f.detail, authority: f.fix!.authority, findingId: f.id, evidence: f.refs },
      })))
    const r = commit(items)
    if (!r.ok) return say(r.error ?? 'Not allowed')
    say(`Proposed ${bulk.length} fixes. They now wait in Fixes & approvals. Undo takes them all back.`)
  }

  return (
    <div className="page stack">
      <PageHeader title="Problems">
        The app re-read every document and recalculated the return itself, instead of trusting the tax software. These are the problems it found. Open one to see the proof; press <strong>Fix it</strong> to propose the correction.
      </PageHeader>

      <div className="row wrap spread">
        <div className="tabs" style={{ marginTop: 0 }}>
          <button className={tab === 'todo' ? 'on' : ''} onClick={() => setTab('todo')}>To do<span className="badge">{counts.todo}</span></button>
          <button className={tab === 'waiting' ? 'on' : ''} onClick={() => setTab('waiting')} title="A fix was proposed; a reviewer or the partner has to approve it in Fixes & approvals">Waiting for approval<span className="badge">{counts.waiting}</span></button>
          <button className={tab === 'done' ? 'on' : ''} onClick={() => setTab('done')}>Done<span className="badge">{counts.done}</span></button>
          <button className={tab === 'all' ? 'on' : ''} onClick={() => setTab('all')}>All<span className="badge">{counts.all}</span></button>
        </div>
        {can('adjust.propose') && bulk.length > 0 && (
          <button className="btn primary" onClick={proposeAll} title="Decisions that need a person (like the health insurance deduction) are left for you">Fix all clear problems ({bulk.length})</button>
        )}
      </div>

      {GROUPS.map((sev) => {
        const items = shown.filter((f) => f.severity === sev)
        if (!items.length) return null
        return (
          <section key={sev}>
            <div className="group-head"><h2>{SEVERITY[sev].label}</h2><span className="muted small">{items.length} · {SEVERITY[sev].hint}</span></div>
            <div className="stack">{items.map((f) => <ProblemCard key={f.id} f={f} />)}</div>
          </section>
        )
      })}
      {shown.length === 0 && <div className="card muted">{tab === 'todo' ? (counts.waiting ? <>Nothing left to do here. {counts.waiting} fix{counts.waiting === 1 ? ' is' : 'es are'} waiting for approval: switch to the reviewer or partner (top right) and open <strong>Fixes & approvals</strong>.</> : 'Nothing left to do here.') : 'Nothing here yet.'}</div>}

      <details className="card more">
        <summary>Behind the scenes: the tax software’s own warnings, and every check that ran</summary>
        <h3 style={{ margin: '4px 0 6px' }}>The tax software’s own warnings</h3>
        <p className="small muted">It raised {idx.current.diagnostics.length} warnings. It did not raise any of the {findings.filter((f) => f.kind === 'engine_error').length} software mistakes above.</p>
        <table className="tbl"><tbody>
          {idx.current.diagnostics.map((d) => {
            const cov = DIAGNOSTIC_COVERAGE[d.code]
            const f = cov?.findingId ? findings.find((x) => x.id === cov.findingId) : undefined
            return <tr key={d.code}><td className="small">{d.message}</td><td className="small muted">{cov?.note}{f && <div><StatusPill status={findingStatus(f, state)} /></div>}</td></tr>
          })}
        </tbody></table>
        <h3 style={{ margin: '12px 0 6px' }}>Every check the app ran</h3>
        <table className="tbl"><tbody>
          {ran.map((r) => <tr key={r.id}><td className="small">{r.title}</td><td style={{ width: 110 }}>{r.findingIds.length ? <Pill tone="warn">{r.findingIds.length} found</Pill> : <Pill tone="good">all good</Pill>}</td></tr>)}
        </tbody></table>
      </details>
    </div>
  )
}

/** "saves $4,402 federal" reads better than "−$4,402". */
function Impact({ n, where }: { n: number; where: string }) {
  if (n === 0) return <span className="muted">no change {where}</span>
  return <span className={`effect ${n > 0 ? 'up' : 'down'}`}>{n < 0 ? 'saves' : 'adds'} {usd(Math.abs(n))} {where}</span>
}

/** One problem: a single line with the main action, and the proof and other choices folded underneath. */
export function ProblemCard({ f }: { f: Finding }) {
  const { state, idx, commit, can, say, uid } = useStore()
  const { openAdjust } = useUi()
  const [open, setOpen] = useState(false)
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

  // the one obvious next step for this problem
  const main = !done && (
    f.kind === 'judgment' && can('finding.decide')
      ? <button className="btn small" onClick={() => setOpen(true)}>Decide</button>
      : f.fix && st === 'open' && can('adjust.propose')
      ? <button className="btn primary small" onClick={() => openAdjust({ kind: 'finding', finding: f })}>Fix it</button>
      : f.kind === 'outside_scope' && can('finding.decide')
        ? <button className="btn small" onClick={() => { setOpen(true); setMode('inform') }}>Tell the client</button>
        : !f.fix && can('finding.decide')
          ? <button className="btn small" onClick={() => { setOpen(true); setMode('accept') }}>Decide</button>
          : null
  )

  return (
    <article className={`card finding ${f.severity} ${done ? 'done' : ''}`} style={{ padding: '10px 14px' }}>
      <div className="compact-card">
        <div>
          <div style={{ fontWeight: 600 }}>{f.title}</div>
          <div className="row wrap small" style={{ marginTop: 4, gap: 6 }}>
            <StatusPill status={st} />
            <span className="muted">{KIND[f.kind]} · {areaLabel(f.area)}</span>
            {f.fix && (eff.federalBalance !== 0 || eff.californiaBalance !== 0) && (
              <span className="impact" title="How much less (or more) the family owes once this is fixed">· Fixing it: <Impact n={eff.federalBalance} where="federal" /> · <Impact n={eff.californiaBalance} where="California" /></span>
            )}
          </div>
        </div>
        <div className="row">
          {main}
          <button className="btn small" onClick={() => setOpen(!open)}>{open ? 'Hide details' : 'Details'}</button>
        </div>
      </div>

      {open && (
        <div style={{ marginTop: 10 }}>
          <p className="small" style={{ marginBottom: 8 }}>{f.detail}</p>
          <div className="small muted" style={{ marginBottom: 6 }}><strong>How the app caught it:</strong> {f.surfacedBy}</div>
          <div className="small muted" style={{ marginBottom: 4 }}>Proof (click to open):</div>
          <RefList refs={f.refs} />
          {decision && decision.decision !== 'reopened' && <div className="small" style={{ marginTop: 8 }}><strong>Decision:</strong> {decision.note} {decision.authority && <span className="muted">· Rule relied on: {decision.authority}</span>}</div>}
          {!done && (
            <div className="row wrap" style={{ marginTop: 10 }}>
              {f.kind === 'judgment' && f.fix && st === 'open' && can('adjust.propose') && <button className="btn small primary" onClick={() => openAdjust({ kind: 'finding', finding: f })}>Change it: {f.fix.summary.replace(/^If disallowed: /, '')}</button>}
              {f.ask && st !== 'asked' && can('question.ask') && <button className="btn small" onClick={askClient}>Ask the client</button>}
              {can('finding.decide') && f.kind !== 'outside_scope' && <button className="btn small" onClick={() => setMode(mode === 'accept' ? null : 'accept')}>No change needed…</button>}
              {can('finding.decide') && f.kind === 'outside_scope' && <button className="btn small" onClick={() => setMode(mode === 'inform' ? null : 'inform')}>Client told…</button>}
            </div>
          )}
          {done && can('finding.decide') && st !== 'fixed' && <button className="btn small" style={{ marginTop: 8 }} onClick={() => decide('reopened')}>Reopen</button>}
          {mode && (
            <div className="card" style={{ marginTop: 10 }}>
              <label className="field"><span>{mode === 'accept' ? 'Why is it fine as it is?' : 'How and when was the client told?'}</span><textarea value={note} onChange={(e) => setNote(e.target.value)} /></label>
              <label className="field"><span>Rule or document relied on</span><input type="text" value={authority} onChange={(e) => setAuthority(e.target.value)} placeholder="e.g. a tax code section, a document, or the client’s written answer" /></label>
              <button className="btn primary" disabled={!note.trim() || (mode === 'accept' && !authority.trim())} onClick={() => decide(mode === 'accept' ? 'accepted' : 'informed')}>Save decision</button>
            </div>
          )}
        </div>
      )}
    </article>
  )
}
