import type { AreaId } from '../packet'
import type { Ref } from '../packet/types'

/**
 * Each tax category matches a key in return_versions[].tax_effect_rates, plus a few
 * dollar-for-dollar ones (payments and credits) that the readme says change the balance 1:1.
 */
export type TaxCategory =
  | 'wages' | 'interest' | 'schc_profit' | 'stcg' | 'ltcg' | 'ordinary_income'
  | 'adjustment' | 'salt' | 'itemized' | 'ca_source_income'
  | 'credit' | 'payment' | 'none'

export type Jurisdiction = 'federal' | 'california'

/** One way a change moves tax. `amount` is the change in the category's own quantity (income up = +). */
export interface Effect {
  category: TaxCategory
  amount: number
  jurisdictions: Jurisdiction[]
}

/** A proposed change to one line (or one extracted value), ready to be turned into an adjustment. */
export interface AdjustmentDraft {
  target: Ref
  label: string
  /** how much the displayed line changes (blank for pure text corrections) */
  lineDelta?: number
  /** a text correction, e.g. an SSN or EIN */
  textFix?: { from: string; to: string }
  effects: Effect[]
}

export type FindingKind =
  | 'engine_error'      // the tax software's rule or arithmetic got it wrong
  | 'extraction_error'  // the pipeline misread or missed something
  | 'data_conflict'     // two sources disagree
  | 'judgment'          // a call a human has to make
  | 'outside_scope'     // a filing or duty outside this engagement
  | 'tie_out'           // a figure that should agree with another

export interface Finding {
  id: string
  area: AreaId
  severity: 'error' | 'warning' | 'info'
  kind: FindingKind
  title: string
  /** plain-language explanation for the preparer */
  detail: string
  /** which part of the workpaper's design exposes this (used in the "errors we found" page) */
  surfacedBy: string
  refs: Ref[]
  fix?: { summary: string; authority: string; drafts: AdjustmentDraft[] }
  /** a question worth sending to the client */
  ask?: string
}
