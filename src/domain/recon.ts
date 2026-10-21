import { docText, evNumber, parseMoney, round2 } from '../checks/helpers'
import type { Finding } from '../checks/types'
import type { PacketIndex } from '../packet'
import type { ReturnLine } from '../packet/types'
import { addEffects, taxEffectOf, ZERO_EFFECT, type TaxEffect } from './taxEffect'

/** Estimated effect of fixing a finding (sum of its drafts). */
export function findingEffect(idx: PacketIndex, f: Finding): TaxEffect {
  return (f.fix?.drafts ?? []).reduce((s, d) => addEffects(s, taxEffectOf(d.effects, idx.current.tax_effect_rates)), { ...ZERO_EFFECT })
}

/* ---------------------------------------------------------- Schedule C */

export function businessRecon(idx: PacketIndex) {
  const books = evNumber(idx, 'D14', 'total_income')
  const nec = ['D16', 'D17', 'D18', 'D19', 'D20'].map((d) => ({ doc: d, payer: idx.docs.get(d)!.issuer, amount: evNumber(idx, d, 'box1') }))
  const necTotal = nec.reduce((s, n) => s + n.amount, 0)
  const noForm = parseMoney(/no Form 1099: ([\d,]+\.\d\d)/.exec(docText(idx, 'D15', 3))?.[1] ?? '0')
  const kTotal = evNumber(idx, 'D21', 'box1a')
  const inAtlas = parseMoney(/of which ([\d,]+\.\d\d) arrived through Paywell/.exec(docText(idx, 'D15', 3))?.[1] ?? '0')
  const engine = Number(idx.lineMaps.get(idx.current.version)?.get('SchC.1')?.value ?? 0)
  return { books, nec, necTotal, noForm, kTotal, inAtlas, engine, booksTiesToForms: round2(necTotal + noForm) === round2(books) }
}

/* ------------------------------------------------------------- brokers */

export interface BrokerRow {
  broker: string
  doc: string
  lots: number
  proceeds: number
  basis: number
  summaryProceeds: number
  note: string
}

/** Lots on Form 8949, summed per broker statement and compared with what the statement's own summary says. */
export function brokerTieOuts(idx: PacketIndex): BrokerRow[] {
  const lots = idx.current.lines.filter((l) => l.rule === 'R-8949-LOT')
  const parse = (l: ReturnLine) => {
    const p = /proceeds ([\d,]+\.\d\d)/.exec(l.label), b = /basis ([\d,]+\.\d\d)/.exec(l.label)
    return { proceeds: p ? parseMoney(p[1]) : 0, basis: b ? parseMoney(b[1]) : 0 }
  }
  const sumFor = (prefix: RegExp) => {
    const mine = lots.filter((l) => prefix.test(l.line.split('.').pop() ?? ''))
    return { n: mine.length, ...mine.reduce((s, l) => { const p = parse(l); return { proceeds: s.proceeds + p.proceeds, basis: s.basis + p.basis } }, { proceeds: 0, basis: 0 }) }
  }
  const money = (s: string, from: string) => parseMoney(new RegExp(`${from} ([\\d,]+\\.\\d\\d)`).exec(s)?.[1] ?? '0')
  const n2 = docText(idx, 'D28', 2)
  const nSummary = money(n2, 'short-term covered proceeds') + money(n2, 'short-term noncovered proceeds') + money(n2, 'long-term covered proceeds') + money(n2, 'long-term noncovered proceeds')
  const mSummary = money(docText(idx, 'D31', 1), 'total proceeds')
  const b1 = docText(idx, 'D74', 1)
  const bSummary = money(b1, 'short-term covered proceeds') + money(b1, 'long-term covered proceeds')
  const cSummary = money(docText(idx, 'D34', 1), 'Total gross proceeds')
  const n = sumFor(/^N\d+$/), m = sumFor(/^M\d+$/), x = sumFor(/^X\d+$/), c = sumFor(/^C\d+$/)
  return [
    { broker: 'Northlake Securities', doc: 'D28', lots: n.n, proceeds: n.proceeds, basis: n.basis, summaryProceeds: nSummary, note: 'RSU lots show basis 0.00: noncovered. See D11.' },
    { broker: 'Meridian Brokerage (corrected)', doc: 'D31', lots: m.n, proceeds: m.proceeds, basis: m.basis, summaryProceeds: mSummary, note: 'Page 32 was never read; the difference is the missing lot.' },
    { broker: 'Brightpath Advisors', doc: 'D74', lots: x.n, proceeds: x.proceeds, basis: x.basis, summaryProceeds: bSummary, note: 'Direct-indexing account; wash sales on many lots.' },
    { broker: 'Coinhaven (1099-DA)', doc: 'D34', lots: c.n, proceeds: c.proceeds, basis: c.basis, summaryProceeds: cSummary, note: 'Basis not reported; taken from the CSV export (D35).' },
  ].map((r) => ({ ...r, proceeds: round2(r.proceeds), basis: round2(r.basis) }))
}

