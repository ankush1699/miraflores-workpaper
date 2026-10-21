import { useMemo, useState } from 'react'
import { usd } from '../checks/helpers'
import { approvedIds, sumEffects } from '../domain/derived'
import { carryForward, finalBalances, lateCharges, simulateEfile } from '../domain/filing'
import { stepStatuses, filingBlockers } from '../domain/steps'
import { useStore } from '../store/Store'
import { EffectText, Money, Num, Pill, RefChip, day, when, who } from '../ui/Common'
import { PageHeader } from '../ui/Shell'
import { BUSINESS_NOTICE } from './noticeText'

export function FilingPage() {
  return (
    <div className="page stack">
      <PageHeader title="Filing">
        What has to be true before the return files, the judgment calls on record, the e-file and client signature, and everything after: the frozen copy, amendments on top, notices, and next year.
      </PageHeader>
      <Readiness />
      <DueDiligence />
      <Judgments />
      <EfilePanel />
      <Replay />
      <AfterFiling />
    </div>
  )
}

/* ----------------------------------------------------------- readiness */

function Readiness() {
  const { idx, state, findings, variances, commit, say, can, actors } = useStore()
  const steps = stepStatuses({ idx, state, findings, variances })
  const blockers = filingBlockers({ idx, state, findings, variances })
  const attest = (name: string) => {
    const note = window.prompt(`Confirm “${name}”. What did you check?`) ?? ''
    if (!note.trim()) return
    const r = commit([{ type: 'step.attest', data: { step: name, note, adjustmentIds: approvedIds(state) } }])
    if (!r.ok) say(r.error ?? 'Not allowed')
  }
  return (
    <section className="card">
      <h2>Required steps</h2>
      <p className="small muted">The firm's twelve steps. Where records can answer, the workpaper checks them itself and says why; the rest need a person to confirm.</p>
      <table className="tbl"><tbody>
        {steps.map((s, i) => (
          <tr key={s.name}>
            <td style={{ width: 28 }} className="muted">{i + 1}</td>
            <td>{s.name}<div className="muted small">{s.why}{s.by ? ` — ${who(actors, s.by)}, ${when(s.at!)}` : ''}</div></td>
            <td><Pill tone={s.state === 'done' ? 'good' : s.state === 'reopened' ? 'warn' : undefined}>{s.state === 'reopened' ? 'Reopened' : s.state === 'done' ? (s.auto ? 'Checked' : 'Done') : 'Open'}</Pill></td>
            <td>{s.state === 'open' && !s.auto && can('step.attest') && !/sign-off|Client approval/.test(s.name) && <button className="btn small" onClick={() => attest(s.name)}>Confirm</button>}</td>
          </tr>
        ))}
      </tbody></table>
      {blockers.length > 0 ? <div className="alert warn small" style={{ marginTop: 8 }}><strong>Cannot file yet:</strong> {blockers.length} thing(s) outstanding. {state.threads.some((t) => t.blocking && t.status !== 'cleared' && t.kind !== 'question') ? 'Open review notes also block filing.' : ''}</div> : <div className="alert good small" style={{ marginTop: 8 }}>Everything required is done.</div>}
    </section>
  )
}

/* ------------------------------------------------------- due diligence */

const CREDITS: { topic: string; facts: string; keyed: string[] }[] = [
  { topic: 'Child tax credit: Theo (age 8)', facts: 'Born 02/09/2017, lived with the taxpayers 12 months, SSN on his card (D71) once the organizer typo is fixed. $2,200 phased down by income over $400,000.', keyed: ['Age under 17 at year end', 'Lived with taxpayers more than half the year', 'Valid SSN that matches the SS card', 'Not providing over half his own support'] },
  { topic: 'Credit for other dependents: Ada (age 19)', facts: 'Born 05/21/2006, full-time student at UC Davis, home in summer, 12 months with parents by the client\'s account, own W-2 of $4,100 and files her own return as a dependent.', keyed: ['Full-time student', 'Lived with taxpayers (temporary school absence counts)', 'Own gross income under the limit or not providing own support', 'Her return says someone can claim her'] },
  { topic: 'American opportunity credit: Ada', facts: 'Tuition $15,800 less $9,000 restricted scholarship = $6,800 qualified expenses; tentative credit $2,500; fully phased out at modified AGI over $180,000 (MAGI is above $445,000).', keyed: ['1098-T received', 'Scholarship restricted to tuition reduces expenses', 'MAGI above the phase-out: credit is zero', 'No double benefit on Ada\'s own return'] },
]

