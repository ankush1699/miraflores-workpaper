import { usd } from '../checks/helpers'
import { SCH_E_ROWS, brokerTieOuts, businessRecon, schERow, scorpBasisRows, w2Rows } from '../domain/recon'
import { useStore } from '../store/Store'
import { Money, Num, Pill, RefChip } from '../ui/Common'

// Each area gets one panel of reconciliations: the tie-outs a careful preparer would build
// by hand, drawn from the same records the engine used.

export function BusinessPanel() {
  const { idx } = useStore()
  const r = businessRecon(idx)
  const gross = idx.lineMaps.get(idx.current.version)!.get('SchC.1')!
  return (
    <section className="card">
      <h2>Do the books agree to the 1099s?</h2>
      <table className="tbl"><tbody>
        {r.nec.map((n) => <tr key={n.doc}><td><RefChip r={`doc:${n.doc}`} /> {n.payer}</td><td className="num"><Money n={n.amount} /></td></tr>)}
        <tr><td><strong>Five 1099-NECs</strong></td><td className="num"><Money n={r.necTotal} /></td></tr>
        <tr><td>Small clients with no 1099 <span className="muted small">(D15 p3)</span></td><td className="num"><Money n={r.noForm} /></td></tr>
        <tr className="group"><td>Expected revenue</td><td className="num"><Money n={r.necTotal + r.noForm} /></td></tr>
        <tr><td>Books: total income <span className="muted small">(D14)</span></td><td className="num"><Money n={r.books} /> {r.booksTiesToForms && <Pill tone="good">ties</Pill>}</td></tr>
        <tr><td>Form 1099-K, Paywell <span className="muted small">(already inside Atlas's 1099-NEC: {usd(r.inAtlas)} arrived by card)</span></td><td className="num"><Money n={r.kTotal} /></td></tr>
        <tr className="flag"><td>Engine gross receipts <span className="muted small">(books + 1099-K)</span></td><td className="num"><Num line={gross} /></td></tr>
        <tr><td><strong>Difference from the books</strong></td><td className="num"><Money n={r.engine - r.books} tone /></td></tr>
      </tbody></table>
    </section>
  )
}

export function InvestmentsPanel() {
  const { idx } = useStore()
  const rows = brokerTieOuts(idx)
  return (
    <section className="card">
      <h2>Sales tie out to each statement</h2>
      <table className="tbl">
        <thead><tr><th>Statement</th><th className="num">Lots</th><th className="num">Proceeds on 8949</th><th className="num">Statement summary</th><th className="num">Difference</th><th /></tr></thead>
        <tbody>
          {rows.map((r) => {
            const diff = Math.round((r.proceeds - r.summaryProceeds) * 100) / 100
            return (
              <tr key={r.doc} className={diff !== 0 ? 'flag' : ''}>
                <td><RefChip r={`doc:${r.doc}`} /> {r.broker}<div className="muted small">{r.note}</div></td>
                <td className="num">{r.lots}</td>
                <td className="num">{usd(r.proceeds, true)}</td>
                <td className="num">{usd(r.summaryProceeds, true)}</td>
                <td className="num">{diff === 0 ? <Pill tone="good">ties</Pill> : <Pill tone="bad">{usd(diff, true)}</Pill>}</td>
                <td />
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="muted small">Every lot, box by box, is on the CPA schedules page under “Sales detail”.</p>
    </section>
  )
}

export function WagesPanel() {
  const { idx } = useStore()
  const rows = w2Rows(idx)
  const tot = (k: keyof (typeof rows)[number]) => rows.reduce((s, r) => s + (r[k] as number), 0)
  return (
    <section className="card">
      <h2>W-2s, one image each</h2>
      <table className="tbl">
        <thead><tr><th>Employer</th><th className="num">Wages (1)</th><th className="num">Fed w/h (2)</th><th className="num">SS wages (3)</th><th className="num">SS tax (4)</th><th className="num">Medicare (5)</th><th className="num">Dep care (10)</th><th className="num">CA wages (16)</th><th className="num">CA w/h (17)</th></tr></thead>
        <tbody>
          {rows.map((r) => <tr key={r.doc}><td><RefChip r={`doc:${r.doc}`} /> {r.employer}</td><td className="num">{usd(r.box1)}</td><td className="num">{usd(r.box2)}</td><td className="num">{usd(r.box3)}</td><td className="num">{usd(r.box4)}</td><td className="num">{usd(r.box5)}</td><td className="num">{usd(r.box10)}</td><td className="num">{usd(r.box16)}</td><td className="num">{usd(r.box17)}</td></tr>)}
          <tr className="group"><td>Total</td><td className="num">{usd(tot('box1'))}</td><td className="num">{usd(tot('box2'))}</td><td className="num">{usd(tot('box3'))}</td><td className="num">{usd(tot('box4'))}</td><td className="num">{usd(tot('box5'))}</td><td className="num">{usd(tot('box10'))}</td><td className="num">{usd(tot('box16'))}</td><td className="num">{usd(tot('box17'))}</td></tr>
        </tbody>
      </table>
      <p className="small muted">D10 is a phone photo of the Halvorsen W-2 and is counted once. Social security tax withheld {usd(tot('box4'))} against a maximum of {usd(Math.round((idx.param('ss_wage_base') as number) * 0.062))}: the excess is credited on Schedule 3 line 11.</p>
    </section>
  )
}

export function PassThroughPanel() {
  const { idx } = useStore()
  const rows = scorpBasisRows(idx)
  return (
    <section className="card">
      <h2>Woodworks S corporation stock basis, year by year</h2>
      <table className="tbl">
        <thead><tr><th>Year</th><th className="num">Income</th><th className="num">Distributions</th><th className="num">Ending basis</th><th>Source</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.year} className={r.gap ? 'flag' : ''}>
              <td>{r.year}</td><td className="num">{r.income === null ? '—' : usd(r.income)}</td><td className="num">{r.dist === null ? '—' : usd(r.dist)}</td>
              <td className="num"><strong>{usd(r.end)}</strong></td><td className="small">{r.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="small muted">A gap is shown as a gap. The engine's own “missing 2023 K-1” warning disappears once D40 arrives, but the 2022 starting figure remains an unverified client worksheet.</p>
    </section>
  )
}

export function RentalsPanel() {
  const { idx } = useStore()
  const sale = (k: string) => idx.lineMaps.get(idx.current.version)?.get(k)
  return (
    <>
      <section className="card">
        <h2>The two properties side by side</h2>
        <table className="tbl">
          <thead><tr><th>Schedule E</th><th className="num">1450 Fremont Way (A)</th><th className="num">1200 Barton Hills 4C (B)</th></tr></thead>
          <tbody>
            {SCH_E_ROWS.map(([n, label]) => {
              const a = schERow(idx, n, 'A'), b = schERow(idx, n, 'B')
              return <tr key={n}><td>{label} <span className="muted small">line {n}</span></td><td className="num">{a ? <Num line={a} /> : '—'}</td><td className="num">{b ? <Num line={b} /> : '—'}</td></tr>
            })}
          </tbody>
        </table>
      </section>
      <section className="card">
        <h2>Sale of the Austin condo, 10/15/2025</h2>
        <table className="tbl"><tbody>
          {['F4797.21', 'F4797.22', 'F4797.23', 'F4797.24', 'F4797.25', 'SchD.19'].map((k) => { const l = sale(k); return l ? <tr key={k}><td>{l.label}</td><td className="num"><Num line={l} /></td></tr> : null })}
        </tbody></table>
        <p className="small muted">Selling the whole activity in a fully taxable sale frees the suspended passive losses from prior years, which is why the passive limit shows no disallowed loss this year.</p>
      </section>
    </>
  )
}

export function CaliforniaPanel() {
  const { idx } = useStore()
  const res = idx.packet.household.residency
  const days = idx.param('ca_resident_days') as number
  const l = (k: string) => idx.lineMaps.get(idx.current.version)?.get(k)
  return (
    <section className="card">
      <h2>Residency and the California split</h2>
      <table className="tbl"><tbody>
        {res.map((r) => <tr key={r.state}><td>{r.state} {r.status}</td><td>{r.from} to {r.to}</td></tr>)}
        <tr><td>California resident days</td><td>{days} of {idx.param('year_days') as number} ({((days / 365) * 100).toFixed(1)}%)</td></tr>
        {['F540NR.17', 'F540NR.32', 'F540NR.34', 'F540NR.36', 'F540NR.64', 'F540NR.97'].map((k) => { const x = l(k); return x ? <tr key={k}><td>{x.label}</td><td className="num">{typeof x.value === 'number' && x.value < 1 ? x.value : <Num line={x} />}</td></tr> : null })}
      </tbody></table>
      <p className="small muted">Income is split by source and by days: wages by where the work was done, sales by their date, the Sacramento rental in full.</p>
    </section>
  )
}
