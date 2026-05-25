import { useEffect, useState, useCallback, useRef } from 'react'
import type { Person, Project } from '../types'
import { getAssignments, bulkAssign, bulkDelete, getNotes, upsertNote } from '../api'
import {
  isoDate, daysInRange, isWeekend, italianHolidays,
  formatDayHeader, shortDayName, monthLabel, getSprintAnchor, projectInitials,
} from '../utils/dates'

const CELL_W_DEFAULT = 54
const CELL_H = 32
const NAME_W = 180
const SPRINT_DAYS = 14

type ViewMode = 'full' | 'semester' | 'quarter' | 'month' | 'sprint'

const SEMESTERS = [
  { label: 'S1', startMonth: 0, endMonth: 5 },   // Jan – Jun
  { label: 'S2', startMonth: 6, endMonth: 11 },  // Jul – Dec
]

function currentSemesterIndex(): number {
  return new Date().getMonth() < 6 ? 0 : 1
}

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

const NOTE_TAGS = ['LF-R', 'LF-F', 'SF', 'MF', 'None'] as const
type NoteTag = typeof NOTE_TAGS[number]

const NOTE_SUGGESTIONS = ['Support', 'Team Coord', 'Courses'] as const

interface NoteDialog {
  personId: number
  personName: string
  date: string
  text: string
  tag: NoteTag
  showSuggestions: boolean
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
  const [cellW, setCellW] = useState(CELL_W_DEFAULT)
  const [assignments, setAssignments] = useState<Map<string, number>>(new Map())
  const [cellNotes, setCellNotes] = useState<Map<string, string>>(new Map())
  const [cellTags, setCellTags] = useState<Map<string, string>>(new Map())
  const [noteDialog, setNoteDialog] = useState<NoteDialog | null>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  const [pendingErase, setPendingErase] = useState<DragState | null>(null)
  const [exportFilename, setExportFilename] = useState<string | null>(null)
  const [exportPlanFilename, setExportPlanFilename] = useState<string | null>(null)
  const [activeProject, setActiveProject] = useState<number | null>(projects[0]?.id ?? null)
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('full')
  const [semesterIndex, setSemesterIndex] = useState(currentSemesterIndex)
  const [quarterIndex, setQuarterIndex] = useState(currentQuarterIndex)
  const [monthIndex, setMonthIndex] = useState(() => new Date().getMonth())
  const [sprintIndex, setSprintIndex] = useState(0)

  const scrollRef = useRef<HTMLDivElement>(null)
  const projectMap = new Map(projects.map(p => [p.id, p]))
  const todayStr = isoDate(new Date())
  const year = rangeStart.getFullYear()
  const holidays = italianHolidays(year)

  const fetchAssignments = useCallback(async () => {
    setLoading(true)
    try {
      const [data, notes] = await Promise.all([
        getAssignments(isoDate(rangeStart), isoDate(rangeEnd)),
        getNotes(isoDate(rangeStart), isoDate(rangeEnd)),
      ])
      const aMap = new Map<string, number>()
      data.forEach(a => aMap.set(`${a.person_id}:${a.date}`, a.project_id))
      const nMap = new Map<string, string>()
      const tMap = new Map<string, string>()
      notes.forEach(n => {
        nMap.set(`${n.person_id}:${n.date}`, n.note)
        if (n.tag) tMap.set(`${n.person_id}:${n.date}`, n.tag)
      })
      setAssignments(aMap)
      setCellNotes(nMap)
      setCellTags(tMap)
    } finally {
      setLoading(false)
    }
  }, [rangeStart, rangeEnd])

  useEffect(() => { fetchAssignments() }, [fetchAssignments])


  // ── Day ranges ──────────────────────────────────────────────────────────────
  const allDays = daysInRange(rangeStart, rangeEnd)

