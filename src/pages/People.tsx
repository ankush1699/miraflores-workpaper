import { useState } from 'react'
import { approvedIds, latestSignoff, signoffStatus } from '../domain/derived'
import { ROLE_CAPS, ROLE_LABEL, isActive, type Cap, type Role } from '../domain/people'
import { AREAS } from '../packet'
import { useStore } from '../store/Store'
import { Pill, day, when, who } from '../ui/Common'
import { PageHeader } from '../ui/Shell'
import { ThreadCard } from '../ui/Threads'

export function PeoplePage() {
  const { state, actors, actor, can, commit, say, uid } = useStore()
  const [kind, setKind] = useState<'all' | 'review' | 'question' | 'internal'>('all')
  const [show, setShow] = useState<'open' | 'all'>('open')
  const threads = state.threads.filter((t) => (kind === 'all' || t.kind === kind) && (show === 'all' || t.status !== 'cleared')).slice().reverse()
  const staff = actors.filter((a) => a.role !== 'client')

  return (
    <div className="page stack">
      <PageHeader title="Notes & sign-offs">
        Review notes that can block filing, questions to the client that become evidence when answered, sign-offs that reopen when what was signed changes, and who owns what.
      </PageHeader>

      <SignoffPanel />

      <section className="card">
        <div className="row spread wrap">
          <h2>Notes and questions</h2>
          <div className="row">
            {(['all', 'review', 'question', 'internal'] as const).map((k) => <button key={k} className={`btn small ${kind === k ? 'primary' : ''}`} onClick={() => setKind(k)}>{k === 'all' ? 'All' : k === 'review' ? 'Review notes' : k === 'question' ? 'Client questions' : 'Internal'}</button>)}
            <button className="btn small" onClick={() => setShow(show === 'open' ? 'all' : 'open')}>{show === 'open' ? 'Show cleared too' : 'Hide cleared'}</button>
          </div>
        </div>
        <p className="muted small">Start a note from any number: open it and use “Review note” or “Ask the client”. Open blocking notes stop the return being filed.</p>
        <div className="stack" style={{ marginTop: 8 }}>
          {threads.map((t) => <ThreadCard key={t.id} t={t} />)}
          {threads.length === 0 && <div className="muted">No notes yet.</div>}
        </div>
      </section>

      <div className="grid cols-2">
        <section className="card">
          <h2>Assignments</h2>
          <table className="tbl"><tbody>
            {AREAS.filter((a) => a.id !== 'return_summary').map((a) => <AssignRow key={a.id} id={a.id} label={a.label} />)}
          </tbody></table>
          {!can('assign') && <p className="muted small">Only the partner and the firm administrator assign work.</p>}
        </section>
        <section className="card">
          <h2>The team</h2>
          <table className="tbl"><tbody>
            {staff.map((s) => (
              <tr key={s.id}>
                <td>{s.name}<div className="muted small">{ROLE_LABEL[s.role]}{s.credential ? `, ${s.credential}` : ''}</div></td>
                <td className="small">{s.clearance ? <Pill tone="good">sees sensitive data</Pill> : <Pill tone="warn">masked</Pill>}</td>
                <td className="small">{isActive(s, state.season.asOf) ? `since ${day(s.activeFrom)}` : <Pill>starts {day(s.activeFrom)}</Pill>}{s.note && <div className="muted">{s.note}</div>}</td>
              </tr>
            ))}
          </tbody></table>
        </section>
      </div>

      <RolesTable />
      <span className="hide">{actor.id}{uid('x')}{String(commit)}{String(say)}</span>
    </div>
  )
}

function AssignRow({ id, label }: { id: string; label: string }) {
  const { state, actors, commit, can, say } = useStore()
  const a = state.assignments[id]
  const [to, setTo] = useState(a?.to ?? '')
  const [due, setDue] = useState(a?.due ?? '')
  const save = () => {
    if (!to || !due) return
    const r = commit([{ type: 'assign.set', data: { area: id, to, due } }])
    if (!r.ok) say(r.error ?? 'Not allowed')
  }
  const staff = actors.filter((x) => x.role !== 'client' && x.role !== 'firm_administrator')
  return (
    <tr>
      <td>{label}</td>
      <td>{can('assign') ? <select value={to} onChange={(e) => setTo(e.target.value)}><option value="">—</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select> : <span>{a ? who(actors, a.to) : '—'}</span>}</td>
      <td>{can('assign') ? <input type="date" value={due} onChange={(e) => setDue(e.target.value)} /> : <span className="small">{a ? day(a.due) : ''}</span>}</td>
      <td>{can('assign') && <button className="btn small" onClick={save} disabled={!to || !due}>Save</button>}</td>
    </tr>
  )
}

