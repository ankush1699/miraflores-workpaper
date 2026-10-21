import type { Effect, Jurisdiction } from '../checks/types'
import type { TaxRate } from '../packet/types'

export interface TaxEffect {
  /** change in total tax */
  federalTax: number
  californiaTax: number
  /** change in the amount owed (or in the refund, which is a negative amount owed) */
  federalBalance: number
  californiaBalance: number
}

export const ZERO_EFFECT: TaxEffect = { federalTax: 0, californiaTax: 0, federalBalance: 0, californiaBalance: 0 }

/**
 * Estimate the tax effect of a change by multiplying it by the engine's per-dollar rates.
 * The engine cannot be re-run, so this is an estimate measured at the v3 numbers: it
 * does not know about thresholds the change might cross.
 *
 * Payments move the balance dollar for dollar, credits move tax dollar for dollar.
 */
export function taxEffectOf(effects: Effect[], rates: Record<string, TaxRate>): TaxEffect {
  const out = { ...ZERO_EFFECT }
  for (const e of effects) {
    for (const j of e.jurisdictions) {
      const fed = j === 'federal'
      if (e.category === 'none') continue
      if (e.category === 'payment') {
        // more payments, less owed
        if (fed) out.federalBalance -= e.amount
        else out.californiaBalance -= e.amount
        continue
      }
      const tax = e.category === 'credit' ? -e.amount : e.amount * perDollar(rates, e.category, j)
      if (fed) {
        out.federalTax += tax
        out.federalBalance += tax
      } else {
        out.californiaTax += tax
        out.californiaBalance += tax
      }
    }
  }
  return {
    federalTax: Math.round(out.federalTax),
    californiaTax: Math.round(out.californiaTax),
    federalBalance: Math.round(out.federalBalance),
    californiaBalance: Math.round(out.californiaBalance),
  }
}

function perDollar(rates: Record<string, TaxRate>, category: string, j: Jurisdiction): number {
  const r = rates[category]
  if (!r) return 0
  return j === 'federal' ? r.federal_per_dollar : r.california_per_dollar
}

export function addEffects(a: TaxEffect, b: TaxEffect): TaxEffect {
  return {
    federalTax: a.federalTax + b.federalTax,
    californiaTax: a.californiaTax + b.californiaTax,
    federalBalance: a.federalBalance + b.federalBalance,
    californiaBalance: a.californiaBalance + b.californiaBalance,
  }
}

/** The larger of the two jurisdictions' tax changes, in absolute dollars. Used for the partner-approval rule. */
export function biggestSwing(e: TaxEffect): number {
  return Math.max(Math.abs(e.federalTax), Math.abs(e.californiaTax), Math.abs(e.federalBalance), Math.abs(e.californiaBalance))
}
