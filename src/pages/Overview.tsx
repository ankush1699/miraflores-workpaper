import { Link } from 'react-router-dom'
import { usd } from '../checks/helpers'
import { findingStatus, isResolved } from '../domain/derived'
import { position } from '../domain/summary'
import { stepStatuses } from '../domain/steps'
import { notificationsFor } from '../domain/notify'
import { dispositionOf } from '../checks/review'
import { findingEffect } from '../domain/recon'
import { AREAS } from '../packet'
import { useStore } from '../store/Store'
import { EffectText, Pill, day, when, who } from '../ui/Common'
import { describeEvent, isFeedEvent } from '../ui/describe'
import { PageHeader } from '../ui/Shell'

export function OverviewPage() {
  const { idx, state, findings, variances, events, actors, actor, commit } = useStore()
  const pos = position(idx, state, findings)
  const steps = stepStatuses({ idx, state, findings, variances })
  const stepsDone = steps.filter((s) => s.state === 'done').length
  const open = findings.filter((f) => f.severity !== 'info' && !isResolved(findingStatus(f, state)))
  const errors = open.filter((f) => f.severity === 'error')
  const lastSeen = state.seen[actor.id] ?? ''
  const feed = events.filter((e) => isFeedEvent(e) && e.at > lastSeen && e.actor !== actor.id && !state.undone.has(e.id)).slice(-12).reverse()
  const budgets = idx.packet.firm.budget_hours
  const hours = (area: string) => state.timeEntries.filter((t) => t.area === area).reduce((s, t) => s + t.hours, 0)
  const team = idx.packet.firm.assignment_at_start
  const name = (id: string) => who(actors, id)
  const asOf = state.season.asOf
  const deadlines = idx.packet.firm.deadlines.map((d) => ({ ...d, days: Math.round((new Date(d.date).getTime() - new Date(asOf).getTime()) / 86400000) }))

  const notices = notificationsFor(actor, { idx, state, findings, variances })
  const docsOk = idx.docList.filter((d) => {
    const k = dispositionOf(idx, d.id).kind
    return k !== 'not_landed' || !!state.docDispositions[d.id]
  }).length
  const areasDone = AREAS.filter((a) => a.id !== 'return_summary' && state.attestations[`area:${a.id}`]).length
  const areaTotal = AREAS.filter((a) => a.id !== 'return_summary').length
  const outside = findings.filter((f) => f.kind === 'outside_scope')
  const outsideDone = outside.filter((f) => isResolved(findingStatus(f, state))).length

  const bal = (n: number, kind: 'owe' | 'refund') => (n >= 0 ? `${usd(n)} ${kind === 'owe' ? 'due' : 'due'}` : `${usd(-n)} refund`)

  return (
    <div className="page stack">
      <PageHeader title="Okafor-Lindqvist household · 2025">
        Form 1040 and California 540NR (part-year resident, moved to Texas 07/15/2025). The numbers below start from the engine's v3 run of {day(idx.current.computed_at)} and move only as adjustments are approved.
      </PageHeader>

      <div className="grid cols-4">
        <div className="kpi">
          <div className="label">Federal</div>
          <div className="value">{bal(pos.federal.approved, 'owe')}</div>
          <div className="sub">Engine v3: {bal(pos.federal.engine, 'owe')}</div>
          <div className="sub">If every clear error is fixed: <strong>{bal(pos.federal.ifAllFixed, 'owe')}</strong></div>
        </div>
        <div className="kpi">
          <div className="label">California</div>
          <div className="value">{bal(pos.california.approved, 'refund')}</div>
          <div className="sub">Engine v3: {bal(pos.california.engine, 'refund')}</div>
          <div className="sub">If every clear error is fixed: <strong>{bal(pos.california.ifAllFixed, 'refund')}</strong></div>
        </div>
        <Link to="/issues" className="kpi" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="label">Open findings</div>
          <div className="value">{open.length}</div>
          <div className="sub">{errors.length} errors · {open.length - errors.length} checks to resolve</div>
        </Link>
        <Link to="/filing" className="kpi" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="label">Required steps</div>
          <div className="value">{stepsDone} / {steps.length}</div>
          <div className="sub">before the return can be filed</div>
        </Link>
      </div>
      <p className="muted small">Tax effects are estimates from the engine's per-dollar rates at the v3 numbers. The real system recomputes; thresholds and AMT interplay are not modelled.</p>

      <div className="grid cols-2">
        <section className="card">
          <h2>For you, {actor.name.split(' ')[0]}</h2>
          {notices.length === 0 ? <p className="muted">Nothing is waiting for you.</p> : (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {notices.map((n, i) => <li key={i} style={{ marginBottom: 4 }}><Link to={n.to}>{n.text}</Link> {n.tone === 'bad' && <Pill tone="bad">urgent</Pill>}</li>)}
            </ul>
          )}
        </section>
        <section className="card">
          <h2>Proof of completeness</h2>
          <table className="tbl"><tbody>
            <tr><td>Every document accounted for</td><td className="num">{docsOk} / {idx.docList.length}</td><td><Link to="/documents">Documents</Link></td></tr>
            <tr><td>Every area considered, with a conclusion</td><td className="num">{areasDone} / {areaTotal}</td><td className="muted small">on each area page</td></tr>
            <tr><td>Every outside filing identified and the client told</td><td className="num">{outsideDone} / {outside.length}</td><td><Link to="/issues">Issues</Link></td></tr>
          </tbody></table>
        </section>
      </div>

      {feed.length > 0 && (
        <section className="card">
          <div className="row spread"><h2>Since you last looked</h2><button className="btn small" onClick={() => commit([{ type: 'seen.mark', data: {} }])}>Mark as seen</button></div>
          <ul className="timeline">
            {feed.map((e) => <li key={e.id}><strong>{name(e.actor)}</strong> {describeEvent(e, state, name)} <span className="muted small">· {when(e.at)}</span></li>)}
          </ul>
        </section>
      )}

      <div className="grid cols-2">
        <section className="card">
          <h2>Ready to file?</h2>
          <table className="tbl"><tbody>
            {steps.map((s) => (
              <tr key={s.name}>
                <td style={{ width: 24 }}>{s.state === 'done' ? '✓' : s.state === 'reopened' ? '↺' : '○'}</td>
                <td>{s.name}<div className="muted small">{s.why}</div></td>
                <td><Pill tone={s.state === 'done' ? 'good' : s.state === 'reopened' ? 'warn' : undefined}>{s.state === 'reopened' ? 'Reopened' : s.state === 'done' ? 'Done' : 'Open'}</Pill></td>
              </tr>
            ))}
          </tbody></table>
        </section>

        <div className="stack">
          <section className="card">
            <h2>Team and dates</h2>
            <div className="small">Preparer <strong>{name(team.preparer)}</strong> · Reviewer <strong>{name(team.reviewer)}</strong> · Partner <strong>{name(team.partner)}</strong></div>
            <table className="tbl" style={{ marginTop: 8 }}><tbody>
              {deadlines.map((d) => (
                <tr key={d.what}><td>{d.what}</td><td className="num">{day(d.date)}</td><td><Pill tone={d.days < 0 ? 'bad' : d.days < 14 ? 'warn' : undefined}>{d.days < 0 ? `${-d.days}d past` : `in ${d.days}d`}</Pill></td></tr>
              ))}
            </tbody></table>
            <p className="muted small" style={{ marginTop: 6 }}>Measured against the season date, {day(asOf)}.</p>
          </section>
          <section className="card">
            <h2>Time against budget</h2>
            {AREAS.filter((a) => budgets[a.id]).map((a) => {
              const used = hours(a.id), cap = budgets[a.id]
              return (
                <div key={a.id} style={{ marginBottom: 8 }}>
                  <div className="row spread small"><span>{a.label}</span><span className="num">{used.toFixed(1)} / {cap.toFixed(1)} h</span></div>
                  <div className={`bar ${used > cap ? 'over' : ''}`}><i style={{ width: `${Math.min(100, (used / cap) * 100)}%` }} /></div>
                </div>
              )
            })}
            <p className="muted small">Log time from any area page.</p>
          </section>
        </div>
      </div>

      <section className="card">
        <h2>The biggest problems right now</h2>
        {errors.length === 0 ? <p className="muted">No open errors.</p> : (
          <table className="tbl"><tbody>
            {errors.slice(0, 6).map((f) => (
              <tr key={f.id}>
                <td>{f.title}</td>
                <td className="num">{f.fix ? <EffectText n={findingEffect(idx, f).federalBalance + findingEffect(idx, f).californiaBalance} /> : null}</td>
              </tr>
            ))}
          </tbody></table>
        )}
        <div style={{ marginTop: 8 }}><Link to="/issues" className="btn small">Go to Issues</Link></div>
      </section>
    </div>
  )
}