function SignoffPanel() {
  const { state, actors, actor, commit, say, uid, can } = useStore()
  const [note, setNote] = useState('')
  const rows = (['reviewer', 'partner'] as const).map((level) => {
    const so = latestSignoff(state, level)
    return { level, so, st: so ? signoffStatus(so, state) : null }
  })
  const sign = (level: 'reviewer' | 'partner') => {
    const r = commit([{ type: 'signoff.add', data: { id: uid('so'), level, note, adjustmentIds: approvedIds(state) } }])
    if (!r.ok) return say(r.error ?? 'Not allowed')
    setNote('')
    say(`Signed as ${level}.`)
  }
  return (
    <section className="card">
      <h2>Sign-offs</h2>
      <p className="small muted">A signature covers the numbers in front of the signer. If an adjustment is approved afterwards, the sign-off reopens and says what changed.</p>
      <table className="tbl"><tbody>
        {rows.map(({ level, so, st }) => (
          <tr key={level}>
            <td style={{ width: 120 }}><strong>{level === 'reviewer' ? 'Reviewer' : 'Partner'}</strong></td>
            <td>
              {!so && <Pill>Not signed</Pill>}
              {so && st?.state === 'valid' && <><Pill tone="good">Signed</Pill> <span className="small">by {who(actors, so.by)}, {when(so.at)}</span></>}
              {so && st?.state === 'reopened' && (
                <>
                  <Pill tone="warn">Reopened</Pill> <span className="small">signed by {who(actors, so.by)}, {when(so.at)}</span>
                  <div className="small">{st.added.length} adjustment(s) approved since: {st.added.map((a) => a.label).join('; ')}{st.removed.length ? `; ${st.removed.length} reverted` : ''}</div>
                </>
              )}
              {so?.note && <div className="small muted">“{so.note}”</div>}
            </td>
            <td style={{ width: 150 }}>{can(level === 'reviewer' ? 'signoff.review' : 'signoff.partner') && (!so || st?.state === 'reopened') && <button className="btn small primary" onClick={() => sign(level)}>Sign now</button>}</td>
          </tr>
        ))}
      </tbody></table>
      {(can('signoff.review') || can('signoff.partner')) && <input type="text" style={{ marginTop: 8 }} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note with your signature" />}
      {actor.role === 'preparer' && <p className="muted small" style={{ marginTop: 6 }}>Preparers cannot sign off on their own work. Switch to the reviewer (top right) to try it.</p>}
    </section>
  )
}

const CAP_LABEL: Record<Cap, string> = {
  'adjust.propose': 'Propose adjustments', 'adjust.approve': 'Approve adjustments', verify: 'Verify numbers', attach: 'Attach evidence', 'judgment.record': 'Record judgments',
  'finding.decide': 'Decide on findings', 'note.raise': 'Raise review notes', 'note.address': 'Mark notes addressed', 'note.clear': 'Clear notes', 'question.ask': 'Ask the client',
  'step.attest': 'Attest steps', 'signoff.review': 'Reviewer sign-off', 'signoff.partner': 'Partner sign-off', 'filing.manage': 'File and authorize e-file', 'standards.edit': 'Edit firm standards',
  assign: 'Assign work', 'time.log': 'Log time', 'viewlog.read': 'Read the view log', 'client.respond': 'Answer questions', 'client.approve': 'Approve and e-sign', 'quality.review': 'Quality review',
}

function RolesTable() {
  const roles = Object.keys(ROLE_CAPS) as Role[]
  const caps = Object.keys(CAP_LABEL) as Cap[]
  return (
    <section className="card">
      <h2>What each role can do</h2>
      <p className="small muted">These are enforced when something is saved, not just hidden in the menus. Try it: switch role and attempt the same action.</p>
      <div className="scroll" style={{ maxHeight: 'none' }}>
        <table className="tbl">
          <thead><tr><th>Can</th>{roles.map((r) => <th key={r} style={{ textAlign: 'center' }}>{ROLE_LABEL[r]}</th>)}</tr></thead>
          <tbody>{caps.map((c) => <tr key={c}><td>{CAP_LABEL[c]}</td>{roles.map((r) => <td key={r} style={{ textAlign: 'center' }}>{ROLE_CAPS[r].includes(c) ? '●' : ''}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </section>
  )
}