  // Month days: clipped to rangeStart/rangeEnd
  function monthDays(mi: number): Date[] {
    const from = new Date(Math.max(new Date(year, mi, 1).getTime(), rangeStart.getTime()))
    const to = new Date(Math.min(new Date(year, mi + 1, 0).getTime(), rangeEnd.getTime()))
    return daysInRange(from, to)
  }

  // Semester days: clipped to rangeStart/rangeEnd
  function semesterDays(si: number): Date[] {
    const s = SEMESTERS[si]
    const from = new Date(Math.max(new Date(year, s.startMonth, 1).getTime(), rangeStart.getTime()))
    const to = new Date(Math.min(new Date(year, s.endMonth + 1, 0).getTime(), rangeEnd.getTime()))
    return daysInRange(from, to)
  }

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
    scrollRef.current.scrollLeft = offset * cellW
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Visible days ────────────────────────────────────────────────────────────
  const days =
    viewMode === 'sprint'   ? allSprintDays.slice(clampedSprint * SPRINT_DAYS, (clampedSprint + 1) * SPRINT_DAYS) :
    viewMode === 'quarter'  ? quarterDays(quarterIndex) :
    viewMode === 'semester' ? semesterDays(semesterIndex) :
    viewMode === 'month'    ? monthDays(monthIndex) :
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
    if (d.projectId === null) {
      await bulkDelete(d.personId, dates)
      // Delete notes for erased cells
      const sorted = [...dates].sort()
      if (sorted.length > 0) {
        await fetch(`/api/notes?person_id=${d.personId}&date_from=${sorted[0]}&date_to=${sorted[sorted.length - 1]}`, { method: 'DELETE' })
      }
      setCellNotes(m => { const n = new Map(m); dates.forEach(date => n.delete(`${d.personId}:${date}`)); return n })
      setCellTags(m => { const n = new Map(m); dates.forEach(date => n.delete(`${d.personId}:${date}`)); return n })
    } else {
      await bulkAssign(d.personId, d.projectId, dates)
    }
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
    if (!drag) return
    if (drag.projectId === null) {
      setPendingErase(drag)
    } else {
      await commitDrag(drag)
    }
    setDrag(null)
  }

  async function confirmErase() {
    if (!pendingErase) return
    try { await commitDrag(pendingErase) } catch (e) { console.error('Erase failed', e) }
    setPendingErase(null)
  }

  function openNoteDialog(e: React.MouseEvent, person: { id: number; name: string }, date: string) {
    e.preventDefault()
    const key = `${person.id}:${date}`
    const projId = assignments.get(key)
    const projName = projId ? (projectMap.get(projId)?.name ?? '') : ''
    const showSuggestions = !projId || projName.toLowerCase().includes('non-project')
    setNoteDialog({
      personId: person.id,
      personName: person.name,
      date,
      text: cellNotes.get(key) ?? '',
      tag: (cellTags.get(key) as NoteTag) ?? 'None',
      showSuggestions,
    })
  }

  function closeNoteDialog() {
    setNoteDialog(null)
    setPendingErase(null)
  }

  async function saveNote() {
    if (!noteDialog) return
    const { personId, date, text, tag } = noteDialog
    const key = `${personId}:${date}`
    const tagVal = tag === 'None' ? null : tag
    await upsertNote(personId, date, text, tagVal)
    setCellNotes(m => { const n = new Map(m); text.trim() ? n.set(key, text) : n.delete(key); return n })
    setCellTags(m => { const n = new Map(m); tagVal ? n.set(key, tagVal) : n.delete(key); return n })
    setNoteDialog(null)
    setPendingErase(null)
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

  // ── CSV export ──────────────────────────────────────────────────────────────
  function confirmExportCsv() {
    if (days.length === 0) return
    const filename = `timeline_${viewMode}_${isoDate(days[0])}_${isoDate(days[days.length - 1])}.csv`
    setExportFilename(filename)
  }

  function doExportCsv() {
    if (!exportFilename || days.length === 0) return
    const visibleDays = days.filter(d => !isWeekend(d) && !holidays.has(isoDate(d)))
    const headers = ['Person', ...visibleDays.map(d =>
      `${d.toLocaleDateString('en-US', { weekday: 'long' })} ${isoDate(d)}`
    )]
    const rows: string[][] = [headers]
    people.forEach(person => {
      const cells = visibleDays.map(d => {
        const key = `${person.id}:${isoDate(d)}`
        const projId = assignments.get(key)
        const projName = projId ? (projectMap.get(projId)?.name ?? '') : ''
        const note = cellNotes.get(key) ?? ''
        if (projName && note) return `${projName} | ${note}`
        return projName || note
      })
      rows.push([person.name, ...cells])
    })
    const csv = '﻿' + rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.setAttribute('href', url)
    a.setAttribute('download', exportFilename)
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    setExportFilename(null)
  }

  function confirmExportPlan() {
    if (days.length === 0) return
    const filename = `plan_${viewMode}_${isoDate(days[0])}_${isoDate(days[days.length - 1])}.csv`
    setExportPlanFilename(filename)
  }

  function doExportPlan() {
    if (!exportPlanFilename || days.length === 0) return
    const workingDays = days.filter(d => !isWeekend(d) && !holidays.has(isoDate(d)))

    // Collect all entries that have a note or tag
    const entries: { tag: string; person: string; date: string; project: string; note: string }[] = []
    people.forEach(person => {
      workingDays.forEach(d => {
        const key = `${person.id}:${isoDate(d)}`
        const note = cellNotes.get(key) ?? ''
        const tag = cellTags.get(key) ?? ''
        if (!note && !tag) return
        const projId = assignments.get(key)
        const project = projId ? (projectMap.get(projId)?.name ?? '') : ''
        if (project.toLowerCase().includes('non-project')) return
        const dateLabel = `${d.toLocaleDateString('en-US', { weekday: 'long' })} ${isoDate(d)}`
        entries.push({ tag: tag || '—', person: person.name, date: dateLabel, project, note })
      })
    })

    // Group by tag in NOTE_TAGS order, then untagged (—)
    const tagOrder = [...NOTE_TAGS.filter(t => t !== 'None'), '—']
    const rows: string[][] = []
    tagOrder.forEach(tag => {
      const group = entries.filter(e => e.tag === tag)
      if (group.length === 0) return
      rows.push([tag])
      rows.push(['Person', 'Date', 'Project', 'Note'])
      group.forEach(e => rows.push([e.person, e.date, e.project, e.note]))
      rows.push([])
    })

    const csv = '﻿' + rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.setAttribute('href', url)
    a.setAttribute('download', exportPlanFilename)
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    setExportPlanFilename(null)
  }

  // ── Toolbar helpers ─────────────────────────────────────────────────────────
  function activateView(mode: ViewMode) {
    setViewMode(mode)
    if (mode === 'semester') setSemesterIndex(currentSemesterIndex())
    if (mode === 'quarter')  setQuarterIndex(currentQuarterIndex())
    if (mode === 'month')    setMonthIndex(new Date().getMonth())
    if (mode === 'sprint')   setSprintIndex(todaySprintIndex())
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

        <div className="flex-1" />

        {/* Zoom */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setCellW(w => Math.max(14, w - 4))}
            className="w-6 h-6 flex items-center justify-center rounded bg-gray-100 text-gray-600 hover:bg-gray-200 text-sm font-bold"
            title="Zoom out"
          >−</button>
          <input
            type="range" min={14} max={80} step={2}
            value={cellW}
            onChange={e => setCellW(Number(e.target.value))}
            className="w-20 accent-indigo-500"
            title={`Cell width: ${cellW}px`}
          />
          <button
            onClick={() => setCellW(w => Math.min(80, w + 4))}
            className="w-6 h-6 flex items-center justify-center rounded bg-gray-100 text-gray-600 hover:bg-gray-200 text-sm font-bold"
            title="Zoom in"
          >+</button>
          {cellW !== CELL_W_DEFAULT && (
            <button
              onClick={() => setCellW(CELL_W_DEFAULT)}
              className="text-[10px] text-indigo-500 hover:underline ml-0.5"
              title="Reset zoom"
            >reset</button>
          )}
        </div>

        {/* Export */}
        <button
          onClick={confirmExportCsv}
          disabled={days.length === 0}
          className="px-3 py-1 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors disabled:opacity-40"
        >
          Export CSV
        </button>
        <button
          onClick={confirmExportPlan}
          disabled={days.length === 0}
          className="px-3 py-1 rounded-lg text-xs font-medium bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100 transition-colors disabled:opacity-40"
        >
          Export Plan
        </button>

        {/* View toggle */}
        <div className="flex items-center gap-2">
          <div className="flex gap-0.5 bg-gray-100 rounded-lg p-0.5">
            <button onClick={() => activateView('full')}     className={tabCls(viewMode === 'full')}>Full range</button>
            <button onClick={() => activateView('semester')} className={tabCls(viewMode === 'semester')}>Semester</button>
            <button onClick={() => activateView('quarter')}  className={tabCls(viewMode === 'quarter')}>Quarter</button>
            <button onClick={() => activateView('month')}    className={tabCls(viewMode === 'month')}>Month</button>
            <button onClick={() => activateView('sprint')}   className={tabCls(viewMode === 'sprint')}>Sprint</button>
          </div>

          {/* Semester sub-selector */}
          {viewMode === 'semester' && (
            <div className="flex gap-0.5 bg-gray-100 rounded-lg p-0.5">
              {SEMESTERS.map((s, i) => (
                <button key={s.label} onClick={() => setSemesterIndex(i)} className={tabCls(semesterIndex === i)}>
                  {s.label}
                </button>
              ))}
            </div>
          )}

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

          {/* Month navigator */}
          {viewMode === 'month' && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setMonthIndex(i => Math.max(0, i - 1))}
                disabled={monthIndex === 0}
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 disabled:opacity-30 text-gray-600"
              >‹</button>
              <span className="text-xs font-medium text-gray-700 min-w-[90px] text-center">
                {new Date(year, monthIndex, 1).toLocaleString('default', { month: 'long' })}
              </span>
              <button
                onClick={() => setMonthIndex(i => Math.min(11, i + 1))}
                disabled={monthIndex === 11}
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 disabled:opacity-30 text-gray-600"
              >›</button>
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
                  style={{ width: cellW * g.days.length }}
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
                const dateStr = isoDate(d)
                const wknd = isWeekend(d)
                const isToday = dateStr === todayStr
                const holiday = !wknd && holidays.has(dateStr)
                const qStart = isQuarterStart(d)
                const qEnd = isQuarterEnd(d)
                return (
                  <th
                    key={dateStr}
                    style={{
                      width: cellW, minWidth: cellW,
                      borderLeft:  isToday ? undefined : qStart ? '2px solid #7c3aed' : undefined,
                      borderRight: qEnd ? '2px solid #7c3aed' : undefined,
                    }}
                    className={`border-b border-r text-center ${
                      isToday   ? 'border-l-2 border-l-blue-400 bg-blue-50'
                      : holiday ? 'border-gray-200 bg-red-100'
                      : wknd    ? 'border-gray-200 bg-gray-100'
                                : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div className={`text-[9px] leading-none ${isToday ? 'text-blue-400 font-semibold' : holiday ? 'text-red-400' : 'text-gray-400'}`}>
                      {shortDayName(d)}
                    </div>
                    <div className={`text-[10px] font-bold leading-none mt-px ${isToday ? 'text-blue-500' : holiday ? 'text-red-500' : 'text-gray-600'}`}>
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
                </td>
                {days.map(d => {
                  const dateStr = isoDate(d)
                  const wknd = isWeekend(d)
                  const isToday = dateStr === todayStr
                  const holiday = !wknd && holidays.has(dateStr)
                  const qStart = isQuarterStart(d)
                  const qEnd = isQuarterEnd(d)
                  const projId = previewMap.get(`${person.id}:${dateStr}`)
                  const proj = projId ? projectMap.get(projId) : undefined

                  return (
                    <td
                      key={dateStr}
                      style={{
                        width: cellW, minWidth: cellW, height: CELL_H,
                        position: 'relative',
                        backgroundColor: proj ? proj.color : holiday ? '#fef2f2' : undefined,
                        cursor: ((wknd || holiday) && activeProject !== null) ? 'not-allowed' : (activeProject !== null ? 'crosshair' : 'cell'),
                        opacity: proj ? 0.85 : 1,
                        borderLeft:  isToday ? undefined : qStart ? '2px solid #7c3aed' : undefined,
                        borderRight: qEnd ? '2px solid #7c3aed' : undefined,
                      }}
                      className={`border-b border-r border-gray-100 ${
                        isToday
                          ? 'border-l-2 border-l-blue-400' + (!proj ? ' bg-blue-50/40' : '')
                          : (!proj && wknd ? 'bg-gray-100' : '')
                      }`}
                      onMouseDown={((wknd || holiday) && activeProject !== null) ? undefined : () => onCellMouseDown(person.id, dateStr)}
                      onMouseEnter={((wknd || holiday) && activeProject !== null) ? undefined : () => onCellMouseEnter(person.id, dateStr)}
                      onContextMenu={e => openNoteDialog(e, person, dateStr)}
                      title={(() => {
                        const key = `${person.id}:${dateStr}`
                        const note = cellNotes.get(key)
                        const tag = cellTags.get(key)
                        const parts = [person.name, proj?.name, tag, note].filter(Boolean)
                        return parts.length ? parts.join(' | ') : holiday ? `${dateStr} – festività` : dateStr
                      })()}
                    >
                      {proj && (
                        <span className="flex items-center justify-center h-full text-white font-bold select-none pointer-events-none" style={{ fontSize: 8, lineHeight: 1 }}>
                          {projectInitials(proj.name)}
                        </span>
                      )}
                      {cellNotes.has(`${person.id}:${dateStr}`) && (
                        <svg className="absolute top-0 right-0 pointer-events-none" width="6" height="6" viewBox="0 0 6 6">
                          <polygon points="6,0 0,0 6,6" fill="white" />
                        </svg>
                      )}
                      {cellTags.has(`${person.id}:${dateStr}`) && (
                        <span
                          className="absolute bottom-0 left-0 pointer-events-none leading-none font-semibold"
                          style={{
                            fontSize: 7,
                            padding: '1px 2px',
                            background: proj ? 'rgba(255,255,255,0.30)' : 'rgba(99,102,241,0.15)',
                            color: proj ? 'rgba(255,255,255,0.95)' : '#4338ca',
                            borderTopRightRadius: 3,
                          }}
                        >
                          {cellTags.get(`${person.id}:${dateStr}`)}
                        </span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Export CSV confirmation */}
      {exportFilename && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25" onClick={e => { if (e.target === e.currentTarget) setExportFilename(null) }}>
          <div className="bg-white rounded-xl shadow-xl p-5 w-80">
            <p className="text-sm font-semibold text-gray-800 mb-1">Export CSV?</p>
            <p className="text-xs text-gray-500 mb-4 break-all font-mono bg-gray-50 rounded px-2 py-1.5">{exportFilename}</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setExportFilename(null)} className="px-4 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200">Cancel</button>
              <button onClick={doExportCsv} className="px-4 py-1.5 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700">Download</button>
            </div>
          </div>
        </div>
      )}

      {/* Export Plan confirmation */}
      {exportPlanFilename && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25" onClick={e => { if (e.target === e.currentTarget) setExportPlanFilename(null) }}>
          <div className="bg-white rounded-xl shadow-xl p-5 w-80">
            <p className="text-sm font-semibold text-gray-800 mb-1">Export Plan?</p>
            <p className="text-xs text-gray-500 mb-4 break-all font-mono bg-gray-50 rounded px-2 py-1.5">{exportPlanFilename}</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setExportPlanFilename(null)} className="px-4 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200">Cancel</button>
              <button onClick={doExportPlan} className="px-4 py-1.5 bg-violet-600 text-white text-sm rounded-lg hover:bg-violet-700">Download</button>
            </div>
          </div>
        </div>
      )}

      {/* Erase confirmation */}
      {pendingErase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25" onClick={e => { if (e.target === e.currentTarget) setPendingErase(null) }}>
          <div className="bg-white rounded-xl shadow-xl p-5 w-64 text-center">
            <p className="text-sm font-semibold text-gray-800 mb-1">Erase assignments?</p>
            <p className="text-xs text-gray-400 mb-4">This will remove the selected cells.</p>
            <div className="flex gap-2 justify-center">
              <button onClick={() => setPendingErase(null)} className="px-4 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200">No</button>
              <button onClick={confirmErase} className="px-4 py-1.5 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600">Yes, erase</button>
            </div>
          </div>
        </div>
      )}

      {/* Note dialog */}
      {noteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25" onClick={e => { if (e.target === e.currentTarget) closeNoteDialog() }}>
          <div className="bg-white rounded-xl shadow-xl p-5 w-72">
            <p className="text-sm font-semibold text-gray-800">{noteDialog.personName}</p>
            <p className="text-xs text-gray-400 mb-3">{noteDialog.date}</p>
            <div className="flex gap-1 mb-3">
              {NOTE_TAGS.map(t => (
                <button
                  key={t}
                  onClick={() => setNoteDialog(d => d ? { ...d, tag: t } : d)}
                  className={`flex-1 py-1 rounded-md text-xs font-medium border transition-colors ${
                    noteDialog.tag === t
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400 hover:text-indigo-600'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            {noteDialog.showSuggestions && !noteDialog.text && (
              <div className="flex gap-1.5 mb-2">
                {NOTE_SUGGESTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => setNoteDialog(d => d ? { ...d, text: s } : d)}
                    className="px-2.5 py-1 rounded-full text-xs border border-gray-300 text-gray-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            <textarea
              autoFocus
              rows={3}
              maxLength={200}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
              placeholder="Short note…"
              value={noteDialog.text}
              onChange={e => setNoteDialog(d => d ? { ...d, text: e.target.value } : d)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) saveNote(); if (e.key === 'Escape') closeNoteDialog() }}
            />
            <div className="flex gap-2 justify-end mt-3">
              <button onClick={closeNoteDialog} className="px-4 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200">Cancel</button>
              <button onClick={saveNote} className="px-4 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex gap-4 px-4 py-2 bg-white border-t border-gray-200 text-xs text-gray-500">
        <span>Click & drag to assign days</span>
        {viewMode === 'semester' && (
          <><span>·</span><span>{SEMESTERS[semesterIndex].label}: {days.length} days ({days.filter(d => !isWeekend(d)).length} working)</span></>
        )}
        {viewMode === 'month' && (
          <><span>·</span><span>{new Date(year, monthIndex, 1).toLocaleString('default', { month: 'long' })}: {days.length} days ({days.filter(d => !isWeekend(d)).length} working)</span></>
        )}
        {viewMode === 'quarter' && (
          <><span>·</span><span>{QUARTERS[quarterIndex].label}: {days.length} days ({days.filter(d => !isWeekend(d)).length} working)</span></>
        )}
        {viewMode === 'sprint' && (
          <><span>·</span><span>{days.filter(d => !isWeekend(d)).length} working days in sprint</span></>
        )}
      </div>
    </div>
  )
}
