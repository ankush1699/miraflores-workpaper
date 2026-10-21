import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usd } from '../checks/helpers'
import { adjustedLine, findingStatus } from '../domain/derived'
import { areaLabel, areaOfLine, type PacketIndex } from '../packet'
import { pointer, resolveRef, splitRef } from '../domain/refs'
import type { ExtractedValue, ReturnLine } from '../packet/types'
import { useStore } from '../store/Store'
import { Pill, RefChip, SeverityPill, StatusPill, day } from './Common'
import { DocPage, SimulatedNote } from './DocViewer'
import { EvidenceActions, HistoryPanel } from './TraceParts'
import { useUi } from './Ui'

export function TraceDrawer() {
  const { trace, closeTrace } = useUi()
  const navigate = useNavigate()
  const { kind, id, page } = trace ? splitRef(trace) : { kind: '', id: '', page: undefined }

  // A document is a page of its own, not a drawer.
  useEffect(() => {
    if (trace && kind === 'doc') {
      navigate(`/documents/${id}${page ? `?page=${page}` : ''}`)
      closeTrace()
    }
  }, [trace, kind, id, page, navigate, closeTrace])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeTrace()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closeTrace])

  if (!trace || kind === 'doc') return null
  return (
    <>
      <div className="scrim" onClick={closeTrace} />
      <aside className="drawer" role="dialog" aria-label="Evidence">
        {kind === 'line' && <LineTrace lineKey={id} />}
        {kind === 'ev' && <ValueTrace evId={id} />}
        {kind !== 'line' && kind !== 'ev' && <OtherTrace r={trace} />}
      </aside>
    </>
  )
}

function DrawerHeader({ kicker, title, right, tabs, tab, setTab }: {
  kicker: string; title: string; right?: React.ReactNode
  tabs?: { id: string; label: string; badge?: number }[]; tab?: string; setTab?: (t: string) => void
}) {
  const { closeTrace } = useUi()
  return (
    <header>
      <div className="row spread">
        <span className="muted small" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 650 }}>{kicker}</span>
        <button className="btn small" onClick={closeTrace}>Close ✕</button>
      </div>
      <div className="row spread" style={{ alignItems: 'flex-start', marginTop: 4 }}>
        <h2 style={{ fontSize: 17 }}>{title}</h2>
        {right}
      </div>
      {tabs && (
        <div className="tabs">
          {tabs.map((t) => (
            <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab?.(t.id)}>
              {t.label}{t.badge ? <span className="badge">{t.badge}</span> : null}
            </button>
          ))}
        </div>
      )}
    </header>
  )
}

/* ------------------------------------------------------------------ a line */

