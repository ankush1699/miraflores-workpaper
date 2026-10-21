import type { Finding } from '../checks/types'
import type { PacketIndex } from '../packet'
import { position } from './summary'
import type { SubmissionState, WorkState } from '../store/types'

/** The balance the workpaper finalizes: engine v3 plus approved adjustments (negative is a refund). */
export function finalBalances(idx: PacketIndex, state: WorkState, findings: Finding[]) {
  const p = position(idx, state, findings)
  return {
    federalBalance: p.federal.approved,
    californiaBalance: p.california.approved,
    federalTax: p.federalTax.approved,
    californiaTax: p.californiaTax.approved,
  }
}

type Sim = Pick<SubmissionState, 'jurisdiction' | 'status' | 'submissionId' | 'errors'>

/**
 * A stand-in for the IRS and FTB e-file systems, so the whole season can be replayed.
 * The federal return is rejected until Theo's SSN matches his card, exactly as it was
 * in the real file; California is held until the federal return is accepted.
 */
export function simulateEfile(idx: PacketIndex, state: WorkState, jurisdiction: 'federal' | 'california'): Sim {
  const log = idx.packet.tax_agency_records.efile
  const fedAccepted = state.filing.submissions.some((s) => s.jurisdiction === 'federal' && s.status === 'accepted')
  const ssnFixed = state.adjustments.some((a) => a.status === 'approved' && a.target === 'household:theo' && a.textFix)
  const first = (j: string, st: string) => log.find((e) => e.jurisdiction === j && e.status === st)
  if (jurisdiction === 'federal') {
    if (!ssnFixed) {
      const rej = first('federal', 'rejected')!
      return { jurisdiction, status: 'rejected', submissionId: rej.submission_id, errors: rej.errors ?? [] }
    }
    return { jurisdiction, status: 'accepted', submissionId: first('federal', 'accepted')!.submission_id, errors: [] }
  }
  if (!fedAccepted) {
    const held = first('california', 'not_transmitted')!
    return { jurisdiction, status: 'not_transmitted', submissionId: held.submission_id, errors: held.errors ?? [] }
  }
  return { jurisdiction, status: 'accepted', submissionId: first('california', 'accepted')!.submission_id, errors: [] }
}

/**
 * What the IRS would charge on a balance paid after the original due date. The engine
 * does not compute this, so it is estimated from the packet's post-filing rates:
 * interest at the annual rate by day, failure-to-pay at 0.5% for each month or part.
 */
export function lateCharges(idx: PacketIndex, balance: number, paidOn: string) {
  const rates = idx.packet.post_filing_rates as { irs_underpayment_interest_rate_annual: number; irs_failure_to_pay_penalty_per_month: number }
  const due = new Date('2026-04-15T12:00:00')
  const paid = new Date(`${paidOn.slice(0, 10)}T12:00:00`)
  const days = Math.max(0, Math.round((paid.getTime() - due.getTime()) / 86400000))
  const months = Math.ceil(days / 30.4)
  const interest = Math.max(0, balance) * rates.irs_underpayment_interest_rate_annual * (days / 365)
  const penalty = Math.max(0, balance) * rates.irs_failure_to_pay_penalty_per_month * months
  return { days, months, interest: Math.round(interest), penalty: Math.round(penalty) }
}

export interface CarryItem { label: string; value: string; origin: string; note?: string }

/** What next year's preparer inherits, each with where it came from. */
export function carryForward(idx: PacketIndex, state: WorkState): CarryItem[] {
  const fed = idx.current.carryovers_out.federal
  const out: CarryItem[] = []
  const add = (label: string, value: unknown, origin: string, note?: string) => {
    if (value === null || value === undefined) return
    out.push({ label, value: typeof value === 'number' ? value.toLocaleString('en-US') : String(value), origin, note })
  }
  add('Minimum tax credit (Form 8801)', fed.minimum_tax_credit_from_2025_amt, 'line:F6251.11', 'From the ISO exercise. Becomes usable when regular tax exceeds AMT.')
  add('SEP contribution not deductible for 2025', fed.sep_contribution_not_deductible_for_2025, 'line:Sch1.16', 'Re-compute if Schedule C profit changed after the adjustments.')
  add('Ridgeline capital account at year end', fed.ridgeline_capital_account_end, 'doc:D37', 'Outside basis was never computed. Open item.')
  add('Woodworks stock basis at year end', fed.scorp_stock_basis_end, 'line:F7203.15', 'Zero after distributions in excess of basis.')
  add('Nondeductible IRA basis (Ngozi)', fed.ira_nondeductible_basis_ngozi, 'line:F8606.14')
  add('Capital loss carryover (short / long)', `${fed.capital_loss_short} / ${fed.capital_loss_long}`, 'line:SchD.7')
  add('Passive losses (Fremont / Barton Hills)', `${fed.passive_1450_fremont} / ${fed.passive_1200_barton_hills}`, 'line:F8582.4', 'Fully used: the Austin condo was sold.')
  const ca = idx.current.carryovers_out.california.depreciation_basis_differences as Record<string, number>
  for (const [k, v] of Object.entries(ca)) add(`California depreciation basis difference: ${k}`, v, `asset:${k}`)
  const hvac = state.adjustments.find((a) => a.status === 'approved' && a.target === 'line:SchE.18A')
  if (hvac) add('New asset: Fremont Way HVAC system (27.5-year)', `cost 11,000, in service 08/2025`, 'doc:D47', 'Added by an approved adjustment; start 2026 depreciation from here.')
  return out
}
