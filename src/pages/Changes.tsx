import { useMemo, useState } from 'react'
import { usd } from '../checks/helpers'
import { adjustedLine, approvedAdjustments, sumEffects } from '../domain/derived'
import { biggestSwing } from '../domain/taxEffect'
import { AREAS, areaLabel, areaOfLine } from '../packet'
import { useStore } from '../store/Store'
import type { Adjustment, WorkState } from '../store/types'
import { EffectText, Pill, RefChip, day, when, who } from '../ui/Common'
import { describeEvent, isFeedEvent } from '../ui/describe'
import { PageHeader } from '../ui/Shell'

type Tab = 'ledger' | 'compare' | 'whatif'

export function ChangesPage() {
  const [tab, setTab] = useState<Tab>('ledger')
  return (
    <div className="page stack">
      <PageHeader title="Fixes & approvals">
        A fix never overwrites the original number. It sits on top, with who proposed it, why, the rule relied on, and the estimated tax effect, until someone else approves it.
      </PageHeader>
      <div className="tabs" style={{ marginTop: 0 }}>
        {([['ledger', 'Fixes'], ['compare', 'Compare versions'], ['whatif', 'Try what-ifs']] as const).map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      {tab === 'ledger' && <Ledger />}
      {tab === 'compare' && <Compare />}
      {tab === 'whatif' && <WhatIfs />}
    </div>
  )
}

/* ------------------------------------------------------------- ledger */

function Ledger() {
  const { state, actors, events, actor, commit, say, can } = useStore()
  const [filter, setFilter] = useState<'proposed' | 'approved' | 'all'>('proposed')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const rows = state.adjustments.filter((a) => filter === 'all' || a.status === filter).slice().reverse()
  const decidable = rows.filter((a) => a.status === 'proposed')
  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  const totals = sumEffects(approvedAdjustments(state))
  const lastSeen = state.seen[actor.id] ?? ''
  const unseen = events.filter((e) => isFeedEvent(e) && e.at > lastSeen && e.actor !== actor.id && !state.undone.has(e.id))
  const name = (id: string) => who(actors, id)

  /** Approve or reject many adjustments in one action. The rules still apply to each, and one Undo takes them all back. */
  const bulk = (decision: 'approved' | 'rejected') => {
    const ids = [...picked].filter((id) => decidable.some((a) => a.id === id))
    if (!ids.length) return say('Pick proposed adjustments first.')
    let note = ''
    if (decision === 'rejected') { note = window.prompt('Why are these rejected?') ?? ''; if (!note.trim()) return }
    const r = commit(ids.map((id) => ({ type: 'adjust.decide', data: { id, decision, note } })))
    if (!r.ok) return say(r.error ?? 'Not allowed')
    say(`${decision === 'approved' ? 'Approved' : 'Rejected'} ${ids.length}. Undo takes them all back.`)
    setPicked(new Set())
  }

  const banner =
    actor.role === 'preparer' ? 'Fixes you propose wait here until a reviewer (up to $1,000 of tax) or the partner (bigger ones) approves them. You can’t approve your own.'
    : actor.role === 'reviewer' ? 'Tick fixes and press Approve. You can approve fixes up to $1,000 of tax; bigger ones need the partner.'
    : actor.role === 'partner' ? 'You can approve any fix, except one you proposed yourself.'
    : 'Only the reviewer and the partner approve fixes. Switch person (top right) to try it.'

  return (
    <>
      <div className="banner">{banner}</div>
      <div className="grid cols-3">
        <div className="kpi"><div className="label">Approved so far</div><div className="value">{approvedAdjustments(state).length}</div><div className="sub">federal <EffectText n={totals.federalBalance} /> · California <EffectText n={totals.californiaBalance} /></div></div>
        <div className="kpi"><div className="label">Waiting for approval</div><div className="value">{state.adjustments.filter((a) => a.status === 'proposed').length}</div><div className="sub">fixes over ${state.standards.partnerOver.toLocaleString()} of tax need the partner</div></div>
        <div className="kpi"><div className="label">Changed by others since you looked</div><div className="value">{unseen.length}</div><div className="sub">{state.seen[actor.id] ? `since ${when(state.seen[actor.id])}` : 'you have not marked anything seen'}</div></div>
      </div>

      {unseen.length > 0 && (
        <section className="card">
          <div className="row spread"><h2>What changed since you last looked</h2><button className="btn small" onClick={() => commit([{ type: 'seen.mark', data: {} }])}>Mark as seen</button></div>
          <ul className="timeline">
            {unseen.slice(-10).reverse().map((e) => <li key={e.id}><strong>{name(e.actor)}</strong> {describeEvent(e, state, name)} <span className="muted small">· {when(e.at)}</span></li>)}
          </ul>
        </section>
      )}

      <section className="card">
        <div className="row spread wrap">
          <div className="row">
            {(['proposed', 'approved', 'all'] as const).map((f) => <button key={f} className={`btn small ${filter === f ? 'primary' : ''}`} onClick={() => setFilter(f)}>{f[0].toUpperCase() + f.slice(1)}</button>)}
          </div>
          {can('adjust.approve') && (
            <div className="row">
              <button className="btn small" onClick={() => setPicked(new Set(decidable.map((a) => a.id)))}>Select all proposed ({decidable.length})</button>
              <button className="btn small primary" disabled={!picked.size} onClick={() => bulk('approved')}>Approve {picked.size || ''}</button>
              <button className="btn small" disabled={!picked.size} onClick={() => bulk('rejected')}>Reject</button>
            </div>
          )}
        </div>
        {rows.length === 0 ? <p className="muted">No fixes {filter === 'all' ? 'yet' : `that are ${filter}`}. Propose them from Problems, or click any number and choose “Adjust this number”.</p> : (
          <table className="tbl" style={{ marginTop: 8 }}>
            <thead><tr><th /><th>Fix</th><th className="num">Change</th><th className="num">Federal</th><th className="num">California</th><th>Who and why</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map((a) => <LedgerRow key={a.id} a={a} picked={picked.has(a.id)} onPick={() => toggle(a.id)} can={can('adjust.approve') && a.status === 'proposed'} />)}
            </tbody>
          </table>
        )}
      </section>
    </>
  )
}