/* ---------------------------------------------------------------- W-2s */

export function w2Rows(idx: PacketIndex) {
  return ['D08', 'D09'].map((d) => {
    const g = (f: string) => evNumber(idx, d, f)
    return {
      doc: d, employer: idx.docs.get(d)!.issuer,
      box1: g('box1'), box2: g('box2'), box3: g('box3'), box4: g('box4'), box5: g('box5'), box6: g('box6'),
      box10: g('box10'), box16: g('box16'), box17: g('box17'), hsa: g('box12_W'),
    }
  })
}

/* ---------------------------------------------------------- stock basis */

export function scorpBasisRows(idx: PacketIndex) {
  const rows = (idx.packet.prior_years.basis_records.scorp_lindqvist_family_woodworks as any[]) ?? []
  const b2022 = rows.find((r) => r.year === 2022)?.ending_stock_basis as number
  const k23 = { income: evNumber(idx, 'D40', 'box1'), dist: evNumber(idx, 'D40', 'box16d') }
  const k24 = idx.packet.prior_years.return_2024.K1_1120S
  const k25 = { income: evNumber(idx, 'D39', 'box1') + evNumber(idx, 'D39', 'box4'), dist: evNumber(idx, 'D39', 'box16d') }
  const y23 = b2022 + k23.income - k23.dist
  const y24 = y23 + k24.box1 - k24.box16D
  const raw25 = y24 + k25.income - k25.dist
  return [
    { year: 2022, income: null as number | null, dist: null as number | null, end: b2022, note: 'Client worksheet only. Never verified.', gap: true },
    { year: 2023, income: k23.income, dist: k23.dist, end: y23, note: 'From the 2023 K-1 (D40), received 06/05/2026.', gap: false },
    { year: 2024, income: k24.box1, dist: k24.box16D, end: y24, note: 'From the 2024 return. Prior preparer assumed basis was enough.', gap: false },
    { year: 2025, income: k25.income, dist: k25.dist, end: Math.max(0, raw25), note: raw25 < 0 ? `Distributions exceed basis by ${Math.abs(raw25).toLocaleString()}: capital gain.` : '', gap: false },
  ]
}

/* -------------------------------------------------------- rentals (Sch E) */

export const SCH_E_ROWS: [string, string][] = [
  ['3', 'Rents received'], ['9', 'Insurance'], ['11', 'Management fees'], ['12', 'Mortgage interest'],
  ['14', 'Repairs'], ['16', 'Taxes'], ['18', 'Depreciation'], ['19', 'Other (HOA)'], ['20', 'Total expenses'], ['21', 'Income or (loss)'], ['22', 'After passive loss limits'],
]

export function schERow(idx: PacketIndex, n: string, prop: 'A' | 'B') {
  return idx.lineMaps.get(idx.current.version)?.get(`SchE.${n}${prop}`)
}
