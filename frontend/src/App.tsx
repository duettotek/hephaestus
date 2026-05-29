import { useEffect, useState, useCallback } from 'react'
import type { Person, Project, Role, Plant } from './types'
import { getPeople, getProjects, getRoles, getPlants, getToken, clearToken, getMe } from './api'
import Timeline from './components/Timeline'
import PeoplePage from './pages/PeoplePage'
import ProjectsPage from './pages/ProjectsPage'
import RolesPage from './pages/RolesPage'
import StatsPage from './pages/StatsPage'
import LoginPage from './pages/LoginPage'
import UsersPage from './pages/UsersPage'
import PlantsPage from './pages/PlantsPage'
import { isoDate } from './utils/dates'

type Tab = 'timeline' | 'stats' | 'people' | 'projects' | 'roles' | 'plants' | 'users'

function getRangeStart(): Date {
  return new Date(new Date().getFullYear(), 0, 1)
}

function getRangeEnd(start: Date): Date {
  return new Date(start.getFullYear(), 11, 31)
}

export default function App() {
  const [authed, setAuthed] = useState<boolean | null>(null) // null = checking
  const [username, setUsername] = useState('')
  const [tab, setTab] = useState<Tab>('timeline')
  const [people, setPeople] = useState<Person[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [plants, setPlants] = useState<Plant[]>([])

  const [rangeStart] = useState<Date>(getRangeStart)
  const [rangeEnd] = useState<Date>(() => getRangeEnd(getRangeStart()))

  // Verify token on mount
  useEffect(() => {
    if (!getToken()) { setAuthed(false); return }
    getMe()
      .then(me => { setUsername(me.username); setAuthed(true) })
      .catch(() => { clearToken(); setAuthed(false) })
  }, [])

  const loadAll = useCallback(async () => {
    const [p, pr, r, pl] = await Promise.all([getPeople(), getProjects(), getRoles(), getPlants()])
    setPeople(p)
    setProjects(pr)
    setRoles(r)
    setPlants(pl)
  }, [])

  useEffect(() => { if (authed) loadAll() }, [authed, loadAll])

  function handleLogout() {
    clearToken()
    setAuthed(false)
    setUsername('')
  }

  // Loading check
  if (authed === null) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <span className="text-sm text-gray-400">Loading…</span>
      </div>
    )
  }

  if (!authed) {
    return (
      <LoginPage onLogin={() => {
        getMe().then(me => setUsername(me.username))
        setTab('timeline')
        setAuthed(true)
      }} />
    )
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'timeline', label: 'Timeline' },
    { id: 'stats', label: 'Stats' },
    { id: 'people', label: 'People' },
    { id: 'projects', label: 'Projects' },
    { id: 'roles', label: 'Roles' },
    { id: 'plants', label: 'Plants' },
    ...(username === 'admin' ? [{ id: 'users' as Tab, label: 'Users' }] : []),
  ]

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 flex items-center gap-6 h-14 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-indigo-600">Hephaestus</span>
          <span className="text-xs text-gray-400 ml-1">
            {isoDate(rangeStart)} → {isoDate(rangeEnd)}
          </span>
        </div>
        <nav className="flex gap-1 ml-4">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === t.id
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-xs text-gray-400">
          <span>{people.length} people · {projects.length} projects</span>
          <span className="text-gray-300">|</span>
          <span className="font-medium text-gray-600">{username}</span>
          <button
            onClick={handleLogout}
            className="px-2.5 py-1 rounded-md bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        {tab === 'timeline' && (
          <Timeline
            people={people}
            projects={projects}
            plants={plants}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
          />
        )}
        {tab === 'stats' && (
          <div className="h-full overflow-auto">
            <StatsPage rangeStart={rangeStart} rangeEnd={rangeEnd} projects={projects} />
          </div>
        )}
        {tab === 'people' && <div className="h-full overflow-auto"><PeoplePage people={people} roles={roles} onRefresh={loadAll} /></div>}
        {tab === 'projects' && <div className="h-full overflow-auto"><ProjectsPage projects={projects} onRefresh={loadAll} /></div>}
        {tab === 'roles' && <div className="h-full overflow-auto"><RolesPage roles={roles} onRefresh={loadAll} /></div>}
        {tab === 'plants' && <div className="h-full overflow-auto"><PlantsPage plants={plants} onRefresh={loadAll} /></div>}
        {tab === 'users' && <div className="h-full overflow-auto"><UsersPage currentUsername={username} /></div>}
      </main>
    </div>
  )
}
