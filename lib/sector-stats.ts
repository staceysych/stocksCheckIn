import { formatNumber, formatPct } from '@/lib/format'
import { SECTOR_ETFS, type YahooSector } from '@/lib/sectors'

export const SECTOR_STAT_METRICS = [
  { id: 'pe', label: 'PE', kind: 'number' },
  { id: 'forwardPe', label: 'Fwd PE', kind: 'number' },
  { id: 'peg', label: 'PEG', kind: 'number' },
  { id: 'priceToBook', label: 'P/B', kind: 'number' },
  { id: 'priceToSales', label: 'P/S', kind: 'number' },
  { id: 'divYield', label: 'Yield', kind: 'pct' },
  { id: 'shortRatio', label: 'Short', kind: 'number' },
  { id: 'pctExpect', label: '% expect', kind: 'pct' },
] as const

export type SectorStatMetricId = (typeof SECTOR_STAT_METRICS)[number]['id']

export type MetricStats = {
  id: SectorStatMetricId
  label: string
  kind: 'number' | 'pct'
  min: number
  max: number
  avg: number
  median: number
  n: number
}

export type SectorStatsSnapshot = {
  sector: YahooSector
  etf: string
  fetchedAt: string
  holdings: number
  metrics: MetricStats[]
}

export function sectorEtf(sector: YahooSector) {
  return SECTOR_ETFS[sector]
}

export function summarizeValues(values: number[]) {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((left, right) => left - right)
  const n = sorted.length
  if (n === 0) return null
  const min = sorted[0]
  const max = sorted[n - 1]
  const avg = sorted.reduce((sum, value) => sum + value, 0) / n
  const median =
    n % 2 === 1 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2
  return { min, max, avg, median, n }
}

export function formatStat(value: number | null, kind: 'number' | 'pct') {
  if (value === null) return '—'
  return kind === 'pct' ? formatPct(value) : formatNumber(value)
}

export function markerPosition(value: number, min: number, max: number) {
  if (max === min) return 50
  return Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100))
}

const CACHE_KEY = 'watchlist:sector-stats:v1'

type StatsCache = Partial<Record<YahooSector, SectorStatsSnapshot>>

export function readSectorStatsCache(sector: YahooSector) {
  try {
    if (typeof window === 'undefined') return null
    const raw = window.sessionStorage.getItem(CACHE_KEY)
    const parsed = raw ? (JSON.parse(raw) as StatsCache) : null
    return parsed?.[sector] ?? null
  } catch {
    return null
  }
}

export function writeSectorStatsCache(snapshot: SectorStatsSnapshot) {
  try {
    if (typeof window === 'undefined') return
    const raw = window.sessionStorage.getItem(CACHE_KEY)
    const parsed = (raw ? JSON.parse(raw) : {}) as StatsCache
    parsed[snapshot.sector] = snapshot
    window.sessionStorage.setItem(CACHE_KEY, JSON.stringify(parsed))
  } catch {
    // Private mode or quota.
  }
}