function LineTrace({ lineKey }: { lineKey: string }) {
  const { idx, state, findings, can } = useStore()
  const { openAdjust, findingsByRef } = useUi()
  const [tab, setTab] = useState('source')
  const line = idx.lineMaps.get(idx.current.version)?.get(lineKey)
  const ref = `line:${lineKey}`
  useEffect(() => setTab('source'), [lineKey])
  if (!line) return <div className="body">Line {lineKey} is not in the current return.</div>

  const adj = adjustedLine(state, line)
  const fs = (findingsByRef.get(ref) ?? [])
  const history =
    state.adjustments.filter((a) => a.target === ref).length + state.verifications.filter((v) => v.target === ref).length +
    state.threads.filter((t) => t.target === ref).length + state.attachments.filter((a) => a.target === ref).length
  void findings

  return (
    <>
      <DrawerHeader
        kicker={`Where this number comes from · ${line.jurisdiction === 'california' ? 'California' : 'Federal'} · ${areaLabel(areaOfLine(line.key))}`}
        title={line.label}
        right={typeof line.value === 'number' ? (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 20, fontWeight: 650 }} className="num">{usd(adj.value as number, Math.abs(line.value) < 1000 && line.value % 1 !== 0)}</div>
            {adj.delta !== 0 && <div className="muted small">engine: {usd(line.value, true)}</div>}
          </div>
        ) : <strong>{String(line.value)}</strong>}
        tabs={[
          { id: 'source', label: 'Source document' }, { id: 'calc', label: 'How it’s calculated' },
          { id: 'history', label: 'History & actions', badge: history }, { id: 'related', label: 'Related' },
        ]} tab={tab} setTab={setTab}
      />
      <div className="body">
        <div className="row wrap" style={{ marginBottom: 12 }}>
          <span className="code" title="Form and line on the tax return">{line.key}</span>
          {fs.filter((f) => f.severity !== 'info').map((f) => <span key={f.id} className="row"><SeverityPill severity={f.severity} /><StatusPill status={findingStatus(f, state)} /></span>)}
          <span style={{ flex: 1 }} />
          {typeof line.value === 'number' && can('adjust.propose') && <button className="btn small primary" onClick={() => openAdjust({ kind: 'line', lineKey })}>Adjust this number</button>}
        </div>
        {fs.length > 0 && fs.filter((f) => f.severity !== 'info').map((f) => (
          <div key={f.id} className={`alert ${f.severity === 'error' ? 'bad' : 'warn'}`} style={{ marginBottom: 10 }}>
            <strong>{f.title}</strong>
            <div className="small" style={{ marginTop: 4 }}>{f.detail}</div>
            {f.fix && findingStatus(f, state) === 'open' && can('adjust.propose') && <button className="btn small primary" style={{ marginTop: 6 }} onClick={() => openAdjust({ kind: 'finding', finding: f })}>Fix it</button>}
          </div>
        ))}
        {tab === 'source' && <SourceTab line={line} />}
        {tab === 'calc' && <CalcTab line={line} />}
        {tab === 'history' && <div className="stack"><EvidenceActions target={ref} /><HistoryPanel target={ref} /></div>}
        {tab === 'related' && <RelatedTab line={line} />}
      </div>
    </>
  )
}

