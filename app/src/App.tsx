import { HashRouter, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { setState, useStore } from './lib/store'
import Overview from './pages/Overview'
import Company from './pages/Company'
import Brief from './pages/Brief'
import Buyers from './pages/Buyers'
import Learn from './pages/Learn'
import Practice from './pages/Practice'
import Call from './pages/Call'
import ReportPage from './pages/Report'
import Reports from './pages/Reports'
import Team from './pages/Team'
import SettingsPage from './pages/Settings'

const TITLES: Record<string, string> = {
  '': 'Overview',
  company: 'Company',
  brief: 'Sales brief',
  buyers: 'Buyers',
  learn: 'Learn',
  practice: 'Practice',
  call: 'Live call',
  reports: 'Reports',
  team: 'Team',
  settings: 'Settings',
}

function Mark() {
  return (
    <span className="brand-mark" aria-hidden>
      <svg width="16" height="16" viewBox="0 0 16 16">
        <path d="M1 11 L5 7 L8 9 L12 3 L15 5" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}

function Side() {
  const knowledge = useStore((s) => s.knowledge)
  const editorial = useStore((s) => s.editorial)
  const personas = useStore((s) => s.personas)
  const learning = useStore((s) => s.learning)
  const setup = [
    { to: '/company', label: 'Company', done: !!knowledge },
    { to: '/brief', label: 'Sales brief', done: !!editorial?.approved },
    { to: '/buyers', label: 'Buyers', done: personas.length > 0 },
    { to: '/learn', label: 'Lessons & quiz', done: !!learning },
  ]
  return (
    <aside className="side">
      <div className="brand">
        <Mark />
        <span className="brand-name">Coach</span>
      </div>
      <nav className="nav-group">
        <NavLink to="/" end className="nav-link">Overview</NavLink>
      </nav>
      <nav className="nav-group" aria-label="Setup">
        <div className="nav-label">Setup</div>
        {setup.map((s, i) => (
          <NavLink key={s.to} to={s.to} className="nav-link">
            <span className="row"><span className="nav-step">{i + 1}</span>{s.label}</span>
            <span className={`nav-dot ${s.done ? 'done' : ''}`} />
          </NavLink>
        ))}
      </nav>
      <nav className="nav-group" aria-label="Training">
        <div className="nav-label">Training</div>
        <NavLink to="/practice" className="nav-link">Practice calls</NavLink>
        <NavLink to="/reports" className="nav-link">Reports</NavLink>
        <NavLink to="/team" className="nav-link">Team</NavLink>
      </nav>
      <div className="side-foot">
        <NavLink to="/settings" className="nav-link">Settings</NavLink>
      </div>
    </aside>
  )
}

function Top() {
  const loc = useLocation()
  const section = loc.pathname.split('/')[1] ?? ''
  const company = useStore((s) => s.company.companyName)
  const trainee = useStore((s) => s.trainee)
  return (
    <header className="topbar">
      <div className="crumbs">
        {company || 'New workspace'} / <b>{TITLES[section] ?? ''}</b>
      </div>
      <div className="row">
        <label className="row small muted">
          Trainee
          <input
            type="text"
            value={trainee}
            placeholder="Your name"
            onChange={(e) => setState({ trainee: e.target.value })}
            style={{ width: 150, height: 30, padding: '4px 8px' }}
          />
        </label>
      </div>
    </header>
  )
}

export default function App() {
  return (
    <HashRouter>
      <div className="shell">
        <Side />
        <div className="main">
          <Top />
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/company" element={<Company />} />
            <Route path="/brief" element={<Brief />} />
            <Route path="/buyers" element={<Buyers />} />
            <Route path="/learn" element={<Learn />} />
            <Route path="/practice" element={<Practice />} />
            <Route path="/call/:id" element={<Call />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/reports/:id" element={<ReportPage />} />
            <Route path="/team" element={<Team />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </div>
      </div>
    </HashRouter>
  )
}
