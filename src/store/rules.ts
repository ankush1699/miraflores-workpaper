import type { Finding } from '../checks/types'
import { can, type Actor, type Cap } from '../domain/people'
import { biggestSwing } from '../domain/taxEffect'
import { approvedAdjustments, blockingThreads, fingerprintOf, approvedIds, latestSignoff, signoffStatus } from '../domain/derived'
import type { Variance } from '../checks/review'
import { stepStatuses } from '../domain/steps'
import type { PacketIndex } from '../packet'
import type { WorkState } from './types'

export interface RuleContext {
  actor: Actor
  state: WorkState
  idx: PacketIndex
  findings: Finding[]
  variances: Variance[]
}

type Rule = (data: any, c: RuleContext) => string | null

const need = (cap: Cap, why?: string): Rule => (_d, c) =>
  can(c.actor, cap, c.state.season.asOf) ? null : why ?? refusal(c.actor, cap, c.state.season.asOf)

function refusal(actor: Actor, cap: Cap, asOf: string): string {
  if (!can({ ...actor, activeFrom: '1900-01-01' }, cap, asOf)) return `A ${actor.role.replace('_', ' ')} cannot do this.`
  return `${actor.name} is not on the engagement until ${actor.activeFrom}.`
}

/** What each kind of event requires. Returns an error message, or null when it is allowed. */
const RULES: Record<string, Rule[]> = {
  'adjust.propose': [
    need('adjust.propose'),
    (d) => (d.reason?.trim() ? null : 'Say why: every adjustment records its reason.'),
    (d) => (d.textFix || !d.effects?.length || d.authority?.trim() ? null : 'Record the authority relied on.'),
  ],
  'adjust.decide': [
    (d, c) => {
      const a = c.state.adjustments.find((x) => x.id === d.id)
      if (!a) return 'That adjustment no longer exists.'
      if (d.decision === 'rejected') return d.note?.trim() ? null : 'Say why it is rejected.'
      if (!can(c.actor, 'adjust.approve', c.state.season.asOf)) return refusal(c.actor, 'adjust.approve', c.state.season.asOf)
      if (c.state.standards.selfReviewBlocked && a.proposedBy === c.actor.id) return 'Nobody approves their own adjustment.'
      if (biggestSwing(a.effect) > c.state.standards.partnerOver && c.actor.role !== 'partner') {
        return `This moves tax by more than $${c.state.standards.partnerOver.toLocaleString()}, so a partner has to approve it.`
      }
      return null
    },
  ],
  'adjust.revert': [(_d, c) => (can(c.actor, 'adjust.approve', c.state.season.asOf) || can(c.actor, 'adjust.propose', c.state.season.asOf) ? null : 'Not allowed.')],
  'verify.add': [need('verify'), (d) => (d.type ? null : 'Pick how it was verified.')],
  'attach.add': [need('attach')],
  'link.add': [need('verify')],
  'judgment.add': [need('judgment.record'), (d) => (d.authority?.trim() && d.decision?.trim() ? null : 'A judgment records the decision and the authority relied on.')],
  'finding.decide': [need('finding.decide'), (d) => (d.decision === 'reopened' || d.note?.trim() ? null : 'Add a note explaining the decision.')],
  'doc.disposition': [need('finding.decide')],
  'variance.explain': [need('step.attest'), (d) => (d.text?.trim() ? null : 'Write the explanation.')],
  'thread.open': [
    (d, c) => {
      const cap: Cap = d.kind === 'review' ? 'note.raise' : 'question.ask'
      return can(c.actor, cap, c.state.season.asOf) || (d.kind === 'internal' && can(c.actor, 'note.raise', c.state.season.asOf))
        ? null : refusal(c.actor, cap, c.state.season.asOf)
    },
    (d) => (d.text?.trim() ? null : 'Write the note.'),
  ],
  'thread.reply': [
    (d, c) => {
      const t = c.state.threads.find((x) => x.id === d.threadId)
      if (!t) return 'Thread not found.'
      if (c.actor.role === 'client' && t.kind !== 'question') return 'Clients can only answer questions addressed to them.'
      return d.text?.trim() ? null : 'Write a reply.'
    },
  ],
  'thread.status': [
    (d, c) => {
      const t = c.state.threads.find((x) => x.id === d.threadId)
      // whoever asked the client may accept the client's answer; clearing a review note is for reviewers
      const cap: Cap = t?.kind === 'question' ? 'question.ask' : d.status === 'cleared' ? 'note.clear' : 'note.address'
      return can(c.actor, cap, c.state.season.asOf) ? null : refusal(c.actor, cap, c.state.season.asOf)
    },
  ],
  'step.attest': [need('step.attest')],
  'signoff.add': [
    (d, c) => {
      const cap: Cap = d.level === 'partner' ? 'signoff.partner' : 'signoff.review'
      if (!can(c.actor, cap, c.state.season.asOf)) return refusal(c.actor, cap, c.state.season.asOf)
      const approved = approvedAdjustments(c.state)
      if (c.state.standards.selfReviewBlocked) {
        const own = approved.filter((a) => a.proposedBy === c.actor.id)
        if (own.length) return `${c.actor.name} prepared ${own.length} of these adjustments and cannot sign off on them.`
      }
      if (c.state.adjustments.some((a) => a.status === 'proposed')) return 'Some adjustments are still waiting for a decision.'
      if (d.level === 'partner') {
        const r = latestSignoff(c.state, 'reviewer')
        if (!r || signoffStatus(r, c.state).state !== 'valid') return 'The reviewer has to sign first, on the current numbers.'
        // two review levels means two different people
        if (r.by === c.actor.id) return 'The partner sign-off has to come from someone other than the reviewer.'
      }
      return null
    },
  ],
  'assign.set': [need('assign')],
  'time.log': [need('time.log')],
  'sensitive.view': [(_d, c) => (c.actor.clearance ? null : 'You do not have sensitive-data clearance.')],
  'standards.set': [need('standards.edit')],
  'filing.extension': [need('filing.manage')],
  'filing.approve': [
    need('client.approve'),
    (_d, c) => {
      const r = latestSignoff(c.state, 'reviewer'), p = latestSignoff(c.state, 'partner')
      if (!r || !p) return 'The firm has not finished its review yet.'
      if (signoffStatus(r, c.state).state !== 'valid' || signoffStatus(p, c.state).state !== 'valid') return 'The return changed after review; it needs to be signed again first.'
      return null
    },
  ],
  'filing.submission': [
    need('filing.manage'),
    (_d, c) => {
      const steps = stepStatuses(c).filter((s) => s.state !== 'done')
      if (steps.length) return `Not ready to file: ${steps[0].name}.`
      if (c.state.standards.openNotesBlock && blockingThreads(c.state).some((t) => t.kind !== 'question')) return 'Open review notes block filing.'
      const a = c.state.filing.clientApproval
      if (!a || fingerprintOf(a.adjustmentIds) !== fingerprintOf(approvedIds(c.state))) return 'The client has not approved the current numbers.'
      return null
    },
  ],
  'filing.freeze': [need('filing.manage')],
  'filing.payment': [],
  'filing.refund': [],
  'filing.notice': [],
  'filing.notice.respond': [need('judgment.record')],
  'filing.rollforward': [need('step.attest')],
  'season.advance': [],
  'seen.mark': [],
  undo: [],
}

export function validate(type: string, data: any, c: RuleContext): string | null {
  const rules = RULES[type]
  if (!rules) return null
  for (const r of rules) {
    const err = r(data, c)
    if (err) return err
  }
  return null
}