function SourceTab({ line }: { line: ReturnLine }) {
  const { idx } = useStore()
  const evSources = line.sources.filter((s) => s.startsWith('ev-')).map((s) => idx.evs.get(s)).filter(Boolean) as ExtractedValue[]
  const groups = useMemo(() => {
    const m = new Map<string, ExtractedValue[]>()
    for (const e of evSources) {
      const k = `${e.document_id}|${e.page}`
      m.set(k, [...(m.get(k) ?? []), e])
    }
    return [...m.entries()]
  }, [evSources])
  const others = line.sources.filter((s) => !s.startsWith('ev-'))

  return (
    <div className="stack">
      {line.note && <div className="alert info small">{line.note}</div>}
      {!line.sources.length && <div className="muted">This number is calculated from other numbers, not read from a document. See “How it’s calculated”.</div>}
      {groups.map(([key, evs]) => {
        const [docId, page] = key.split('|')
        const doc = idx.docs.get(docId)!
        return (
          <div key={key}>
            <div className="row spread" style={{ marginBottom: 6 }}>
              <div><strong>{docId}</strong> · {doc.title} <span className="muted">· page {page}</span></div>
              <SimulatedNote />
            </div>
            <DocPage docId={docId} page={Number(page)} selectedEv={evs[0].id} onlyEv={evs.map((e) => e.id)} />
            <table className="tbl" style={{ marginTop: 8 }}>
              <tbody>
                {evs.map((e) => (
                  <tr key={e.id}>
                    <td><RefChip r={`ev:${e.id}`} /></td>
                    <td>{e.label}<div className="muted small">box/field: {e.field}</div></td>
                    <td className="num">{typeof e.value === 'number' ? usd(e.value, true) : String(e.value ?? '—')}</td>
                    <td className="num"><Pill tone={e.confidence < 0.8 ? 'bad' : 'good'}>{Math.round(e.confidence * 100)}%</Pill></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="row" style={{ marginTop: 6 }}>
              <RefChip r={`doc:${docId}#page${page}`} />
            </div>
          </div>
        )
      })}
      {others.map((s) => <OtherSource key={s} r={s} idx={idx} />)}
    </div>
  )
}

/** A source that is not a document value: a client answer, a prior-year figure, an engine parameter… */
function OtherSource({ r, idx }: { r: string; idx: PacketIndex }) {
  const res = resolveRef(idx, r.startsWith('qa-') ? `qa:${r}` : r.startsWith('msg-') ? `msg:${r}` : r.startsWith('asset:') ? r : r)
  const { id } = splitRef(r)
  const special = r.startsWith('ref:param.') ? idx.param(r.slice('ref:param.'.length)) : r.startsWith('ref:fx.SEK.') ? (idx.param('fx') as any).SEK[r.slice('ref:fx.SEK.'.length)] : undefined
  return (
    <div className="card" style={{ padding: '9px 12px' }}>
      <div className="row spread"><strong>{res.kind}</strong><RefChip r={r.startsWith('qa-') ? `qa:${r}` : r.startsWith('msg-') ? `msg:${r}` : r} /></div>
      <div className="small">{res.title}</div>
      {res.detail && <div className="small muted">“{res.detail}”</div>}
      {special !== undefined && <div className="small">Value used: <strong>{typeof special === 'object' ? JSON.stringify(special) : String(special)}</strong></div>}
      {r.startsWith('asset:') && <AssetCard id={id} />}
    </div>
  )
}

function AssetCard({ id }: { id: string }) {
  const { idx } = useStore()
  const a = idx.current.assets.find((x) => x.asset_id === id)
  if (!a) return null
  return (
    <div className="small">{a.description}: cost {usd(a.cost)}, {a.method}, {a.life_years} yrs. 2025 depreciation: federal {usd(a.federal.depreciation_2025, true)}, California {usd(a.california.depreciation_2025, true)}.</div>
  )
}

function CalcTab({ line }: { line: ReturnLine }) {
  const { idx } = useStore()
  const { openTrace } = useUi()
  const rule = idx.packet.engine_reference.rules[line.rule]
  const flows = idx.usedBy.get(line.key) ?? []
  return (
    <div className="stack">
      <div className="card" style={{ padding: '9px 12px' }}>
        <strong>The tax software’s rule</strong> <span className="code">{line.rule}</span>
        <div className="small">{rule ?? 'No description given.'}</div>
      </div>
      {line.inputs.length > 0 ? (
        <div>
          <h3 style={{ marginBottom: 6 }}>Made up of</h3>
          <div className="tree"><ul><Node line={line} depth={0} open /></ul></div>
        </div>
      ) : <div className="muted">Nothing else adds into this number; it is read straight from the documents.</div>}
      {flows.length > 0 && (
        <div>
          <h3 style={{ marginBottom: 6 }}>This number feeds into</h3>
          <div className="row wrap">{flows.slice(0, 12).map((l) => <button key={l.key} className="chip" onClick={() => openTrace(`line:${l.key}`)}><span className="k">{l.key}</span><span className="t">{l.label}</span></button>)}</div>
        </div>
      )}
    </div>
  )
}

function Node({ line, depth, open: startOpen }: { line: ReturnLine; depth: number; open?: boolean }) {
  const { idx, state } = useStore()
  const { openTrace } = useUi()
  const [open, setOpen] = useState(!!startOpen)
  const kids = line.inputs.map((k) => idx.lineMaps.get(idx.current.version)?.get(k)).filter(Boolean) as ReturnLine[]
  const v = adjustedLine(state, line)
  return (
    <li>
      <div className="node">
        <span className="toggle" onClick={() => kids.length && setOpen(!open)}>{kids.length ? (open ? '▾' : '▸') : '•'}</span>
        <span className="grow"><a href="#" onClick={(e) => { e.preventDefault(); depth > 0 && openTrace(`line:${line.key}`) }}>{line.label}</a> <span className="muted mono">{line.key}</span></span>
        <span className="num">{typeof v.value === 'number' ? usd(v.value, v.value % 1 !== 0 && Math.abs(v.value) < 1000) : String(v.value)}</span>
      </div>
      {open && kids.length > 0 && depth < 7 && <ul>{kids.map((k) => <Node key={k.key} line={k} depth={depth + 1} />)}</ul>}
    </li>
  )
}

function RelatedTab({ line }: { line: ReturnLine }) {
  const { idx, state } = useStore()
  const { openTrace } = useUi()
  const prior = idx.packet.prior_years.return_2024
  const priorKey = Object.keys(prior.lines).find((k) => k === line.key) ?? (({ 'F540NR.13': 'CA540.13', 'F540NR.17': 'CA540.17', 'F540NR.19': 'CA540.19', 'F540NR.64': 'CA540.64' } as Record<string, string>)[line.key])
  const links = state.links.filter((l) => l.from === `line:${line.key}` || l.to === `line:${line.key}`)
  const sameDocs = new Set<string>()
  for (const s of line.sources) if (s.startsWith('ev-')) sameDocs.add(idx.evs.get(s)?.document_id ?? '')
  sameDocs.delete('')
  const siblings = new Map<string, ReturnLine[]>()
  for (const d of sameDocs) siblings.set(d, (idx.docLanding.get(d) ?? []).filter((l) => l.key !== line.key))
  return (
    <div className="stack">
      <div>
        <h3 style={{ marginBottom: 6 }}>In each of the tax software’s three calculations</h3>
        <table className="tbl"><tbody>
          {idx.versions.map((v) => {
            const l = idx.lineMaps.get(v.version)?.get(line.key)
            const ch = v.changes_from_previous.find((c) => c.key === line.key)
            return <tr key={v.version}><td>{v.version} <span className="muted small">{day(v.computed_at)}</span></td><td className="num">{l ? (typeof l.value === 'number' ? usd(l.value, true) : String(l.value)) : '—'}</td><td>{ch ? <Pill tone="warn">{ch.change}</Pill> : ''}</td></tr>
          })}
        </tbody></table>
      </div>
      {priorKey && (
        <div>
          <h3 style={{ marginBottom: 6 }}>Last year</h3>
          <div className="card" style={{ padding: '9px 12px' }}>
            <div className="row spread"><span>{prior.line_labels[priorKey] ?? priorKey} (2024)</span><strong className="num">{typeof prior.lines[priorKey] === 'number' ? usd(prior.lines[priorKey] as number) : String(prior.lines[priorKey])}</strong></div>
            <RefChip r={`py:/return_2024/lines/${priorKey}`} />
            {prior.notes[priorKey] && <div className="small muted">{prior.notes[priorKey]}</div>}
          </div>
        </div>
      )}
      {[...siblings.entries()].map(([d, ls]) => ls.length > 0 && (
        <div key={d}>
          <h3 style={{ marginBottom: 6 }}>Also fed by {d}</h3>
          <div className="row wrap">{ls.slice(0, 10).map((l) => <button key={l.key} className="chip" onClick={() => openTrace(`line:${l.key}`)}><span className="k">{l.key}</span><span className="t">{l.label}</span></button>)}</div>
        </div>
      ))}
      {links.length > 0 && <div><h3 style={{ marginBottom: 6 }}>Linked by the team</h3>{links.map((l) => <div key={l.id} className="row wrap"><RefChip r={l.from} /> <span className="muted">{l.relation}</span> <RefChip r={l.to} /></div>)}</div>}
    </div>
  )
}

/* ------------------------------------------------------------ one value */

function ValueTrace({ evId }: { evId: string }) {
  const { idx } = useStore()
  const { openTrace } = useUi()
  const [tab, setTab] = useState('source')
  const ev = idx.evs.get(evId)
  if (!ev) return <div className="body">Value {evId} not found.</div>
  const doc = idx.docs.get(ev.document_id)!
  const lines = idx.linesByEv.get(evId) ?? []
  return (
    <>
      <DrawerHeader
        kicker={`Extracted value · ${doc.id} page ${ev.page}`} title={ev.label}
        right={<div style={{ textAlign: 'right' }}><strong className="num" style={{ fontSize: 18 }}>{typeof ev.value === 'number' ? usd(ev.value, true) : String(ev.value ?? '—')}</strong><div><Pill tone={ev.confidence < 0.8 ? 'bad' : 'good'}>confidence {ev.confidence}</Pill></div></div>}
        tabs={[{ id: 'source', label: 'Source' }, { id: 'lands', label: 'Where it landed', badge: lines.length }, { id: 'history', label: 'History' }]} tab={tab} setTab={setTab}
      />
      <div className="body">
        {tab === 'source' && (
          <div className="stack">
            <div className="row spread"><span><strong>{doc.title}</strong></span><SimulatedNote /></div>
            <DocPage docId={doc.id} page={ev.page} selectedEv={ev.id} />
            <div className="small muted">Field “{ev.field}”, read as “{ev.text_as_read || '(blank)'}”. Position is synthetic in this packet; the highlight is placed by matching the text.</div>
            <button className="btn" onClick={() => openTrace(`doc:${doc.id}#page${ev.page}`)}>Open the whole document</button>
          </div>
        )}
        {tab === 'lands' && (
          <div>
            {lines.length === 0 ? <div className="alert warn">Nothing in the return reads this value. It was extracted but never used.</div> : (
              <table className="tbl"><tbody>{lines.map((l) => <tr key={l.key}><td><RefChip r={`line:${l.key}`} /></td><td>{l.label}</td></tr>)}</tbody></table>
            )}
          </div>
        )}
        {tab === 'history' && <div className="stack"><EvidenceActions target={`ev:${ev.id}`} /><HistoryPanel target={`ev:${ev.id}`} /></div>}
      </div>
    </>
  )
}

/* ------------------------------------------------------- everything else */

function OtherTrace({ r }: { r: string }) {
  const { idx } = useStore()
  const { kind, id } = splitRef(r)
  const res = resolveRef(idx, r)
  let data: unknown
  if (kind === 'py') data = pointer(idx.packet.prior_years, id)
  else if (kind === 'agency') data = pointer(idx.packet.tax_agency_records, id)
  else if (kind === 'household') data = idx.packet.household.people.find((p) => p.id === id)
  else if (kind === 'whatif') data = idx.packet.what_if.alternatives.find((w) => w.id === id)
  else if (kind === 'asset') data = idx.current.assets.find((a) => a.asset_id === id) ?? idx.packet.prior_years.asset_records.find((a: any) => a.asset_id === id)
  else if (kind === 'ref') data = id.startsWith('param.') ? idx.param(id.slice(6)) : undefined
  // identifiers are masked here; unmasking is done where the view is logged
  const shown = kind === 'household' && data ? maskPerson(data as Record<string, unknown>) : data
  return (
    <>
      <DrawerHeader kicker={res.kind} title={res.title} />
      <div className="body stack">
        {res.detail && <div className="alert info" style={{ whiteSpace: 'pre-wrap' }}>{res.detail}</div>}
        {shown !== undefined && <pre className="mono card" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{typeof shown === 'object' ? JSON.stringify(shown, null, 2) : String(shown)}</pre>}
        <EvidenceActions target={r} />
        <HistoryPanel target={r} />
      </div>
    </>
  )
}

function maskPerson(p: Record<string, unknown>) {
  return { ...p, ssn: p.ssn ? '•••-••-' + String(p.ssn).slice(-4) : undefined, ip_pin: p.ip_pin ? '••••••' : p.ip_pin }
}
