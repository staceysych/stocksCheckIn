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
