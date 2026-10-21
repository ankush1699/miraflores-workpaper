import { useMemo, useState } from 'react'
import { NavLink, useParams } from 'react-router-dom'
import { usd, evNumber, parseMoney } from '../checks/helpers'
import { dispositionOf } from '../checks/review'
import { adjustedLine, lineValue } from '../domain/derived'
import { brokerTieOuts, scorpBasisRows, w2Rows } from '../domain/recon'
import { AREAS, areaOfLine } from '../packet'
import type { ReturnLine } from '../packet/types'
import { useStore } from '../store/Store'
import { Money, Num, Pill, RefChip } from '../ui/Common'
import { PageHeader } from '../ui/Shell'
import { useUi } from '../ui/Ui'

const LIST: [string, string][] = [
  ['summary', 'Return summary vs last year'], ['computation', 'Tax computation'], ['areas', 'Area summaries'], ['documents', 'Document index'],
  ['depreciation', 'Depreciation by asset'], ['sales', 'Sales detail'], ['books', 'Books to tax'], ['rentals', 'Rentals and passive losses'],
  ['k1', 'K-1 lines'], ['retirement', 'Retirement and foreign'], ['deductions', 'Deductions and credits'], ['payments', 'Payments'],
  ['states', 'State split'], ['carryovers', 'Carryovers'], ['basis', 'Basis by year'], ['prior', 'Prior preparer vs what we changed'],
]

export function SchedulesPage() {
  const { name = 'summary' } = useParams()
  return (
    <div className="page">
      <PageHeader title="Reports">The standard reports an accountant expects, built from the same records as the return. Pick one on the left; click any number for its source.</PageHeader>
      <div className="grid" style={{ gridTemplateColumns: '220px minmax(0,1fr)' }}>
        <nav className="nav card" style={{ padding: 8, alignSelf: 'start' }}>
          {LIST.map(([k, l]) => <NavLink key={k} to={`/schedules/${k}`} className={({ isActive }) => (isActive || (name === k) ? 'active' : '')}>{l}</NavLink>)}
        </nav>
        <div className="stack">
          {name === 'summary' && <Summary />}
          {name === 'computation' && <Computation />}
          {name === 'areas' && <Areas />}
          {name === 'documents' && <DocIndex />}
          {name === 'depreciation' && <Depreciation />}
          {name === 'sales' && <Sales />}
          {name === 'books' && <BooksToTax />}
          {name === 'rentals' && <Rentals />}
          {name === 'k1' && <K1 />}
          {name === 'retirement' && <Retirement />}
          {name === 'deductions' && <Deductions />}
          {name === 'payments' && <Payments />}
          {name === 'states' && <States />}
          {name === 'carryovers' && <Carryovers />}
          {name === 'basis' && <Basis />}
          {name === 'prior' && <Prior />}
        </div>
      </div>
    </div>
  )
}

const L = (idx: ReturnType<typeof useStore>['idx'], k: string): ReturnLine | undefined => idx.lineMaps.get(idx.current.version)?.get(k)

function Rows({ keys }: { keys: string[] }) {
  const { idx } = useStore()
  return <>{keys.map((k) => { const l = L(idx, k); return l ? <tr key={k}><td className="mono small">{k}</td><td>{l.label}</td><td className="num"><Num line={l} /></td></tr> : null })}</>
}

function Table({ title, keys, note }: { title: string; keys: string[]; note?: string }) {
  return <section className="card"><h2>{title}</h2><table className="tbl"><tbody><Rows keys={keys} /></tbody></table>{note && <p className="small muted">{note}</p>}</section>
}

/* ------------------------------------------------------------ summary */

