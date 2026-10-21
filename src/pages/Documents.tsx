import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { usd } from '../checks/helpers'
import { dispositionOf, type Disposition } from '../checks/review'
import { useStore } from '../store/Store'
import { Pill, RefChip, day, who } from '../ui/Common'
import { DocPage, SimulatedNote } from '../ui/DocViewer'
import { PageHeader } from '../ui/Shell'
import { EvidenceActions, HistoryPanel } from '../ui/TraceParts'
import { useUi } from '../ui/Ui'

function DispositionPill({ d, recorded }: { d: Disposition; recorded?: boolean }) {
  switch (d.kind) {
    case 'landed': return <Pill tone="good">Used on {d.lines.length} line{d.lines.length === 1 ? '' : 's'}</Pill>
    case 'superseded': return <Pill tone="info">Replaced by {d.by}</Pill>
    case 'duplicate': return <Pill tone="info">Copy of {d.of}</Pill>
    case 'reference': return <Pill>Background only</Pill>
    case 'after_current_run': return <Pill tone="warn">Arrived after the last calculation</Pill>
    case 'not_landed': return recorded ? <Pill tone="good">Checked by a person</Pill> : <Pill tone="bad">Ignored by the software</Pill>
  }
}

export function DocumentsPage() {
  const { idx, state, actors, commit, can, say } = useStore()
  const [filter, setFilter] = useState<'all' | 'attention' | 'partial'>('all')
  const [q, setQ] = useState('')
  const rows = useMemo(() => idx.docList.map((d) => ({ d, disp: dispositionOf(idx, d.id) })), [idx])
  const uploads = state.attachments.filter((a) => a.target === 'doc:client-upload')
  const needs = rows.filter((r) => r.disp.kind === 'not_landed' && !state.docDispositions[r.d.id])
  const shown = rows.filter((r) => {
    if (q && !`${r.d.id} ${r.d.title} ${r.d.issuer}`.toLowerCase().includes(q.toLowerCase())) return false
    if (filter === 'attention') return (r.disp.kind === 'not_landed' && !state.docDispositions[r.d.id]) || r.disp.kind === 'after_current_run'
    if (filter === 'partial') return r.d.extraction.status !== 'extracted'
    return true
  })
  const record = (docId: string, decision: string) => {
    const note = window.prompt('What did you conclude about this document?') ?? ''
    if (!note.trim()) return
    const r = commit([{ type: 'doc.disposition', data: { docId, decision, note } }])
    if (!r.ok) say(r.error ?? 'Not allowed')
  }

  return (
    <div className="page stack">
      <PageHeader title="Documents">
        The family’s {idx.docList.length} documents, and where each one was used on the return. Watch for <strong>“Ignored by the software”</strong>: the tax software says it read these, but nothing from them reached the return. Click a document to read it.
      </PageHeader>
      <div className="row wrap">
        {([['all', 'All'], ['attention', `Needs a person (${needs.length})`], ['partial', 'Not fully read']] as const).map(([k, l]) => <button key={k} className={`btn small ${filter === k ? 'primary' : ''}`} onClick={() => setFilter(k)}>{l}</button>)}
        <input type="text" placeholder="Filter by name or issuer" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 260 }} />
      </div>
      {uploads.length > 0 && (
        <section className="card">
          <h2>Sent by the client through the portal</h2>
          <table className="tbl"><tbody>
            {uploads.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td><td className="small">{who(actors, u.by)}, {day(u.at)}</td>
                <td>{u.dataUrl ? <a href={u.dataUrl} download={u.name}>Download</a> : u.text}</td>
              </tr>
            ))}
          </tbody></table>
          <p className="small muted">New documents go through extraction before they reach the numbers; attach one to the line it supports from that line's evidence panel.</p>
        </section>
      )}
      <div className="scroll" style={{ maxHeight: 'none' }}>
        <table className="tbl">
          <thead><tr><th>Doc</th><th>Title</th><th>For</th><th>Received</th><th className="num">Pages</th><th>Read by the software</th><th>Where it was used</th></tr></thead>
          <tbody>
            {shown.map(({ d, disp }) => (
              <tr key={d.id}>
                <td><Link to={`/documents/${d.id}`} className="mono">{d.id}</Link></td>
                <td>{d.title}<div className="muted small">{d.issuer}{d.marked_corrected ? ' · CORRECTED copy' : ''}</div></td>
                <td className="small">{d.belongs_to}</td>
                <td className="small">{day(d.received_at)}<div className="muted">{d.uploaded_by}</div></td>
                <td className="num">{d.page_count}</td>
                <td><Pill tone={d.extraction.status === 'extracted' ? 'good' : d.extraction.status === 'partial' ? 'warn' : undefined}>{d.extraction.status.replace('_', ' ')}</Pill>{d.extraction.values ? <span className="muted small"> {d.extraction.values} values</span> : null}</td>
                <td>
                  <DispositionPill d={disp} recorded={!!state.docDispositions[d.id]} />
                  {disp.kind === 'not_landed' && !state.docDispositions[d.id] && can('finding.decide') && (
                    <div style={{ marginTop: 4 }}><button className="btn small" onClick={() => record(d.id, 'no_action')}>Record decision</button></div>
                  )}
                  {state.docDispositions[d.id] && <div className="small muted">“{state.docDispositions[d.id].note}”</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function DocumentPage() {
  const { id = '' } = useParams()
  const [sp, setSp] = useSearchParams()
  const { idx, state, actors } = useStore()
  const { openTrace } = useUi()
  const doc = idx.docs.get(id)
  const [selected, setSelected] = useState<string | undefined>()
  if (!doc) return <div className="page"><PageHeader title="Document not found" /></div>
  const page = Math.min(doc.page_count, Math.max(1, Number(sp.get('page')) || 1))
  const evs = (idx.evsByDoc.get(id) ?? []).filter((e) => e.page === page)
  const disp = dispositionOf(idx, id)
  const landing = idx.docLanding.get(id) ?? []
  const unused = (idx.evsByDoc.get(id) ?? []).filter((e) => !(idx.linesByEv.get(e.id)?.length))
  const recorded = state.docDispositions[id]
  const pages = doc.pages.filter((p) => !/no further transactions/.test(p.printed_content))

  return (
    <div className="page stack">
      <PageHeader title={`${doc.id} · ${doc.title}`}>
        {doc.issuer} · for {doc.belongs_to} · received {day(doc.received_at)} from the {doc.uploaded_by} · {doc.file_name}
      </PageHeader>
      <div className="row wrap">
        <DispositionPill d={disp} recorded={!!recorded} />
        <Pill tone={doc.extraction.status === 'extracted' ? 'good' : 'warn'}>{doc.extraction.status.replace('_', ' ')}</Pill>
        {doc.marked_corrected && <Pill tone="warn">Marked CORRECTED by the issuer</Pill>}
        <SimulatedNote />
      </div>
      {doc.extraction.reason && <div className="alert warn">{doc.extraction.reason}</div>}
      {disp.kind === 'superseded' && <div className="alert info">Replaced by {disp.by}. Its numbers are in the file for history but not in the return.</div>}
      {disp.kind === 'not_landed' && <div className="alert bad">The tax software says it used this document, but nothing from it reached the return. Look at the values below and decide whether something was missed.{recorded && <> Decision by {who(actors, recorded.by)}: “{recorded.note}”.</>}</div>}
      {disp.kind === 'after_current_run' && <div className="alert warn">{disp.why}</div>}

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1.35fr) minmax(0,1fr)' }}>
        <div className="stack">
          <div className="row spread">
            <div className="row wrap">
              {doc.pages.length > 1 && pages.map((p) => <button key={p.page} className={`btn small ${p.page === page ? 'primary' : ''}`} onClick={() => setSp({ page: String(p.page) })}>p{p.page}</button>)}
              {doc.page_count > pages.length && <span className="muted small">{doc.page_count - pages.length} blank continuation pages hidden</span>}
            </div>
          </div>
          <DocPage docId={id} page={page} selectedEv={selected} />
        </div>
        <div className="stack">
          <section className="card">
            <h2>Values on page {page}</h2>
            {evs.length === 0 ? <p className="muted small">Nothing was extracted from this page.</p> : (
              <table className="tbl"><tbody>
                {evs.map((e) => {
                  const ls = idx.linesByEv.get(e.id) ?? []
                  return (
                    <tr key={e.id} onMouseEnter={() => setSelected(e.id)} onClick={() => openTrace(`ev:${e.id}`)} style={{ cursor: 'pointer' }}>
                      <td>{e.label}<div className="muted small">{e.field}</div></td>
                      <td className="num">{typeof e.value === 'number' ? usd(e.value, true) : String(e.value ?? '—')}<div>{e.confidence < 0.8 && <Pill tone="bad">{e.confidence}</Pill>}</div></td>
                      <td className="small">{ls.length ? ls.slice(0, 2).map((l) => l.key).join(', ') + (ls.length > 2 ? ` +${ls.length - 2}` : '') : <span className="muted">not used</span>}</td>
                    </tr>
                  )
                })}
              </tbody></table>
            )}
          </section>
          <section className="card">
            <h2>Where it was used on the return</h2>
            {landing.length === 0 ? <p className="muted small">No return line reads this document.</p> : (
              <div className="row wrap">{landing.map((l) => <RefChip key={l.key} r={`line:${l.key}`} />)}</div>
            )}
            {unused.length > 0 && landing.length > 0 && <p className="small muted" style={{ marginTop: 8 }}>{unused.length} of its {(idx.evsByDoc.get(id) ?? []).length} extracted values reached nothing.</p>}
          </section>
          <section className="card">
            <h2>Record against this document</h2>
            <div className="stack"><EvidenceActions target={`doc:${id}`} /><HistoryPanel target={`doc:${id}`} /></div>
          </section>
        </div>
      </div>
    </div>
  )
}