function LedgerRow({ a, picked, onPick, can }: { a: Adjustment; picked: boolean; onPick: () => void; can: boolean }) {
  const { actors, state } = useStore()
  const big = biggestSwing(a.effect) > state.standards.partnerOver
  return (
    <tr>
      <td>{can && <input type="checkbox" checked={picked} onChange={onPick} aria-label="Select" />}</td>
      <td>{a.label}<div><RefChip r={a.target} /></div></td>
      <td className="num">{a.lineDelta !== undefined ? `${a.lineDelta > 0 ? '+' : ''}${a.lineDelta.toLocaleString()}` : a.textFix ? `“${a.textFix.to}”` : '—'}</td>
      <td className="num"><EffectText n={a.effect.federalBalance} /></td>
      <td className="num"><EffectText n={a.effect.californiaBalance} /></td>
      <td className="small" style={{ maxWidth: 320 }}>{who(actors, a.proposedBy)}, {day(a.proposedAt)}<div className="muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{a.reason}</div></td>
      <td><Pill tone={a.status === 'approved' ? 'good' : a.status === 'proposed' ? 'warn' : undefined}>{a.status}</Pill>{a.amendment && <Pill tone="info">amendment</Pill>}{big && a.status === 'proposed' && <div><Pill tone="bad">partner</Pill></div>}</td>
    </tr>
  )
}

/* ------------------------------------------------------------ compare */

type Source = { id: string; label: string; values: () => Map<string, number | string | null> }

