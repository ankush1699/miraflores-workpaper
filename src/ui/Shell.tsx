import { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, Route, Routes, useLocation, useNavigate, Navigate } from 'react-router-dom'
import { findingStatus, isResolved } from '../domain/derived'
import { notificationsFor } from '../domain/notify'
import { initials, ROLE_LABEL } from '../domain/people'
import { AREAS } from '../packet'
import { AreaPage } from '../pages/Area'
import { ChangesPage } from '../pages/Changes'
import { ClientPage } from '../pages/Client'
import { DocumentPage, DocumentsPage } from '../pages/Documents'
import { ErrorsPage } from '../pages/Errors'
import { FilingPage } from '../pages/Filing'
import { FirmPage } from '../pages/Firm'
import { IssuesPage } from '../pages/Issues'
import { OverviewPage } from '../pages/Overview'
import { PeoplePage } from '../pages/People'
import { SchedulesPage } from '../pages/Schedules'
import { useStore } from '../store/Store'
import { AdjustDialog } from './AdjustDialog'
import { day, who } from './Common'
import { SearchPalette } from './Search'
import { TraceDrawer } from './TraceDrawer'
import { useUi } from './Ui'
import { HelpPanel, RolePicker } from './Guides'

export function Shell() {
  const { actor, toast, reportPage } = useStore()
  const loc = useLocation()
  const navigate = useNavigate()
  const { setPalette } = useUi()

  useEffect(() => { reportPage(loc.pathname) }, [loc.pathname, reportPage])
  // Clients only ever see their own portal.
  useEffect(() => {
    if (actor.role === 'client' && !loc.pathname.startsWith('/client')) navigate('/client', { replace: true })
  }, [actor.role, loc.pathname, navigate])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette(true) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setPalette])

  return (
    <div className="app">
      <Topbar />
      {actor.role === 'client' ? <ClientNav /> : <Sidebar />}
      <main className="main">
        <Routes>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/area/:id" element={<AreaPage />} />
          <Route path="/issues" element={<IssuesPage />} />
          <Route path="/documents" element={<DocumentsPage />} />
          <Route path="/documents/:id" element={<DocumentPage />} />
          <Route path="/changes" element={<ChangesPage />} />
          <Route path="/people" element={<PeoplePage />} />
          <Route path="/filing" element={<FilingPage />} />
          <Route path="/schedules" element={<SchedulesPage />} />
          <Route path="/schedules/:name" element={<SchedulesPage />} />
          <Route path="/firm" element={<FirmPage />} />
          <Route path="/errors" element={<ErrorsPage />} />
          <Route path="/client" element={<ClientPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <TraceDrawer />
      <AdjustDialog />
      <SearchPalette />
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  )
}

function Topbar() {
  const { idx, actors, actor, state, presence, undoLast, canUndo, say, resetDemo, findings, variances } = useStore()
  const navigate = useNavigate()
  const waiting = notificationsFor(actor, { idx, state, findings, variances })
  const { setPalette } = useUi()
  const [picker, setPicker] = useState(false)
  const [help, setHelp] = useState(false)
  const [more, setMore] = useState(false)
  const [theme, setTheme] = useState<string>(() => { try { return localStorage.getItem('mf-theme') ?? 'auto' } catch { return 'auto' } })
  useEffect(() => {
    if (theme === 'auto') document.documentElement.removeAttribute('data-theme')
    else document.documentElement.setAttribute('data-theme', theme)
    try { localStorage.setItem('mf-theme', theme) } catch { /* private window */ }
  }, [theme])
  const others = presence.filter((p) => p.actorId !== actor.id)
  const doUndo = () => { const r = undoLast(); say(r.ok ? 'Undone.' : r.error ?? 'Nothing to undo.') }

  return (
    <header className="topbar">
      <div className="brand"><span className="logo">M</span> Miraflores Workpaper</div>
      <button className="search no-print" onClick={() => setPalette(true)} style={{ border: '1px solid var(--line-strong)' }}>
        <span>⌕</span><span style={{ flex: 1, textAlign: 'left' }}>Search anything…</span><span className="kbd">⌘K</span>
      </button>
      <span style={{ flex: 1 }} />
      {others.length > 0 && (
        <div className="row" style={{ gap: 2 }} title={others.map((p) => `${who(actors, p.actorId)} is also working on this`).join('\n')}>
          {others.map((p) => <span key={p.actorId} className="avatar live">{initials(who(actors, p.actorId))}</span>)}
        </div>
      )}
      <button className="btn role-btn" onClick={() => setPicker(true)} title="Switch to another person to see what they can do">
        <span className="muted small">You are</span> <strong>{actor.name}</strong> <span className="pill">{ROLE_LABEL[actor.role]}</span> ▾
      </button>
      <button className="btn small" onClick={() => navigate(actor.role === 'client' ? '/client' : '/')} title={waiting.map((w) => w.text).join('\n') || 'Nothing waiting for you'}>🔔 {waiting.length}</button>
      <button className="btn small" onClick={doUndo} disabled={!canUndo} title="Undo your last action">↶ Undo</button>
      <button className="btn small" onClick={() => setHelp(true)} title="How this works, and what the words mean">? Help</button>
      <div style={{ position: 'relative' }}>
        <button className="btn small" onClick={() => setMore(!more)} title="More">⋯</button>
        {more && (
          <div className="menu" onMouseLeave={() => setMore(false)}>
            <div className="small muted" style={{ padding: '6px 10px' }} title="The date inside the story. It moves forward when you replay the season on the Filing page.">Story date: {day(state.season.asOf)}</div>
            <button onClick={() => { setTheme(theme === 'dark' ? 'light' : 'dark'); setMore(false) }}>Switch light / dark</button>
            <button onClick={() => { setMore(false); if (window.confirm('Clear everything recorded in this workpaper and start over?')) resetDemo() }}>Start over (clear everything)</button>
          </div>
        )}
      </div>
      {picker && <RolePicker onClose={() => setPicker(false)} />}
      {help && <HelpPanel onClose={() => setHelp(false)} />}
    </header>
  )
}

