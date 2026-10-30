import 'server-only'

import YahooFinance from 'yahoo-finance2'
import { SECTOR_ETFS, type YahooSector } from '@/lib/sectors'
import {
  SECTOR_STAT_METRICS,
  summarizeValues,
  type SectorStatMetricId,
  type SectorStatsSnapshot,
} from '@/lib/sector-stats'

const yahooFinance = new YahooFinance({
  suppressNotices: ['yahooSurvey'],
  versionCheck: false,
  validation: { logErrors: false, allowAdditionalProps: true },
  queue: { concurrency: 3, interval: 80 },
})

const SECTOR_ETF_TICKERS = new Set(Object.values(SECTOR_ETFS))
const FUND_NAME = /\b(ETF|ETN|ETP|fund|trust)\b/i
const HOLDING_CAP = 25

type HoldingValuation = Record<SectorStatMetricId, number | null>

export async function yahooSectorStats(sector: YahooSector): Promise<SectorStatsSnapshot> {
  const etf = SECTOR_ETFS[sector]
  const tickers = await etfHoldings(etf)
  const rows = await Promise.all(tickers.map((ticker) => valuationFor(ticker)))
  const metrics = SECTOR_STAT_METRICS.flatMap((metric) => {
    const values = rows
      .map((row) => row[metric.id])
      .filter((value): value is number => value !== null && usable(metric.id, value))
    const stats = summarizeValues(values)
    if (!stats) return []
    return [{ id: metric.id, label: metric.label, kind: metric.kind, ...stats }]
  })

  return {
    sector,
    etf,
    fetchedAt: new Date().toISOString(),
    holdings: rows.length,
    metrics,
  }
}

async function etfHoldings(etf: string) {
  try {
    const summary = (await yahooFinance.quoteSummary(etf, { modules: ['topHoldings'] })) as {
      topHoldings?: { holdings?: Array<{ symbol?: string; holdingName?: string }> }
    }
    const tickers: string[] = []
    for (const row of summary?.topHoldings?.holdings ?? []) {
      const ticker = String(row.symbol ?? '').trim().toUpperCase()
      const name = String(row.holdingName ?? '').trim()
      if (!ticker || SECTOR_ETF_TICKERS.has(ticker) || FUND_NAME.test(name)) continue
      tickers.push(ticker)
      if (tickers.length >= HOLDING_CAP) break
    }
    return tickers
  } catch {
    return []
  }
}

async function valuationFor(ticker: string): Promise<HoldingValuation> {
  const empty: HoldingValuation = {
    pe: null,
    forwardPe: null,
    peg: null,
    priceToBook: null,
    priceToSales: null,
    divYield: null,
    shortRatio: null,
    pctExpect: null,
  }
  try {
    const summary = (await yahooFinance.quoteSummary(ticker, {
      modules: ['summaryDetail', 'defaultKeyStatistics', 'financialData'],
    })) as {
      summaryDetail?: {
        trailingPE?: number
        forwardPE?: number
        priceToBook?: number
        priceToSalesTrailing12Months?: number
        dividendYield?: number
        yield?: number
      }
      defaultKeyStatistics?: {
        trailingPE?: number
        forwardPE?: number
        pegRatio?: number
        priceToBook?: number
        shortRatio?: number
      }
      financialData?: {
        currentPrice?: number
        targetMeanPrice?: number
      }
    }
    const price = num(summary?.financialData?.currentPrice)
    const target = num(summary?.financialData?.targetMeanPrice)
    return {
      pe: num(summary?.summaryDetail?.trailingPE) ?? num(summary?.defaultKeyStatistics?.trailingPE),
      forwardPe: num(summary?.summaryDetail?.forwardPE) ?? num(summary?.defaultKeyStatistics?.forwardPE),
      peg: num(summary?.defaultKeyStatistics?.pegRatio),
      priceToBook: num(summary?.defaultKeyStatistics?.priceToBook) ?? num(summary?.summaryDetail?.priceToBook),
      priceToSales: num(summary?.summaryDetail?.priceToSalesTrailing12Months),
      divYield: percent(num(summary?.summaryDetail?.dividendYield) ?? num(summary?.summaryDetail?.yield)),
      shortRatio: num(summary?.defaultKeyStatistics?.shortRatio),
      pctExpect: price && target ? ((target / price) - 1) * 100 : null,
    }
  } catch {
    return empty
  }
}

function usable(id: SectorStatMetricId, value: number) {
  if (!Number.isFinite(value)) return false
  if (id === 'divYield') return value >= 0 && value <= 20
  if (id === 'pctExpect') return value >= -90 && value <= 400
  if (id === 'shortRatio') return value >= 0 && value <= 40
  return value > 0 && value <= 200
}

function num(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function percent(value: number | null) {
  if (value === null) return null
  return value > 0 && value <= 1 ? value * 100 : value
}
