import 'server-only'

import YahooFinance from 'yahoo-finance2'
import { emptySnapshot, type DailyClose, type MarketSnapshot } from '@/lib/market'

const yahooFinance = new YahooFinance({
  suppressNotices: ['yahooSurvey'],
  versionCheck: false,
  validation: { logErrors: false, allowAdditionalProps: true },
  queue: { concurrency: 3, interval: 80 },
})

type QuoteLike = {
  symbol?: string
  shortName?: string | null
  longName?: string | null
  displayName?: string | null
  regularMarketPrice?: number
  regularMarketChange?: number
  regularMarketChangePercent?: number
  regularMarketVolume?: number
  regularMarketTime?: Date | number | string
  fiftyTwoWeekLow?: number
  fiftyTwoWeekHigh?: number
  trailingPE?: number
  forwardPE?: number
  epsTrailingTwelveMonths?: number
  marketCap?: number
  beta?: number
  currency?: string
  fiftyDayAverage?: number
  twoHundredDayAverage?: number
  dividendYield?: number
}

type SummaryLike = {
  assetProfile?: { sector?: string | null }
  summaryProfile?: { sector?: string | null }
  summaryDetail?: {
    trailingPE?: number
    forwardPE?: number
    priceToBook?: number
    priceToSalesTrailing12Months?: number
    dividendYield?: number
    yield?: number
    beta?: number
    fiftyTwoWeekLow?: number
    fiftyTwoWeekHigh?: number
    exDividendDate?: Date | number | string
  }
  defaultKeyStatistics?: {
    trailingPE?: number
    forwardPE?: number
    pegRatio?: number
    shortRatio?: number
    priceToBook?: number
    beta?: number
    trailingEps?: number
  }
  financialData?: {
    targetMeanPrice?: number
    targetLowPrice?: number
    targetHighPrice?: number
    currentPrice?: number
  }
  calendarEvents?: {
    exDividendDate?: Date | number | string
    earnings?: { earningsDate?: Array<Date | number | string> }
  }
}

export async function yahooSnapshots(tickers: string[]): Promise<MarketSnapshot[]> {
  if (tickers.length === 0) return []

  const quotes = await quoteMap(tickers)
  const snapshots = await Promise.all(tickers.map((ticker) => snapshotFor(ticker, quotes.get(ticker))))
  return snapshots
}

async function quoteMap(tickers: string[]) {
  const map = new Map<string, QuoteLike>()
  try {
    const result = await yahooFinance.quote(tickers, { return: 'object' })
    for (const [symbol, quote] of Object.entries(result ?? {})) {
      if (quote) map.set(symbol.toUpperCase(), quote as QuoteLike)
    }
  } catch {
    await Promise.all(
      tickers.map(async (ticker) => {
        try {
          const quote = await yahooFinance.quote(ticker)
          if (quote) map.set(ticker, quote as QuoteLike)
        } catch {
          // Leave missing; snapshotFor marks those unavailable.
        }
      }),
    )
  }
  return map
}

