import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { runAllChecks } from '../checks'
import { actorsFrom } from '../domain/people'
import { approvedIds, signoffStatus, latestSignoff } from '../domain/derived'
import { simulateEfile } from '../domain/filing'
import { stepStatuses } from '../domain/steps'
import { buildIndex } from '../packet'
import type { Packet } from '../packet/types'
import { reduce } from './reduce'
import { validate } from './rules'
import type { FirmStandards, WorkEvent } from './types'

const packet = JSON.parse(readFileSync('public/packet.json', 'utf8')) as Packet
const idx = buildIndex(packet)
const { findings } = runAllChecks(idx)
const actors = actorsFrom(packet)
const standards: FirmStandards = {
  ...packet.firm.starter_standards, partnerOver: 1000, selfReviewBlocked: true, openNotesBlock: true,
  maskWithoutClearance: true, retentionYears: 7, dueDiligenceFor: [],
}
const ctx = { rates: idx.current.tax_effect_rates, standards, startDate: '2026-06-23' }

/** A tiny harness: apply events the way the store does, enforcing the same rules. */
function session() {
  const events: WorkEvent[] = []
  let n = 0
  const state = () => reduce(events, ctx)
  const act = (actorId: string, type: string, data: any) => {
    const actor = actors.find((a) => a.id === actorId)!
    const err = validate(type, data, { actor, state: state(), idx, findings, variances: [] })
    if (err) return err
    events.push({ id: `e${++n}`, at: new Date(2026, 5, 24, 9, 0, n).toISOString(), actor: actorId, type, data })
    return null
  }
  return { events, state, act }
}

const proposeFix = (s: ReturnType<typeof session>, findingId: string, by = 'st-01') => {
  const f = findings.find((x) => x.id === findingId)!
  const ids: string[] = []
  f.fix!.drafts.forEach((d, i) => {
    const id = `${findingId}-${i}`
    ids.push(id)
    expect(s.act(by, 'adjust.propose', { id, target: d.target, label: d.label, lineDelta: d.lineDelta, textFix: d.textFix, effects: d.effects, reason: 'because', authority: 'IRC', findingId, evidence: f.refs })).toBeNull()
  })
  return ids
}