function Summary() {
  const { idx, state, variances, commit, say, can } = useStore()
  const { openTrace } = useUi()
  const keys = ['F1040.1z', 'F1040.2b', 'F1040.3b', 'F1040.7', 'F1040.8', 'F1040.9', 'F1040.10', 'F1040.11', 'F1040.12', 'F1040.13', 'F1040.15', 'F1040.16', 'F1040.23', 'F1040.24', 'F1040.33', 'F540NR.17', 'F540NR.19', 'F540NR.64']
  const rows = variances.filter((v) => keys.includes(v.key))
  const explain = (key: string) => {
    const text = window.prompt('Explain this change from last year:') ?? ''
    if (!text.trim()) return
    const r = commit([{ type: 'variance.explain', data: { key, text, refs: [`line:${key}`] } }])
    if (!r.ok) say(r.error ?? 'Not allowed')
  }
  const th = state.standards.variance_review
  const flagged = variances.filter((v) => v.flagged)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const toggle = (k: string) => setPicked((p) => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n })
  /** One explanation can cover many lines that moved for the same reason (the sale, the move, the new job). */
  const explainMany = () => {
    const keys = [...picked].filter((k) => !state.varianceNotes[k])
    if (!keys.length) return say('Pick lines that are not explained yet.')
    const text = window.prompt(`One explanation for ${keys.length} lines (e.g. "Sold the Austin condo and the RSU/ISO activity; see D51, D28"):`) ?? ''
    if (!text.trim()) return
    const r = commit(keys.map((key) => ({ type: 'variance.explain', data: { key, text, refs: [`line:${key}`] } })))
    if (!r.ok) return say(r.error ?? 'Not allowed')
    say(`Explained ${keys.length} lines. Undo takes them all back.`)
    setPicked(new Set())
  }
  return (
    <>
      <section className="card">
        <h2>Summary against 2024</h2>
        <table className="tbl">
          <thead><tr><th>Line</th><th className="num">2024</th><th className="num">2025</th><th className="num">Change</th><th className="num">%</th><th /></tr></thead>
          <tbody>
            {rows.map((v) => (
              <tr key={v.key} className={v.flagged ? 'flag' : ''}>
                <td>{v.label}<div className="muted mono small">{v.key}</div></td><td className="num">{usd(v.prior)}</td>
                <td className="num"><a href="#" onClick={(e) => { e.preventDefault(); openTrace(`line:${v.key}`) }}>{usd(v.current)}</a></td>
                <td className="num"><Money n={v.change} /></td><td className="num">{v.pct === null ? 'n/a' : `${v.pct.toFixed(0)}%`}</td>
                <td>{v.flagged && (state.varianceNotes[v.key] ? <Pill tone="good">explained</Pill> : can('step.attest') ? <button className="btn small" onClick={() => explain(v.key)}>Explain</button> : <Pill tone="warn">unexplained</Pill>)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="card">
        <h2>Every year-over-year swing</h2>
        <p className="small muted">Flagged when a line moved by more than {th.flag_if_change_over_percent}% and more than {usd(th.and_over_amount)} (change these in Settings & security). {flagged.length} lines flagged, {flagged.filter((v) => state.varianceNotes[v.key]).length} explained.</p>
        {can('step.attest') && (
          <div className="row" style={{ marginBottom: 6 }}>
            <button className="btn small" onClick={() => setPicked(new Set(flagged.filter((v) => !state.varianceNotes[v.key]).map((v) => v.key)))}>Select all unexplained</button>
            <button className="btn small primary" disabled={!picked.size} onClick={explainMany}>Explain {picked.size || ''} together</button>
          </div>
        )}
        <div className="scroll"><table className="tbl">
          <thead><tr><th /><th>Line</th><th className="num">2024</th><th className="num">2025</th><th className="num">Change</th><th>Explanation</th></tr></thead>
          <tbody>
            {flagged.map((v) => (
              <tr key={v.key}>
                <td>{!state.varianceNotes[v.key] && can('step.attest') && <input type="checkbox" checked={picked.has(v.key)} onChange={() => toggle(v.key)} />}</td>
                <td>{v.label}<div className="muted mono small">{v.key}</div></td><td className="num">{usd(v.prior)}</td><td className="num">{usd(v.current)}</td><td className="num"><Money n={v.change} /></td>
                <td className="small">{state.varianceNotes[v.key]?.text ?? (can('step.attest') ? <button className="btn small" onClick={() => explain(v.key)}>Explain</button> : '—')}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </section>
      <span className="hide">{idx.packet.packet.name}</span>
    </>
  )
}

function Computation() {
  return (
    <>
      <Table title="Regular tax" keys={['F1040.11', 'F1040.12', 'F1040.13', 'F1040.14', 'F1040.15', 'F1040.16']} note="Tax by the Schedule D tax worksheet: preferential rates on qualified dividends and long-term gains, 25% on unrecaptured section 1250 gain." />
      <Table title="Alternative minimum tax" keys={['F6251.1', 'F6251.2a', 'F6251.2i', 'F6251.4', 'F6251.5', 'F6251.6', 'F6251.7', 'F6251.8', 'F6251.9', 'F6251.10', 'F6251.11']} note="The incentive stock option exercise is the whole story. California AMT is not computed." />
      <Table title="Other taxes and credits" keys={['F1040.17', 'F1040.18', 'F1040.19', 'F1040.20', 'F1040.22', 'Sch2.4', 'Sch2.11', 'Sch2.12', 'F1040.23', 'F1040.24']} />
      <Table title="Payments and balance" keys={['F1040.25d', 'F1040.26', 'F1040.31', 'F1040.33', 'F1040.37', 'F1040.38']} />
      <Table title="California" keys={['F540NR.17', 'F540NR.19', 'F540NR.31', 'F540NR.35', 'F540NR.37', 'F540NR.40', 'ScheduleS.credit', 'F540NR.64', 'F540NR.78', 'F540NR.97']} />
    </>
  )
}

function Areas() {
  const { idx, state, findings } = useStore()
  const rows = AREAS.map((a) => {
    const lines = idx.current.lines.filter((l) => areaOfLine(l.key) === a.id)
    const adj = state.adjustments.filter((x) => x.target.startsWith('line:') && areaOfLine(x.target.slice(5)) === a.id && x.status === 'approved')
    return { a, n: lines.length, adj: adj.length, f: findings.filter((x) => x.area === a.id).length, att: state.attestations[`area:${a.id}`] }
  })
  return (
    <section className="card"><h2>Area summaries</h2>
      <table className="tbl"><thead><tr><th>Area</th><th className="num">Lines</th><th className="num">Findings</th><th className="num">Approved adjustments</th><th>Considered</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.a.id}><td><NavLink to={`/area/${r.a.id}`}>{r.a.label}</NavLink></td><td className="num">{r.n}</td><td className="num">{r.f}</td><td className="num">{r.adj}</td><td>{r.att ? <Pill tone="good">yes</Pill> : <Pill>not yet</Pill>}</td></tr>)}</tbody></table>
    </section>
  )
}

function DocIndex() {
  const { idx, state } = useStore()
  return (
    <section className="card"><h2>Document index</h2>
      <div className="scroll" style={{ maxHeight: 640 }}><table className="tbl"><thead><tr><th>Doc</th><th>Title</th><th>Received</th><th>Landed on</th></tr></thead>
        <tbody>{idx.docList.map((d) => { const disp = dispositionOf(idx, d.id); return <tr key={d.id}><td><RefChip r={`doc:${d.id}`} /></td><td>{d.title}</td><td className="small">{d.received_at.slice(0, 10)}</td><td className="small">{disp.kind === 'landed' ? disp.lines.slice(0, 4).map((l) => l.key).join(', ') + (disp.lines.length > 4 ? ` +${disp.lines.length - 4}` : '') : disp.kind === 'superseded' ? `superseded by ${disp.by}` : disp.kind === 'duplicate' ? `duplicate of ${disp.of}` : state.docDispositions[d.id] ? `decision: ${state.docDispositions[d.id].note}` : disp.kind.replace('_', ' ')}</td></tr> })}</tbody></table></div>
    </section>
  )
}

/* ------------------------------------------------------- depreciation */

function Depreciation() {
  const { idx, state } = useStore()
  const rows = idx.current.assets
  const sum = (f: (a: (typeof rows)[number]) => number) => rows.reduce((s, a) => s + f(a), 0)
  const hvac = state.adjustments.find((a) => a.status === 'approved' && a.target === 'line:SchE.18A')
  return (
    <>
      <section className="card"><h2>Depreciation by asset, 2025</h2>
        <div className="scroll" style={{ maxHeight: 'none' }}><table className="tbl">
          <thead><tr><th>Asset</th><th>Placed in service</th><th>Method and life</th><th className="num">Cost</th><th className="num">Federal</th><th className="num">California</th><th className="num">AMT</th><th className="num">Federal accumulated</th><th>Disposed</th></tr></thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.asset_id}><td><RefChip r={`asset:${a.asset_id}`} /><div className="small">{a.description}</div></td><td className="small">{a.placed_in_service}</td><td className="small">{a.method}, {a.life_years} yrs</td>
                <td className="num">{usd(a.cost)}</td><td className="num">{usd(a.federal.depreciation_2025, true)}</td><td className="num">{usd(a.california.depreciation_2025, true)}</td><td className="num">{usd(a.amt.depreciation_2025, true)}</td><td className="num">{usd(a.federal.accumulated_end, true)}</td><td className="small">{a.disposed ?? ''}</td></tr>
            ))}
            {hvac && <tr className="flag"><td>HVAC system (adjustment)<div className="small">1450 Fremont Way</div></td><td className="small">2025-08-12</td><td className="small">SL / mid-month, 27.5 yrs</td><td className="num">{usd(11000)}</td><td className="num">{usd(hvac.lineDelta ?? 0, true)}</td><td className="num">{usd(hvac.lineDelta ?? 0, true)}</td><td className="num">—</td><td className="num">—</td><td /></tr>}
            <tr className="group"><td colSpan={4}>Total</td><td className="num">{usd(sum((a) => a.federal.depreciation_2025), true)}</td><td className="num">{usd(sum((a) => a.california.depreciation_2025), true)}</td><td className="num">{usd(sum((a) => a.amt.depreciation_2025), true)}</td><td /><td /></tr>
          </tbody>
        </table></div>
        <p className="small muted">The three studio assets took 100% special depreciation federally ({usd(38000)}); California does not allow it, so its column is regular 5-year MACRS and the {usd(30400)} difference is added back on Schedule CA.</p>
      </section>
      <Table title="Disposal of the Austin condo and recapture" keys={['F4797.21', 'F4797.22', 'F4797.23', 'F4797.24', 'F4797.25', 'F4797.26g', 'SchD.19']} note="All depreciation was straight-line, so there is no ordinary recapture under section 1250; the depreciation taken is unrecaptured section 1250 gain taxed up to 25%." />
    </>
  )
}

