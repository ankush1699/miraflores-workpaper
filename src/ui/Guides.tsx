import { useEffect, type ReactNode } from 'react'
import { initials, isActive, ROLE_LABEL, type Role } from '../domain/people'
import { useStore } from '../store/Store'
import { day } from './Common'
import { GLOSSARY, ROLE_STORY } from './words'

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="modal" onClick={onClose}>
      <div className="box" style={wide ? { width: 'min(860px, 100%)' } : undefined} onClick={(e) => e.stopPropagation()}>
        <div className="row spread" style={{ marginBottom: 8 }}><h2>{title}</h2><button className="btn small" onClick={onClose}>Close ✕</button></div>
        {children}
      </div>
    </div>
  )
}

/** "Who are you?" Every person in the firm and the family, with what they can and can't do. */
export function RolePicker({ onClose }: { onClose: () => void }) {
  const { actors, actor, setActor, state } = useStore()
  const groups: { title: string; roles: Role[] }[] = [
    { title: 'People at the accounting firm', roles: ['preparer', 'reviewer', 'partner', 'firm_administrator', 'quality_reviewer'] },
    { title: 'The clients (the family)', roles: ['client'] },
  ]
  return (
    <Modal title="Switch person" onClose={onClose} wide>
      <p className="small muted">Each person can do different things, and the app enforces it. Switch to see the same return through their eyes. You can open a second browser tab as someone else to see two people working at once.</p>
      {groups.map((g) => (
        <section key={g.title} style={{ marginTop: 10 }}>
          <h3 style={{ marginBottom: 6 }}>{g.title}</h3>
          <div className="grid cols-2">
            {actors.filter((a) => g.roles.includes(a.role)).map((a) => {
              const story = ROLE_STORY[a.role]
              const active = isActive(a, state.season.asOf)
              return (
                <button key={a.id} className={`card pick ${a.id === actor.id ? 'on' : ''}`} onClick={() => { setActor(a.id); onClose() }}>
                  <div className="row"><span className="avatar">{initials(a.name)}</span><strong>{a.name}</strong><span className="pill">{ROLE_LABEL[a.role]}</span>{a.id === actor.id && <span className="pill good">You</span>}</div>
                  <div className="small" style={{ marginTop: 6 }}>{story.does}</div>
                  <div className="small"><strong>Can:</strong> {story.can}</div>
                  <div className="small muted"><strong>Can’t:</strong> {story.cannot}</div>
                  {!a.clearance && a.role !== 'client' && <div className="small" style={{ color: 'var(--warn)' }}>Sees Social Security and bank numbers masked.</div>}
                  {!active && <div className="small" style={{ color: 'var(--warn)' }}>Not on the job until {day(a.activeFrom)}.</div>}
                </button>
              )
            })}
          </div>
        </section>
      ))}
    </Modal>
  )
}

/** How to use the app, and what the tax words mean. */
export function HelpPanel({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="How this works" onClose={onClose} wide>
      <p>This is an accountant’s <strong>workpaper</strong>: the place where the firm checks and proves a family’s tax return before filing it. The tax software already calculated the return; this app shows where every number came from, finds the software’s mistakes, and records who fixed and approved what.</p>
      <ol style={{ paddingLeft: 20 }}>
        <li><strong>Click any underlined number</strong> to see the document it came from, how it was calculated, and everything done to it.</li>
        <li><strong>Problems</strong> lists what the app’s checks found. Each has a “Fix it” button.</li>
        <li>Fixes wait in <strong>Fixes & approvals</strong> until a reviewer (small ones) or the partner (big ones) approves.</li>
        <li><strong>Switch person</strong> (top right) to act as the reviewer, partner or client. The app enforces what each one is allowed to do.</li>
        <li>Made a mistake? <strong>Undo</strong> takes back your last action. <strong>⋯ → Start over</strong> clears everything.</li>
      </ol>
      <h3 style={{ margin: '12px 0 6px' }}>Colours on numbers</h3>
      <NumberLegend />
      <h3 style={{ margin: '12px 0 6px' }}>Words you will see</h3>
      <table className="tbl"><tbody>
        {GLOSSARY.map(([t, d]) => <tr key={t}><td style={{ width: 190 }}><strong>{t}</strong></td><td className="small">{d}</td></tr>)}
      </tbody></table>
    </Modal>
  )
}

/** The key to how numbers look. Shown wherever numbers are. */
export function NumberLegend() {
  return (
    <div className="legend small">
      <span><span className="n">1,234</span> click to see where it came from</span>
      <span><span className="n adjusted">1,234</span> changed by a fix</span>
      <span><span className="n flagged">1,234</span> has a problem</span>
      <span><i className="stamp" /> checked</span>
      <span><i className="stamp ask" /> asked the client</span>
      <span><i className="stamp adj" /> fix waiting for approval</span>
    </div>
  )
}
