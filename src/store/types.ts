import type { Effect } from '../checks/types'
import type { TaxEffect } from '../domain/taxEffect'
import type { Standards } from '../packet/types'

/**
 * The firm's starter standards plus the few rules the workpaper can actually enforce.
 * The administrator can change any of them; the rest of the app reads them from here.
 */
export interface FirmStandards extends Standards {
  /** an adjustment moving tax by more than this (federal or state) needs a partner */
  partnerOver: number
  /** nobody reviews or signs off on work they prepared */
  selfReviewBlocked: boolean
  /** open blocking review notes stop the return being filed */
  openNotesBlock: boolean
  /** staff without clearance see SSNs and account numbers masked */
  maskWithoutClearance: boolean
  retentionYears: number
  /** credits that need a due diligence record before sign-off */
  dueDiligenceFor: string[]
}

/** Everything that happens in the workpaper is an event. State is what you get by replaying them. */
export interface WorkEvent {
  id: string
  at: string
  actor: string
  type: string
  data: any
  /** events that were one user action share a group, so one Undo takes them all back */
  group?: string
}

export type AdjustmentStatus = 'proposed' | 'approved' | 'rejected' | 'reverted'

export interface Adjustment {
  id: string
  batchId: string
  target: string
  label: string
  lineDelta?: number
  textFix?: { from: string; to: string }
  effects: Effect[]
  effect: TaxEffect
  reason: string
  authority: string
  findingId?: string
  evidence: string[]
  proposedBy: string
  proposedAt: string
  status: AdjustmentStatus
  decidedBy?: string
  decidedAt?: string
  decisionNote?: string
  /** proposed after the return was frozen at filing: an amendment on top */
  amendment: boolean
}

export interface Verification {
  id: string
  target: string
  type: string
  note: string
  refs: string[]
  by: string
  at: string
}

export interface ThreadMessage { by: string; at: string; text: string }

export type ThreadStatus = 'open' | 'addressed' | 'cleared'

export interface Thread {
  id: string
  target: string
  kind: 'review' | 'question' | 'internal'
  blocking: boolean
  assignee?: string
  opener: string
  openedAt: string
  messages: ThreadMessage[]
  status: ThreadStatus
  /** for client questions: the first client reply is kept as evidence for the target */
  answeredBy?: string
}

export interface Signoff {
  id: string
  level: 'reviewer' | 'partner'
  by: string
  at: string
  note: string
  /** approved adjustment ids at the moment of signing; if the set changes, the sign-off reopens */
  adjustmentIds: string[]
}

export interface Judgment {
  id: string
  kind: 'judgment' | 'election' | 'due_diligence' | 'penalty'
  topic: string
  decision: string
  authority: string
  refs: string[]
  by: string
  at: string
}

export interface Attachment {
  id: string
  target: string
  kind: 'file' | 'message' | 'note'
  name: string
  text: string
  dataUrl?: string
  by: string
  at: string
}

export interface Link { id: string; from: string; to: string; relation: string; note: string; by: string; at: string }

export interface FindingDecision {
  decision: 'accepted' | 'informed' | 'asked' | 'reopened'
  note: string
  authority: string
  by: string
  at: string
}

export interface TimeEntry { id: string; area: string; hours: number; note: string; by: string; at: string }

export interface ViewLogEntry { field: string; label: string; by: string; at: string }

export interface StepAttestation { step: string; note: string; refs: string[]; by: string; at: string; adjustmentIds: string[] }

export interface SubmissionState {
  jurisdiction: 'federal' | 'california'
  at: string
  by: string
  status: 'accepted' | 'rejected' | 'not_transmitted'
  submissionId: string
  errors: { code: string; message: string }[]
}

export interface FilingState {
  extension?: { at: string; federalPayment: number; by: string }
  clientApproval?: { at: string; by: string; adjustmentIds: string[]; pins: { taxpayer: string; spouse: string } }
  submissions: SubmissionState[]
  /** set once the federal return is accepted: the return as filed, for amendments to sit on top of */
  frozen?: { at: string; adjustmentIds: string[]; fingerprint: string }
  payments: { at: string; agency: string; amount: number; note: string }[]
  refund?: { at: string; amount: number }
  notice?: { at: string; respondedAt?: string; respondedBy?: string }
  rollForward?: { at: string; by: string }
}

export interface WorkState {
  adjustments: Adjustment[]
  verifications: Verification[]
  threads: Thread[]
  signoffs: Signoff[]
  judgments: Judgment[]
  attachments: Attachment[]
  links: Link[]
  findingDecisions: Record<string, FindingDecision>
  varianceNotes: Record<string, { text: string; refs: string[]; by: string; at: string }>
  docDispositions: Record<string, { decision: string; note: string; by: string; at: string }>
  assignments: Record<string, { to: string; due: string; by: string }>
  timeEntries: TimeEntry[]
  viewLog: ViewLogEntry[]
  seen: Record<string, string>
  standards: FirmStandards
  attestations: Record<string, StepAttestation>
  filing: FilingState
  season: { index: number; asOf: string }
  /** event ids that were undone */
  undone: Set<string>
}