async function snapshotFor(ticker: string, quote?: QuoteLike): Promise<MarketSnapshot> {
  const [summary, closes] = await Promise.all([quoteSummaryFor(ticker), chartCloses(ticker)])
  const price = num(quote?.regularMarketPrice) ?? num(summary?.financialData?.currentPrice)
  if (!quote && !summary && closes.length === 0) return emptySnapshot(ticker)

  const targetAvg = num(summary?.financialData?.targetMeanPrice)
  const ma20 = movingAverage(closes, 20)
  const ma50 = movingAverage(closes, 50) ?? num(quote?.fiftyDayAverage)
  const ma100 = movingAverage(closes, 100)
  const ma200 = movingAverage(closes, 200) ?? num(quote?.twoHundredDayAverage)
  const peTtm = num(quote?.trailingPE) ?? num(summary?.summaryDetail?.trailingPE) ?? num(summary?.defaultKeyStatistics?.trailingPE)
  const forwardPe = num(quote?.forwardPE) ?? num(summary?.summaryDetail?.forwardPE) ?? num(summary?.defaultKeyStatistics?.forwardPE)
  const dividend = percentFromYield(num(quote?.dividendYield) ?? num(summary?.summaryDetail?.dividendYield) ?? num(summary?.summaryDetail?.yield))
  const earningsDate = firstDate(summary?.calendarEvents?.earnings?.earningsDate)
  const exDiv = formatDay(summary?.calendarEvents?.exDividendDate ?? summary?.summaryDetail?.exDividendDate)

  return {
    ticker,
    name: quote?.shortName || quote?.displayName || quote?.longName || '',
    sector: summary?.assetProfile?.sector || summary?.summaryProfile?.sector || '',
    price,
    changepct: num(quote?.regularMarketChangePercent),
    change: num(quote?.regularMarketChange),
    low52: num(quote?.fiftyTwoWeekLow) ?? num(summary?.summaryDetail?.fiftyTwoWeekLow),
    high52: num(quote?.fiftyTwoWeekHigh) ?? num(summary?.summaryDetail?.fiftyTwoWeekHigh),
    ma20,
    ma50,
    ma100,
    ma200,
    pe: peTtm,
    peTtm,
    forwardPe,
    eps: num(quote?.epsTrailingTwelveMonths) ?? num(summary?.defaultKeyStatistics?.trailingEps),
    peg: num(summary?.defaultKeyStatistics?.pegRatio),
    priceToBook: num(summary?.defaultKeyStatistics?.priceToBook) ?? num(summary?.summaryDetail?.priceToBook),
    priceToSales: num(summary?.summaryDetail?.priceToSalesTrailing12Months),
    divYield: dividend,
    shortRatio: num(summary?.defaultKeyStatistics?.shortRatio),
    beta: num(quote?.beta) ?? num(summary?.defaultKeyStatistics?.beta) ?? num(summary?.summaryDetail?.beta),
    marketcap: num(quote?.marketCap),
    volume: num(quote?.regularMarketVolume),
    currency: quote?.currency || 'USD',
    tradetime: formatTime(quote?.regularMarketTime),
    targetAvg,
    targetLow: num(summary?.financialData?.targetLowPrice),
    targetHigh: num(summary?.financialData?.targetHighPrice),
    pctExpect: price && targetAvg ? ((targetAvg / price) - 1) * 100 : null,
    exDiv,
    earnings: earningsDate,
    closes,
    quoteUnavailable: price === null,
  }
}

async function quoteSummaryFor(ticker: string): Promise<SummaryLike | null> {
  try {
    return (await yahooFinance.quoteSummary(ticker, {
      modules: ['assetProfile', 'summaryProfile', 'summaryDetail', 'defaultKeyStatistics', 'financialData', 'calendarEvents'],
    })) as SummaryLike
  } catch {
    return null
  }
}

async function chartCloses(ticker: string): Promise<DailyClose[]> {
  try {
    const chart = await yahooFinance.chart(ticker, {
      period1: '1970-01-01',
      interval: '1d',
    })
    const quotes = Array.isArray(chart?.quotes) ? chart.quotes : []
    const closes: DailyClose[] = []
    for (const row of quotes) {
      const close = num(row?.close ?? row?.adjclose)
      const date = formatDay(row?.date)
      if (close === null || !date) continue
      closes.push({ date, close })
    }
    return closes
  } catch {
    return []
  }
}

function movingAverage(closes: DailyClose[], n: number) {
  if (closes.length < n) return null
  const slice = closes.slice(-n)
  const sum = slice.reduce((total, row) => total + row.close, 0)
  return sum / n
}

function num(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.getTime()
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function percentFromYield(value: number | null) {
  if (value === null) return null
  return value > 0 && value <= 1 ? value * 100 : value
}

function formatDay(value: unknown) {
  const date = asDate(value)
  if (!date) return ''
  return date.toISOString().slice(0, 10)
}

function formatTime(value: unknown) {
  const date = asDate(value)
  if (!date) return ''
  return date.toISOString()
}

function firstDate(values: Array<Date | number | string> | undefined) {
  if (!values?.length) return ''
  return formatDay(values[0])
}

function asDate(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value
  if (typeof value === 'number' && Number.isFinite(value)) {
    const ms = value < 1e12 ? value * 1000 : value
    const date = new Date(ms)
    return Number.isNaN(date.getTime()) ? null : date
  }
  if (typeof value === 'string' && value.trim()) {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }
  return null
}
