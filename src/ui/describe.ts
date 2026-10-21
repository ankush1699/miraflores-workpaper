import type { WorkEvent, WorkState } from '../store/types'

/** One plain sentence for each kind of event, for the activity feed and "what changed since I last looked". */
export function describeEvent(e: WorkEvent, state: WorkState, name: (id: string) => string): string {
  const d = e.data
  const adj = (id: string) => state.adjustments.find((a) => a.id === id)
  switch (e.type) {
    case 'adjust.propose': return `proposed an adjustment to ${d.target.replace('line:', '')}: ${d.label}`
    case 'adjust.decide': return `${d.decision} the adjustment “${adj(d.id)?.label ?? d.id}”`
    case 'adjust.revert': return `reverted the adjustment “${adj(d.id)?.label ?? d.id}”`
    case 'verify.add': return `verified ${d.target.replace(/^(line|ev):/, '')} (${String(d.type).replace(/_/g, ' ')})`
    case 'thread.open': return d.kind === 'question' ? `asked the client about ${d.target.replace(/^(line|ev):/, '')}` : `raised a note on ${d.target.replace(/^(line|ev):/, '')}`
    case 'thread.reply': return 'replied on a thread'
    case 'thread.status': return `marked a thread ${d.status}`
    case 'signoff.add': return `signed off as ${d.level}`
    case 'step.attest': return `completed “${d.step}”`
    case 'judgment.add': return `recorded a ${String(d.kind).replace('_', ' ')}: ${d.topic}`
    case 'attach.add': return `attached ${d.name} to ${d.target.replace(/^(line|ev):/, '')}`
    case 'link.add': return `linked ${d.from.replace(/^(line|ev):/, '')} ${d.relation} ${d.to.replace(/^(line|ev):/, '')}`
    case 'finding.decide': return `marked a finding ${d.decision}`
    case 'variance.explain': return `explained the change in ${d.key}`
    case 'doc.disposition': return `recorded a decision on ${d.docId}`
    case 'assign.set': return `assigned ${d.area.replace(/_/g, ' ')} to ${name(d.to)}`
    case 'time.log': return `logged ${d.hours}h on ${d.area.replace(/_/g, ' ')}`
    case 'standards.set': return 'changed the firm standards'
    case 'filing.extension': return 'filed the extension'
    case 'filing.approve': return 'approved the return and signed Form 8879'
    case 'filing.submission': return `${d.jurisdiction} e-file ${d.status}`
    case 'filing.freeze': return 'froze the return as filed'
    case 'filing.payment': return `recorded a payment to ${d.agency}`
    case 'filing.notice': return 'received an IRS notice'
    case 'filing.notice.respond': return 'sent the notice response'
    case 'filing.rollforward': return 'rolled the file forward to 2026'
    case 'season.advance': return `moved the season to ${d.asOf}`
    case 'sensitive.view': return `viewed ${d.label} unmasked`
    case 'undo': return 'undid their last action'
    default: return e.type
  }
}

/** Events that belong in the activity feed (not just bookkeeping). */
export function isFeedEvent(e: WorkEvent): boolean {
  return !['seen.mark', 'sensitive.view', 'season.advance'].includes(e.type)
}