/* -------------------------------------------------------------- sales */

function Sales() {
  const { idx, state } = useStore()
  const [box, setBox] = useState('all')
  const [q, setQ] = useState('')
  const [limit, setLimit] = useState(120)
  const lots = useMemo(() => idx.current.lines.filter((l) => l.form === 'F8949' && !/total/.test(l.line)), [idx])
  const shown = lots.filter((l) => (box === 'all' || l.line.startsWith(`${box}.`)) && (!q || l.label.toLowerCase().includes(q.toLowerCase()) || l.line.toLowerCase().includes(q.toLowerCase())))
  const totals = idx.current.lines.filter((l) => /^F8949\..\.total$/.test(l.key))
  const rec = brokerTieOuts(idx)
  const parse = (l: ReturnLine) => ({ p: parseMoney(/proceeds ([\d,]+\.\d\d)/.exec(l.label)?.[1] ?? '0'), b: parseMoney(/basis ([\d,]+\.\d\d)/.exec(l.label)?.[1] ?? '0') })
  void state
  return (
    <>
      <section className="card"><h2>Form 8949 totals by box</h2>
        <table className="tbl"><tbody>{totals.map((t) => <tr key={t.key}><td>{t.label}</td><td className="num"><Num line={t} /></td></tr>)}</tbody></table>
        <table className="tbl" style={{ marginTop: 8 }}><thead><tr><th>Statement</th><th className="num">Lots</th><th className="num">Proceeds</th><th className="num">Statement says</th><th className="num">Diff</th></tr></thead>
          <tbody>{rec.map((r) => { const d = Math.round((r.proceeds - r.summaryProceeds) * 100) / 100; return <tr key={r.doc} className={d ? 'flag' : ''}><td>{r.broker}</td><td className="num">{r.lots}</td><td className="num">{usd(r.proceeds, true)}</td><td className="num">{usd(r.summaryProceeds, true)}</td><td className="num">{d ? <Pill tone="bad">{usd(d, true)}</Pill> : <Pill tone="good">ties</Pill>}</td></tr> })}</tbody></table>
      </section>
      <section className="card">
        <div className="row spread wrap"><h2>All {lots.length} lots</h2>
          <div className="row"><select value={box} onChange={(e) => setBox(e.target.value)} style={{ width: 'auto' }}><option value="all">All boxes</option>{['A', 'B', 'D', 'E', 'F', 'H', 'K'].map((b) => <option key={b} value={b}>Box {b}</option>)}</select><input type="text" placeholder="Search a lot or security" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 220 }} /></div></div>
        <div className="scroll" style={{ maxHeight: 520 }}><table className="tbl">
          <thead><tr><th>Box</th><th>Lot</th><th>Security</th><th className="num">Proceeds</th><th className="num">Basis</th><th className="num">Gain or loss</th></tr></thead>
          <tbody>{shown.slice(0, limit).map((l) => { const { p, b } = parse(l); const [bx, id] = l.line.split('.'); return <tr key={l.key}><td>{bx}</td><td className="mono">{id}</td><td className="small">{l.label.replace(/\s*\(acquired.*$/, '')}<div className="muted">{(/acquired ([\d-]+), sold ([\d-]+)/.exec(l.label) ?? []).slice(1).join(' → ')}</div></td><td className="num">{usd(p, true)}</td><td className="num">{usd(b, true)}</td><td className="num"><Num line={l} cents /></td></tr> })}</tbody>
        </table></div>
        <div className="row spread" style={{ marginTop: 6 }}><span className="muted small">{shown.length} lots match; showing {Math.min(limit, shown.length)}</span>{limit < shown.length && <button className="btn small" onClick={() => setLimit(limit + 200)}>Show more</button>}</div>
      </section>
    </>
  )
}

