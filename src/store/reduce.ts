import { taxEffectOf } from '../domain/taxEffect'
import type { TaxRate } from '../packet/types'
import type { WorkEvent, WorkState, Adjustment, FirmStandards } from './types'

export interface ReduceContext {
  rates: Record<string, TaxRate>
  standards: FirmStandards
  startDate: string
}

export function initialState(ctx: ReduceContext): WorkState {
  return {
    adjustments: [], verifications: [], threads: [], signoffs: [], judgments: [], attachments: [], links: [],
    findingDecisions: {}, varianceNotes: {}, docDispositions: {}, assignments: {}, timeEntries: [], viewLog: [],
    seen: {}, standards: ctx.standards, attestations: {},
    filing: { submissions: [], payments: [] },
    season: { index: 0, asOf: ctx.startDate },
    undone: new Set(),
  }
}

/** Which events were taken back by an Undo, including everything that shared a group with them. */
function undoneIds(events: WorkEvent[]): Set<string> {
  const direct = new Set<string>()
  for (const e of events) if (e.type === 'undo') for (const id of e.data.targets as string[]) direct.add(id)
  const groups = new Set(events.filter((e) => direct.has(e.id) && e.group).map((e) => e.group))
  const all = new Set(direct)
  for (const e of events) if (e.group && groups.has(e.group)) all.add(e.id)
  return all
}

export function reduce(events: WorkEvent[], ctx: ReduceContext): WorkState {
  const s = initialState(ctx)
  s.undone = undoneIds(events)
  const adj = (id: string): Adjustment | undefined => s.adjustments.find((a) => a.id === id)

  for (const e of events) {
    if (e.type === 'undo' || s.undone.has(e.id)) continue
    const d = e.data
    switch (e.type) {
      case 'adjust.propose':
        s.adjustments.push({
          id: d.id, batchId: d.batchId ?? d.id, target: d.target, label: d.label,
          lineDelta: d.lineDelta, textFix: d.textFix, effects: d.effects,
          effect: taxEffectOf(d.effects, ctx.rates),
          reason: d.reason, authority: d.authority, findingId: d.findingId, evidence: d.evidence ?? [],
          proposedBy: e.actor, proposedAt: e.at, status: 'proposed', amendment: !!s.filing.frozen,
        })
        break
      case 'adjust.decide': {
        const a = adj(d.id)
        if (a) Object.assign(a, { status: d.decision, decidedBy: e.actor, decidedAt: e.at, decisionNote: d.note })
        break
      }
      case 'adjust.revert': {
        const a = adj(d.id)
        if (a) Object.assign(a, { status: 'reverted', decidedBy: e.actor, decidedAt: e.at, decisionNote: d.reason })
        break
      }
      case 'verify.add':
        s.verifications.push({ id: d.id, target: d.target, type: d.type, note: d.note, refs: d.refs ?? [], by: e.actor, at: e.at })
        break
      case 'thread.open':
        s.threads.push({
          id: d.id, target: d.target, kind: d.kind, blocking: !!d.blocking, assignee: d.assignee,
          opener: e.actor, openedAt: e.at, messages: [{ by: e.actor, at: e.at, text: d.text }], status: 'open',
        })
        break
      case 'thread.reply': {
        const t = s.threads.find((x) => x.id === d.threadId)
        if (!t) break
        t.messages.push({ by: e.actor, at: e.at, text: d.text })
        if (t.kind === 'question' && !t.answeredBy && e.actor !== t.opener) t.answeredBy = e.actor
        break
      }
      case 'thread.status': {
        const t = s.threads.find((x) => x.id === d.threadId)
        if (t) {
          t.status = d.status
          if (d.note) t.messages.push({ by: e.actor, at: e.at, text: d.note })
        }
        break
      }
      case 'signoff.add':
        s.signoffs.push({ id: d.id, level: d.level, by: e.actor, at: e.at, note: d.note ?? '', adjustmentIds: d.adjustmentIds })
        break
      case 'step.attest':
        s.attestations[d.step] = { step: d.step, note: d.note ?? '', refs: d.refs ?? [], by: e.actor, at: e.at, adjustmentIds: d.adjustmentIds ?? [] }
        break
      case 'judgment.add':
        s.judgments.push({ id: d.id, kind: d.kind, topic: d.topic, decision: d.decision, authority: d.authority, refs: d.refs ?? [], by: e.actor, at: e.at })
        break
      case 'attach.add':
        s.attachments.push({ id: d.id, target: d.target, kind: d.kind, name: d.name, text: d.text ?? '', dataUrl: d.dataUrl, by: e.actor, at: e.at })
        break
      case 'link.add':
        s.links.push({ id: d.id, from: d.from, to: d.to, relation: d.relation, note: d.note ?? '', by: e.actor, at: e.at })
        break
      case 'finding.decide':
        s.findingDecisions[d.findingId] = { decision: d.decision, note: d.note ?? '', authority: d.authority ?? '', by: e.actor, at: e.at }
        break
      case 'variance.explain':
        s.varianceNotes[d.key] = { text: d.text, refs: d.refs ?? [], by: e.actor, at: e.at }
        break
      case 'doc.disposition':
        s.docDispositions[d.docId] = { decision: d.decision, note: d.note ?? '', by: e.actor, at: e.at }
        break
      case 'assign.set':
        s.assignments[d.area] = { to: d.to, due: d.due, by: e.actor }
        break
      case 'time.log':
        s.timeEntries.push({ id: d.id, area: d.area, hours: d.hours, note: d.note ?? '', by: e.actor, at: e.at })
        break
      case 'sensitive.view':
        s.viewLog.push({ field: d.field, label: d.label, by: e.actor, at: e.at })
        break
      case 'seen.mark':
        s.seen[e.actor] = e.at
        break
      case 'standards.set':
        s.standards = d.standards
        break
      case 'season.advance':
        s.season = { index: d.index, asOf: d.asOf }
        break
      case 'filing.extension':
        s.filing.extension = { at: e.at, federalPayment: d.federalPayment, by: e.actor }
        break
      case 'filing.approve':
        s.filing.clientApproval = { at: e.at, by: e.actor, adjustmentIds: d.adjustmentIds, pins: d.pins }
        break
      case 'filing.submission':
        s.filing.submissions.push({
          jurisdiction: d.jurisdiction, at: e.at, by: e.actor, status: d.status,
          submissionId: d.submissionId, errors: d.errors ?? [],
        })
        break
      case 'filing.freeze':
        s.filing.frozen = { at: e.at, adjustmentIds: d.adjustmentIds, fingerprint: d.fingerprint }
        break
      case 'filing.payment':
        s.filing.payments.push({ at: e.at, agency: d.agency, amount: d.amount, note: d.note })
        break
      case 'filing.refund':
        s.filing.refund = { at: e.at, amount: d.amount }
        break
      case 'filing.notice':
        s.filing.notice = { at: e.at }
        break
      case 'filing.notice.respond':
        if (s.filing.notice) s.filing.notice = { ...s.filing.notice, respondedAt: e.at, respondedBy: e.actor }
        break
      case 'filing.rollforward':
        s.filing.rollForward = { at: e.at, by: e.actor }
        break
    }
  }
  return s
}
