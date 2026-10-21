import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { findingStatus } from '../domain/derived'
import { AREAS, areaLabel, areaOfLine } from '../packet'
import type { ReturnLine } from '../packet/types'
import { useStore } from '../store/Store'
import { Empty, Num, Pill, SeverityPill, StatusPill, day, who } from '../ui/Common'
import { PageHeader } from '../ui/Shell'
import { BusinessPanel, CaliforniaPanel, InvestmentsPanel, PassThroughPanel, RentalsPanel, WagesPanel } from './panels'

export function AreaPage() {
  const { id = 'return_summary' } = useParams()
  const { idx, state, findings, variances, actors, commit, say, can, actor, uid } = useStore()
  const [hours, setHours] = useState('')
  const [hourNote, setHourNote] = useState('')
  const [conclusion, setConclusion] = useState('')
  const [showAll, setShowAll] = useState(false)
  const label = areaLabel(id)

  const lines = useMemo(() => idx.current.lines.filter((l) => areaOfLine(l.key) === id && !(l.form === 'F8949' && !/total/.test(l.line))), [idx, id])
  const lotCount = idx.current.lines.filter((l) => areaOfLine(l.key) === id && l.form === 'F8949' && !/total/.test(l.line)).length
  const groups = useMemo(() => {
    const m = new Map<string, ReturnLine[]>()
    for (const l of lines) m.set(l.form, [...(m.get(l.form) ?? []), l])
    return [...m.entries()]
  }, [lines])

  const mine = findings.filter((f) => f.area === id)
  const budget = idx.packet.firm.budget_hours[id]
  const used = state.timeEntries.filter((t) => t.area === id).reduce((s, t) => s + t.hours, 0)
  const assignment = state.assignments[id]
  const attest = state.attestations[`area:${id}`]
  const priorLines = idx.packet.prior_years.return_2024.lines
  const flaggedVariance = new Set(variances.filter((v) => v.flagged).map((v) => v.key))

  const logTime = () => {
    const h = Number(hours)
    if (!h) return
    const r = commit([{ type: 'time.log', data: { id: uid('time'), area: id, hours: h, note: hourNote } }])
    if (!r.ok) return say(r.error ?? 'Not allowed')
    setHours(''); setHourNote('')
  }
  const considered = () => {
    const r = commit([{ type: 'step.attest', data: { step: `area:${id}`, note: conclusion, adjustmentIds: [] } }])
    if (!r.ok) return say(r.error ?? 'Not allowed')
    setConclusion('')
  }

  return (
    <div className="page stack">
      <PageHeader title={label}>
        {AREAS.find((a) => a.id === id) ? 'Every figure here opens its source. Dotted colour means the number has been adjusted, flagged, verified or asked about.' : ''}
      </PageHeader>

      <div className="row wrap">
        {assignment && <Pill tone="info">Assigned to {who(actors, assignment.to)} · due {day(assignment.due)}</Pill>}
        {budget !== undefined && <Pill tone={used > budget ? 'bad' : undefined}>{used.toFixed(1)} of {budget.toFixed(1)} budgeted hours</Pill>}
        {attest ? <Pill tone="good">Considered by {who(actors, attest.by)} · {day(attest.at)}</Pill> : <Pill>Not yet signed off as considered</Pill>}
      </div>

      {mine.length > 0 && (
        <section className="card">
          <div className="row spread"><h2>Findings in this area</h2><Link className="btn small" to="/issues">Open Issues</Link></div>
          <table className="tbl"><tbody>
            {mine.map((f) => (
              <tr key={f.id}><td style={{ width: 70 }}><SeverityPill severity={f.severity} /></td><td>{f.title}</td><td><StatusPill status={findingStatus(f, state)} /></td></tr>
            ))}
          </tbody></table>
        </section>
      )}

      {id === 'business' && <BusinessPanel />}
      {id === 'investments_and_digital_assets' && <InvestmentsPanel />}
      {id === 'wages_and_stock_compensation' && <WagesPanel />}
      {id === 'pass_throughs_and_basis' && <PassThroughPanel />}
      {id === 'rentals_and_sale' && <RentalsPanel />}
      {id === 'california' && <CaliforniaPanel />}

      <section className="card">
        <div className="row spread">
          <h2>Lines</h2>
          {lotCount > 0 && <span className="muted small">{lotCount} Form 8949 lots are on <Link to="/schedules/sales">Sales detail</Link></span>}
        </div>
        {lines.length === 0 ? <Empty>No engine lines in this area.</Empty> : (
          <div className="scroll">
            <table className="tbl">
              <thead><tr><th>Line</th><th>What it is</th><th className="num">2025</th><th className="num">2024</th><th /></tr></thead>
              <tbody>
                {groups.map(([form, ls]) => (
                  <GroupRows key={form} form={form} ls={ls} priorLines={priorLines} flagged={flaggedVariance} limit={showAll ? 9999 : 40} />
                ))}
              </tbody>
            </table>
          </div>
        )}
        {lines.length > 80 && !showAll && <button className="btn small" style={{ marginTop: 8 }} onClick={() => setShowAll(true)}>Show all {lines.length}</button>}
      </section>

      <div className="grid cols-2">
        {can('time.log') && (
          <section className="card">
            <h2>Log time</h2>
            <div className="row"><input type="number" step="0.25" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="hours" style={{ width: 90 }} /><input type="text" value={hourNote} onChange={(e) => setHourNote(e.target.value)} placeholder="what you worked on" /><button className="btn" onClick={logTime}>Add</button></div>
            <ul className="small" style={{ paddingLeft: 18 }}>
              {state.timeEntries.filter((t) => t.area === id).slice(-5).map((t) => <li key={t.id}>{t.hours}h · {who(actors, t.by)} · {t.note || '—'}</li>)}
            </ul>
          </section>
        )}
        {can('step.attest') && (
          <section className="card">
            <h2>Mark this area as considered</h2>
            <p className="small muted">Proof of completeness: every area is looked at and a conclusion recorded, even when nothing was found.</p>
            <textarea value={conclusion} onChange={(e) => setConclusion(e.target.value)} placeholder="What did you conclude? e.g. Reconciled to the 1099s; two issues raised." />
            <button className="btn primary" style={{ marginTop: 6 }} disabled={!conclusion.trim()} onClick={considered}>Record conclusion</button>
            {attest && <p className="small" style={{ marginTop: 8 }}>Last: “{attest.note}” — {who(actors, attest.by)}</p>}
          </section>
        )}
      </div>
      <span className="hide">{actor.id}</span>
    </div>
  )
}

function GroupRows({ form, ls, priorLines, flagged, limit }: { form: string; ls: ReturnLine[]; priorLines: Record<string, number | string>; flagged: Set<string>; limit: number }) {
  return (
    <>
      <tr className="group"><td colSpan={5}>{form}</td></tr>
      {ls.slice(0, limit).map((l) => {
        const prior = priorLines[l.key]
        return (
          <tr key={l.key} className={flagged.has(l.key) ? 'flag' : ''}>
            <td className="mono">{l.line}</td>
            <td>{l.label}{l.note && <div className="muted small">{l.note}</div>}</td>
            <td className="num"><Num line={l} /></td>
            <td className="num muted">{typeof prior === 'number' ? prior.toLocaleString('en-US') : prior ?? ''}</td>
            <td>{flagged.has(l.key) && <Pill tone="warn">moved &gt; threshold</Pill>}</td>
          </tr>
        )
      })}
      {ls.length > limit && <tr><td colSpan={5} className="muted small">… {ls.length - limit} more lines</td></tr>}
    </>
  )
}
