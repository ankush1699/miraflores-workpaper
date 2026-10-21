import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { findingStatus } from '../domain/derived'
import { AREAS, areaLabel, areaOfLine } from '../packet'
import type { ReturnLine } from '../packet/types'
import { useStore } from '../store/Store'
import { Empty, Num, Pill, SeverityPill, StatusPill, day, who } from '../ui/Common'
import { PageHeader } from '../ui/Shell'
import { NumberLegend } from '../ui/Guides'
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
      <PageHeader title={label}>{AREAS.find((a) => a.id === id)?.hint}</PageHeader>
      <NumberLegend />

      <div className="row wrap">
        {assignment && <Pill tone="info">Assigned to {who(actors, assignment.to)} · due {day(assignment.due)}</Pill>}
        {budget !== undefined && <Pill tone={used > budget ? 'bad' : undefined}>{used.toFixed(1)} of {budget.toFixed(1)} budgeted hours</Pill>}
        {attest ? <Pill tone="good">Checked by {who(actors, attest.by)} · {day(attest.at)}</Pill> : <Pill>Not checked yet</Pill>}
      </div>

      {mine.length > 0 && (
        <section className="card">
          <div className="row spread"><h2>Problems in this topic</h2><Link className="btn small" to="/issues">Open Problems</Link></div>
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
          <h2>Every number in this topic</h2>
          {lotCount > 0 && <span className="muted small">{lotCount} Form 8949 lots are on <Link to="/schedules/sales">Sales detail</Link></span>}
        </div>
        {lines.length === 0 ? <Empty>No numbers in this topic.</Empty> : (
          <div className="scroll">
            <table className="tbl">
              <thead><tr><th>What it is</th><th>Form line</th><th className="num">2025</th><th className="num">Last year</th><th /></tr></thead>
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
            <h2>Mark this topic as checked</h2>
            <p className="small muted">Proof nothing was skipped: every topic gets a short conclusion, even when nothing was wrong.</p>
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

// What each form is, for people who don't speak tax-form.
const FORM_NAMES: Record<string, string> = {
  F1040: 'Main federal return (Form 1040)', Sch1: 'Extra income and adjustments (Schedule 1)', Sch2: 'Extra taxes (Schedule 2)', Sch3: 'Credits and payments (Schedule 3)',
  SchA: 'Itemized deductions (Schedule A)', SchB: 'Interest and dividends (Schedule B)', SchC: 'Business income and expenses (Schedule C)', SchD: 'Capital gains (Schedule D)',
  SchE: 'Rentals and K-1 income (Schedule E)', SchSE: 'Self-employment tax (Schedule SE)', F8949: 'Stock and crypto sales (Form 8949)', F4797: 'Sale of the rental condo (Form 4797)',
  'F4562-C': 'Business equipment depreciation', 'F4562-E': 'Rental depreciation', F8582: 'Rental loss limits (Form 8582)', F6251: 'Alternative minimum tax (Form 6251)',
  F8959: 'Additional Medicare tax', F8960: 'Investment income tax', F8995: 'Small-business deduction (QBI)', F8812: 'Child tax credit', F8863: 'Education credit',
  F2441: 'Child care credit', F8889: 'Health savings account', F8606: 'IRA and Roth conversion (Form 8606)', F8283: 'Donated property (Form 8283)', F7203: 'Company stock basis (Form 7203)',
  F8938: 'Foreign accounts (Form 8938)', F2210: 'Underpayment penalty', F8867: 'Due diligence checklist', SchCA540NR: 'California adjustments (Schedule CA)', F540NR: 'California return (540NR)',
  ScheduleS: 'California credit for other-state tax', FTB3885A: 'California depreciation', FTB5805: 'California underpayment penalty',
}

function GroupRows({ form, ls, priorLines, flagged, limit }: { form: string; ls: ReturnLine[]; priorLines: Record<string, number | string>; flagged: Set<string>; limit: number }) {
  return (
    <>
      <tr className="group"><td colSpan={5}>{FORM_NAMES[form] ?? form} <span className="code">{FORM_NAMES[form] ? form : ''}</span></td></tr>
      {ls.slice(0, limit).map((l) => {
        const prior = priorLines[l.key]
        return (
          <tr key={l.key} className={flagged.has(l.key) ? 'flag' : ''}>
            <td>{l.label}{l.note && <div className="muted small">{l.note}</div>}</td>
            <td className="code">{l.key}</td>
            <td className="num"><Num line={l} /></td>
            <td className="num muted">{typeof prior === 'number' ? prior.toLocaleString('en-US') : prior ?? ''}</td>
            <td>{flagged.has(l.key) && <Pill tone="warn" title="Changed a lot from last year; needs an explanation">big change</Pill>}</td>
          </tr>
        )
      })}
      {ls.length > limit && <tr><td colSpan={5} className="muted small">… {ls.length - limit} more lines</td></tr>}
    </>
  )
}
