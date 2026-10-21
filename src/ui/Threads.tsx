import { useState } from 'react'
import type { Thread } from '../store/types'
import { useStore } from '../store/Store'
import { Pill, RefChip, when, who } from './Common'

const KIND_LABEL: Record<Thread['kind'], string> = { review: 'Review note', question: 'Question for client', internal: 'Internal note' }

export function ThreadCard({ t, showTarget = true }: { t: Thread; showTarget?: boolean }) {
  const { state, actors, actor, commit, can, say } = useStore()
  const [reply, setReply] = useState('')
  const open = t.status !== 'cleared'
  const tone = t.status === 'cleared' ? 'good' : t.status === 'addressed' ? 'info' : t.blocking ? 'bad' : 'warn'
  const asked = t.kind === 'question'
  const isClient = actor.role === 'client'

  const send = () => {
    const r = commit([{ type: 'thread.reply', data: { threadId: t.id, text: reply } }])
    if (!r.ok) return say(r.error ?? 'Could not post')
    setReply('')
  }
  const setStatus = (status: Thread['status']) => {
    const r = commit([{ type: 'thread.status', data: { threadId: t.id, status } }])
    if (!r.ok) say(r.error ?? 'Not allowed')
  }

  return (
    <div className="card" style={{ padding: '10px 12px' }}>
      <div className="row spread wrap">
        <div className="row wrap">
          <Pill tone={tone}>{t.status === 'cleared' ? 'Cleared' : t.status === 'addressed' ? 'Addressed' : 'Open'}</Pill>
          <strong>{KIND_LABEL[t.kind]}</strong>
          {t.blocking && open && !asked && <Pill tone="bad">Blocks filing</Pill>}
          {asked && t.answeredBy && <Pill tone="good">Answered: kept as evidence</Pill>}
        </div>
        <span className="muted small">{when(t.openedAt)}</span>
      </div>
      {showTarget && <div style={{ margin: '6px 0' }}><RefChip r={t.target} /></div>}
      <div style={{ margin: '6px 0' }}>
        {t.messages.map((m, i) => (
          <p key={i} style={{ marginBottom: 6 }}>
            <strong>{who(actors, m.by)}</strong> <span className="muted small">{when(m.at)}</span><br />
            {m.text}
          </p>
        ))}
      </div>
      {open && (
        <>
          <div className="row">
            <input type="text" value={reply} onChange={(e) => setReply(e.target.value)} placeholder={isClient ? 'Type your answer…' : 'Reply…'} onKeyDown={(e) => e.key === 'Enter' && reply.trim() && send()} />
            <button className="btn" disabled={!reply.trim()} onClick={send}>Send</button>
          </div>
          {!isClient && (
            <div className="row" style={{ marginTop: 8 }}>
              {t.status === 'open' && can('note.address') && <button className="btn small" onClick={() => setStatus('addressed')}>Mark addressed</button>}
              {can('note.clear') && <button className="btn small primary" onClick={() => setStatus('cleared')} title={state.standards.selfReviewBlocked && t.opener === actor.id ? '' : ''}>Clear</button>}
              {asked && can('question.ask') && t.answeredBy && <button className="btn small" onClick={() => setStatus('cleared')}>Accept the answer</button>}
            </div>
          )}
        </>
      )}
    </div>
  )
}
