export const SPRINT_ANCHOR = new Date(2026, 0, 12) // Jan 12, 2026

export function getSprintAnchor(_rangeStart: Date): Date {
  return new Date(SPRINT_ANCHOR)
}

export function isoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0)
}

export function monthLabel(d: Date): string {
  return d.toLocaleString('default', { month: 'long', year: 'numeric' })
}

export function isWeekend(d: Date): boolean {
  const day = d.getDay()
  return day === 0 || day === 6
}

export function countWorkingDays(from: Date, to: Date): number {
  let count = 0
  const cur = new Date(from)
  while (cur <= to) {
    const d = cur.getDay()
    if (d !== 0 && d !== 6) count++
    cur.setDate(cur.getDate() + 1)
  }
  return count
}

export function daysInRange(from: Date, to: Date): Date[] {
  const days: Date[] = []
  const cur = new Date(from)
  while (cur <= to) {
    days.push(new Date(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return days
}

export function formatDayHeader(d: Date): string {
  return String(d.getDate())
}

export function shortDayName(d: Date): string {
  return d.toLocaleString('default', { weekday: 'short' }).slice(0, 1)
}