describe('workpaper rules', () => {
  it('stops people approving their own work, and sends big swings to a partner', () => {
    const s = session()
    const ids = proposeFix(s, 'rsu-basis-unmatched')
    expect(s.act('st-01', 'adjust.decide', { id: ids[0], decision: 'approved' })).toMatch(/own adjustment|cannot/i)
    // reviewer may approve small ones but this moves thousands
    expect(s.act('st-02', 'adjust.decide', { id: ids[0], decision: 'approved' })).toMatch(/partner/i)
    expect(s.act('st-03', 'adjust.decide', { id: ids[0], decision: 'approved' })).toBeNull()
    const small = proposeFix(s, 'schc-spotify')
    expect(s.act('st-02', 'adjust.decide', { id: small[0], decision: 'approved' })).toBeNull()
  })

  it('a client cannot approve or sign, and Sam cannot act before January 2027', () => {
    const s = session()
    expect(s.act('cu-01', 'adjust.propose', { id: 'x', target: 'line:SchC.1', label: 'x', lineDelta: 1, effects: [], reason: 'r', authority: 'a' })).toMatch(/cannot/i)
    expect(s.act('st-06', 'thread.open', { id: 't', target: 'line:SchC.1', kind: 'review', text: 'qa' })).toMatch(/until/i)
    expect(s.act('st-04', 'sensitive.view', { field: 'x', label: 'x' })).toMatch(/clearance/i)
  })

  it('sign-offs reopen when an adjustment is approved afterwards', () => {
    const s = session()
    const a = proposeFix(s, 'schc-spotify')
    expect(s.act('st-02', 'adjust.decide', { id: a[0], decision: 'approved' })).toBeNull()
    expect(s.act('st-02', 'signoff.add', { id: 'so1', level: 'reviewer', note: '', adjustmentIds: approvedIds(s.state()) })).toBeNull()
    expect(signoffStatus(latestSignoff(s.state(), 'reviewer')!, s.state()).state).toBe('valid')
    const b = proposeFix(s, 'schc-personal-use-phone-internet')
    expect(s.act('st-02', 'adjust.decide', { id: b[0], decision: 'approved' })).toBeNull()
    const st = signoffStatus(latestSignoff(s.state(), 'reviewer')!, s.state())
    expect(st.state).toBe('reopened')
    expect(st.added).toHaveLength(1)
    const steps = stepStatuses({ idx, state: s.state(), findings, variances: [] })
    expect(steps.find((x) => x.name === 'Reviewer sign-off')!.state).toBe('reopened')
  })

  it('partners sign only as partner, and the two levels need two people', () => {
    const s = session()
    const a = proposeFix(s, 'schc-spotify')
    expect(s.act('st-02', 'adjust.decide', { id: a[0], decision: 'approved' })).toBeNull()
    expect(s.act('st-03', 'signoff.add', { id: 'r', level: 'reviewer', note: '', adjustmentIds: approvedIds(s.state()) })).toMatch(/cannot/i)
    expect(s.act('st-02', 'signoff.add', { id: 'r', level: 'reviewer', note: '', adjustmentIds: approvedIds(s.state()) })).toBeNull()
    expect(s.act('st-03', 'signoff.add', { id: 'p', level: 'partner', note: '', adjustmentIds: approvedIds(s.state()) })).toBeNull()
  })

  it('a preparer cannot sign off on work they prepared, and the partner needs the reviewer first', () => {
    const s = session()
    const a = proposeFix(s, 'schc-spotify')
    expect(s.act('st-02', 'adjust.decide', { id: a[0], decision: 'approved' })).toBeNull()
    expect(s.act('st-03', 'signoff.add', { id: 'p', level: 'partner', note: '', adjustmentIds: approvedIds(s.state()) })).toMatch(/reviewer has to sign first/i)
    // Daniel approved but did not prepare: he may sign. Priya prepared: she may not.
    expect(s.act('st-01', 'signoff.add', { id: 'r0', level: 'reviewer', note: '', adjustmentIds: [] })).toMatch(/cannot/i)
  })

  it('e-file is rejected until Theo\'s SSN is fixed, California is held, then both accept and the return freezes', () => {
    const s = session()
    expect(simulateEfile(idx, s.state(), 'federal').status).toBe('rejected')
    expect(simulateEfile(idx, s.state(), 'california').status).toBe('not_transmitted')
    const fix = proposeFix(s, 'theo-ssn-typo')
    expect(s.act('st-02', 'adjust.decide', { id: fix[0], decision: 'approved' })).toBeNull()
    expect(simulateEfile(idx, s.state(), 'federal').status).toBe('accepted')
    // once the federal return is accepted, later adjustments are amendments
    // the rules refuse a premature filing (steps are not done), so record the acceptance directly
    expect(s.act('st-03', 'filing.submission', { ...simulateEfile(idx, s.state(), 'federal') })).toMatch(/not ready/i)
    s.events.push({ id: 'sub', at: new Date(2026, 6, 14).toISOString(), actor: 'st-03', type: 'filing.submission', data: simulateEfile(idx, s.state(), 'federal') })
    s.events.push({ id: 'frz', at: new Date(2026, 6, 14, 1).toISOString(), actor: 'st-03', type: 'filing.freeze', data: { adjustmentIds: approvedIds(s.state()), fingerprint: 'x' } })
    const late = proposeFix(s, 'schc-spotify')
    const adj = s.state().adjustments.find((x) => x.id === late[0])!
    expect(adj.amendment).toBe(true)
    expect(simulateEfile(idx, s.state(), 'california').status).toBe('accepted')
  })

  it('undo takes back a whole group of events', () => {
    const s = session()
    const ids = proposeFix(s, 'rsu-basis-unmatched')
    expect(s.state().adjustments).toHaveLength(ids.length)
    s.events.forEach((e) => { e.group = 'g1' })
    s.act('st-01', 'undo', { targets: [s.events[0].id] })
    expect(s.state().adjustments).toHaveLength(0)
  })
})
