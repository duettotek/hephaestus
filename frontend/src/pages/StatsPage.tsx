import { useEffect, useState } from 'react'
import { isoDate, getSprintAnchor, countWorkingDays } from '../utils/dates'
import type { Project } from '../types'

interface PersonStat {
  person_id: number
  name: string
  role_name: string | null
  role_multiplier: number
  sprint_capacity: number
  pto_days: number
  availability: number
  allocated: number
  allocated_weighted: number
  remaining: number
  utilization_pct: number
  by_project: Record<number, number>
}

interface ProjectStat {
  project_id: number
  name: string
  color: string
  demand_days: number
  allocated: number
  remaining_demand: number
  utilization_pct: number
  by_person: Record<number, number>
}

interface Stats {
  date_from: string
  date_to: string
  hours_per_day: number
  people: PersonStat[]
  projects: ProjectStat[]
}

interface Props {
  rangeStart: Date
  rangeEnd: Date
  projects: Project[]
}

type PeriodType = 'year' | 'semester' | 'quarter' | 'sprint'

function countDays(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86400000) + 1
}


const SPRINT_DAYS = 14

function getPeriodRange(type: PeriodType, index: number, rangeStart: Date, rangeEnd: Date): [Date, Date] {
  const y = rangeStart.getFullYear()
  switch (type) {
    case 'year':
      return [rangeStart, rangeEnd]
    case 'semester':
      return index === 0
        ? [new Date(y, 0, 1), new Date(y, 5, 30)]
        : [new Date(y, 6, 1), new Date(y, 11, 31)]
    case 'quarter': {
      const quarters: [Date, Date][] = [
        [new Date(y, 0, 1), new Date(y, 2, 31)],
        [new Date(y, 3, 1), new Date(y, 5, 30)],
        [new Date(y, 6, 1), new Date(y, 8, 30)],
        [new Date(y, 9, 1), new Date(y, 11, 31)],
      ]
      return quarters[Math.min(index, 3)]
    }
    case 'sprint': {
      const anchor = getSprintAnchor(rangeStart)
      const from = new Date(anchor.getTime() + index * SPRINT_DAYS * 86400000)
      const to = new Date(Math.min(
        from.getTime() + (SPRINT_DAYS - 1) * 86400000,
        rangeEnd.getTime()
      ))
      return [from, to]
    }
  }
}

function totalSprints(rangeStart: Date, rangeEnd: Date): number {
  const anchor = getSprintAnchor(rangeStart)
  const days = Math.round((rangeEnd.getTime() - anchor.getTime()) / 86400000) + 1
  return Math.ceil(days / SPRINT_DAYS)
}

function getPeriodOptions(type: PeriodType, rangeStart: Date, rangeEnd: Date): string[] {
  switch (type) {
    case 'year':
      return [`Full Year (${rangeStart.getFullYear()})`]
    case 'semester':
      return ['S1 (Jan – Jun)', 'S2 (Jul – Dec)']
    case 'quarter':
      return ['Q3 (Jan – Mar)', 'Q4 (Apr – Jun)', 'Q1 (Jul – Sep)', 'Q2 (Oct – Dec)']
    case 'sprint': {
      const n = totalSprints(rangeStart, rangeEnd)
      return Array.from({ length: n }, (_, i) => {
        const [from, to] = getPeriodRange('sprint', i, rangeStart, rangeEnd)
        return `S${i + 1}  ${isoDate(from)} – ${isoDate(to)}`
      })
    }
  }
}

function getCurrentIndex(type: PeriodType, rangeStart: Date, rangeEnd: Date): number {
  const today = new Date()
  switch (type) {
    case 'year': return 0
    case 'semester': return today.getMonth() < 6 ? 0 : 1
    case 'quarter': {
      const m = today.getMonth()
      if (m < 3) return 0
      if (m < 6) return 1
      if (m < 9) return 2
      return 3
    }
    case 'sprint': {
      const anchor = getSprintAnchor(rangeStart)
      if (today < anchor) return 0
      if (today > rangeEnd) return totalSprints(rangeStart, rangeEnd) - 1
      const diff = Math.floor((today.getTime() - anchor.getTime()) / 86400000)
      return Math.min(Math.floor(diff / SPRINT_DAYS), totalSprints(rangeStart, rangeEnd) - 1)
    }
  }
}

