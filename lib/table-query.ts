import { latestTargetActivityTime } from '@/lib/activity'
import { hasUserTarget, INTENT_LABEL, type Position } from '@/lib/watchlist'

export type SortKey =
  | 'ticker'
  | 'price'
  | 'changepct'
  | 'target'
  | 'pctToTarget'
  | 'sell'
  | 'pctToSell'
  | 'buyUpTo'
  | 'sellUpTo'
  | 'intent'
  | 'pnlPct'
  | 'pe'
  | 'forwardPe'
  | 'peg'
  | 'priceToBook'
  | 'priceToSales'
  | 'divYield'
  | 'shortRatio'
  | 'ma20'
  | 'ma50'
  | 'ma100'
  | 'ma200'
  | 'range52'
  | 'low52'
  | 'high52'
  | 'targetAvg'
  | 'pctExpect'
  | 'sector'
  | 'earnings'
  | 'exDiv'
  | 'tradetime'

export type SortDir = 'asc' | 'desc'

export type SortState = {
  key: SortKey
  dir: SortDir
}

export const DEFAULT_SORT: SortState = { key: 'ticker', dir: 'asc' }

export type TargetFilter = 'any' | 'none' | 'set'
export type OwnedFilter = 'any' | 'yes' | 'no'

export type TableFilters = {
  target: TargetFilter
  owned: OwnedFilter
  sector: string | null
  updatedAfter: string
  updatedBefore: string
  pctExpectMin: string
  pctExpectMax: string
}

export const EMPTY_FILTERS: TableFilters = {
  target: 'any',
  owned: 'any',
  sector: null,
  updatedAfter: '',
  updatedBefore: '',
  pctExpectMin: '',
  pctExpectMax: '',
}

export const FILTER_CHIP_IDS = ['target', 'owned', 'updatedAfter', 'updatedBefore', 'sector', 'pctExpect'] as const
export type FilterChipId = (typeof FILTER_CHIP_IDS)[number]

export function chipHasValue(filters: TableFilters, id: FilterChipId) {
  switch (id) {
    case 'target':
      return filters.target !== 'any'
    case 'owned':
      return filters.owned !== 'any'
    case 'updatedAfter':
      return Boolean(filters.updatedAfter)
    case 'updatedBefore':
      return Boolean(filters.updatedBefore)
    case 'sector':
      return filters.sector !== null
    case 'pctExpect':
      return Boolean(filters.pctExpectMin.trim()) || Boolean(filters.pctExpectMax.trim())
  }
}

export function clearChip(filters: TableFilters, id: FilterChipId): TableFilters {
  switch (id) {
    case 'target':
      return { ...filters, target: 'any' }
    case 'owned':
      return { ...filters, owned: 'any' }
    case 'updatedAfter':
      return { ...filters, updatedAfter: '' }
    case 'updatedBefore':
      return { ...filters, updatedBefore: '' }
    case 'sector':
      return { ...filters, sector: null }
    case 'pctExpect':
      return { ...filters, pctExpectMin: '', pctExpectMax: '' }
  }
}

const TEXT_KEYS = new Set<SortKey>(['ticker', 'intent', 'sector'])

export function isTableView(view: string) {
  return view === 'overview' || view === 'range' || view === 'valuation' || view === 'calendar'
}

export function filtersActive(filters: TableFilters) {
  return (
    filters.target !== 'any' ||
    filters.owned !== 'any' ||
    filters.sector !== null ||
    Boolean(filters.updatedAfter) ||
    Boolean(filters.updatedBefore) ||
    Boolean(filters.pctExpectMin.trim()) ||
    Boolean(filters.pctExpectMax.trim())
  )
}

export function uniqueSectors(positions: Position[]) {
  const names = new Set<string>()
  let missing = false
  for (const position of positions) {
    const sector = position.sector.trim()
    if (sector) names.add(sector)
    else missing = true
  }
  return { names: [...names].sort((left, right) => left.localeCompare(right)), missing }
}

