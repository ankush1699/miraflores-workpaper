import { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, Route, Routes, useLocation, useNavigate, Navigate } from 'react-router-dom'
import { findingStatus, isResolved } from '../domain/derived'
import { notificationsFor } from '../domain/notify'
import { initials, isActive, ROLE_LABEL } from '../domain/people'
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
  const { idx, actors, actor, setActor, state, presence, undoLast, canUndo, say, resetDemo, findings, variances } = useStore()
  const navigate = useNavigate()
  const waiting = notificationsFor(actor, { idx, state, findings, variances })
  const { setPalette } = useUi()
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
        <span>⌕</span><span style={{ flex: 1, textAlign: 'left' }}>Search documents, numbers, notes…</span><span className="kbd">⌘K</span>
      </button>
      <span style={{ flex: 1 }} />
      {others.length > 0 && (
        <div className="row" style={{ gap: 2 }} title={others.map((p) => `${who(actors, p.actorId)} is on ${p.page}`).join('\n')}>
          {others.map((p) => <span key={p.actorId} className="avatar live">{initials(who(actors, p.actorId))}</span>)}
        </div>
      )}
      <span className="muted small" title="The engagement clock. It moves when you replay the season on the Filing page.">Season: {day(state.season.asOf)}</span>
      <button className="btn small" onClick={() => navigate(actor.role === 'client' ? '/client' : '/')} title={waiting.map((w) => w.text).join('\n') || 'Nothing waiting for you'}>🔔 {waiting.length}</button>
      <button className="btn small" onClick={doUndo} disabled={!canUndo} title="Undo your last action">↶ Undo</button>
      <label className="row small">
        <span className="muted">Viewing as</span>
        <select value={actor.id} onChange={(e) => setActor(e.target.value)} style={{ width: 'auto' }}>
          {(['preparer', 'reviewer', 'partner', 'firm_administrator', 'quality_reviewer', 'client'] as const).map((role) => (
            <optgroup key={role} label={ROLE_LABEL[role]}>
              {actors.filter((a) => a.role === role).map((a) => (
                <option key={a.id} value={a.id}>{a.name}{!isActive(a, state.season.asOf) ? ` (from ${a.activeFrom})` : ''}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      <button className="btn small" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} title="Light or dark">◐</button>
      <button className="btn small" onClick={() => { if (window.confirm('Clear everything recorded in this workpaper and start over?')) resetDemo() }} title="Clear saved work">Reset</button>
    </header>
  )
}

function Sidebar() {
  const { state, findings, events, actor } = useStore()
  const open = useMemo(() => findings.filter((f) => f.severity !== 'info' && !isResolved(findingStatus(f, state))), [findings, state])
  const byArea = (id: string) => open.filter((f) => f.area === id).length
  const openThreads = state.threads.filter((t) => t.status !== 'cleared').length
  const lastSeen = state.seen[actor.id] ?? ''
  const unseen = events.filter((e) => e.actor !== actor.id && e.at > lastSeen && !['seen.mark', 'sensitive.view'].includes(e.type)).length
  const link = (to: string, label: string, count?: number, quiet?: boolean) => (
    <NavLink to={to} end={to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
      {label}{count ? <span className={`count ${quiet ? 'quiet' : ''}`}>{count}</span> : null}
    </NavLink>
  )
  return (
    <nav className="sidebar nav no-print">
      {link('/', 'Overview')}
      <div className="nav-title">The return</div>
      {AREAS.map((a) => <span key={a.id}>{link(`/area/${a.id}`, a.label, byArea(a.id))}</span>)}
      <div className="nav-title">Work</div>
      {link('/issues', 'Issues', open.length)}
      {link('/documents', 'Documents')}
      {link('/changes', 'Changes', unseen, true)}
      {link('/people', 'Notes & people', openThreads, true)}
      {link('/filing', 'Filing & after')}
      <div className="nav-title">Records</div>
      {link('/schedules', 'CPA schedules')}
      <div className="nav-title">Firm</div>
      {link('/firm', 'Firm & standards')}
      {link('/errors', 'Errors we found')}
    </nav>
  )
}

function ClientNav() {
  return (
    <nav className="sidebar nav no-print">
      <NavLink to="/client" className="active">Your return</NavLink>
      <p className="muted small" style={{ padding: '10px' }}>You see what the firm needs from you and your copy of the return. Internal notes and review comments are not shown.</p>
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
