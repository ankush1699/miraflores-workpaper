import type { PacketIndex } from '../packet'
import { engineChecks, type Check } from './engineChecks'
import { otherChecks } from './otherChecks'
import { completenessFindings, footEngine } from './review'
import type { Finding } from './types'

export type { Finding, AdjustmentDraft, Effect, TaxCategory } from './types'

export interface CheckRun {
  id: string
  title: string
  findingIds: string[]
}

const reviewChecks: Check[] = [
  {
    id: 'documents-landed',
    title: 'Every document the tax software used reached the return',
    run: completenessFindings,
  },
  {
    id: 'engine-arithmetic',
    title: 'Every engine sum and carry re-adds correctly',
    run(idx) {
      const foot = footEngine(idx)
      return foot.breaks.map((b) => ({
        id: `foot-${b.key}`, area: 'partner_review', severity: 'error' as const, kind: 'engine_error' as const,
        title: `${b.key} does not foot`,
        detail: `The tax software shows ${b.value} but its listed inputs add to ${b.expected}.`,
        surfacedBy: 'Independent arithmetic pass over every derived line.', refs: [`line:${b.key}`],
      }))
    },
  },
]

export const allChecks: Check[] = [...engineChecks, ...otherChecks, ...reviewChecks]

/** Run every independent check over the packet. Nothing here reads the tax software's own diagnostics. */
export function runAllChecks(idx: PacketIndex): { findings: Finding[]; ran: CheckRun[] } {
  const findings: Finding[] = []
  const ran: CheckRun[] = []
  for (const check of allChecks) {
    const found = check.run(idx)
    findings.push(...found)
    ran.push({ id: check.id, title: check.title, findingIds: found.map((f) => f.id) })
  }
  const order = { error: 0, warning: 1, info: 2 }
  findings.sort((a, b) => order[a.severity] - order[b.severity])
  return { findings, ran }
}

/**
 * Which of our findings covers each engine diagnostic. The tax software raises 11 diagnostics
 * on v3; a reviewer should see that every one is either explained or consciously accepted.
 */
export const DIAGNOSTIC_COVERAGE: Record<string, { findingId?: string; note: string }> = {
  DIGITAL_ASSET_BASIS_MISSING: { findingId: 'crypto-c6', note: 'Client supplied a basis and date on 06/30 (msg-07).' },
  AMT_CREDIT_CARRYFORWARD: { note: 'Expected. Carried to next year (Form 8801) as minimum tax credit.' },
  AOTC_PHASED_OUT: { note: 'Correct: modified AGI is far above 180,000.' },
  FBAR_OUTSIDE_RETURN: { findingId: 'outside-fbar', note: 'Outside the engagement; client told in writing.' },
  FORM_1099_FILING: { findingId: 'outside-1099-nec', note: 'Outside the engagement; client told in writing.' },
  DUE_DILIGENCE_REQUIRED: { findingId: 'form-8867', note: 'Required step before sign-off.' },
  CA_AMT_NOT_COMPUTED: { findingId: 'ca-amt-not-computed', note: 'Judgment call with recorded authority.' },
  HOME_OFFICE_AREA_CHANGE: { note: 'Explained: two houses (220 sq ft Sacramento, 260 sq ft Austin) per D24.' },
  QUESTIONNAIRE_SALES_CONFLICT: { findingId: 'qa-14-sales', note: 'Documents override the answer.' },
  LOW_CONFIDENCE_READ: { findingId: 'low-conf-ev-1049', note: 'Confirmed by client and bank check.' },
  BROKER_SUMMARY_DETAIL_MISMATCH: { findingId: 'meridian-p32-unread', note: 'Difference is exactly the unread page 32 lot.' },
}