/* -------------------------------------------------------------- books */

const BOOKS: [string, string, string | null][] = [
  ['Sales - client projects', 'SchC.1', 'Gross receipts'], ['Sales - print and licensing', 'SchC.1', null], ['Advertising', 'SchC.8', null],
  ['Bank and merchant fees', 'SchC.27a.2', null], ['Car and truck - fuel', 'SchC.9', 'Replaced by standard mileage'], ['Contract labor', 'SchC.11', null],
  ['Depreciation', 'SchC.13', 'Client booked 7,600; tax takes 100% special depreciation'], ['Insurance - business liability', 'SchC.15', null],
  ['Insurance - health (Erik)', 'Sch1.17', 'Moved off Schedule C to the adjustment'], ['Internet', 'SchC.25', 'With telephone'], ['Telephone', 'SchC.25', 'With internet'],
  ['Legal and professional', 'SchC.17', null], ['Meals', 'SchC.24b', '50% only'], ['Office expenses', 'SchC.18', null], ['Software and subscriptions', 'SchC.27a.1', null],
  ['Supplies', 'SchC.22', null], ['Travel', 'SchC.24a', null],
]

function BooksToTax() {
  const { idx, state } = useStore()
  const books = (f: string) => evNumber(idx, 'D14', f)
  const seen = new Set<string>()
  void state
  return (
    <section className="card"><h2>Books to Schedule C</h2>
      <table className="tbl"><thead><tr><th>Books (QuickBooks, cash)</th><th className="num">Books</th><th>Schedule C line</th><th className="num">Tax return</th><th>What changed</th></tr></thead>
        <tbody>
          {BOOKS.map(([f, k, note]) => { const l = L(idx, k); const first = !seen.has(k); seen.add(k); return <tr key={f}><td>{f}</td><td className="num">{usd(books(f))}</td><td className="small"><span className="mono">{k}</span> {l?.label}</td><td className="num">{first && l ? <Num line={l} /> : ''}</td><td className="small muted">{note}</td></tr> })}
          <tr className="group"><td>Net income</td><td className="num">{usd(books('net_income'))}</td><td>Net profit (SchC.31)</td><td className="num">{L(idx, 'SchC.31') && <Num line={L(idx, 'SchC.31')!} />}</td><td className="small muted">After home office {usd(1200)} (simplified, average 240 sq ft)</td></tr>
        </tbody>
      </table>
    </section>
  )
}

