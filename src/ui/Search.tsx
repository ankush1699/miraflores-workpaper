import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { areaLabel, areaOfLine } from '../packet'
import { useStore } from '../store/Store'
import { useUi } from './Ui'

interface Hit { kind: string; title: string; sub: string; go: () => void }

/** Search across documents, extracted values, return lines, findings, notes and the client's own words. */
export function SearchPalette() {
  const { palette, setPalette, openTrace } = useUi()
  const { idx, findings, state } = useStore()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => { if (palette) { setQ(''); setSel(0); setTimeout(() => input.current?.focus(), 20) } }, [palette])

  // A flat list of searchable things, built once.
  const corpus = useMemo(() => {
    const c: { hay: string; hit: Hit }[] = []
    const close = () => setPalette(false)
    for (const d of idx.docList) {
      const text = d.pages.map((p) => p.printed_content).join(' ')
      c.push({ hay: `${d.id} ${d.title} ${d.issuer} ${text}`.toLowerCase(), hit: { kind: 'Document', title: `${d.id} · ${d.title}`, sub: d.issuer, go: () => { close(); navigate(`/documents/${d.id}`) } } })
    }
    for (const l of idx.current.lines) {
      if (l.form === 'F8949' && !/total/.test(l.line)) continue
      c.push({ hay: `${l.key} ${l.label} ${l.value}`.toLowerCase(), hit: { kind: 'Line', title: `${l.key} · ${l.label}`, sub: areaLabel(areaOfLine(l.key)), go: () => { close(); openTrace(`line:${l.key}`) } } })
    }
    for (const f of findings) {
      c.push({ hay: `${f.title} ${f.detail}`.toLowerCase(), hit: { kind: 'Finding', title: f.title, sub: areaLabel(f.area), go: () => { close(); navigate('/issues') } } })
    }
    for (const qa of idx.packet.client.questionnaire) c.push({ hay: `${qa.question} ${qa.answer}`.toLowerCase(), hit: { kind: 'Client answer', title: qa.question, sub: qa.answer, go: () => { close(); openTrace(`qa:${qa.id}`) } } })
    for (const m of idx.packet.client.messages) c.push({ hay: m.text.toLowerCase(), hit: { kind: 'Client message', title: m.text.slice(0, 90), sub: m.from, go: () => { close(); openTrace(`msg:${m.id}`) } } })
    return c
  }, [idx, findings, navigate, openTrace, setPalette])

  const noteHits = useMemo(() => state.threads.map((t) => ({ hay: t.messages.map((m) => m.text).join(' ').toLowerCase(), hit: { kind: 'Note', title: t.messages[0].text.slice(0, 90), sub: t.target, go: () => { setPalette(false); navigate('/people') } } as Hit })), [state.threads, navigate, setPalette])

  const results = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (term.length < 2) return []
    const words = term.split(/\s+/)
    return [...corpus, ...noteHits].filter((c) => words.every((w) => c.hay.includes(w))).slice(0, 40).map((c) => c.hit)
  }, [q, corpus, noteHits])

  if (!palette) return null
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') setPalette(false)
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, results.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)) }
    if (e.key === 'Enter' && results[sel]) results[sel].go()
  }
  return (
    <div className="modal palette" onClick={() => setPalette(false)}>
      <div className="box" onClick={(e) => e.stopPropagation()} onKeyDown={onKey}>
        <input ref={input} type="text" value={q} onChange={(e) => { setQ(e.target.value); setSel(0) }} placeholder="Search: “Spotify”, “3,050”, “HVAC”, “D17”…" />
        <div style={{ marginTop: 8, maxHeight: '55vh', overflow: 'auto' }}>
          {q.trim().length >= 2 && results.length === 0 && <div className="muted" style={{ padding: 10 }}>Nothing matches.</div>}
          {results.map((r, i) => (
            <div key={i} className={`result ${i === sel ? 'on' : ''}`} onClick={r.go}>
              <div><span className="pill info" style={{ marginRight: 6 }}>{r.kind}</span>{r.title}</div>
              <div className="muted small" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