function DueDiligence() {
  const { state, commit, say, uid, can } = useStore()
  const have = (t: string) => state.judgments.find((j) => j.kind === 'due_diligence' && j.topic === t)
  const [authority, setAuthority] = useState('Form 8867 instructions; Treas. Reg. §1.6695-2(b)')
  const record = (c: (typeof CREDITS)[number], conclusion: string) => {
    const r = commit([{ type: 'judgment.add', data: { id: uid('jdg'), kind: 'due_diligence', topic: c.topic, decision: `${conclusion} Facts relied on: ${c.facts}`, authority, refs: [] } }])
    if (!r.ok) say(r.error ?? 'Not allowed')
  }
  return (
    <section className="card">
      <h2>Due diligence (Form 8867)</h2>
      <p className="small muted">Required before sign-off for each credit claimed. Not claimed and so not applicable: earned income credit, head of household.</p>
      {can('judgment.record') && <label className="field"><span>Authority for the checklist</span><input type="text" value={authority} onChange={(e) => setAuthority(e.target.value)} /></label>}
      {CREDITS.map((c) => {
        const done = have(c.topic)
        return (
          <div key={c.topic} className="card" style={{ padding: '10px 12px' }}>
            <div className="row spread"><strong>{c.topic}</strong>{done ? <Pill tone="good">Documented</Pill> : <Pill tone="bad">Not documented</Pill>}</div>
            <p className="small" style={{ margin: '4px 0' }}>{c.facts}</p>
            <ul className="small" style={{ margin: '4px 0', paddingLeft: 18 }}>{c.keyed.map((k) => <li key={k}>{k}</li>)}</ul>
            {done ? <p className="small muted">{done.decision.slice(0, 80)}… · authority: {done.authority}</p> : can('judgment.record') && <button className="btn small" onClick={() => record(c, 'All knowledge questions asked and answered; the client\'s answers are consistent with the documents.')}>Record: questions asked, facts consistent</button>}
          </div>
        )
      })}
    </section>
  )
}

/* ------------------------------------------------------------ judgments */

function Judgments() {
  const { state, actors, commit, say, uid, can } = useStore()
  const [kind, setKind] = useState<'judgment' | 'election' | 'penalty'>('judgment')
  const [topic, setTopic] = useState('')
  const [decision, setDecision] = useState('')
  const [authority, setAuthority] = useState('')
  const add = () => {
    const r = commit([{ type: 'judgment.add', data: { id: uid('jdg'), kind, topic, decision, authority, refs: [] } }])
    if (!r.ok) return say(r.error ?? 'Not allowed')
    setTopic(''); setDecision(''); setAuthority('')
  }
  const rows = state.judgments.filter((j) => j.kind !== 'due_diligence').slice().reverse()
  return (
    <section className="card">
      <h2>Judgments, elections and penalty decisions</h2>
      <p className="small muted">Every judgment records the decision and the authority relied on. You can also record one from any number's evidence panel. Elections made from the What-ifs page appear here.</p>
      <table className="tbl"><tbody>
        {rows.map((j) => <tr key={j.id}><td style={{ width: 90 }}><Pill>{j.kind}</Pill></td><td><strong>{j.topic}</strong><div className="small">{j.decision}</div><div className="small muted">Authority: {j.authority} · {who(actors, j.by)}, {day(j.at)}</div></td></tr>)}
        {rows.length === 0 && <tr><td className="muted">None recorded yet.</td></tr>}
      </tbody></table>
      {can('judgment.record') && (
        <div className="card" style={{ marginTop: 8 }}>
          <div className="row"><select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} style={{ width: 150 }}><option value="judgment">Judgment call</option><option value="election">Election</option><option value="penalty">Penalty decision</option></select><input type="text" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Topic, e.g. Erik's health insurance deduction" /></div>
          <textarea style={{ marginTop: 6 }} value={decision} onChange={(e) => setDecision(e.target.value)} placeholder="What was decided and why" />
          <input type="text" style={{ marginTop: 6 }} value={authority} onChange={(e) => setAuthority(e.target.value)} placeholder="Authority relied on (required)" />
          <button className="btn primary" style={{ marginTop: 6 }} disabled={!topic.trim() || !decision.trim() || !authority.trim()} onClick={add}>Record</button>
        </div>
      )}
    </section>
  )
}

