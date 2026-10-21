import { useMemo } from 'react'
import { segmentPage } from '../domain/refs'
import { useStore } from '../store/Store'
import { useUi } from './Ui'

/** Break the printed text into readable lines without changing any character a value could match. */
function layout(text: string): string {
  return text.replace(/; /g, ';\n').replace(/\. (?=[A-Z0-9'(])/g, '.\n')
}

/**
 * One page of a source document. There are no page images in the packet, so this draws the
 * printed text as a sheet and highlights each extracted value on it. The document is addressed
 * by (document, page, field), so a real scan could replace this component without changing
 * any link that points here.
 */
export function DocPage({ docId, page, selectedEv, onlyEv }: { docId: string; page: number; selectedEv?: string; onlyEv?: string[] }) {
  const { idx } = useStore()
  const { openTrace } = useUi()
  const doc = idx.docs.get(docId)
  const pg = doc?.pages.find((p) => p.page === page)
  const evs = useMemo(
    () => (idx.evsByDoc.get(docId) ?? []).filter((e) => e.page === page && (!onlyEv || onlyEv.includes(e.id))),
    [idx, docId, page, onlyEv],
  )
  const text = pg ? layout(pg.printed_content) : ''
  const segs = useMemo(() => segmentPage(text, evs), [text, evs])
  if (!doc || !pg) return <div className="muted">Page not found.</div>
  return (
    <div className="paper">
      <div className="sheet-head">
        <span>{doc.issuer}</span>
        <span>{doc.id} · page {page} of {doc.page_count}</span>
      </div>
      <div style={{ whiteSpace: 'pre-wrap' }}>
        {segs.map((s, i) =>
          s.ev ? (
            <mark
              key={i}
              className={`${s.ev.id === selectedEv ? 'sel' : ''} ${s.ev.confidence < 0.8 ? 'low' : ''}`}
              title={`${s.ev.label}: ${s.ev.id}, confidence ${s.ev.confidence}`}
              onClick={() => openTrace(`ev:${s.ev!.id}`)}
            >{s.text}</mark>
          ) : <span key={i}>{s.text}</span>,
        )}
      </div>
    </div>
  )
}

export function SimulatedNote() {
  return <span className="sim" title="No scans were provided, so the page is drawn from the printed text in the packet.">Simulated from packet text</span>
}
