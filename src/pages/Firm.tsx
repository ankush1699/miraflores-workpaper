import { useState } from 'react'
import { AREAS } from '../packet'
import { ROLE_LABEL } from '../domain/people'
import { useStore } from '../store/Store'
import type { FirmStandards } from '../store/types'
import { Masked, Pill, day, when, who } from '../ui/Common'
import { PageHeader } from '../ui/Shell'

export function FirmPage() {
  return (
    <div className="page stack">
      <PageHeader title="Firm & standards">
        The firm's own rules, enforced by the workpaper rather than written in a manual. Only the firm administrator changes them; everyone else sees them applied.
      </PageHeader>
      <Standards />
      <div className="grid cols-2">
        <Identity />
        <Retention />
      </div>
      <ViewLog />
      <TimeTable />
    </div>
  )
}

function Standards() {
  const { state, commit, say, can } = useStore()
  const [s, setS] = useState<FirmStandards>(state.standards)
  const [newStep, setNewStep] = useState('')
  const [newRule, setNewRule] = useState('')
  const editable = can('standards.edit')
  const dirty = JSON.stringify(s) !== JSON.stringify(state.standards)
  const save = () => {
    const r = commit([{ type: 'standards.set', data: { standards: s } }])
    say(r.ok ? 'Standards saved. They apply to everything from now on.' : r.error ?? 'Not allowed')
  }
  const num = (v: string) => Math.max(0, Number(v) || 0)
  return (
    <section className="card">
      <div className="row spread"><h2>Standards</h2>{editable ? <button className="btn primary" disabled={!dirty} onClick={save}>Save changes</button> : <Pill>Read-only for your role</Pill>}</div>
      <p className="small muted">{s.note ?? ''}</p>
      <div className="grid cols-3">
        <label className="field"><span>Flag a year-over-year change over (%)</span><input type="number" disabled={!editable} value={s.variance_review.flag_if_change_over_percent} onChange={(e) => setS({ ...s, variance_review: { ...s.variance_review, flag_if_change_over_percent: num(e.target.value) } })} /></label>
        <label className="field"><span>…and over ($)</span><input type="number" disabled={!editable} value={s.variance_review.and_over_amount} onChange={(e) => setS({ ...s, variance_review: { ...s.variance_review, and_over_amount: num(e.target.value) } })} /></label>
        <label className="field"><span>Partner approval needed above a tax effect of ($)</span><input type="number" disabled={!editable} value={s.partnerOver} onChange={(e) => setS({ ...s, partnerOver: num(e.target.value) })} /></label>
      </div>
      <div className="stack small">
        <label className="row"><input type="checkbox" disabled={!editable} checked={s.selfReviewBlocked} onChange={(e) => setS({ ...s, selfReviewBlocked: e.target.checked })} /> Nobody reviews or signs off on work they prepared</label>
        <label className="row"><input type="checkbox" disabled={!editable} checked={s.openNotesBlock} onChange={(e) => setS({ ...s, openNotesBlock: e.target.checked })} /> Open blocking review notes stop a return being filed</label>
        <label className="row"><input type="checkbox" disabled={!editable} checked={s.maskWithoutClearance} onChange={(e) => setS({ ...s, maskWithoutClearance: e.target.checked })} /> Mask SSNs, bank and account numbers and IP PINs; log every unmasked view</label>
        <label className="row"><span>Retention (years after filing)</span><input type="number" style={{ width: 80 }} disabled={!editable} value={s.retentionYears} onChange={(e) => setS({ ...s, retentionYears: num(e.target.value) })} /></label>
      </div>
      <div className="grid cols-2" style={{ marginTop: 12 }}>
        <div>
          <h3>Required steps before filing</h3>
          <ol className="small" style={{ paddingLeft: 20 }}>
            {s.required_steps.map((st, i) => <li key={st}>{st} {editable && <button className="btn small" onClick={() => setS({ ...s, required_steps: s.required_steps.filter((_, j) => j !== i) })}>remove</button>}</li>)}
          </ol>
          {editable && <div className="row"><input type="text" value={newStep} onChange={(e) => setNewStep(e.target.value)} placeholder="Add a step (a person has to confirm it)" /><button className="btn small" disabled={!newStep.trim()} onClick={() => { setS({ ...s, required_steps: [...s.required_steps, newStep.trim()] }); setNewStep('') }}>Add</button></div>}
        </div>
        <div>
          <h3>Written rules</h3>
          <ul className="small" style={{ paddingLeft: 18 }}>
            {s.rules.map((r, i) => <li key={r}>{r} {editable && <button className="btn small" onClick={() => setS({ ...s, rules: s.rules.filter((_, j) => j !== i) })}>remove</button>}</li>)}
          </ul>
          {editable && <div className="row"><input type="text" value={newRule} onChange={(e) => setNewRule(e.target.value)} placeholder="Add a rule" /><button className="btn small" disabled={!newRule.trim()} onClick={() => { setS({ ...s, rules: [...s.rules, newRule.trim()] }); setNewRule('') }}>Add</button></div>}
          <p className="small muted" style={{ marginTop: 6 }}>Verification types: {s.verification_types.map((v) => v.replace(/_/g, ' ')).join(', ')}.</p>
        </div>
      </div>
    </section>
  )
}

