import { useState } from 'react'
import { Link } from 'react-router-dom'
import { usd } from '../checks/helpers'
import { dispositionOf } from '../checks/review'
import { findingStatus, isResolved, latestSignoff, signoffStatus } from '../domain/derived'
import { notificationsFor } from '../domain/notify'
import { position } from '../domain/summary'
import { stepStatuses } from '../domain/steps'
import { AREAS } from '../packet'
import { useStore } from '../store/Store'
import { Pill, day, when, who } from '../ui/Common'
import { describeEvent, isFeedEvent } from '../ui/describe'
import { NumberLegend } from '../ui/Guides'

/** Owe or refund, in words. Balances are amounts owed; negative means money back. */
const plain = (n: number) => (n >= 0 ? `owe ${usd(n)}` : `get ${usd(-n)} back`)

export function OverviewPage() {
  const { idx, state, findings, variances, events, actors, actor, commit } = useStore()
  const [hidden, setHidden] = useState<boolean>(() => { try { return localStorage.getItem('mf-welcome-hidden') === '1' } catch { return false } })
  const hide = (v: boolean) => { setHidden(v); try { localStorage.setItem('mf-welcome-hidden', v ? '1' : '0') } catch { /* private window */ } }

  const pos = position(idx, state, findings)
  const steps = stepStatuses({ idx, state, findings, variances })
  const notices = notificationsFor(actor, { idx, state, findings, variances })
  const name = (id: string) => who(actors, id)

  // ---- the five-step journey, worked out from the record
  const untouched = findings.filter((f) => f.severity !== 'info' && findingStatus(f, state) === 'open')
  const waiting = state.adjustments.filter((a) => a.status === 'proposed').length
  // one problem can need several numbers changed, so count both
  const waitingProblems = findings.filter((f) => findingStatus(f, state) === 'proposed').length
  const checklist = steps.filter((s) => !/sign-off|Client approval/.test(s.name))
  const checklistDone = checklist.filter((s) => s.state === 'done').length
  const signed = (['reviewer', 'partner'] as const).filter((l) => { const so = latestSignoff(state, l); return so && signoffStatus(so, state).state === 'valid' }).length
  const filed = state.filing.submissions.some((s) => s.jurisdiction === 'federal' && s.status === 'accepted')
  const journey = [
    { title: 'Review the problems', who: 'Preparer', done: untouched.length === 0, status: untouched.length ? `${untouched.length} not looked at yet` : 'Every problem has a fix or a decision', to: '/issues', go: 'Open Problems' },
    { title: 'Propose and approve fixes', who: 'Preparer proposes · Reviewer or Partner approves', done: untouched.length === 0 && waiting === 0 && state.adjustments.some((a) => a.status === 'approved'), status: waiting ? `${waitingProblems} problem${waitingProblems === 1 ? '' : 's'}’ fixes waiting for approval (${waiting} number change${waiting === 1 ? '' : 's'})` : `${state.adjustments.filter((a) => a.status === 'approved').length} approved`, to: '/changes', go: 'Open Fixes' },
    { title: 'Finish the checklist', who: 'Preparer', done: checklistDone === checklist.length, status: `${checklistDone} of ${checklist.length} done`, to: '/filing', go: 'Open Filing' },
    { title: 'Sign off', who: 'Reviewer, then Partner', done: signed === 2, status: `${signed} of 2 signatures`, to: '/people', go: 'Open Sign-offs' },
    { title: 'Client approves, firm files', who: 'Client signs · Partner files', done: filed, status: filed ? 'Filed and accepted' : state.filing.clientApproval ? 'Client signed; ready to file' : 'Not yet', to: '/filing', go: 'Open Filing' },
  ]
  const nowIdx = journey.findIndex((s) => !s.done)

  // ---- details that used to crowd the page
  const lastSeen = state.seen[actor.id] ?? ''
  const feed = events.filter((e) => isFeedEvent(e) && e.at > lastSeen && e.actor !== actor.id && !state.undone.has(e.id)).slice(-10).reverse()
  const docsOk = idx.docList.filter((d) => dispositionOf(idx, d.id).kind !== 'not_landed' || !!state.docDispositions[d.id]).length
  const areaList = AREAS.filter((a) => a.id !== 'return_summary')
  const areasDone = areaList.filter((a) => state.attestations[`area:${a.id}`]).length
  const outside = findings.filter((f) => f.kind === 'outside_scope')
  const outsideDone = outside.filter((f) => isResolved(findingStatus(f, state))).length
  const budgets = idx.packet.firm.budget_hours
  const hours = (area: string) => state.timeEntries.filter((t) => t.area === area).reduce((s, t) => s + t.hours, 0)
  const team = idx.packet.firm.assignment_at_start
  const deadlines = idx.packet.firm.deadlines.map((d) => ({ ...d, days: Math.round((new Date(d.date).getTime() - new Date(state.season.asOf).getTime()) / 86400000) }))

  return (
    <div className="page stack">
      {!hidden ? (
        <section className="welcome">
          <div className="row spread"><h2>Welcome. Here’s what this is.</h2><button className="btn small" onClick={() => hide(true)}>Hide</button></div>
          <p>An accountant’s <strong>workpaper</strong> for the Okafor-Lindqvist family’s 2025 tax return. MiraFlores’ tax software already calculated the return. This is where the firm <strong>checks</strong> it, <strong>fixes its mistakes</strong>, and <strong>proves</strong> every number before filing.</p>
          <p className="small"><strong>The family:</strong> Ngozi (software engineer, changed jobs, paid partly in company shares) and Erik (freelance designer), with two children. They moved from California to Texas in July 2025 and own rental property.</p>
          <ul className="small">
            <li><strong>Follow the five steps below</strong>, top to bottom. Each has one button.</li>
            <li><strong>Click any underlined number</strong> anywhere to see the document it came from.</li>
            <li>Use <strong>“You are…”</strong> (top right) to act as the reviewer, partner or client, and <strong>? Help</strong> for what the tax words mean.</li>
          </ul>
          <div style={{ marginTop: 10 }}><NumberLegend /></div>
        </section>
      ) : (
        <div className="row spread"><h1>Okafor-Lindqvist family · 2025 tax return</h1><button className="btn small" onClick={() => hide(false)}>What is this?</button></div>
      )}

      <section className="card">
        <h2>The bottom line</h2>
        <div className="bottom-line">
          <div className="kpi">
            <div className="label">Federal (IRS)</div>
            <div className="value">They {plain(pos.federal.approved)}</div>
            <div className="sub">The tax software said: they {plain(pos.federal.engine)}.</div>
            <div className="sub">If every must-fix problem is fixed: they <strong>{plain(pos.federal.ifAllFixed)}</strong>.</div>
          </div>
          <div className="kpi">
            <div className="label">California</div>
            <div className="value">They {plain(pos.california.approved)}</div>
            <div className="sub">The tax software said: they {plain(pos.california.engine)}.</div>
            <div className="sub">If every must-fix problem is fixed: they <strong>{plain(pos.california.ifAllFixed)}</strong>.</div>
          </div>
        </div>
        <p className="small muted" style={{ marginTop: 8 }}>The big number moves only when a fix is approved. Amounts are estimates using the tax software’s own rates, because the software itself can’t be re-run.</p>
      </section>

      <section className="card">
        <h2>Five steps to file</h2>
        <ol className="journey">
          {journey.map((s, i) => (
            <li key={s.title} className={s.done ? 'done' : i === nowIdx ? 'now' : ''}>
              <span className="num">{s.done ? '✓' : i + 1}</span>
              <div>
                <strong>{s.title}</strong> {i === nowIdx && <Pill tone="info">Next</Pill>}
                <div className="who">{s.who} · {s.status}</div>
              </div>
              <Link className={`btn small ${i === nowIdx ? 'primary' : ''}`} to={s.to}>{s.go}</Link>
            </li>
          ))}
        </ol>
      </section>

      <section className="card">
        <h2>Waiting for you, {actor.name.split(' ')[0]}</h2>
        {notices.length === 0 ? <p className="muted">Nothing right now. {nowIdx >= 0 && journey[nowIdx].who.includes('Reviewer') && actor.role === 'preparer' ? 'Switch to the reviewer or partner (top right) to approve fixes.' : ''}</p> : (
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {notices.map((n, i) => <li key={i} style={{ marginBottom: 4 }}><Link to={n.to}>{n.text}</Link> {n.tone === 'bad' && <Pill tone="bad">urgent</Pill>}</li>)}
          </ul>
        )}
      </section>

      <details className="card more">
        <summary>More details: completeness, team and dates, time, recent activity</summary>
        <div className="grid cols-2">
          <div>
            <h3>Proof nothing was missed</h3>
            <table className="tbl"><tbody>
              <tr><td>Every document accounted for</td><td className="num">{docsOk} / {idx.docList.length}</td></tr>
              <tr><td>Every topic looked at, with a conclusion</td><td className="num">{areasDone} / {areaList.length}</td></tr>
              <tr><td>Every outside filing found and the client told</td><td className="num">{outsideDone} / {outside.length}</td></tr>
            </tbody></table>
          </div>
          <div>
            <h3>Team and dates</h3>
            <div className="small">Preparer <strong>{name(team.preparer)}</strong> · Reviewer <strong>{name(team.reviewer)}</strong> · Partner <strong>{name(team.partner)}</strong></div>
            <table className="tbl" style={{ marginTop: 6 }}><tbody>
              {deadlines.map((d) => <tr key={d.what}><td className="small">{d.what}</td><td className="num small">{day(d.date)}</td><td><Pill tone={d.days < 0 ? 'bad' : d.days < 14 ? 'warn' : undefined}>{d.days < 0 ? `${-d.days}d ago` : `in ${d.days}d`}</Pill></td></tr>)}
            </tbody></table>
            <p className="muted small">Measured against the story date, {day(state.season.asOf)}.</p>
          </div>
          <div>
            <h3>Time against budget</h3>
            {AREAS.filter((a) => budgets[a.id]).map((a) => {
              const used = hours(a.id), cap = budgets[a.id]
              return (
                <div key={a.id} style={{ marginBottom: 6 }}>
                  <div className="row spread small"><span>{a.label}</span><span className="num">{used.toFixed(1)} / {cap.toFixed(1)} h</span></div>
                  <div className={`bar ${used > cap ? 'over' : ''}`}><i style={{ width: `${Math.min(100, (used / cap) * 100)}%` }} /></div>
                </div>
              )
            })}
          </div>
          <div>
            <div className="row spread"><h3>Changed by others since you looked</h3>{feed.length > 0 && <button className="btn small" onClick={() => commit([{ type: 'seen.mark', data: {} }])}>Mark as seen</button>}</div>
            {feed.length === 0 ? <p className="muted small">Nothing new.</p> : (
              <ul className="timeline">{feed.map((e) => <li key={e.id} className="small"><strong>{name(e.actor)}</strong> {describeEvent(e, state, name)} <span className="muted">· {when(e.at)}</span></li>)}</ul>
            )}
          </div>
        </div>
      </details>
    </div>
  )
}
