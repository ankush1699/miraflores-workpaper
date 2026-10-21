import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { runAllChecks, type CheckRun } from '../checks'
import type { Finding } from '../checks/types'
import { variances as computeVariances, type Variance } from '../checks/review'
import { actorsFrom, can as canDo, type Actor, type Cap } from '../domain/people'
import { adjustedLine } from '../domain/derived'
import { buildIndex, loadPacket, type PacketIndex } from '../packet'
import { appendEvents, clearEvents, loadEvents, openChannel, sortEvents } from './db'
import { reduce, type ReduceContext } from './reduce'
import { validate } from './rules'
import type { FirmStandards, WorkEvent, WorkState } from './types'

export interface Presence { actorId: string; page: string; at: number }

export interface CommitResult { ok: boolean; error?: string }

export interface Store {
  idx: PacketIndex
  actors: Actor[]
  actor: Actor
  setActor: (id: string) => void
  events: WorkEvent[]
  state: WorkState
  findings: Finding[]
  ran: CheckRun[]
  variances: Variance[]
  can: (cap: Cap) => boolean
  /** write one or more events as a single user action; checks the rules first */
  commit: (items: { type: string; data: any }[], opts?: { actor?: string; skipRules?: boolean }) => CommitResult
  undoLast: () => CommitResult
  /** the workpaper as it stood at a moment in the past (replays the events up to then) */
  stateAt: (iso: string) => WorkState
  canUndo: boolean
  resetDemo: () => Promise<void>
  presence: Presence[]
  reportPage: (page: string) => void
  toast: string | null
  say: (msg: string) => void
  uid: (prefix: string) => string
}

const StoreContext = createContext<Store | null>(null)

export function useStore(): Store {
  const s = useContext(StoreContext)
  if (!s) throw new Error('useStore outside StoreProvider')
  return s
}

function newId(prefix: string): string {
  const rand = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10)
  return `${prefix}-${rand}`
}