/* ------------------------------------------------------------- others */

function Rentals() {
  const { idx } = useStore()
  return (
    <>
      <Table title="Passive activity loss, Form 8582" keys={['F8582.1a', 'F8582.1b', 'F8582.1c', 'F8582.3a', 'F8582.4', 'SchE.22A', 'SchE.22B', 'SchE.26', 'SchE.41']} note="With net passive income positive, every current and prior passive loss is allowed. The sale of the Austin condo is a fully taxable disposition, which also frees its suspended losses." />
      <Table title="Rental days and use" keys={['SchE.2A', 'SchE.2B']} />
      <span className="hide">{idx.packet.packet.name}</span>
    </>
  )
}

function K1() {
  return (
    <>
      <Table title="Woodworks (S corporation, 20%)" keys={['SchE.28A', 'F7203.1', 'F7203.3a', 'F7203.3c', 'F7203.5', 'F7203.6', 'F7203.7', 'F7203.excess', 'SchB.1.7', 'F8995.2.2', 'F8995.15.2']} note="Passive to the shareholder because he does not work in the business." />
      <Table title="Ridgeline Real Estate Fund III (limited partner)" keys={['SchE.28B', 'SchB.1.8', 'SchD.12', 'Sch3.1']} note="State apportionment (D38): California 22%, Texas 31%, Arizona 27%, Nevada 20%. No Arizona filing is required by the partner." />
    </>
  )
}