/* ------------------------------------------------------------ e-file */

function EfilePanel() {
  const { idx, state, findings, variances, actor, actors, commit, say, can, uid } = useStore()
  const subs = state.filing.submissions
  const fedOk = subs.some((s) => s.jurisdiction === 'federal' && s.status === 'accepted')
  const caOk = subs.some((s) => s.jurisdiction === 'california' && s.status === 'accepted')
  const approval = state.filing.clientApproval
  const finals = finalBalances(idx, state, findings)
  const blockers = filingBlockers({ idx, state, findings, variances })

  const approve = () => {
    const pins = { taxpayer: '41207', spouse: '88310' }
    const r = commit([{ type: 'filing.approve', data: { adjustmentIds: approvedIds(state), pins } }])
    say(r.ok ? 'Approved and signed Form 8879 and FTB 8879.' : r.error ?? 'Not allowed')
  }
  const submit = (j: 'federal' | 'california') => {
    const sim = simulateEfile(idx, state, j)
    const items: { type: string; data: any }[] = [{ type: 'filing.submission', data: sim }]
    if (sim.status === 'rejected') {
      // a rejection becomes a blocking note, so it cannot be forgotten
      items.push({ type: 'thread.open', data: { id: uid('thr'), target: 'household:theo', kind: 'review', blocking: true, text: `Federal e-file rejected: ${sim.errors.map((e) => `${e.code} ${e.message}`).join(' ')}` } })
    }
    if (sim.status === 'accepted' && j === 'federal') {
      items.push({ type: 'filing.freeze', data: { adjustmentIds: approvedIds(state), fingerprint: approvedIds(state).join(',') } })
    }
    const r = commit(items)
    if (!r.ok) return say(r.error ?? 'Not allowed')
    say(sim.status === 'accepted' ? `${j} accepted.` : sim.status === 'rejected' ? 'Rejected: see the note that was raised.' : 'Held until the federal return is accepted.')
  }
  const extend = () => {
    const r = commit([{ type: 'filing.extension', data: { federalPayment: 36000 } }])
    say(r.ok ? 'Extension recorded: Form 4868 with $36,000 and FTB 3519 with $0.' : r.error ?? 'Not allowed')
  }

  return (
    <section className="card">
      <h2>Extension, client signature and e-file</h2>
      <table className="tbl"><tbody>
        <tr><td>Extension</td><td>{state.filing.extension ? <Pill tone="good">Filed {day(state.filing.extension.at)} with {usd(state.filing.extension.federalPayment)}</Pill> : <Pill>Not filed</Pill>}</td><td>{!state.filing.extension && can('filing.manage') && <button className="btn small" onClick={extend}>File extension</button>}</td></tr>
        <tr><td>Client approval and e-signature (8879)</td><td>{approval ? <Pill tone="good">Signed {when(approval.at)} by {who(actors, approval.by)}</Pill> : <Pill>Waiting</Pill>}</td><td>{actor.role === 'client' && !approval && <button className="btn small primary" onClick={approve}>Approve and sign</button>}</td></tr>
        <tr><td>Federal e-file</td><td>{fedOk ? <Pill tone="good">Accepted</Pill> : <Pill>Not accepted</Pill>}</td><td>{!fedOk && can('filing.manage') && <button className="btn small primary" onClick={() => submit('federal')}>Submit federal</button>}</td></tr>
        <tr><td>California e-file</td><td>{caOk ? <Pill tone="good">Accepted</Pill> : <Pill>Not accepted</Pill>}</td><td>{!caOk && can('filing.manage') && <button className="btn small" onClick={() => submit('california')}>Submit California</button>}</td></tr>
      </tbody></table>
      {blockers.length > 0 && !fedOk && <div className="small muted" style={{ marginTop: 6 }}>Submitting will be refused while: {blockers[0]}</div>}
      <p className="small muted" style={{ marginTop: 6 }}>As the workpaper finalizes it: federal balance {usd(finals.federalBalance)} {finals.federalBalance < 0 ? '(refund)' : 'due'}, California {usd(finals.californiaBalance)} {finals.californiaBalance < 0 ? '(refund)' : 'due'}. The client approves these numbers; if an adjustment is approved afterwards, their approval reopens.</p>
      {subs.length > 0 && (
        <table className="tbl" style={{ marginTop: 8 }}>
          <thead><tr><th>When</th><th>Return</th><th>Status</th><th>Submission</th><th>Errors</th></tr></thead>
          <tbody>{subs.map((s, i) => <tr key={i}><td className="small">{when(s.at)}</td><td>{s.jurisdiction}</td><td><Pill tone={s.status === 'accepted' ? 'good' : s.status === 'rejected' ? 'bad' : 'warn'}>{s.status.replace('_', ' ')}</Pill></td><td className="mono">{s.submissionId}</td><td className="small">{s.errors.map((e) => `${e.code}: ${e.message}`).join('; ')}</td></tr>)}</tbody>
        </table>
      )}
    </section>
  )
}

