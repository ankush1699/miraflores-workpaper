import type { Finding } from '../checks/types'
import type { Variance } from '../checks/review'
import type { PacketIndex } from '../packet'
import { areaLabel } from '../packet'
import { approvedIds, fingerprintOf, latestSignoff, signoffStatus } from './derived'
import { can, type Actor } from './people'
import type { WorkState } from '../store/types'

export interface Notice {
  text: string
  to: string
  tone: 'bad' | 'warn' | 'info'
}

interface Ctx { idx: PacketIndex; state: WorkState; findings: Finding[]; variances: Variance[] }

/**
 * What is waiting for this person right now: notes assigned to them, work to approve,
 * sign-offs that reopened, questions a client has not answered, and dates that are close.
 * Computed from the state, so it is always current and needs no separate delivery.
 */
export function notificationsFor(actor: Actor, c: Ctx): Notice[] {
  const { state } = c
  const asOf = state.season.asOf
  const out: Notice[] = []
  const mine = state.threads.filter((t) => t.status !== 'cleared')

  if (actor.role === 'client') {
    const q = mine.filter((t) => t.kind === 'question' && !t.answeredBy)
    if (q.length) out.push({ text: `The firm asked you ${q.length} question${q.length === 1 ? '' : 's'}`, to: '/client', tone: 'bad' })
    const r = latestSignoff(state, 'reviewer'), p = latestSignoff(state, 'partner')
    const reviewed = r && p && signoffStatus(r, state).state === 'valid' && signoffStatus(p, state).state === 'valid'
    const a = state.filing.clientApproval
    const needs = !a || fingerprintOf(a.adjustmentIds) !== fingerprintOf(approvedIds(state))
    if (reviewed && needs) out.push({ text: 'Your return is ready for your approval and signature', to: '/client', tone: 'warn' })
    return out
  }

  const assigned = mine.filter((t) => t.assignee === actor.id && t.kind !== 'question')
  if (assigned.length) out.push({ text: `${assigned.length} note${assigned.length === 1 ? '' : 's'} assigned to you`, to: '/people', tone: 'warn' })
  const addressed = mine.filter((t) => t.opener === actor.id && t.status === 'addressed' && t.kind !== 'question')
  if (addressed.length) out.push({ text: `${addressed.length} of your notes ${addressed.length === 1 ? 'was addressed and needs' : 'were addressed and need'} clearing`, to: '/people', tone: 'info' })
  const answered = mine.filter((t) => t.opener === actor.id && t.kind === 'question' && t.answeredBy)
  if (answered.length) out.push({ text: `The client answered ${answered.length === 1 ? 'your question' : `${answered.length} of your questions`}`, to: '/people', tone: 'info' })

  if (can(actor, 'adjust.approve', asOf)) {
    const waiting = state.adjustments.filter((a) => a.status === 'proposed' && (!state.standards.selfReviewBlocked || a.proposedBy !== actor.id))
    if (waiting.length) out.push({ text: `${waiting.length} adjustment${waiting.length === 1 ? '' : 's'} waiting for your approval`, to: '/changes', tone: 'warn' })
  }
  for (const level of ['reviewer', 'partner'] as const) {
    const cap = level === 'reviewer' ? 'signoff.review' : 'signoff.partner'
    if (!can(actor, cap, asOf)) continue
    const so = latestSignoff(state, level)
    if (so && so.by === actor.id && signoffStatus(so, state).state === 'reopened') {
      out.push({ text: `Your ${level} sign-off reopened because the return changed`, to: '/people', tone: 'bad' })
    } else if (!so && !state.adjustments.some((a) => a.status === 'proposed') && state.adjustments.some((a) => a.status === 'approved')) {
      out.push({ text: `Ready for your ${level} sign-off`, to: '/people', tone: 'info' })
    }
  }

  const day = 86400000
  for (const d of c.idx.packet.firm.deadlines) {
    const days = Math.round((new Date(d.date).getTime() - new Date(asOf).getTime()) / day)
    if (days >= 0 && days <= 14) out.push({ text: `${d.what}: ${days === 0 ? 'today' : `in ${days} day${days === 1 ? '' : 's'}`}`, to: '/', tone: 'warn' })
  }
  for (const [area, a] of Object.entries(state.assignments)) {
    if (a.to !== actor.id) continue
    const days = Math.round((new Date(a.due).getTime() - new Date(asOf).getTime()) / day)
    if (days <= 7) out.push({ text: `${areaLabel(area)} assigned to you, due ${days < 0 ? `${-days} days ago` : `in ${days} days`}`, to: `/area/${area}`, tone: days < 0 ? 'bad' : 'warn' })
  }
  return out
}
