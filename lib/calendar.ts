import type { Position } from '@/lib/watchlist'

export type DateEventKind = 'earnings' | 'exDiv'

export type DateEvent = {
  dayKey: string
  kind: DateEventKind
  ticker: string
  name: string
  row: number
}

export type CalendarCell = {
  dayKey: string
  day: number
  inMonth: boolean
}

export function localDayKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function dayKeyFromValue(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null
  const isoDay = trimmed.match(/^(\d{4}-\d{2}-\d{2})/)
  if (isoDay) return isoDay[1]
  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString().slice(0, 10)
}

export function dateEvents(positions: Position[]) {
  const events: DateEvent[] = []
  for (const position of positions) {
    const earningsDay = dayKeyFromValue(position.earnings)
    if (earningsDay) {
      events.push({
        dayKey: earningsDay,
        kind: 'earnings',
        ticker: position.ticker,
        name: position.name,
        row: position.row,
      })
    }
    const exDivDay = dayKeyFromValue(position.exDiv)
    if (exDivDay) {
      events.push({
        dayKey: exDivDay,
        kind: 'exDiv',
        ticker: position.ticker,
        name: position.name,
        row: position.row,
      })
    }
  }
  events.sort(
    (left, right) => left.dayKey.localeCompare(right.dayKey) || left.ticker.localeCompare(right.ticker) || left.kind.localeCompare(right.kind),
  )
  return events
}

export function eventsByDay(events: DateEvent[]) {
  const grouped = new Map<string, DateEvent[]>()
  for (const event of events) {
    const bucket = grouped.get(event.dayKey)
    if (bucket) bucket.push(event)
    else grouped.set(event.dayKey, [event])
  }
  return grouped
}

export function monthCells(year: number, month: number): CalendarCell[] {
  const firstWeekday = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrev = new Date(year, month, 0).getDate()
  const cells: CalendarCell[] = []

  for (let offset = firstWeekday; offset > 0; offset -= 1) {
    const day = daysInPrev - offset + 1
    const date = new Date(year, month - 1, day)
    cells.push({ dayKey: localDayKey(date), day, inMonth: false })
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day)
    cells.push({ dayKey: localDayKey(date), day, inMonth: true })
  }
  let nextDay = 1
  while (cells.length % 7 !== 0) {
    const date = new Date(year, month + 1, nextDay)
    cells.push({ dayKey: localDayKey(date), day: nextDay, inMonth: false })
    nextDay += 1
  }
  return cells
}

export function shiftMonth(year: number, month: number, delta: number) {
  const date = new Date(year, month + delta, 1)
  return { year: date.getFullYear(), month: date.getMonth() }
}

export const EARNINGS_WINDOWS = [
  { urgency: 'week', within: 7, label: 'Within 7 days' },
  { urgency: 'fortnight', within: 15, label: 'Within 15 days' },
  { urgency: 'month', within: 30, label: 'Within 30 days' },
] as const

export type EarningsUrgency = (typeof EARNINGS_WINDOWS)[number]['urgency']

export type EarningsProximity = {
  days: number
  dayKey: string
  urgency: EarningsUrgency
}

export function daysUntilDay(dayKey: string, now = new Date()) {
  const [year, month, day] = dayKey.split('-').map(Number)
  if (!year || !month || !day) return null
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const end = new Date(year, month - 1, day).getTime()
  return Math.round((end - start) / 86_400_000)
}

export function earningsProximity(earnings: string, now = new Date()): EarningsProximity | null {
  const dayKey = dayKeyFromValue(earnings)
  if (!dayKey) return null
  const days = daysUntilDay(dayKey, now)
  if (days === null || days < 0) return null
  const window = EARNINGS_WINDOWS.find((item) => days < item.within)
  if (!window) return null
  return { days, dayKey, urgency: window.urgency }
}

export function earningsWindowLabel(urgency: EarningsUrgency) {
  return EARNINGS_WINDOWS.find((item) => item.urgency === urgency)?.label ?? 'Upcoming earnings'
}