function Bar({ pct, color = '#6366f1' }: { pct: number; color?: string }) {
  const clamped = Math.min(100, Math.max(0, pct))
  const over = pct > 100
  return (
    <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${clamped}%`, backgroundColor: over ? '#ef4444' : color }}
      />
    </div>
  )
}

export default function StatsPage({ rangeStart, rangeEnd, projects }: Props) {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'people' | 'projects'>('people')
  const [periodType, setPeriodType] = useState<PeriodType>('year')
  const [periodIndex, setPeriodIndex] = useState(() => getCurrentIndex('year', rangeStart, rangeEnd))

  const projectMap = new Map(projects.map(p => [p.id, p]))

  const [statsFrom, statsTo] = getPeriodRange(periodType, periodIndex, rangeStart, rangeEnd)
  const periodOptions = getPeriodOptions(periodType, rangeStart, rangeEnd)

  const filterLabel = (() => {
    const quarterLabels = ['Q3', 'Q4', 'Q1', 'Q2']
    switch (periodType) {
      case 'year':     return 'year'
      case 'semester': return `S${periodIndex + 1}`
      case 'quarter':  return quarterLabels[periodIndex]
      case 'sprint':   return `sprint-${periodIndex + 1}`
    }
  })()
  const totalDays = countDays(statsFrom, statsTo)
  const workingDays = countWorkingDays(statsFrom, statsTo)

  function changePeriodType(t: PeriodType) {
    setPeriodType(t)
    setPeriodIndex(getCurrentIndex(t, rangeStart, rangeEnd))
  }

  function downloadCsv(rows: string[][], filename: string) {
    const csv = '﻿' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.setAttribute('href', url)
    a.setAttribute('download', filename)
    a.style.visibility = 'hidden'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  function exportPeople() {
    if (!stats) return
    const projectList = projects.filter(p => stats.people.some(ps => ps.by_project[p.id]))
    const headers = ['Person', 'Role', 'Available (d)', 'Allocated (d)', 'Utilization %', ...projectList.map(p => p.name)]
    const rows: (string | number)[][] = [headers]
    stats.people.forEach(p => {
      rows.push([
        p.name,
        p.role_name ?? '',
        workingDays - p.allocated,
        p.allocated,
        workingDays > 0 ? Math.round(p.allocated / workingDays * 1000) / 10 : 0,
        ...projectList.map(proj => p.by_project[proj.id] ?? 0),
      ])
    })
    rows.push(['Total', '', stats.people.reduce((s, p) => s + (workingDays - p.allocated), 0), stats.people.reduce((s, p) => s + p.allocated, 0), '', ...projectList.map(() => '')])
    downloadCsv(rows.map(r => r.map(String)), `stats-people_${filterLabel}_${isoDate(statsFrom)}_${isoDate(statsTo)}.csv`)
  }

  function exportProjects() {
    if (!stats) return
    const personList = stats.people
    const headers = ['Project', 'Demand (d)', 'Allocated (d)', 'Remaining demand', 'Fulfillment %', ...personList.map(p => p.name)]
    const rows: (string | number)[][] = [headers]
    stats.projects.forEach(proj => {
      rows.push([
        proj.name,
        proj.demand_days,
        proj.allocated,
        proj.remaining_demand,
        proj.utilization_pct,
        ...personList.map(p => proj.by_person[p.person_id] ?? 0),
      ])
    })
    rows.push(['Total', stats.projects.reduce((s, p) => s + p.demand_days, 0), stats.projects.reduce((s, p) => s + p.allocated, 0), stats.projects.reduce((s, p) => s + p.remaining_demand, 0), '', ...personList.map(() => '')])
    downloadCsv(rows.map(r => r.map(String)), `stats-projects_${filterLabel}_${isoDate(statsFrom)}_${isoDate(statsTo)}.csv`)
  }

  useEffect(() => {
    setLoading(true)
    fetch(`/api/stats?date_from=${isoDate(statsFrom)}&date_to=${isoDate(statsTo)}`)
      .then(r => r.json())
      .then(data => { setStats(data); setLoading(false) })
  }, [isoDate(statsFrom), isoDate(statsTo)])

  if (loading || !stats) {
    return <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Loading stats…</div>
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Capacity Stats</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {isoDate(statsFrom)} → {isoDate(statsTo)} · {totalDays} days
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => view === 'people' ? exportPeople() : exportProjects()}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
          >
            Export CSV
          </button>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setView('people')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${view === 'people' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
            >
              People
            </button>
            <button
              onClick={() => setView('projects')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${view === 'projects' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Projects
            </button>
          </div>
        </div>
      </div>

      {view === 'people' && (
        <>
          {/* Period filter */}
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs text-gray-500 font-medium">Period</span>
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              {(['year', 'semester', 'quarter', 'sprint'] as PeriodType[]).map(t => (
                <button
                  key={t}
                  onClick={() => changePeriodType(t)}
                  className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors ${
                    periodType === t ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            {periodOptions.length > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPeriodIndex(i => Math.max(0, i - 1))}
                  disabled={periodIndex === 0}
                  className="w-6 h-6 flex items-center justify-center rounded bg-gray-100 text-gray-500 hover:bg-gray-200 disabled:opacity-30 text-xs"
                >‹</button>
                <select
                  value={periodIndex}
                  onChange={e => setPeriodIndex(Number(e.target.value))}
                  className="border border-gray-200 rounded-md px-2 py-1 text-xs text-gray-700 bg-white"
                >
                  {periodOptions.map((label, i) => (
                    <option key={i} value={i}>{label}</option>
                  ))}
                </select>
                <button
                  onClick={() => setPeriodIndex(i => Math.min(periodOptions.length - 1, i + 1))}
                  disabled={periodIndex === periodOptions.length - 1}
                  className="w-6 h-6 flex items-center justify-center rounded bg-gray-100 text-gray-500 hover:bg-gray-200 disabled:opacity-30 text-xs"
                >›</button>
              </div>
            )}
          </div>

          <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 mb-4 text-xs text-indigo-700 flex flex-wrap gap-x-6 gap-y-1">
            <span><strong>Available</strong> = working days in period without any assignment ({workingDays} working days)</span>
            <span><strong>Allocated</strong> = assigned days in period</span>
            <span><strong>Utilization</strong> = Allocated ÷ working days</span>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-3">Person</th>
                  <th className="text-left px-4 py-3">Role</th>
                  <th className="text-right px-4 py-3" title="Days in period with no assignment">Avail. (d)</th>
                  <th className="text-right px-4 py-3" title="Assigned days">Alloc. (d)</th>
                  <th className="px-4 py-3 text-center">Utilization</th>
                  <th className="text-left px-4 py-3">By project</th>
                </tr>
              </thead>
              <tbody>
                {stats.people.map((p, i) => {
                  const available = workingDays - p.allocated
                  const utilizationPct = workingDays > 0 ? Math.round(p.allocated / workingDays * 1000) / 10 : 0
                  return (
                    <tr key={p.person_id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                      <td className="px-4 py-2.5 font-medium text-gray-800">{p.name}</td>
                      <td className="px-4 py-2.5 text-gray-500 text-xs">{p.role_name ?? '—'}</td>
                      <td className={`px-4 py-2.5 text-right font-semibold ${available < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {available}
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-700">{p.allocated}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-col items-center gap-1">
                          <Bar pct={utilizationPct} />
                          <span className={`text-[10px] font-medium ${utilizationPct > 100 ? 'text-red-500' : 'text-gray-500'}`}>
                            {utilizationPct}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(p.by_project).map(([pid, days]) => {
                            const proj = projectMap.get(Number(pid))
                            return proj ? (
                              <span
                                key={pid}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] text-white font-medium"
                                style={{ backgroundColor: proj.color }}
                              >
                                {proj.name}: {days}d
                              </span>
                            ) : null
                          })}
                          {Object.keys(p.by_project).length === 0 && <span className="text-gray-300 text-xs">—</span>}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="bg-gray-50 text-xs font-semibold text-gray-700 border-t border-gray-200">
                <tr>
                  <td colSpan={2} className="px-4 py-2">Total</td>
                  <td className="px-4 py-2 text-right">
                    {stats.people.reduce((s, p) => s + (workingDays - p.allocated), 0)}
                  </td>
                  <td className="px-4 py-2 text-right">{stats.people.reduce((s, p) => s + p.allocated, 0)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}

      {view === 'projects' && (
        <>
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 mb-4 text-xs text-indigo-700 flex flex-wrap gap-x-6 gap-y-1">
            <span><strong>Demand</strong> = from project definition (days)</span>
            <span><strong>Allocated</strong> = SUBTOTAL(person columns) = count of assigned days</span>
            <span><strong>Remaining demand</strong> = Demand − Allocated (days)</span>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-3">Project</th>
                  <th className="text-right px-4 py-3">Demand (d)</th>
                  <th className="text-right px-4 py-3">Allocated (d)</th>
                  <th className="text-right px-4 py-3">Remaining demand</th>
                  <th className="px-4 py-3 text-center">Fulfillment</th>
                  <th className="text-left px-4 py-3">People assigned</th>
                </tr>
              </thead>
              <tbody>
                {stats.projects.map((proj, i) => {
                  const over = proj.remaining_demand < 0
                  return (
                    <tr key={proj.project_id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: proj.color }} />
                          <span className="font-medium text-gray-800">{proj.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-700">{proj.demand_days}</td>
                      <td className="px-4 py-2.5 text-right text-gray-700">{proj.allocated}</td>
                      <td className={`px-4 py-2.5 text-right font-semibold ${over ? 'text-red-600' : proj.remaining_demand === 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {proj.remaining_demand}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-col items-center gap-1">
                          <Bar pct={proj.utilization_pct} color={proj.color} />
                          <span className="text-[10px] font-medium text-gray-500">{proj.utilization_pct}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(proj.by_person).map(([pid, days]) => {
                            const person = stats.people.find(p => p.person_id === Number(pid))
                            return person ? (
                              <span key={pid} className="px-2 py-0.5 bg-gray-100 rounded-full text-[10px] text-gray-600 font-medium">
                                {person.name.split(' ')[0]}: {days}d
                              </span>
                            ) : null
                          })}
                          {Object.keys(proj.by_person).length === 0 && <span className="text-gray-300 text-xs">—</span>}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="bg-gray-50 text-xs font-semibold text-gray-700 border-t border-gray-200">
                <tr>
                  <td className="px-4 py-2">Total</td>
                  <td className="px-4 py-2 text-right">{stats.projects.reduce((s, p) => s + p.demand_days, 0)}</td>
                  <td className="px-4 py-2 text-right">{stats.projects.reduce((s, p) => s + p.allocated, 0)}</td>
                  <td className="px-4 py-2 text-right">{stats.projects.reduce((s, p) => s + p.remaining_demand, 0)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