function Retirement() {
  return (
    <>
      <Table title="Backdoor Roth (Form 8606)" keys={['F8606.1', 'F8606.2', 'F8606.3', 'F8606.6', 'F8606.8', 'F8606.10', 'F8606.11', 'F8606.14', 'F8606.18', 'F1040.4a', 'F1040.4b']} />
      <Table title="Health savings account (Form 8889)" keys={['F8889.3', 'F8889.9', 'F8889.13', 'F8889.14a', 'F8889.15', 'F8889.16']} />
      <Table title="Self-employed retirement and health" keys={['Sch1.16', 'Sch1.17']} />
      <Table title="Foreign account" keys={['SchB.7a', 'SchB.7b', 'SchB.1.6', 'F8938.1.max', 'F8938.1.ye', 'F8938.req']} note="FinCEN 114 (FBAR) is due separately and is outside this engagement." />
    </>
  )
}

function Deductions() {
  return (
    <>
      <Table title="Itemized deductions (Schedule A)" keys={['SchA.5a', 'SchA.5b', 'SchA.5d', 'SchA.5e', 'SchA.7', 'SchA.8a', 'SchA.8c', 'SchA.8e', 'SchA.11', 'SchA.12', 'SchA.14', 'SchA.17', 'F1040.12']} note="The state and local tax total is capped at $40,000 (phase-down starts at $500,000 of income). Itemizing beats the $31,500 standard deduction." />
      <Table title="Credits with their limits" keys={['F8812.5', 'F8812.7', 'F8812.8', 'F8812.11', 'F8812.12', 'F8863.27', 'F8863.30', 'F8863.7', 'F2441.2', 'F2441.12', 'F2441.31', 'Sch3.1']} note="Child tax credit and credit for other dependents phase down by $50 per $1,000 of income over $400,000. The American opportunity credit is fully phased out. Dependent care is zero: the $5,000 of employer benefits uses up the limit." />
    </>
  )
}

function Payments() {
  const { idx, state } = useStore()
  const w = w2Rows(idx)
  const irs = idx.packet.tax_agency_records.irs_account_transcript_2025[0].transactions.filter((t) => t.code === '670')
  const ftb = (idx.packet.tax_agency_records.ftb_account as any).tax_year_2025_payments as { date: string; amount: number }[]
  const lines = ['F1040.25a', 'F1040.26', 'Sch3.10', 'Sch3.11', 'F1040.33', 'F540NR.71', 'F540NR.72', 'F540NR.78']
  return (
    <>
      <Table title="Payments in the return" keys={lines} />
      <section className="card"><h2>Against the agencies' records</h2>
        <table className="tbl"><thead><tr><th /><th className="num">In the return</th><th className="num">Agency</th><th>Agrees?</th></tr></thead>
          <tbody>
            <tr><td>Federal estimated (IRS transcript, 3 in 2025 + Jan 2026)</td><td className="num">{usd(lineValue(idx, state, 'F1040.26'))}</td><td className="num">{usd(irs.reduce((s, t) => s + (t.amount as number), 0))}</td><td>{lineValue(idx, state, 'F1040.26') === irs.reduce((s, t) => s + (t.amount as number), 0) ? <Pill tone="good">yes</Pill> : <Pill tone="bad">no</Pill>}</td></tr>
            <tr><td>California estimated (FTB: payments applied to 2025)</td><td className="num">{usd(lineValue(idx, state, 'F540NR.72'))}</td><td className="num">{usd(ftb.reduce((s, p) => s + p.amount, 0))}</td><td>{lineValue(idx, state, 'F540NR.72') === ftb.reduce((s, p) => s + p.amount, 0) ? <Pill tone="good">yes</Pill> : <Pill tone="bad">no</Pill>}</td></tr>
            <tr><td>Federal withholding (W-2 box 2)</td><td className="num">{usd(lineValue(idx, state, 'F1040.25a'))}</td><td className="num">{usd(w.reduce((s, r) => s + r.box2, 0))}</td><td><Pill tone="good">yes</Pill></td></tr>
            <tr><td>California withholding (W-2 box 17)</td><td className="num">{usd(lineValue(idx, state, 'F540NR.71'))}</td><td className="num">{usd(w.reduce((s, r) => s + r.box17, 0))}</td><td><Pill tone="good">yes</Pill></td></tr>
          </tbody></table>
        <p className="small muted">California withholding ran until September by mistake (qa-45). It is still a credit against the 540NR.</p>
      </section>
    </>
  )
}

