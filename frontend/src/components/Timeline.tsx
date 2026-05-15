import { useEffect, useState, useCallback, useRef } from 'react'
import type { Person, Project } from '../types'
import { getAssignments, bulkAssign, bulkDelete } from '../api'
import {
  isoDate, daysInRange, isWeekend,
  formatDayHeader, shortDayName, monthLabel, getSprintAnchor,
} from '../utils/dates'

const CELL_W = 28
const CELL_H = 32
const NAME_W = 180
const SPRINT_DAYS = 14

type ViewMode = 'full' | 'quarter' | 'sprint'

// User-defined fiscal quarters (name → [startMonth, endMonth] 0-indexed)
const QUARTERS = [
  { label: 'Q3', startMonth: 0, endMonth: 2 },   // Jan – Mar
  { label: 'Q4', startMonth: 3, endMonth: 5 },   // Apr – Jun
  { label: 'Q1', startMonth: 6, endMonth: 8 },   // Jul – Sep
  { label: 'Q2', startMonth: 9, endMonth: 11 },  // Oct – Dec
]

function currentQuarterIndex(): number {
  const m = new Date().getMonth()
  return QUARTERS.findIndex(q => m >= q.startMonth && m <= q.endMonth)
}

interface Props {
  people: Person[]
  projects: Project[]
  rangeStart: Date
  rangeEnd: Date
}

interface DragState {
  personId: number
  startDate: string
  endDate: string
  projectId: number | null
}

const QUARTER_START_MONTHS = new Set([0, 3, 6, 9])   // Jan, Apr, Jul, Oct
const QUARTER_END_MONTHS   = new Set([2, 5, 8, 11])  // Mar, Jun, Sep, Dec

function isQuarterStart(d: Date): boolean {
  return QUARTER_START_MONTHS.has(d.getMonth()) && d.getDate() === 1
}

function isQuarterEnd(d: Date): boolean {
  if (!QUARTER_END_MONTHS.has(d.getMonth())) return false
  return d.getDate() === new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
}

function sprintLabel(days: Date[]): string {
  if (days.length === 0) return ''
  const from = days[0], to = days[days.length - 1]
  const sameMonth = from.getMonth() === to.getMonth()
  const fmt = (d: Date, withMonth: boolean) =>
    withMonth ? d.toLocaleString('default', { month: 'short', day: 'numeric' }) : String(d.getDate())
  return `${fmt(from, true)} – ${fmt(to, !sameMonth)}`
}

