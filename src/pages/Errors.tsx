import { useMemo } from 'react'
import { findingStatus } from '../domain/derived'
import { findingEffect } from '../domain/recon'
import { areaLabel } from '../packet'
import { useStore } from '../store/Store'
import { EffectText, Pill, RefList, StatusPill } from '../ui/Common'
import { PageHeader } from '../ui/Shell'

/** The "errors we found" write-up, generated from the same findings the workpaper acts on. */
export function ErrorsPage() {
  const { findings, idx, state } = useStore()
  const real = useMemo(() => findings.filter((f) => f.severity !== 'info' && f.kind !== 'outside_scope' && f.kind !== 'judgment'), [findings])
  const outside = findings.filter((f) => f.kind === 'outside_scope')
  const judgments = findings.filter((f) => f.kind === 'judgment')

  const markdown = useMemo(() => {
    const lines = ['# Errors found in the Okafor-Lindqvist packet', '']
    real.forEach((f, i) => {
      const e = findingEffect(idx, f)
      lines.push(`## ${i + 1}. ${f.title}`, '', f.detail, '', `- Area: ${areaLabel(f.area)}`, `- Kind: ${f.kind.replace('_', ' ')}`,
        `- Estimated effect on amount owed: federal ${e.federalBalance >= 0 ? '+' : ''}${e.federalBalance}, California ${e.californiaBalance >= 0 ? '+' : ''}${e.californiaBalance}`,
        `- How the workpaper surfaced it: ${f.surfacedBy}`, `- Evidence: ${f.refs.join(', ')}`, '')
    })
    return lines.join('\n')
  }, [real, idx])

  const download = () => {
    const url = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown' }))
    const a = document.createElement('a')
    a.href = url; a.download = 'errors-found.md'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="page stack">
      <PageHeader title="Errors we found">
        The packet says it contains confident mistakes. These are the ones the workpaper's own checks found by recomputing from the printed documents, with the figure each moves and the feature of the design that exposed it. The engine raised none of the engine errors itself.
      </PageHeader>
      <div className="row spread">
        <span className="muted small">{real.length} errors and checks · {outside.length} items outside the engagement · {judgments.length} judgment calls</span>
        <button className="btn" onClick={download}>Download as Markdown</button>
      </div>

      {real.map((f, i) => {
        const e = findingEffect(idx, f)
        return (
          <article key={f.id} className={`card finding ${f.severity}`}>
            <div className="row spread wrap">
              <div className="row wrap"><strong>{i + 1}.</strong><Pill>{areaLabel(f.area)}</Pill><Pill tone={f.kind === 'engine_error' ? 'bad' : f.kind === 'extraction_error' ? 'warn' : 'info'}>{f.kind.replace('_', ' ')}</Pill><StatusPill status={findingStatus(f, state)} /></div>
              {f.fix && <span className="small">Federal <EffectText n={e.federalBalance} /> · California <EffectText n={e.californiaBalance} /></span>}
            </div>
            <h3 style={{ margin: '6px 0 4px', fontSize: 15 }}>{f.title}</h3>
            <p className="small">{f.detail}</p>
            <p className="small muted"><strong>How the design surfaced it:</strong> {f.surfacedBy}</p>
            <RefList refs={f.refs} />
          </article>
        )
      })}

      <section className="card">
        <h2>Outside this engagement, but someone has to say it</h2>
        <ul className="small" style={{ paddingLeft: 18 }}>{outside.map((f) => <li key={f.id}><strong>{f.title}.</strong> {f.detail.split('. ')[0]}.</li>)}</ul>
      </section>
      <About />
    </div>
  )
}

function About() {
  return (
    <section className="card">
      <h2>How this was built</h2>
      <p className="small">Built with Claude Code as a pair: it read the packet and the 74 documents, wrote the independent checks and the app, and ran the checks against the real data in tests. The design decisions, the tax reasoning behind each finding and the choice of what to leave out were reviewed by a person. All figures here come from the packet; tax effects use the engine's own per-dollar rates because the engine cannot be rerun.</p>
      <h3 style={{ margin: '10px 0 4px' }}>Core idea</h3>
      <p className="small">A workpaper is an evidence graph with an append-only history. Every number points to its inputs and its source location; the engine's numbers are never overwritten; every change, note, verification and signature is an event with a person and a reason; and sign-offs store what they covered, so they reopen when it changes.</p>
      <h3 style={{ margin: '10px 0 4px' }}>Data model</h3>
      <ul className="small" style={{ paddingLeft: 18 }}>
        <li><strong>Packet</strong> (read-only): documents, extracted values, three engine runs, client records, prior years, agency records, timeline.</li>
        <li><strong>Reference</strong>: a short address for anything evidence can point at: <code>line:SchC.1</code>, <code>ev:ev-0103</code>, <code>doc:D15#page3</code>, <code>qa:qa-14</code>, <code>py:/return_2024/lines/…</code>. A real scanned document would be addressed the same way.</li>
        <li><strong>Event</strong> (the only thing saved): who, when, type, data. State is rebuilt by replaying events, which gives history, time travel between versions, undo, and a frozen copy at filing for free.</li>
        <li><strong>Adjustment</strong>: target, change, tax effect, reason, authority, status; sits on top of an engine line.</li>
        <li><strong>Finding</strong>: produced by an independent check from source documents; carries evidence, an estimated effect and a proposed fix.</li>
        <li><strong>Verification, thread, sign-off, judgment, attachment, link</strong>: all keyed by reference; a sign-off holds the set of approved adjustments it covered.</li>
      </ul>
    </section>
  )
}