function States() {
  const { idx } = useStore()
  const rows = useMemo(() => {
    const m = new Map<string, Record<string, ReturnLine>>()
    for (const l of idx.current.lines.filter((x) => x.form === 'SchCA540NR')) {
      const [n, col] = l.line.split('.')
      m.set(n, { ...(m.get(n) ?? {}), [col]: l })
    }
    return [...m.entries()].sort((a, b) => Number(a[0]) - Number(b[0]))
  }, [idx])
  return (
    <section className="card"><h2>Schedule CA (540NR), column by column</h2>
      <table className="tbl"><thead><tr><th>Line</th><th>Item</th><th className="num">A: federal</th><th className="num">B/C: CA difference</th><th className="num">D: using CA law</th><th className="num">E: California amount</th></tr></thead>
        <tbody>{rows.map(([n, c]) => { const any = c.A ?? c.D ?? c.E; return <tr key={n}><td>{n}</td><td className="small">{any?.label.replace(/ - .*$/, '')}</td>{['A', 'C', 'D', 'E'].map((k) => <td key={k} className="num">{k === 'C' ? (c.B ? <Num line={c.B} /> : c.C ? <Num line={c.C} /> : '') : c[k] ? <Num line={c[k]} /> : ''}</td>)}</tr> })}</tbody>
      </table>
      <p className="small muted">California taxes everything while resident (195 of 365 days) and only California-source income after the move.</p>
    </section>
  )
}