export function applyFilters(positions: Position[], filters: TableFilters) {
  const minExpect = parseBound(filters.pctExpectMin)
  const maxExpect = parseBound(filters.pctExpectMax)
  const after = startOfDay(filters.updatedAfter)
  const before = endOfDay(filters.updatedBefore)

  return positions.filter((position) => {
    if (filters.target === 'set' && !hasUserTarget(position)) return false
    if (filters.target === 'none' && hasUserTarget(position)) return false
    if (filters.owned === 'yes' && !position.owned) return false
    if (filters.owned === 'no' && position.owned) return false
    if (filters.sector !== null) {
      const sector = position.sector.trim()
      if (filters.sector === '' ? Boolean(sector) : sector !== filters.sector) return false
    }
    if (after !== null || before !== null) {
      const stamp = latestTargetActivityTime(position.targetActivity)
      if (stamp === null) return false
      if (after !== null && stamp < after) return false
      if (before !== null && stamp > before) return false
    }
    if (minExpect !== null || maxExpect !== null) {
      if (position.pctExpect === null) return false
      if (minExpect !== null && position.pctExpect < minExpect) return false
      if (maxExpect !== null && position.pctExpect > maxExpect) return false
    }
    return true
  })
}

export function sortPositions(positions: Position[], sort: SortState) {
  return [...positions].sort((left, right) => compareValues(sortValue(left, sort.key), sortValue(right, sort.key), sort.dir))
}

export function nextSort(current: SortState, key: SortKey): SortState {
  if (current.key !== key) return { key, dir: defaultDir(key) }
  if (key === 'ticker') return { key, dir: current.dir === 'asc' ? 'desc' : 'asc' }
  const flipped: SortDir = current.dir === 'asc' ? 'desc' : 'asc'
  if (flipped === defaultDir(key)) return DEFAULT_SORT
  return { key, dir: flipped }
}

function defaultDir(key: SortKey): SortDir {
  if (TEXT_KEYS.has(key) || key === 'earnings' || key === 'exDiv') return 'asc'
  return 'desc'
}

function sortValue(position: Position, key: SortKey): unknown {
  switch (key) {
    case 'intent':
      return INTENT_LABEL[position.intent]
    case 'ma20':
      return pctVsMa(position.price, position.ma20)
    case 'ma50':
      return pctVsMa(position.price, position.ma50)
    case 'ma100':
      return pctVsMa(position.price, position.ma100)
    case 'ma200':
      return position.pctVsMa200
    case 'range52':
      return position.rangePosition
    case 'earnings':
    case 'exDiv':
    case 'tradetime':
      return timestamp(position[key])
    default:
      return position[key]
  }
}

function compareValues(a: unknown, b: unknown, dir: SortDir) {
  const empty = (value: unknown) => value === null || value === undefined || value === ''
  if (empty(a) && empty(b)) return 0
  if (empty(a)) return 1
  if (empty(b)) return -1
  if (typeof a === 'number' && typeof b === 'number') return dir === 'asc' ? a - b : b - a
  return dir === 'asc' ? String(a).localeCompare(String(b)) : String(b).localeCompare(String(a))
}

function pctVsMa(price: number | null, ma: number | null) {
  if (price === null || ma === null || ma === 0) return null
  return (price / ma - 1) * 100
}

function parseBound(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

function timestamp(value: string) {
  if (!value) return null
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? null : parsed
}

function startOfDay(value: string) {
  if (!value) return null
  const parts = parseDateParts(value)
  if (!parts) return null
  return new Date(parts.year, parts.month, parts.day).getTime()
}

function endOfDay(value: string) {
  if (!value) return null
  const parts = parseDateParts(value)
  if (!parts) return null
  return new Date(parts.year, parts.month, parts.day, 23, 59, 59, 999).getTime()
}

function parseDateParts(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!match) return null
  return { year: Number(match[1]), month: Number(match[2]) - 1, day: Number(match[3]) }
}