/* ------------------------------------------------------------- replay */

function Replay() {
  const { idx, state, findings, actor, actors, commit, say, uid } = useStore()
  const tl = idx.packet.timeline
  const v3At = idx.current.computed_at
  const upcoming = tl.filter((t) => t.at > v3At)
  const index = state.season.index
  const next = upcoming[index]
  const finals = finalBalances(idx, state, findings)

  /** Play the next scripted event as the real action, so the same rules apply as if a person had done it. */
  const play = () => {
    if (!next) return
    const asOf = next.at.slice(0, 10)
    const msg = (id: string) => idx.packet.client.messages.find((m) => m.id === id)
    const advance = { type: 'season.advance', data: { index: index + 1, asOf } }
    const as = (id: string) => ({ actor: id, skipRules: false })
    let result: { ok: boolean; error?: string } = { ok: true }
    switch (next.event) {
      case 'client_message': {
        const m = msg(next.refs[0])!
        const target = next.refs[0] === 'msg-07' ? 'line:F8949.H.C6' : 'line:SchA.11'
        result = commit([advance, { type: 'attach.add', data: { id: uid('att'), target, kind: 'message', name: `${m.from}, ${m.sent_at.slice(0, 10)}`, text: m.text } }], as('cu-01'))
        break
      }
      case 'client_approved_and_signed_8879': {
        result = commit([{ type: 'filing.approve', data: { adjustmentIds: approvedIds(state), pins: { taxpayer: '41207', spouse: '88310' } } }], as('cu-01'))
        if (result.ok) result = commit([advance], { skipRules: true })
        break
      }
      case 'efile_rejected': {
        // In the real file the federal return bounced on Theo's SSN. If the workpaper already
        // caught the typo, the same submission is accepted and the rejection never happens.
        const sim = simulateEfile(idx, state, 'federal')
        const items: { type: string; data: any }[] = [advance, { type: 'filing.submission', data: sim }]
        if (sim.status === 'rejected') {
          items.push({ type: 'filing.submission', data: simulateEfile(idx, state, 'california') })
          items.push({ type: 'thread.open', data: { id: uid('thr'), target: 'household:theo', kind: 'review', blocking: true, text: `Federal e-file rejected: ${sim.errors.map((e) => `${e.code} ${e.message}`).join(' ')}` } })
        } else {
          items.push({ type: 'filing.freeze', data: { adjustmentIds: approvedIds(state), fingerprint: approvedIds(state).join(',') } })
        }
        result = commit(items, as('st-03'))
        if (result.ok && sim.status === 'accepted') say('Accepted first time: the SSN typo was fixed before filing, so the rejection in the real file never happens.')
        break
      }
      case 'document_received': {
        const m = msg(next.refs.find((r) => r.startsWith('msg-')) ?? '')
        result = commit([advance, ...(m ? [{ type: 'attach.add', data: { id: uid('att'), target: 'household:theo', kind: 'message', name: `${m.from}, ${m.sent_at.slice(0, 10)}`, text: m.text } }] : [])], { skipRules: true })
        break
      }
      case 'efile_accepted_federal':
        result = commit([advance], { skipRules: true })
        if (result.ok && !state.filing.submissions.some((s) => s.jurisdiction === 'federal' && s.status === 'accepted')) {
          const sim = simulateEfile(idx, state, 'federal')
          result = commit([{ type: 'filing.submission', data: sim }, ...(sim.status === 'accepted' ? [{ type: 'filing.freeze', data: { adjustmentIds: approvedIds(state), fingerprint: approvedIds(state).join(',') } }] : [])], as('st-03'))
        }
        break
      case 'efile_accepted_california':
        result = commit([advance, { type: 'filing.submission', data: simulateEfile(idx, state, 'california') }], as('st-03'))
        break
      case 'federal_balance_paid': {
        // The script assumes a balance was owed. If the corrected return is a refund, say so instead of inventing a payment.
        if (finals.federalBalance > 0) {
          const lc = lateCharges(idx, finals.federalBalance, next.at)
          result = commit([advance, { type: 'filing.payment', data: { agency: 'IRS', amount: finals.federalBalance, note: `Payment with return. Estimated interest ${usd(lc.interest)} and failure-to-pay ${usd(lc.penalty)} follow.` } }], { skipRules: true })
        } else {
          result = commit([advance, { type: 'filing.payment', data: { agency: 'IRS', amount: 0, note: `Nothing to pay: the return as finalized shows a federal refund of ${usd(-finals.federalBalance)}, so the scripted balance payment does not apply.` } }], { skipRules: true })
        }
        break
      }
      case 'california_refund_issued':
        result = commit([advance, { type: 'filing.refund', data: { amount: Math.max(0, -finals.californiaBalance) } }], { skipRules: true })
        break
      case 'notice_received':
        result = commit([advance, { type: 'filing.notice', data: {} }], { skipRules: true })
        break
      case 'next_year_engagement_started':
        result = commit([advance, { type: 'filing.rollforward', data: {} }], as('st-01'))
        break
      default:
        result = commit([advance], { skipRules: true })
    }
    if (!result.ok) say(result.error ?? 'Blocked')
    else say(`Played: ${next.event.replace(/_/g, ' ')}`)
  }

  return (
    <section className="card">
      <h2>Replay the season</h2>
      <p className="small muted">The data includes what happened after the tax software’s last calculation: client messages, the signature, e-filing, payments, a quality review, next year, and an IRS letter. Press Play to make each event happen. It goes through the real rules, so if the return isn’t ready to be approved or filed, it tells you why. The story date (⋯ menu) moves with it.</p>
      <ul className="timeline">
        {tl.map((t) => {
          const isPast = t.at <= v3At
          const playedIdx = upcoming.indexOf(t)
          const done = isPast || playedIdx < index
          const isNext = !isPast && playedIdx === index
          return <li key={t.id} className={done ? 'done' : isNext ? 'next' : ''}><strong>{t.event.replace(/_/g, ' ')}</strong> <span className="muted small">{day(t.at)}{t.actor ? ` · ${who(actors, t.actor)}` : ''}</span>{t.detail && <div className="small muted">{t.detail}</div>}</li>
        })}
      </ul>
      <div className="row">
        <button className="btn primary" disabled={!next} onClick={play}>{next ? `Play next: ${next.event.replace(/_/g, ' ')}` : 'End of season'}</button>
        <span className="muted small">{index} of {upcoming.length} replayed · you are {actor.name}</span>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------ after */

function AfterFiling() {
  const { idx, state, findings, actors, commit, say, can, uid } = useStore()
  const f = state.filing
  const finals = finalBalances(idx, state, findings)
  const frozen = f.frozen
  const amendments = state.adjustments.filter((a) => a.amendment && a.status !== 'rejected' && a.status !== 'reverted')
  const amendEffect = sumEffects(amendments.filter((a) => a.status === 'approved'))
  const paid = f.payments.find((p) => p.agency === 'IRS')
  const lc = paid && paid.amount > 0 ? lateCharges(idx, paid.amount, paid.at) : null
  const frozenEffect = sumEffects(state.adjustments.filter((a) => (frozen?.adjustmentIds ?? []).includes(a.id)))
  const engineFed = idx.current.summary.federal, engineCa = idx.current.summary.california
  const filedRows: [string, number, number][] = [
    ['Federal total tax', engineFed.total_tax + frozenEffect.federalTax, finals.federalTax],
    ['Federal amount owed (negative is a refund)', engineFed.balance_due + frozenEffect.federalBalance, finals.federalBalance],
    ['California total tax', engineCa.total_tax + frozenEffect.californiaTax, finals.californiaTax],
    ['California amount owed (negative is a refund)', engineCa.balance_due + frozenEffect.californiaBalance, finals.californiaBalance],
  ]
  const carry = useMemo(() => carryForward(idx, state), [idx, state])
  const notice = idx.packet.tax_agency_records.notices.find((n: any) => n.id === 'N-2025-L566') as any

  const respond = () => {
    const r = commit([{ type: 'filing.notice.respond', data: {} }])
    say(r.ok ? 'Response recorded as sent.' : r.error ?? 'Not allowed')
  }

  return (
    <>
      <section className="card">
        <h2>The return as filed, and amendments on top</h2>
        {!frozen ? <p className="muted">The federal return has not been accepted yet. When it is, the numbers freeze here, and anything changed afterwards is recorded as an amendment on top instead of rewriting what was filed.</p> : (
          <>
            <div className="alert info small">Frozen {when(frozen.at)} with {frozen.adjustmentIds.length} approved adjustments. This copy cannot change.</div>
            <table className="tbl" style={{ marginTop: 8 }}>
              <thead><tr><th>Result</th><th className="num">As filed</th><th className="num">Now (with amendments)</th></tr></thead>
              <tbody>
                {filedRows.map(([label, filed, now]) => <tr key={label}><td>{label}</td><td className="num">{usd(filed)}</td><td className="num">{usd(now)}{now !== filed && <> <Pill tone="warn">changed</Pill></>}</td></tr>)}
              </tbody>
            </table>
            <h3 style={{ margin: '12px 0 4px' }}>Amendments</h3>
            {amendments.length === 0 ? <p className="small muted">None. Propose an adjustment now and it will be marked as an amendment, with its tax effect, ready for a Form 1040-X.</p> : (
              <table className="tbl"><tbody>{amendments.map((a) => <tr key={a.id}><td>{a.label}</td><td className="num"><EffectText n={a.effect.federalBalance} /></td><td className="num"><EffectText n={a.effect.californiaBalance} /></td><td><Pill tone={a.status === 'approved' ? 'good' : 'warn'}>{a.status}</Pill></td></tr>)}</tbody></table>
            )}
            {amendments.some((a) => a.status === 'approved') && <p className="small" style={{ marginTop: 6 }}>Approved amendments change tax by federal <EffectText n={amendEffect.federalBalance} /> and California <EffectText n={amendEffect.californiaBalance} />: that is the Form 1040-X and 540X amount.</p>}
          </>
        )}
      </section>

      {(f.payments.length > 0 || f.refund) && (
        <section className="card">
          <h2>Payments, refunds and the IRS account</h2>
          <table className="tbl"><tbody>
            {f.payments.map((p, i) => <tr key={i}><td>{day(p.at)}</td><td>{p.agency} payment</td><td className="num"><Money n={p.amount} /></td><td className="small muted">{p.note}</td></tr>)}
            {f.refund && <tr><td>{day(f.refund.at)}</td><td>California refund</td><td className="num"><Money n={f.refund.amount} /></td><td className="small muted">Direct deposit, Austin Community Credit Union</td></tr>}
          </tbody></table>
          {lc && <div className="alert warn small" style={{ marginTop: 8 }}>Paid {lc.days} days after 04/15/2026. The tax software does not compute this; estimated interest <strong>{usd(lc.interest)}</strong> and failure-to-pay penalty <strong>{usd(lc.penalty)}</strong> ({lc.months} months at 0.5%). An extension of time to file is not an extension of time to pay. The IRS will assess the real amount (transaction codes 196 and 276).</div>}
          <p className="small muted">Expected IRS transcript entries: code 150 total tax {usd(finals.federalTax)}; {finals.federalBalance > 0 ? `code 610 payment with return ${usd(finals.federalBalance)}` : `code 846 refund of ${usd(-finals.federalBalance)}`}.</p>
        </section>
      )}

      {f.notice && (
        <section className="card">
          <div className="row spread"><h2>IRS Letter 566: examination of 2025</h2>{f.notice.respondedAt ? <Pill tone="good">Response sent {day(f.notice.respondedAt)}</Pill> : <Pill tone="bad">Response due {day(notice.response_due)}</Pill>}</div>
          <p className="small">Dated {day(notice.dated)}. The IRS asks for two things. Everything needed to answer is already in the workpaper, so the response is assembled from it rather than from memory, three years later.</p>
          <div className="grid cols-2">
            <div className="card">
              <h3>1. Noncash charitable gifts (Schedule A line 12, Form 8283)</h3>
              <table className="tbl"><tbody>
                {['F8283.A1.stock', 'F8283.A1.vehicle'].map((k) => { const l = idx.current.lines.find((x) => x.key === k)!; return <tr key={k}><td>{l.label}</td><td className="num"><Num line={l} /></td></tr> })}
              </tbody></table>
              <p className="small muted">{BUSINESS_NOTICE.charity}</p>
              <div className="row wrap"><RefChip r="doc:D65" /><RefChip r="doc:D66" /><RefChip r="line:F8283.A1.vehicle" /></div>
            </div>
            <div className="card">
              <h3>2. Schedule C gross receipts vs 1099-NEC (142,000) and 1099-K (12,400)</h3>
              <table className="tbl"><tbody>
                <tr><td>Schedule C gross receipts</td><td className="num"><Num line={idx.current.lines.find((x) => x.key === 'SchC.1')!} /></td></tr>
                <tr><td>1099-NEC total</td><td className="num">{usd(142000)}</td></tr>
                <tr><td>Clients with no 1099 (D15)</td><td className="num">{usd(9300)}</td></tr>
                <tr><td>1099-K from Paywell: the card part of Atlas’s $41,200, not extra income (Erik’s books, D15 p3)</td><td className="num">{usd(12400)}</td></tr>
              </tbody></table>
              <p className="small muted">{BUSINESS_NOTICE.receipts}</p>
              <div className="row wrap"><RefChip r="doc:D15#page3" /><RefChip r="doc:D21" /><RefChip r="line:SchC.1" /></div>
            </div>
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn" onClick={() => window.print()}>Print the response record</button>
            {can('judgment.record') && !f.notice.respondedAt && <button className="btn primary" onClick={respond}>Mark response sent</button>}
          </div>
        </section>
      )}

      {f.rollForward && (
        <section className="card">
          <h2>Rolled forward to 2026</h2>
          <p className="small muted">Started {day(f.rollForward.at)} by {who(actors, f.rollForward.by)}. Nothing is retyped: each carried item points back to where it came from, so the next preparer can open its history.</p>
          <table className="tbl"><tbody>
            {carry.map((c) => <tr key={c.label}><td>{c.label}{c.note && <div className="small muted">{c.note}</div>}</td><td className="num">{c.value}</td><td><RefChip r={c.origin} /></td></tr>)}
          </tbody></table>
          <h3 style={{ margin: '12px 0 4px' }}>Open items for next year</h3>
          <ul className="small" style={{ paddingLeft: 18 }}>
            {idx.packet.prior_years.prior_preparer_workpaper.open_items_left_by_prior_preparer.map((o) => <li key={o}>{o} <span className="muted">(inherited from Delta River)</span></li>)}
            {findings.filter((x) => x.kind === 'outside_scope' || x.id === 'scorp-distributions-over-basis').map((x) => <li key={x.id}>{x.title}</li>)}
          </ul>
          <h3 style={{ margin: '12px 0 4px' }}>2026 estimated payments</h3>
          <EstimatePlan />
        </section>
      )}
      <span className="hide">{uid('x')}</span>
    </>
  )
}

function EstimatePlan() {
  const { idx, state, findings } = useStore()
  const plan = idx.packet.planning_reference_2026 as any
  const finals = finalBalances(idx, state, findings)
  const safeHarbor = Math.round(finals.federalTax * 1.1)
  const caHarbor = Math.round(finals.californiaTax * 1.1)
  return (
    <div className="small">
      <p>Federal safe harbor: {plan.federal_safe_harbor} On the 2025 total tax as finalized ({usd(finals.federalTax)}), 110% is <strong>{usd(safeHarbor)}</strong>, or <strong>{usd(Math.round(safeHarbor / 4))}</strong> on {plan.federal_estimate_due_dates.join(', ')}.</p>
      <p>California: {plan.california_safe_harbor} 110% of {usd(finals.californiaTax)} is {usd(caHarbor)}, paid {plan.california_installment_percentages.map((p: number) => `${p * 100}%`).join(' / ')}. Only California-source income is taxable there after the move.</p>
      <ul style={{ paddingLeft: 18 }}>{(plan.known_2026_changes_for_this_household as string[]).map((c) => <li key={c}>{c}</li>)}</ul>
    </div>
  )
}