function Carryovers() {
  const { idx } = useStore()
  const co = idx.packet.prior_years.carryovers_into_2025 as Record<string, any>
  const out = idx.current.carryovers_out
  const f = out.federal
  const pairs: [string, unknown, unknown][] = [
    ['Short-term capital loss', co.capital_loss_short, f.capital_loss_short], ['Long-term capital loss', co.capital_loss_long, f.capital_loss_long],
    ['Passive loss: Fremont Way', co.passive_1450_fremont, f.passive_1450_fremont], ['Passive loss: Barton Hills 4C', co.passive_1200_barton_hills, f.passive_1200_barton_hills],
    ['Charitable', co.charitable, f.charitable], ['AMT credit', co.amt_credit, f.minimum_tax_credit_from_2025_amt],
    ['Nondeductible IRA basis', 7000, f.ira_nondeductible_basis_ngozi], ['SEP not deductible', 0, f.sep_contribution_not_deductible_for_2025],
  ]
  return (
    <section className="card"><h2>Carryovers in and out</h2>
      <table className="tbl"><thead><tr><th>Item</th><th className="num">From 2024</th><th className="num">To 2026</th></tr></thead>
        <tbody>{pairs.map(([l, a, b]) => <tr key={l}><td>{l}</td><td className="num">{String(a ?? 0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}</td><td className="num">{String(b ?? 0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}</td></tr>)}</tbody></table>
      <p className="small muted">The 2024 side is agreed to the return and the prior preparer's file (required step). The 2026 side is the tax software's, before any adjustments; see Filing for the roll-forward.</p>
    </section>
  )
}

function Basis() {
  const { idx } = useStore()
  const rows = scorpBasisRows(idx)
  const b = idx.packet.prior_years.basis_records as Record<string, any[]>
  return (
    <>
      <section className="card"><h2>S corporation stock basis (Woodworks)</h2>
        <table className="tbl"><thead><tr><th>Year</th><th className="num">Income</th><th className="num">Distributions</th><th className="num">Ending</th><th>Source</th></tr></thead><tbody>{rows.map((r) => <tr key={r.year} className={r.gap ? 'flag' : ''}><td>{r.year}</td><td className="num">{r.income === null ? '—' : usd(r.income)}</td><td className="num">{r.dist === null ? '—' : usd(r.dist)}</td><td className="num">{usd(r.end)}</td><td className="small">{r.note}</td></tr>)}</tbody></table></section>
      <section className="card"><h2>Partnership, IRA and homes</h2>
        <table className="tbl"><tbody>
          {(b.partnership_ridgeline ?? []).map((r: any) => <tr key={r.year}><td>Ridgeline {r.year}: ending capital {usd(r.ending_capital_account)}</td><td>outside basis: {r.outside_basis === null ? <Pill tone="warn">never computed</Pill> : usd(r.outside_basis)}</td></tr>)}
          {(b.ira_nondeductible_basis_ngozi ?? []).map((r: any) => <tr key={r.year}><td>Ngozi IRA {r.year}: Form 8606 line 14</td><td>{usd(r.form_8606_line_14)}</td></tr>)}
          {(b.home_7709_barton_ridge ?? []).map((r: any, i: number) => <tr key={i}><td>7709 Barton Ridge Dr: {r.event}</td><td>{usd(r.price)}</td></tr>)}
        </tbody></table></section>
    </>
  )
}

function Prior() {
  const { idx } = useStore()
  const pw = idx.packet.prior_years.prior_preparer_workpaper
  const rows: [string, string, string][] = [
    ['2023 Woodworks K-1 not provided; basis not rolled forward', 'Obtained D40 (06/05/2026) and rolled basis forward: 21,300 → 15,400 → 2,300 at the start of 2025.', 'Fixed'],
    ['8606 basis 7,000 per client; 2024 Form 5498 not obtained', 'D42 and D43 obtained. Basis of 7,000 agrees; 14,000 total this year, taxable conversion 26.', 'Fixed'],
    ['Home office 300 sq ft ("2 rooms combined?")', 'D24 gives 220 sq ft (Sacramento) and 260 sq ft (Austin); average 240 used.', 'Changed'],
    ['Sparbanken: FBAR filed by client; 8938 filed (max 151,880)', 'Form 8938 prepared again at the Treasury year-end rate (149,567). FBAR still outside the engagement.', 'Same approach'],
    ['Fremont Way appliances: 100% bonus federal, California 5-yr 200DB', 'Continued. California depreciation 484 in 2025 on the remaining basis.', 'Same approach'],
    ['Standard mileage 0.67 on 7,400 miles', 'Rate 0.70 for 2025. Log has a duplicated page that inflated the miles.', 'Changed'],
    ['No self-employed health insurance deduction (covered on Ngozi\'s plan)', 'Engine now takes 14,400. Needs a decision: Erik was eligible for the same plan again.', 'Question'],
    ['2023 Form 3520 (foreign inheritance) "discussed?"', 'Still unresolved. Raised as an outside-the-engagement item for the client.', 'Open'],
  ]
  return (
    <section className="card"><h2>What the prior preparer did, and what we did instead</h2>
      <p className="small">{pw.summary_memo}</p>
      <table className="tbl"><thead><tr><th>Delta River</th><th>This year</th><th /></tr></thead>
        <tbody>{rows.map(([a, b, c]) => <tr key={a}><td>{a}</td><td className="small">{b}</td><td><Pill tone={c === 'Fixed' ? 'good' : c === 'Open' || c === 'Question' ? 'warn' : 'info'}>{c}</Pill></td></tr>)}</tbody></table>
      <h3 style={{ margin: '12px 0 4px' }}>Open items they left</h3>
      <ul className="small" style={{ paddingLeft: 18 }}>{pw.open_items_left_by_prior_preparer.map((o) => <li key={o}>{o}</li>)}</ul>
    </section>
  )
}

export { adjustedLine }