function defaultStandards(idx: PacketIndex): FirmStandards {
  const starter = idx.packet.firm.starter_standards
  return {
    ...starter,
    partnerOver: 1000, selfReviewBlocked: true, openNotesBlock: true, maskWithoutClearance: true,
    retentionYears: 7, dueDiligenceFor: ['Child tax credit', 'Credit for other dependents', 'American opportunity credit', 'Earned income credit', 'Head of household'],
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [idx, setIdx] = useState<PacketIndex | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [events, setEvents] = useState<WorkEvent[]>([])
  const [actorId, setActorId] = useState<string>(() => {
    try { return sessionStorage.getItem('mf-actor') ?? 'st-01' } catch { return 'st-01' }
  })
  const [presence, setPresence] = useState<Presence[]>([])
  const [toast, setToast] = useState<string | null>(null)
  const channel = useRef<BroadcastChannel | null>(null)
  const page = useRef('/')

  useEffect(() => {
    loadPacket().then((p) => setIdx(buildIndex(p))).catch((e) => setError(String(e)))
    loadEvents().then(setEvents)
  }, [])

  // Another tab (another "person") wrote something: merge it in.
  useEffect(() => {
    const ch = openChannel()
    channel.current = ch
    if (!ch) return
    ch.onmessage = (m) => {
      const msg = m.data
      if (msg.kind === 'events') {
        setEvents((prev) => {
          const have = new Set(prev.map((e) => e.id))
          const fresh = (msg.events as WorkEvent[]).filter((e) => !have.has(e.id))
          return fresh.length ? sortEvents([...prev, ...fresh]) : prev
        })
      } else if (msg.kind === 'reset') {
        setEvents([])
      } else if (msg.kind === 'presence') {
        setPresence((prev) => [...prev.filter((p) => p.actorId !== msg.actorId), { actorId: msg.actorId, page: msg.page, at: Date.now() }])
      }
    }
    return () => ch.close()
  }, [])

  const actors = useMemo(() => (idx ? actorsFrom(idx.packet) : []), [idx])
  const actor = actors.find((a) => a.id === actorId) ?? actors[0]

  // Tell other tabs where this person is, and forget people who went quiet.
  useEffect(() => {
    if (!actor) return
    const beat = () => channel.current?.postMessage({ kind: 'presence', actorId: actor.id, page: page.current })
    beat()
    const t = setInterval(() => {
      beat()
      setPresence((prev) => prev.filter((p) => Date.now() - p.at < 15000))
    }, 5000)
    return () => clearInterval(t)
  }, [actor])

  const ctx = useMemo<ReduceContext | null>(() => idx && {
    rates: idx.current.tax_effect_rates,
    standards: defaultStandards(idx),
    startDate: idx.current.computed_at.slice(0, 10),
  }, [idx])

  const state = useMemo(() => (ctx ? reduce(events, ctx) : null), [events, ctx])
  const checks = useMemo(() => (idx ? runAllChecks(idx) : null), [idx])

  const variances = useMemo(() => {
    if (!idx || !state) return []
    const t = state.standards.variance_review
    return computeVariances(
      idx,
      (_key, line) => { const v = adjustedLine(state, line).value; return typeof v === 'number' ? v : 0 },
      { percent: t.flag_if_change_over_percent, amount: t.and_over_amount },
    )
  }, [idx, state])

  const say = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast((t) => (t === msg ? null : t)), 4500)
  }, [])

  const commit: Store['commit'] = useCallback((items, opts) => {
    if (!idx || !state || !checks || !actor) return { ok: false, error: 'Not ready.' }
    const who = opts?.actor ? actors.find((a) => a.id === opts.actor) ?? actor : actor
    const group = items.length > 1 ? newId('grp') : undefined
    let working = state
    const made: WorkEvent[] = []
    for (const item of items) {
      if (!opts?.skipRules) {
        const err = validate(item.type, item.data, { actor: who, state: working, idx, findings: checks.findings, variances })
        if (err) return { ok: false, error: err }
      }
      const ev: WorkEvent = { id: newId('ev'), at: new Date().toISOString(), actor: who.id, type: item.type, data: item.data, group }
      made.push(ev)
      if (ctx) working = reduce([...events, ...made], ctx)
    }
    setEvents((prev) => sortEvents([...prev, ...made]))
    appendEvents(made)
    channel.current?.postMessage({ kind: 'events', events: made })
    return { ok: true }
  }, [idx, state, checks, actor, actors, events, ctx, variances])

  // The last thing this person did (one group of events), which has not been undone.
  const lastAction = useMemo(() => {
    if (!state || !actor) return null
    const mine = events.filter((e) => e.actor === actor.id && e.type !== 'undo' && e.type !== 'seen.mark' && !state.undone.has(e.id))
    const last = mine[mine.length - 1]
    if (!last) return null
    return last.group ? mine.filter((e) => e.group === last.group) : [last]
  }, [events, state, actor])

  const undoLast = useCallback((): CommitResult => {
    if (!lastAction) return { ok: false, error: 'Nothing to undo.' }
    return commit([{ type: 'undo', data: { targets: lastAction.map((e) => e.id) } }])
  }, [lastAction, commit])

  const resetDemo = useCallback(async () => {
    await clearEvents()
    setEvents([])
    channel.current?.postMessage({ kind: 'reset' })
  }, [])

  const stateAt = useCallback((iso: string) => reduce(events.filter((e) => e.at <= iso), ctx!), [events, ctx])

  const reportPage = useCallback((p: string) => { page.current = p }, [])

  if (error) return <div className="boot">Could not load the packet: {error}</div>
  if (!idx || !state || !checks || !actor) return <div className="boot">Loading the Okafor-Lindqvist packet…</div>

  const store: Store = {
    idx, actors, actor, state, events, findings: checks.findings, ran: checks.ran, variances,
    setActor: (id) => { try { sessionStorage.setItem('mf-actor', id) } catch { /* private window */ } setActorId(id) },
    can: (cap) => canDo(actor, cap, state.season.asOf),
    commit, undoLast, stateAt, canUndo: !!lastAction, resetDemo, presence, reportPage, toast, say, uid: newId,
  }
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
}
