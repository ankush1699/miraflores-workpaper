import type { Finding } from '../checks/types'
import type { PacketIndex } from '../packet'
import { approvedAdjustments, findingStatus, sumEffects } from './derived'
import { addEffects, taxEffectOf, ZERO_EFFECT, type TaxEffect } from './taxEffect'
import type { WorkState } from '../store/types'

export interface Position {
  federal: { engine: number; approved: number; ifAllFixed: number; penalty: number }
  california: { engine: number; approved: number; ifAllFixed: number; penalty: number }
  federalTax: { engine: number; approved: number; ifAllFixed: number }
  californiaTax: { engine: number; approved: number; ifAllFixed: number }
}

/**
 * Where the return stands: the tax software's v3 numbers, the same after the adjustments that have
 * been approved, and what they would be if every proposed fix for a clear error were approved.
 * Balances are amounts owed (negative means refund).
 */
export function position(idx: PacketIndex, state: WorkState, findings: Finding[]): Position {
  const fed = idx.current.summary.federal
  const ca = idx.current.summary.california
  const approved = sumEffects(approvedAdjustments(state))
  // fixes not yet approved, for errors with a clear answer (judgment calls are left out on purpose)
  let pending: TaxEffect = { ...ZERO_EFFECT }
  for (const f of findings) {
    if (f.severity !== 'error' || !f.fix || f.kind === 'judgment') continue
    const st = findingStatus(f, state)
    if (st === 'fixed') continue
    const mine = state.adjustments.filter((a) => a.findingId === f.id && a.status === 'approved')
    if (mine.length) continue
    pending = addEffects(pending, f.fix.drafts.reduce((s, d) => addEffects(s, taxEffectOf(d.effects, idx.current.tax_effect_rates)), { ...ZERO_EFFECT }))
  }
  const all = addEffects(approved, pending)
  return {
    federal: { engine: fed.balance_due, approved: fed.balance_due + approved.federalBalance, ifAllFixed: fed.balance_due + all.federalBalance, penalty: fed.penalty },
    california: { engine: ca.balance_due, approved: ca.balance_due + approved.californiaBalance, ifAllFixed: ca.balance_due + all.californiaBalance, penalty: ca.penalty },
    federalTax: { engine: fed.total_tax, approved: fed.total_tax + approved.federalTax, ifAllFixed: fed.total_tax + all.federalTax },
    californiaTax: { engine: ca.total_tax, approved: ca.total_tax + approved.californiaTax, ifAllFixed: ca.total_tax + all.californiaTax },
  }
}
