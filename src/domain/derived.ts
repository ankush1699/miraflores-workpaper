import type { Finding } from '../checks/types'
import type { PacketIndex } from '../packet'
import type { ReturnLine } from '../packet/types'
import { ZERO_EFFECT, addEffects, type TaxEffect } from './taxEffect'
import type { Adjustment, Signoff, WorkState } from '../store/types'

/** Adjustments that count toward the workpaper's numbers. */
export function approvedAdjustments(state: WorkState): Adjustment[] {
  return state.adjustments.filter((a) => a.status === 'approved')
}

export function adjustmentsFor(state: WorkState, target: string): Adjustment[] {
  return state.adjustments.filter((a) => a.target === target && a.status !== 'rejected' && a.status !== 'reverted')
}

export interface AdjustedLine {
  line: ReturnLine
  base: number | string | null
  delta: number
  value: number | string | null
  /** every adjustment that touches the line, whatever its status */
  adjustments: Adjustment[]
  pending: boolean
}

/** A line's value with approved adjustments applied. Proposed ones are shown but not counted. */
export function adjustedLine(state: WorkState, line: ReturnLine): AdjustedLine {
  const target = `line:${line.key}`
  const all = state.adjustments.filter((a) => a.target === target)
  const delta = all.filter((a) => a.status === 'approved').reduce((s, a) => s + (a.lineDelta ?? 0), 0)
  const value = typeof line.value === 'number' ? line.value + delta : line.value
  return {
    line, base: line.value, delta, value, adjustments: all,
    pending: all.some((a) => a.status === 'proposed'),
  }
}

/** Total estimated tax effect of a set of adjustments. */
export function sumEffects(adjs: Adjustment[]): TaxEffect {
  return adjs.reduce((s, a) => addEffects(s, a.effect), { ...ZERO_EFFECT })
}

/** A short stable string for "the set of approved adjustments", used to tell when a sign-off no longer matches. */
export function fingerprintOf(ids: string[]): string {
  const text = [...ids].sort().join(',')
  let h = 5381
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0
  return (h >>> 0).toString(16).padStart(8, '0')
}

export function approvedIds(state: WorkState): string[] {
  return approvedAdjustments(state).map((a) => a.id).sort()
}

export interface SignoffStatus {
  state: 'valid' | 'reopened'
  added: Adjustment[]
  removed: string[]
}

/** A sign-off is only good for the numbers that were in front of the signer. */
export function signoffStatus(signoff: Signoff, state: WorkState): SignoffStatus {
  const now = new Set(approvedIds(state))
  const then = new Set(signoff.adjustmentIds)
  const added = approvedAdjustments(state).filter((a) => !then.has(a.id))
  const removed = signoff.adjustmentIds.filter((id) => !now.has(id))
  return { state: added.length || removed.length ? 'reopened' : 'valid', added, removed }
}

export function latestSignoff(state: WorkState, level: Signoff['level']): Signoff | undefined {
  return [...state.signoffs].reverse().find((s) => s.level === level)
}

export type FindingStatus = 'open' | 'proposed' | 'fixed' | 'accepted' | 'informed' | 'asked'

export function findingStatus(f: Finding, state: WorkState): FindingStatus {
  const decision = state.findingDecisions[f.id]
  if (decision && decision.decision !== 'reopened') return decision.decision
  const adjs = state.adjustments.filter((a) => a.findingId === f.id && a.status !== 'rejected' && a.status !== 'reverted')
  if (adjs.length && f.fix && adjs.length >= f.fix.drafts.length) {
    if (adjs.every((a) => a.status === 'approved')) return 'fixed'
    return 'proposed'
  }
  return 'open'
}

export function isResolved(status: FindingStatus): boolean {
  return status === 'fixed' || status === 'accepted' || status === 'informed'
}

/** Open review notes that would block filing. */
export function blockingThreads(state: WorkState) {
  return state.threads.filter((t) => t.blocking && t.status !== 'cleared')
}

export function lineValue(idx: PacketIndex, state: WorkState, key: string): number {
  const line = idx.lineMaps.get(idx.current.version)?.get(key)
  if (!line) return 0
  const v = adjustedLine(state, line).value
  return typeof v === 'number' ? v : 0
}
