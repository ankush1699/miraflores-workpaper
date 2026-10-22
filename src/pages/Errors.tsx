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
        MiraFlores warned that the data contains confident mistakes. These are the ones the app’s own checks found by re-reading the documents, with how much each one changes and how the app caught it. The tax software’s own warnings caught none of them.
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
      <p className="small"><strong>The idea:</strong> don’t store the numbers, store what happened to them. Every action (a fix, an approval, a question, a signature) is saved with who did it and why. History, undo, comparing versions, signatures that reopen, and the locked copy at filing all come from that one record.</p>
      <p className="small"><strong>The checks:</strong> 30 checks re-read the documents and recalculate, instead of trusting the tax software. They found 22 real mistakes it missed.</p>
      <p className="small"><strong>The technology:</strong> React and TypeScript; the browser’s own database (IndexedDB) to save work, so there’s no server or login; 16 automated tests that run the checks on the real data; hosted on GitHub Pages.</p>
      <p className="small"><strong>AI:</strong> I used Claude Code as an AI coding assistant to write the code faster. The design and product decisions are mine. Tax effects are estimates using the tax software’s own rates, because the software can’t be re-run.</p>
      <p className="small">More detail: the one-page summary and the full list of mistakes are in the GitHub repository (docs/ONE_PAGER.md and docs/ERRORS.md).</p>
    </section>
  )
}
