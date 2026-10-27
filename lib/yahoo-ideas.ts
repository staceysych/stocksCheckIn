import 'server-only'

import YahooFinance from 'yahoo-finance2'
import { SECTOR_ETFS, type SectorIdea, type SectorIdeaGroup, type YahooSector } from '@/lib/sectors'

const yahooFinance = new YahooFinance({
  suppressNotices: ['yahooSurvey'],
  versionCheck: false,
  validation: { logErrors: false, allowAdditionalProps: true },
  queue: { concurrency: 3, interval: 80 },
})

const SECTOR_ETF_TICKERS = new Set(Object.values(SECTOR_ETFS))
const FUND_NAME = /\b(ETF|ETN|ETP|fund|trust)\b/i

export async function yahooSectorIdeas(
  sectors: YahooSector[],
  exclude: string[],
  limit = 5,
): Promise<SectorIdeaGroup[]> {
  const skip = new Set(exclude.map((ticker) => ticker.trim().toUpperCase()).filter(Boolean))
  const take = Math.min(15, Math.max(1, Math.floor(limit)))
  return Promise.all(sectors.map((sector) => ideasForSector(sector, skip, take)))
}

async function ideasForSector(sector: YahooSector, skip: Set<string>, limit: number): Promise<SectorIdeaGroup> {
  const etf = SECTOR_ETFS[sector]
  try {
    const summary = (await yahooFinance.quoteSummary(etf, { modules: ['topHoldings'] })) as {
      topHoldings?: { holdings?: Array<{ symbol?: string; holdingName?: string; holdingPercent?: number }> }
    }
    const candidates: SectorIdea[] = []
    for (const row of summary?.topHoldings?.holdings ?? []) {
      const ticker = String(row.symbol ?? '').trim().toUpperCase()
      const name = String(row.holdingName ?? '').trim()
      if (!ticker || skip.has(ticker) || SECTOR_ETF_TICKERS.has(ticker) || FUND_NAME.test(name)) continue
      const holding = row.holdingPercent
      candidates.push({
        ticker,
        name,
        holdingPct:
          typeof holding === 'number' && Number.isFinite(holding)
            ? holding > 0 && holding <= 1
              ? holding * 100
              : holding
            : null,
      })
      if (candidates.length >= 30) break
    }
    const stocks = await equityTickers(candidates.map((row) => row.ticker))
    return {
      sector,
      etf,
      ideas: candidates.filter((row) => stocks.has(row.ticker)).slice(0, limit),
    }
  } catch {
    return { sector, etf, ideas: [] }
  }
}

async function equityTickers(tickers: string[]) {
  const stocks = new Set<string>()
  if (tickers.length === 0) return stocks

  const notFund = (type: string) => {
    const kind = type.toUpperCase()
    return kind !== 'ETF' && kind !== 'MUTUALFUND' && kind !== 'INDEX' && kind !== 'ETN'
  }

  try {
    const result = (await yahooFinance.quote(tickers, { return: 'object' })) as Record<
      string,
      { quoteType?: string } | undefined
    >
    for (const [symbol, quote] of Object.entries(result ?? {})) {
      if (notFund(String(quote?.quoteType ?? 'EQUITY'))) stocks.add(symbol.toUpperCase())
    }
    if (stocks.size > 0) return stocks
  } catch {
    // Fall through and keep name-filtered candidates.
  }

  for (const ticker of tickers) stocks.add(ticker)
  return stocks
}
