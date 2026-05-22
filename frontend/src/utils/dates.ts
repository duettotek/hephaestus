export function projectInitials(name: string): string {
  const words = name.trim().split(/\s+/)
  return words.length >= 2
    ? (words[0][0] + words[1][0]).toUpperCase()
    : name.trim().slice(0, 2).toUpperCase()
}

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

/** Working days (Mon–Fri) in range, excluding Italian public holidays */
export function countEffectiveDays(from: Date, to: Date): number {
  const yearsNeeded = new Set<number>()
  for (let y = from.getFullYear(); y <= to.getFullYear(); y++) yearsNeeded.add(y)
  const holidays = new Set<string>()
  yearsNeeded.forEach(y => italianHolidays(y).forEach(h => holidays.add(h)))
  let count = 0
  const cur = new Date(from)
  while (cur <= to) {
    const day = cur.getDay()
    if (day !== 0 && day !== 6 && !holidays.has(isoDate(cur))) count++
    cur.setDate(cur.getDate() + 1)
  }
  return count
}

/** Anonymous Gregorian algorithm for Easter Sunday */
function easterSunday(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month, day)
}

/** Returns a Set of ISO date strings for Italian public holidays in the given year */
export function italianHolidays(year: number): Set<string> {
  const fixed = [
    [0, 1],   // Capodanno
    [0, 6],   // Epifania
    [3, 25],  // Liberazione
    [4, 1],   // Festa del Lavoro
    [5, 2],   // Festa della Repubblica
    [7, 15],  // Ferragosto
    [10, 1],  // Ognissanti
    [11, 8],  // Immacolata Concezione
    [11, 25], // Natale
    [11, 26], // Santo Stefano
  ]
  const holidays = new Set(fixed.map(([m, d]) => {
    const date = new Date(year, m, d)
    return `${year}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  }))
  const easter = easterSunday(year)
  holidays.add(isoDate(easter))
  const pasquetta = new Date(easter)
  pasquetta.setDate(easter.getDate() + 1)
  holidays.add(isoDate(pasquetta))
  return holidays
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