function Sidebar() {
  const { state, findings, actor } = useStore()
  const loc = useLocation()
  const open = useMemo(() => findings.filter((f) => f.severity !== 'info' && !isResolved(findingStatus(f, state))), [findings, state])
  const byArea = (id: string) => open.filter((f) => f.area === id).length
  const waiting = state.adjustments.filter((a) => a.status === 'proposed').length
  const openThreads = state.threads.filter((t) => t.status !== 'cleared').length
  const [returnOpen, setReturnOpen] = useState<boolean>(() => { try { return localStorage.getItem('mf-nav-return') === '1' } catch { return false } })
  useEffect(() => { if (loc.pathname.startsWith('/area/')) setReturnOpen(true) }, [loc.pathname])
  const toggle = () => { const v = !returnOpen; setReturnOpen(v); try { localStorage.setItem('mf-nav-return', v ? '1' : '0') } catch { /* private window */ } }
  const link = (to: string, icon: string, label: string, hint: string, count?: number, quiet?: boolean) => (
    <NavLink to={to} end={to === '/'} title={hint} className={({ isActive }) => (isActive ? 'active' : '')}>
      <span className="ico">{icon}</span>{label}{count ? <span className={`count ${quiet ? 'quiet' : ''}`}>{count}</span> : null}
    </NavLink>
  )
  void actor
  return (
    <nav className="sidebar nav no-print">
      {link('/', '⌂', 'Home', 'Where things stand and what to do next')}
      {link('/issues', '!', 'Problems', 'What the checks found wrong in the return', open.length)}
      {link('/changes', '✓', 'Fixes & approvals', 'Proposed fixes waiting for approval, and every change made', waiting, true)}
      {link('/documents', '▤', 'Documents', 'The family’s 74 documents and where each one was used')}
      <button className={`nav-group ${returnOpen ? 'open' : ''}`} onClick={toggle} title="The return, topic by topic">
        <span className="ico">≡</span>The return<span className="chev">{returnOpen ? '▾' : '▸'}</span>
      </button>
      {returnOpen && (
        <div className="nav-sub">
          {AREAS.map((a) => <span key={a.id}>{link(`/area/${a.id}`, '', a.label, a.hint, byArea(a.id))}</span>)}
        </div>
      )}
      {link('/people', '✎', 'Notes & sign-offs', 'Review notes, client questions and signatures', openThreads, true)}
      {link('/filing', '➜', 'Filing', 'Checklist, e-file, and everything after filing')}
      {link('/schedules', '▦', 'Reports', 'The standard reports an accountant expects')}
      {link('/firm', '⚙', 'Settings & security', 'Firm rules, sensitive data log, time budget')}
      <div className="nav-foot">
        <div className="nav-title">For reviewers</div>
        {link('/errors', '★', 'Errors we found', 'The submission write-up: every error found and how')}
      </div>
    </nav>
  )
}

function ClientNav() {
  return (
    <nav className="sidebar nav no-print">
      <NavLink to="/client" className="active"><span className="ico">⌂</span>Your return</NavLink>
      <p className="muted small" style={{ padding: '10px' }}>You see what the firm needs from you and your copy of the return. The firm’s internal notes are not shown.</p>
    </nav>
  )
}

/** Small helper other pages use for a section header with the page title. */
export function PageHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null)
  return (
    <header>
      <h1 ref={ref}>{title}</h1>
      {children && <p>{children}</p>}
    </header>
  )
}