export default function Timeline({ people, projects, rangeStart, rangeEnd }: Props) {
  const [assignments, setAssignments] = useState<Map<string, number>>(new Map())
  const [drag, setDrag] = useState<DragState | null>(null)
  const [activeProject, setActiveProject] = useState<number | null>(projects[0]?.id ?? null)
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('full')
  const [quarterIndex, setQuarterIndex] = useState(currentQuarterIndex)
  const [sprintIndex, setSprintIndex] = useState(0)

  const scrollRef = useRef<HTMLDivElement>(null)
  const projectMap = new Map(projects.map(p => [p.id, p]))
  const todayStr = isoDate(new Date())
  const year = rangeStart.getFullYear()

  const fetchAssignments = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getAssignments(isoDate(rangeStart), isoDate(rangeEnd))
      const map = new Map<string, number>()
      data.forEach(a => map.set(`${a.person_id}:${a.date}`, a.project_id))
      setAssignments(map)
    } finally {
      setLoading(false)
    }
  }, [rangeStart, rangeEnd])

  useEffect(() => { fetchAssignments() }, [fetchAssignments])


  // ── Day ranges ──────────────────────────────────────────────────────────────
  const allDays = daysInRange(rangeStart, rangeEnd)

  // Quarter days: clipped to rangeStart/rangeEnd
  function quarterDays(qi: number): Date[] {
    const q = QUARTERS[qi]
    const from = new Date(Math.max(new Date(year, q.startMonth, 1).getTime(), rangeStart.getTime()))
    const to = new Date(Math.min(new Date(year, q.endMonth + 1, 0).getTime(), rangeEnd.getTime()))
    return daysInRange(from, to)
  }

  const sprintAnchor = getSprintAnchor(rangeStart)
  const allSprintDays = daysInRange(sprintAnchor, rangeEnd)
  const totalSprints = Math.ceil(allSprintDays.length / SPRINT_DAYS)
  const clampedSprint = Math.min(sprintIndex, totalSprints - 1)

  function todaySprintIndex(): number {
    const today = new Date()
    if (today < sprintAnchor) return 0
    if (today > rangeEnd) return totalSprints - 1
    const diff = Math.floor((today.getTime() - sprintAnchor.getTime()) / 86_400_000)
    return Math.min(Math.floor(diff / SPRINT_DAYS), totalSprints - 1)
  }

  // Scroll to start of current sprint on mount
  useEffect(() => {
    if (!scrollRef.current) return
    const idx = todaySprintIndex()
    const sprintStart = new Date(sprintAnchor)
    sprintStart.setDate(sprintAnchor.getDate() + idx * SPRINT_DAYS)
    const offset = Math.floor((sprintStart.getTime() - rangeStart.getTime()) / 86_400_000)
    scrollRef.current.scrollLeft = offset * CELL_W
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Visible days ────────────────────────────────────────────────────────────
  const days =
    viewMode === 'sprint'  ? allSprintDays.slice(clampedSprint * SPRINT_DAYS, (clampedSprint + 1) * SPRINT_DAYS) :
    viewMode === 'quarter' ? quarterDays(quarterIndex) :
    allDays

  // Month header groups
  const monthGroups: { label: string; days: Date[] }[] = []
  days.forEach(d => {
    const label = monthLabel(d)
    const last = monthGroups[monthGroups.length - 1]
    if (!last || last.label !== label) monthGroups.push({ label, days: [d] })
    else last.days.push(d)
  })

  // ── Drag handlers ───────────────────────────────────────────────────────────
  function getDragRange(a: string, b: string, includeWeekends = false): string[] {
    const da = new Date(a), db = new Date(b)
    const from = da < db ? da : db
    const to   = da < db ? db : da
    return daysInRange(from, to).filter(d => includeWeekends || !isWeekend(d)).map(isoDate)
  }

  async function commitDrag(d: DragState) {
    const dates = getDragRange(d.startDate, d.endDate, d.projectId === null)
    if (d.projectId === null) await bulkDelete(d.personId, dates)
    else await bulkAssign(d.personId, d.projectId, dates)
    await fetchAssignments()
  }

  function onCellMouseDown(personId: number, date: string) {
    const existing = assignments.get(`${personId}:${date}`)
    setDrag({ personId, startDate: date, endDate: date, projectId: existing ? null : (activeProject ?? null) })
  }

  function onCellMouseEnter(personId: number, date: string) {
    if (!drag || drag.personId !== personId) return
    setDrag(d => d ? { ...d, endDate: date } : d)
  }

  async function onMouseUp() {
    if (drag) { await commitDrag(drag); setDrag(null) }
  }

  // Optimistic preview
  const previewMap = new Map(assignments)
  if (drag) {
    getDragRange(drag.startDate, drag.endDate, drag.projectId === null).forEach(d => {
      const key = `${drag.personId}:${d}`
      if (drag.projectId === null) previewMap.delete(key)
      else previewMap.set(key, drag.projectId)
    })
  }

  // ── Toolbar helpers ─────────────────────────────────────────────────────────
  function activateView(mode: ViewMode) {
    setViewMode(mode)
    if (mode === 'sprint') setSprintIndex(todaySprintIndex())
    if (mode === 'quarter') setQuarterIndex(currentQuarterIndex())
  }

  const tabCls = (active: boolean) =>
    `px-3 py-1 rounded-md text-xs font-medium transition-colors ${
      active ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'
    }`

  return (
    <div className="flex flex-col h-full select-none" onMouseUp={onMouseUp} onMouseLeave={onMouseUp}>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 px-3 py-2 bg-white border-b border-gray-200">

        {/* Project picker */}
        <span className="text-xs font-semibold text-gray-500">Paint:</span>
        {projects.map(p => (
          <button
            key={p.id}
            onClick={() => setActiveProject(p.id)}
            className={`px-3 py-1 rounded-full text-xs font-medium text-white transition-all ${
              activeProject === p.id ? 'ring-2 ring-offset-1 ring-gray-400 scale-105' : 'opacity-70 hover:opacity-100'
            }`}
            style={{ backgroundColor: p.color }}
          >
            {p.name}
          </button>
        ))}
        <button
          onClick={() => setActiveProject(null)}
          className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
            activeProject === null ? 'bg-gray-200 ring-2 ring-offset-1 ring-gray-400' : 'bg-white text-gray-500 hover:bg-gray-100'
          }`}
        >
          Erase
        </button>

        <div className="flex-1" />

        {/* View toggle */}
        <div className="flex items-center gap-2">
          <div className="flex gap-0.5 bg-gray-100 rounded-lg p-0.5">
            <button onClick={() => activateView('full')}    className={tabCls(viewMode === 'full')}>Full range</button>
            <button onClick={() => activateView('quarter')} className={tabCls(viewMode === 'quarter')}>Quarter</button>
            <button onClick={() => activateView('sprint')}  className={tabCls(viewMode === 'sprint')}>Sprint</button>
          </div>

          {/* Quarter sub-selector */}
          {viewMode === 'quarter' && (
            <div className="flex gap-0.5 bg-gray-100 rounded-lg p-0.5">
              {QUARTERS.map((q, i) => (
                <button
                  key={q.label}
                  onClick={() => setQuarterIndex(i)}
                  className={tabCls(quarterIndex === i)}
                >
                  {q.label}
                </button>
              ))}
            </div>
          )}

          {/* Sprint navigator */}
          {viewMode === 'sprint' && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setSprintIndex(i => Math.max(0, i - 1))}
                disabled={clampedSprint === 0}
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 disabled:opacity-30 text-gray-600"
              >‹</button>
              <span className="text-xs font-medium text-gray-700 min-w-[130px] text-center">
                S{clampedSprint + 1} · {sprintLabel(days)}
              </span>
              <button
                onClick={() => setSprintIndex(i => Math.min(totalSprints - 1, i + 1))}
                disabled={clampedSprint === totalSprints - 1}
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 disabled:opacity-30 text-gray-600"
              >›</button>
              <span className="text-[10px] text-gray-400 ml-1">{clampedSprint + 1}/{totalSprints}</span>
            </div>
          )}
        </div>
      </div>

      {/* Scrollable grid */}
      <div ref={scrollRef} className="flex-1 overflow-auto relative">
        {loading && (
          <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-10">
            <span className="text-sm text-gray-400">Loading…</span>
          </div>
        )}

        <table className="border-collapse" style={{ tableLayout: 'fixed' }}>
          <thead className="sticky top-0 z-20 bg-white">
            <tr>
              <th style={{ width: NAME_W, minWidth: NAME_W }} className="bg-white border-b border-r border-gray-200" />
              {monthGroups.map(g => (
                <th
                  key={g.label}
                  colSpan={g.days.length}
                  style={{ width: CELL_W * g.days.length }}
                  className="text-xs font-semibold text-gray-600 text-left px-2 py-1 bg-gray-50 border-b border-r border-gray-200"
                >
                  {g.label}
                </th>
              ))}
            </tr>
            <tr>
              <th style={{ width: NAME_W, minWidth: NAME_W }} className="bg-white border-b border-r border-gray-200 text-left px-3 text-xs text-gray-400 font-normal">
                Person
              </th>
              {days.map(d => {
                const wknd = isWeekend(d)
                const isToday = isoDate(d) === todayStr
                const qStart = isQuarterStart(d)
                const qEnd = isQuarterEnd(d)
                return (
                  <th
                    key={isoDate(d)}
                    style={{
                      width: CELL_W, minWidth: CELL_W,
                      borderLeft:  isToday ? undefined : qStart ? '2px solid #7c3aed' : undefined,
                      borderRight: qEnd ? '2px solid #7c3aed' : undefined,
                    }}
                    className={`border-b border-r text-center ${
                      isToday ? 'border-l-2 border-l-red-400 bg-red-50'
                               : `border-gray-200 ${wknd ? 'bg-gray-100' : 'bg-white'}`
                    }`}
                  >
                    <div className={`text-[9px] leading-none ${isToday ? 'text-red-400 font-semibold' : 'text-gray-400'}`}>
                      {shortDayName(d)}
                    </div>
                    <div className={`text-[10px] font-bold leading-none mt-px ${isToday ? 'text-red-500' : 'text-gray-600'}`}>
                      {formatDayHeader(d)}
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {people.map((person, idx) => (
              <tr key={person.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'}>
                <td
                  style={{ width: NAME_W, minWidth: NAME_W }}
                  className="sticky left-0 z-10 border-b border-r border-gray-200 px-3 py-0 bg-inherit"
                >
                  <div className="text-xs font-medium text-gray-800 truncate">{person.name}</div>
                  {person.role_name && (
                    <div className="text-[10px] text-gray-400 truncate">{person.role_name}</div>
                  )}
                </td>
                {days.map(d => {
                  const dateStr = isoDate(d)
                  const wknd = isWeekend(d)
                  const isToday = dateStr === todayStr
                  const qStart = isQuarterStart(d)
                  const qEnd = isQuarterEnd(d)
                  const projId = previewMap.get(`${person.id}:${dateStr}`)
                  const proj = projId ? projectMap.get(projId) : undefined

                  return (
                    <td
                      key={dateStr}
                      style={{
                        width: CELL_W, minWidth: CELL_W, height: CELL_H,
                        backgroundColor: proj ? proj.color : undefined,
                        cursor: (wknd && activeProject !== null) ? 'not-allowed' : (activeProject !== null ? 'crosshair' : 'cell'),
                        opacity: proj ? 0.85 : 1,
                        borderLeft:  isToday ? undefined : qStart ? '2px solid #7c3aed' : undefined,
                        borderRight: qEnd ? '2px solid #7c3aed' : undefined,
                      }}
                      className={`border-b border-r border-gray-100 ${
                        isToday
                          ? 'border-l-2 border-l-red-400' + (!proj ? ' bg-red-50/40' : '')
                          : (!proj && wknd ? 'bg-gray-100' : '')
                      }`}
                      onMouseDown={(wknd && activeProject !== null) ? undefined : () => onCellMouseDown(person.id, dateStr)}
                      onMouseEnter={(wknd && activeProject !== null) ? undefined : () => onCellMouseEnter(person.id, dateStr)}
                      title={proj ? `${person.name} – ${proj.name} – ${dateStr}` : dateStr}
                    />
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="flex gap-4 px-4 py-2 bg-white border-t border-gray-200 text-xs text-gray-500">
        <span>Click & drag to assign days</span>
        <span>·</span>
        <span>Select "Erase" to remove</span>
        {viewMode === 'sprint' && (
          <><span>·</span><span>{days.filter(d => !isWeekend(d)).length} working days in sprint</span></>
        )}
        {viewMode === 'quarter' && (
          <><span>·</span><span>{QUARTERS[quarterIndex].label}: {days.length} days ({days.filter(d => !isWeekend(d)).length} working)</span></>
        )}
      </div>
    </div>
  )
}
