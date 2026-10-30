import { formatDateTime, formatPrice } from '@/lib/format'

export const TARGET_ACTIVITY_FIELDS = ['target', 'sell'] as const
export type TargetActivityField = (typeof TARGET_ACTIVITY_FIELDS)[number]

export type TargetActivity = {
  at: string
  ticker: string
  field: TargetActivityField
  from: number | null
  to: number | null
}

export function sameAmount(left: number | null | undefined, right: number | null | undefined) {
  if (left === null || left === undefined) return right === null || right === undefined
  if (right === null || right === undefined) return false
  return left === right
}

export function targetActivityEvents(
  ticker: string,
  before: { target: number | null; sell: number | null },
  after: { target?: number | null; sell?: number | null },
  at = new Date().toISOString(),
): TargetActivity[] {
  const events: TargetActivity[] = []
  const symbol = ticker.trim().toUpperCase()
  if (after.target !== undefined && !sameAmount(before.target, after.target)) {
    events.push({ at, ticker: symbol, field: 'target', from: before.target, to: after.target })
  }
  if (after.sell !== undefined && !sameAmount(before.sell, after.sell)) {
    events.push({ at, ticker: symbol, field: 'sell', from: before.sell, to: after.sell })
  }
  return events
}

export function parseActivityRows(rows: unknown[][]): TargetActivity[] {
  if (rows.length < 2) return []
  const events: TargetActivity[] = []
  for (const row of rows.slice(1)) {
    const ticker = String(row[1] ?? '').trim().toUpperCase()
    const field = String(row[2] ?? '').trim()
    const at = String(row[0] ?? '').trim()
    if (!ticker || !at || (field !== 'target' && field !== 'sell')) continue
    events.push({
      at,
      ticker,
      field,
      from: parseAmount(row[3]),
      to: parseAmount(row[4]),
    })
  }
  return events.sort((left, right) => right.at.localeCompare(left.at) || left.ticker.localeCompare(right.ticker))
}

export function activityByTicker(events: TargetActivity[]) {
  const grouped: Record<string, TargetActivity[]> = {}
  for (const event of events) {
    const list = grouped[event.ticker] ?? []
    list.push(event)
    grouped[event.ticker] = list
  }
  return grouped
}

export function latestTargetActivity(events: TargetActivity[]) {
  return events[0] ?? null
}

export function latestTargetActivityTime(events: TargetActivity[]) {
  const latest = latestTargetActivity(events)
  if (!latest) return null
  const parsed = Date.parse(latest.at)
  return Number.isNaN(parsed) ? null : parsed
}

export function activityFieldLabel(field: TargetActivityField) {
  return field === 'sell' ? 'Sell above' : 'Buy under'
}

export function formatTargetActivity(event: TargetActivity, currency = 'USD') {
  const from = event.from === null ? 'none' : formatPrice(event.from, currency)
  const to = event.to === null ? 'none' : formatPrice(event.to, currency)
  return `${activityFieldLabel(event.field)} ${from} → ${to}`
}

export function formatTargetActivityStamp(event: TargetActivity) {
  return formatDateTime(event.at)
}

export function activityRow(event: TargetActivity) {
  return [event.at, event.ticker, event.field, event.from ?? '', event.to ?? '']
}

function parseAmount(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}