function Compare() {
  const { idx, state, stateAt } = useStore()
  const sources = useMemo<Source[]>(() => {
    const engine = idx.versions.map((v) => ({
      id: v.version, label: `Tax software run ${v.version} · ${day(v.computed_at)}`,
      values: () => new Map(v.lines.map((l) => [l.key, l.value])),
    }))
    const workpaperAt = (st: WorkState) => () => {
      const m = new Map<string, number | string | null>()
      for (const l of idx.current.lines) m.set(l.key, adjustedLine(st, l).value)
      return m
    }
    const extra: Source[] = [{ id: 'now', label: 'Workpaper now (v3 + approved adjustments)', values: workpaperAt(state) }]
    for (const so of state.signoffs) extra.push({ id: so.id, label: `Workpaper when the ${so.level} signed · ${when(so.at)}`, values: workpaperAt(stateAt(so.at)) })
    if (state.filing.frozen) {
      const frozen = new Set(state.filing.frozen.adjustmentIds)
      const asFiled = { ...state, adjustments: state.adjustments.map((a) => ({ ...a, status: frozen.has(a.id) ? ('approved' as const) : ('proposed' as const) })) }
      extra.push({ id: 'filed', label: `As filed · ${when(state.filing.frozen.at)}`, values: workpaperAt(asFiled) })
    }
    return [...engine, ...extra]
  }, [idx, state, stateAt])

  const [left, setLeft] = useState('v1')
  const [right, setRight] = useState('now')
  const [area, setArea] = useState('all')
  const diffs = useMemo(() => {
    const a = sources.find((s) => s.id === left)?.values() ?? new Map()
    const b = sources.find((s) => s.id === right)?.values() ?? new Map()
    const keys = new Set([...a.keys(), ...b.keys()])
    const out: { key: string; label: string; from: number | string | null | undefined; to: number | string | null | undefined; delta: number }[] = []
    const labels = new Map(idx.versions.flatMap((v) => v.lines.map((l) => [l.key, l.label] as const)))
    for (const k of keys) {
      const x = a.get(k), y = b.get(k)
      if (x === y) continue
      if (area !== 'all' && areaOfLine(k) !== area) continue
      const delta = typeof x === 'number' && typeof y === 'number' ? y - x : typeof y === 'number' ? y : typeof x === 'number' ? -x : 0
      if (typeof x === 'number' && typeof y === 'number' && Math.abs(delta) < 0.5) continue
      out.push({ key: k, label: labels.get(k) ?? k, from: x, to: y, delta })
    }
    return out.sort((p, q) => Math.abs(q.delta) - Math.abs(p.delta))
  }, [sources, left, right, area, idx])

  return (
    <section className="card">
      <div className="row wrap">
        <label className="row small"><span className="muted">From</span><select value={left} onChange={(e) => setLeft(e.target.value)} style={{ width: 'auto' }}>{sources.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
        <label className="row small"><span className="muted">To</span><select value={right} onChange={(e) => setRight(e.target.value)} style={{ width: 'auto' }}>{sources.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
        <select value={area} onChange={(e) => setArea(e.target.value)} style={{ width: 'auto' }}><option value="all">All areas</option>{AREAS.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}</select>
        <span className="muted small">{diffs.length} lines differ</span>
      </div>
      <div className="scroll" style={{ marginTop: 10 }}>
        <table className="tbl">
          <thead><tr><th>Line</th><th>Area</th><th className="num">From</th><th className="num">To</th><th className="num">Change</th></tr></thead>
          <tbody>
            {diffs.slice(0, 300).map((d) => (
              <tr key={d.key}>
                <td><RefChip r={`line:${d.key}`} /> {d.label}</td>
                <td className="small">{areaLabel(areaOfLine(d.key))}</td>
                <td className="num">{fmt(d.from)}</td><td className="num">{fmt(d.to)}</td>
                <td className="num">{d.from === undefined ? <Pill tone="info">added</Pill> : d.to === undefined ? <Pill tone="bad">removed</Pill> : <span className={`effect ${d.delta > 0 ? 'up' : 'down'}`}>{d.delta > 0 ? '+' : '−'}{usd(Math.abs(d.delta))}</span>}</td>
              </tr>
            ))}
            {diffs.length === 0 && <tr><td colSpan={5} className="muted">These two are identical.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="muted small">The tax software's runs are compared line by line as delivered. Workpaper versions are the v3 return with only the adjustments approved at that moment applied; downstream lines are estimated, not recomputed.</p>
    </section>
  )
}

const fmt = (v: unknown) => (v === undefined ? '—' : typeof v === 'number' ? usd(v, v % 1 !== 0 && Math.abs(v) < 1000) : v === null ? '—' : String(v))

/* ------------------------------------------------------------ what-ifs */

function WhatIfs() {
  const { idx, state, commit, say, can, uid } = useStore()
  const [tryIds, setTryIds] = useState<Set<string>>(new Set())
  const alts = idx.packet.what_if.alternatives
  const ext = idx.packet.what_if.extension as Record<string, any>
  const proposed = state.adjustments.filter((a) => a.status === 'proposed')
  const trial = sumEffects(proposed.filter((a) => tryIds.has(a.id)))
  const base = approvedAdjustments(state)
  const now = sumEffects(base)
  const fed = idx.current.summary.federal, ca = idx.current.summary.california
  const elected = state.judgments.find((j) => j.kind === 'election' && /equipment/i.test(j.topic))

  const record = (alt: (typeof alts)[number]) => {
    const authority = window.prompt('Authority relied on for this election?', alt.id === 'equipment_section179' ? 'IRC §179; Cal. R&TC §17255 ($25,000 limit)' : 'IRC §168(k)(7) election out of special depreciation') ?? ''
    if (!authority.trim()) return
    const r = commit([{ type: 'judgment.add', data: { id: uid('jdg'), kind: 'election', topic: `Equipment: ${alt.description}`, decision: `Elected: ${alt.description} Federal ${alt.federal.total_tax_change >= 0 ? '+' : ''}${alt.federal.total_tax_change}, California ${alt.california.total_tax_change >= 0 ? '+' : ''}${alt.california.total_tax_change}.`, authority, refs: ['line:F4562-C.14', `whatif:${alt.id}`] } }])
    say(r.ok ? 'Election recorded.' : r.error ?? 'Not allowed')
  }

  return (
    <div className="stack">
      <section className="card">
        <h2>The tax software's alternatives</h2>
        <p className="small muted">These are real engine runs from the packet, not estimates. Record the election you chose, with the authority.</p>
        <table className="tbl">
          <thead><tr><th>Alternative</th><th className="num">Federal tax</th><th className="num">California tax</th><th /></tr></thead>
          <tbody>
            {alts.map((a) => (
              <tr key={a.id}>
                <td>{a.description}<div className="muted small">{a.changed_lines.length} lines change</div></td>
                <td className="num"><EffectText n={a.federal.total_tax_change} /></td>
                <td className="num"><EffectText n={a.california.total_tax_change} /></td>
                <td>{can('judgment.record') && a.id.startsWith('equipment') && <button className="btn small" onClick={() => record(a)}>Record as election</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {elected && <div className="alert good small" style={{ marginTop: 8 }}><strong>Elected:</strong> {elected.decision} <span className="muted">Authority: {elected.authority}</span></div>}
      </section>

      <section className="card">
        <h2>Try adjustments before approving them</h2>
        <p className="small muted">Tick proposed adjustments to see where the balance would land, without approving anything.</p>
        {proposed.length === 0 ? <p className="muted">Nothing is waiting. Propose fixes on the Problems page first.</p> : (
          <table className="tbl"><tbody>
            {proposed.map((a) => <tr key={a.id}><td style={{ width: 28 }}><input type="checkbox" checked={tryIds.has(a.id)} onChange={() => setTryIds((p) => { const n = new Set(p); n.has(a.id) ? n.delete(a.id) : n.add(a.id); return n })} /></td><td>{a.label}</td><td className="num"><EffectText n={a.effect.federalBalance} /></td><td className="num"><EffectText n={a.effect.californiaBalance} /></td></tr>)}
          </tbody></table>
        )}
        <div className="grid cols-2" style={{ marginTop: 10 }}>
          <div className="kpi"><div className="label">Federal if ticked were approved</div><div className="value">{usd(fed.balance_due + now.federalBalance + trial.federalBalance)}</div><div className="sub">owed · approved today {usd(fed.balance_due + now.federalBalance)}</div></div>
          <div className="kpi"><div className="label">California if ticked were approved</div><div className="value">{usd(ca.balance_due + now.californiaBalance + trial.californiaBalance)}</div><div className="sub">negative is a refund · approved today {usd(ca.balance_due + now.californiaBalance)}</div></div>
        </div>
      </section>

      <section className="card">
        <h2>The April extension</h2>
        <p className="small">On 04/14/2026 the firm filed Form 4868 with a payment of {usd(36000)} and FTB 3519 with $0, estimated from engine run v2 ({String(ext.description ?? '')}). An extension of time to file is not an extension of time to pay: any shortfall carries interest and a failure-to-pay penalty from 04/15.</p>
        <table className="tbl"><tbody>
          {Object.entries(ext).filter(([, v]) => typeof v !== 'object').map(([k, v]) => <tr key={k}><td className="muted">{k.replace(/_/g, ' ')}</td><td className="num">{typeof v === 'number' ? usd(v) : String(v)}</td></tr>)}
        </tbody></table>
      </section>
    </div>
  )
}
