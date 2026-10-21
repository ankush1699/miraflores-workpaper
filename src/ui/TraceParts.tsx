import { useState, type ReactNode } from 'react'
import { findingStatus } from '../domain/derived'
import { useStore } from '../store/Store'
import { EffectText, Pill, RefChip, StatusPill, day, when, who } from './Common'
import { ThreadCard } from './Threads'
import { useUi } from './Ui'

const VERIFY_LABEL: Record<string, string> = {
  agreed_to_source_document: 'Agreed to source document',
  recalculated: 'Recalculated',
  confirmed_with_client: 'Confirmed with client',
  agreed_to_prior_year: 'Agreed to prior year',
  agreed_to_third_party_record: 'Agreed to third-party record',
}
export const verifyLabel = (t: string) => VERIFY_LABEL[t] ?? t.replace(/_/g, ' ')

type FormKind = 'verify' | 'evidence' | 'note' | 'question' | 'link'

/** The small forms for recording what was done to a number: verify, attach, note, ask the client, link. */
export function EvidenceActions({ target }: { target: string }) {
  const { state, commit, uid, say, can, actor, actors } = useStore()
  const [open, setOpen] = useState<FormKind | null>(null)
  const [type, setType] = useState(state.standards.verification_types[0])
  const [text, setText] = useState('')
  const [name, setName] = useState('')
  const [blocking, setBlocking] = useState(true)
  const [assignee, setAssignee] = useState('')
  const [relation, setRelation] = useState('agrees to')
  const [other, setOther] = useState('')
  const [dataUrl, setDataUrl] = useState<string | undefined>()

  const reset = () => { setOpen(null); setText(''); setName(''); setOther(''); setDataUrl(undefined) }
  const run = (items: { type: string; data: any }[]) => {
    const r = commit(items)
    if (!r.ok) return say(r.error ?? 'Could not save')
    reset()
  }

  const pickFile = (f: File | undefined) => {
    if (!f) return
    setName(f.name)
    if (f.size > 1_500_000) return say('Keep attachments under 1.5 MB in this prototype.')
    const reader = new FileReader()
    reader.onload = () => setDataUrl(String(reader.result))
    reader.readAsDataURL(f)
  }

  const staff = actors.filter((a) => a.role !== 'client')
  const buttons: { k: FormKind; label: string; cap: Parameters<typeof can>[0] }[] = [
    { k: 'verify', label: 'Verify', cap: 'verify' },
    { k: 'evidence', label: 'Attach evidence', cap: 'attach' },
    { k: 'note', label: 'Review note', cap: 'note.raise' },
    { k: 'question', label: 'Ask the client', cap: 'question.ask' },
    { k: 'link', label: 'Link', cap: 'verify' },
  ]

  return (
    <div className="stack">
      <div className="row wrap">
        {buttons.filter((b) => can(b.cap)).map((b) => (
          <button key={b.k} className={`btn small ${open === b.k ? 'primary' : ''}`} onClick={() => setOpen(open === b.k ? null : b.k)}>{b.label}</button>
        ))}
        {actor.role === 'client' && <span className="muted small">You can answer questions the firm sends you, and upload documents.</span>}
      </div>
      {open === 'verify' && (
        <div className="card">
          <label className="field"><span>How was it verified?</span>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              {state.standards.verification_types.map((t) => <option key={t} value={t}>{verifyLabel(t)}</option>)}
            </select>
          </label>
          <label className="field"><span>What did you compare it to? (optional)</span>
            <input type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. IRS transcript 03/12, D69" />
          </label>
          <button className="btn primary" onClick={() => run([{ type: 'verify.add', data: { id: uid('ver'), target, type, note: text } }])}>Record verification</button>
        </div>
      )}
      {open === 'evidence' && (
        <div className="card">
          <label className="field"><span>Name</span><input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Bank statement, check #2207" /></label>
          <label className="field"><span>Note or message text</span><textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste a message, or describe the file" /></label>
          <label className="field"><span>File (optional, under 1.5 MB)</span><input type="file" onChange={(e) => pickFile(e.target.files?.[0])} /></label>
          <button className="btn primary" disabled={!name.trim() && !text.trim()} onClick={() => run([{ type: 'attach.add', data: { id: uid('att'), target, kind: dataUrl ? 'file' : 'note', name: name || 'Note', text, dataUrl } }])}>Attach</button>
        </div>
      )}
      {(open === 'note' || open === 'question') && (
        <div className="card">
          <label className="field"><span>{open === 'note' ? 'What needs to change or be explained?' : 'Your question for the client'}</span>
            <textarea value={text} onChange={(e) => setText(e.target.value)} />
          </label>
          {open === 'note' && (
            <div className="row wrap">
              <label className="row small"><input type="checkbox" checked={blocking} onChange={(e) => setBlocking(e.target.checked)} /> Blocks filing until cleared</label>
              <select value={assignee} onChange={(e) => setAssignee(e.target.value)} style={{ width: 180 }}>
                <option value="">Assign to…</option>
                {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}
          <button className="btn primary" style={{ marginTop: 8 }} onClick={() => run([{ type: 'thread.open', data: { id: uid('thr'), target, kind: open === 'note' ? 'review' : 'question', blocking: open === 'note' ? blocking : false, assignee: assignee || undefined, text } }])}>
            {open === 'note' ? 'Raise note' : 'Send to client'}
          </button>
        </div>
      )}
      {open === 'link' && (
        <div className="card">
          <div className="row">
            <select value={relation} onChange={(e) => setRelation(e.target.value)} style={{ width: 180 }}>
              {['agrees to', 'explains', 'came from', 'carries to', 'same as', 'related return'].map((r) => <option key={r}>{r}</option>)}
            </select>
            <input type="text" value={other} onChange={(e) => setOther(e.target.value)} placeholder="line:SchC.1, doc:D17, py:/return_2024/lines/SchC.1 …" />
          </div>
          <input type="text" style={{ marginTop: 8 }} value={text} onChange={(e) => setText(e.target.value)} placeholder="Why are they linked? (optional)" />
          <button className="btn primary" style={{ marginTop: 8 }} disabled={!other.trim()} onClick={() => run([{ type: 'link.add', data: { id: uid('lnk'), from: target, to: other.trim(), relation, note: text } }])}>Add link</button>
        </div>
      )}
    </div>
  )
}

/** Everything recorded against one reference: adjustments, verifications, evidence, notes, links, decisions. */
export function HistoryPanel({ target }: { target: string }) {
  const { state, actors, commit, say, findings, can } = useStore()
  const { openTrace } = useUi()
  const adjs = state.adjustments.filter((a) => a.target === target)
  const vers = state.verifications.filter((v) => v.target === target)
  const atts = state.attachments.filter((a) => a.target === target)
  const threads = state.threads.filter((t) => t.target === target)
  const links = state.links.filter((l) => l.from === target || l.to === target)
  const judgments = state.judgments.filter((j) => j.refs.includes(target))
  const fs = findings.filter((f) => f.refs.includes(target) || f.fix?.drafts.some((d) => d.target === target))

  const decide = (id: string, decision: 'approved' | 'rejected') => {
    const note = decision === 'rejected' ? window.prompt('Why is this rejected?') ?? '' : ''
    if (decision === 'rejected' && !note.trim()) return
    const r = commit([{ type: 'adjust.decide', data: { id, decision, note } }])
    if (!r.ok) say(r.error ?? 'Not allowed')
  }
  const revert = (id: string) => {
    const reason = window.prompt('Why is this being reverted?') ?? ''
    if (!reason.trim()) return
    const r = commit([{ type: 'adjust.revert', data: { id, reason } }])
    if (!r.ok) say(r.error ?? 'Not allowed')
  }

  const empty = !adjs.length && !vers.length && !atts.length && !threads.length && !links.length && !judgments.length && !fs.length

  return (
    <div className="stack">
      {empty && <div className="muted">Nothing has been recorded against this yet.</div>}
      {fs.map((f) => (
        <Block key={f.id} title={f.title} right={<StatusPill status={findingStatus(f, state)} />}>
          <span className="muted small">Raised by the independent checks. Open Issues to act on it.</span>
        </Block>
      ))}
      {adjs.map((a) => (
        <Block key={a.id} title={`Adjustment: ${a.label}`} right={<Pill tone={a.status === 'approved' ? 'good' : a.status === 'proposed' ? 'warn' : undefined}>{a.status}{a.amendment ? ' · amendment' : ''}</Pill>}>
          <div className="small">
            {a.lineDelta !== undefined && <span>Change to the line: <strong>{a.lineDelta > 0 ? '+' : ''}{a.lineDelta.toLocaleString()}</strong>. </span>}
            {a.textFix && <span>Correct “{a.textFix.from}” to “{a.textFix.to}”. </span>}
            Federal <EffectText n={a.effect.federalBalance} /> · California <EffectText n={a.effect.californiaBalance} /> <span className="muted">(change in amount owed)</span>
          </div>
          <p className="small" style={{ margin: '4px 0 0' }}><strong>Why:</strong> {a.reason}</p>
          <p className="small" style={{ margin: 0 }}><strong>Authority:</strong> {a.authority || 'n/a'}</p>
          <p className="muted small" style={{ margin: '2px 0 0' }}>Proposed by {who(actors, a.proposedBy)}, {when(a.proposedAt)}{a.decidedBy ? ` · ${a.status} by ${who(actors, a.decidedBy)}, ${when(a.decidedAt!)}` : ''}{a.decisionNote ? ` — “${a.decisionNote}”` : ''}</p>
          <div className="row" style={{ marginTop: 6 }}>
            {a.status === 'proposed' && can('adjust.approve') && <>
              <button className="btn small primary" onClick={() => decide(a.id, 'approved')}>Approve</button>
              <button className="btn small" onClick={() => decide(a.id, 'rejected')}>Reject</button>
            </>}
            {a.status === 'approved' && can('adjust.approve') && <button className="btn small" onClick={() => revert(a.id)}>Revert</button>}
          </div>
        </Block>
      ))}
      {vers.map((v) => (
        <Block key={v.id} title={`Verified: ${verifyText(v.type)}`}>
          <div className="small">{v.note || 'No comparison noted.'}</div>
          <div className="muted small">{who(actors, v.by)}, {when(v.at)}</div>
        </Block>
      ))}
      {atts.map((a) => (
        <Block key={a.id} title={`Evidence: ${a.name}`}>
          {a.text && <div className="small" style={{ whiteSpace: 'pre-wrap' }}>{a.text}</div>}
          {a.dataUrl && <a className="small" href={a.dataUrl} download={a.name}>Download {a.name}</a>}
          <div className="muted small">{who(actors, a.by)}, {when(a.at)}</div>
        </Block>
      ))}
      {threads.map((t) => <ThreadCard key={t.id} t={t} showTarget={false} />)}
      {links.map((l) => (
        <Block key={l.id} title={`Linked: ${l.relation}`}>
          <div className="row wrap"><RefChip r={l.from} /> <span className="muted">{l.relation}</span> <RefChip r={l.to} /></div>
          {l.note && <div className="small">{l.note}</div>}
          <button className="btn small" style={{ marginTop: 4 }} onClick={() => openTrace(l.from === target ? l.to : l.from)}>Open the other end</button>
        </Block>
      ))}
      {judgments.map((j) => (
        <Block key={j.id} title={`${j.kind.replace('_', ' ')}: ${j.topic}`}>
          <div className="small">{j.decision}</div>
          <div className="small muted">Authority: {j.authority}</div>
          <div className="muted small">{who(actors, j.by)}, {day(j.at)}</div>
        </Block>
      ))}
    </div>
  )
}

const verifyText = (t: string) => verifyLabel(t)

function Block({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <div className="card" style={{ padding: '9px 12px' }}>
      <div className="row spread" style={{ marginBottom: 4 }}><strong>{title}</strong>{right}</div>
      {children}
    </div>
  )
}