function Identity() {
  const { idx } = useStore()
  const f = idx.packet.firm.firm_identity as Record<string, any>
  return (
    <section className="card">
      <h2>Firm identity on the return</h2>
      <table className="tbl"><tbody>
        <tr><td>Firm</td><td>{idx.packet.firm.name}, {f.address}</td></tr>
        <tr><td>EIN</td><td className="mono">{f.ein}</td></tr>
        <tr><td>EFIN</td><td><Masked value={String(f.efin)} kind="account" label="Firm EFIN" /></td></tr>
        <tr><td>ERO PIN</td><td><Masked value={String(f.ero_pin)} kind="pin" label="ERO PIN" /></td></tr>
        <tr><td>Paid preparer who signs</td><td>{idx.packet.firm.staff.find((s) => s.id === f.paid_preparer_signing_returns)?.name} <span className="muted small">PTIN <Masked value={String(f.ptins?.[f.paid_preparer_signing_returns])} kind="account" label="Partner PTIN" /></span></td></tr>
        <tr><td>Client bank for refund or payment</td><td><Masked value={idx.packet.household.bank_account_for_refund_or_payment.account} kind="account" label="Client bank account" /> <span className="muted small">{idx.packet.household.bank_account_for_refund_or_payment.bank}</span></td></tr>
      </tbody></table>
    </section>
  )
}

function Retention() {
  const { state } = useStore()
  const filed = state.filing.frozen?.at
  const destroy = filed ? new Date(new Date(filed).setFullYear(new Date(filed).getFullYear() + state.standards.retentionYears)).toISOString() : null
  return (
    <section className="card">
      <h2>Retention</h2>
      <p className="small">Records are kept {state.standards.retentionYears} years after filing, then destroyed.</p>
      {destroy ? <div className="alert info small">Filed {day(filed!)}. Eligible for destruction on <strong>{day(destroy)}</strong>.</div> : <div className="alert small">The clock starts when the federal return is accepted.</div>}
      <p className="small muted">Open review notes, sign-offs and every adjustment stay with the file for that whole period; nothing here is ever deleted by a user.</p>
    </section>
  )
}

function ViewLog() {
  const { state, actors, can, actor } = useStore()
  return (
    <section className="card">
      <h2>Who has seen sensitive data</h2>
      {!can('viewlog.read') ? <p className="muted small">The view log is visible to the partner, the firm administrator and the quality reviewer. You are signed in as {ROLE_LABEL[actor.role]}.</p> : (
        <>
          <table className="tbl"><thead><tr><th>When</th><th>Who</th><th>Unmasked</th></tr></thead>
            <tbody>
              {state.viewLog.slice().reverse().map((v, i) => <tr key={i}><td className="small">{when(v.at)}</td><td>{who(actors, v.by)}</td><td>{v.label}</td></tr>)}
              {state.viewLog.length === 0 && <tr><td colSpan={3} className="muted">Nobody has unmasked anything yet. Try it: open Firm identity as a cleared user and press Show.</td></tr>}
            </tbody></table>
          <p className="small muted" style={{ marginTop: 6 }}>Staff without clearance: {actors.filter((a) => a.role !== 'client' && !a.clearance).map((a) => a.name).join(', ') || 'none'}. They see masked values and cannot reveal them.</p>
        </>
      )}
    </section>
  )
}

function TimeTable() {
  const { idx, state, actors } = useStore()
  const budgets = idx.packet.firm.budget_hours
  const staff = actors.filter((a) => state.timeEntries.some((t) => t.by === a.id))
  const total = Object.values(budgets).reduce((s, h) => s + h, 0)
  const used = state.timeEntries.reduce((s, t) => s + t.hours, 0)
  return (
    <section className="card">
      <h2>Time against budget</h2>
      <table className="tbl"><thead><tr><th>Area</th><th className="num">Budget</th><th className="num">Logged</th>{staff.map((s) => <th key={s.id} className="num">{s.name.split(' ')[0]}</th>)}<th /></tr></thead>
        <tbody>
          {AREAS.filter((a) => budgets[a.id]).map((a) => {
            const u = state.timeEntries.filter((t) => t.area === a.id)
            const sum = u.reduce((s, t) => s + t.hours, 0)
            return <tr key={a.id}><td>{a.label}</td><td className="num">{budgets[a.id].toFixed(1)}</td><td className="num">{sum.toFixed(1)}</td>{staff.map((s) => <td key={s.id} className="num">{u.filter((t) => t.by === s.id).reduce((x, t) => x + t.hours, 0).toFixed(1)}</td>)}<td>{sum > budgets[a.id] && <Pill tone="bad">over</Pill>}</td></tr>
          })}
          <tr className="group"><td>Total</td><td className="num">{total.toFixed(1)}</td><td className="num">{used.toFixed(1)}</td>{staff.map((s) => <td key={s.id} />)}<td /></tr>
        </tbody></table>
    </section>
  )
}
