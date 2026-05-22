import { useEffect, useState, useCallback } from 'react'
import type { Person, Project, Role } from './types'
import { getPeople, getProjects, getRoles } from './api'
import Timeline from './components/Timeline'
import PeoplePage from './pages/PeoplePage'
import ProjectsPage from './pages/ProjectsPage'
import RolesPage from './pages/RolesPage'
import StatsPage from './pages/StatsPage'
import { isoDate } from './utils/dates'

type Tab = 'timeline' | 'stats' | 'people' | 'projects' | 'roles'


function getRangeStart(): Date {
  return new Date(new Date().getFullYear(), 0, 1)
}

function getRangeEnd(start: Date): Date {
  return new Date(start.getFullYear(), 11, 31)
}

export default function App() {
  const [tab, setTab] = useState<Tab>('timeline')
  const [people, setPeople] = useState<Person[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [roles, setRoles] = useState<Role[]>([])

  const [rangeStart] = useState<Date>(getRangeStart)
  const [rangeEnd] = useState<Date>(() => getRangeEnd(getRangeStart()))

  const loadAll = useCallback(async () => {
    const [p, pr, r] = await Promise.all([getPeople(), getProjects(), getRoles()])
    setPeople(p)
    setProjects(pr)
    setRoles(r)
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  const tabs: { id: Tab; label: string }[] = [
    { id: 'timeline', label: 'Timeline' },
    { id: 'stats', label: 'Stats' },
    { id: 'people', label: 'People' },
    { id: 'projects', label: 'Projects' },
    { id: 'roles', label: 'Roles' },
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
        <div className="ml-auto text-xs text-gray-400">
          {people.length} people · {projects.length} projects
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        {tab === 'timeline' && (
          <Timeline
            people={people}
            projects={projects}
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
      </main>
    </div>
  )
}
