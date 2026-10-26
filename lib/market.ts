export type DailyClose = {
  date: string
  close: number
}

export type MarketSnapshot = {
  ticker: string
  name: string
  sector: string
  price: number | null
  changepct: number | null
  change: number | null
  low52: number | null
  high52: number | null
  ma20: number | null
  ma50: number | null
  ma100: number | null
  ma200: number | null
  pe: number | null
  peTtm: number | null
  forwardPe: number | null
  eps: number | null
  peg: number | null
  priceToBook: number | null
  priceToSales: number | null
  divYield: number | null
  shortRatio: number | null
  beta: number | null
  marketcap: number | null
  volume: number | null
  currency: string
  tradetime: string
  targetAvg: number | null
  targetLow: number | null
  targetHigh: number | null
  pctExpect: number | null
  exDiv: string
  earnings: string
  closes: DailyClose[]
  quoteUnavailable: boolean
  error?: string
}

export function emptySnapshot(ticker: string, error?: string): MarketSnapshot {
  return {
    ticker: ticker.toUpperCase(),
    name: '',
    sector: '',
    price: null,
    changepct: null,
    change: null,
    low52: null,
    high52: null,
    ma20: null,
    ma50: null,
    ma100: null,
    ma200: null,
    pe: null,
    peTtm: null,
    forwardPe: null,
    eps: null,
    peg: null,
    priceToBook: null,
    priceToSales: null,
    divYield: null,
    shortRatio: null,
    beta: null,
    marketcap: null,
    volume: null,
    currency: '',
    tradetime: '',
    targetAvg: null,
    targetLow: null,
    targetHigh: null,
    pctExpect: null,
    exDiv: '',
    earnings: '',
    closes: [],
    quoteUnavailable: true,
    ...(error ? { error } : {}),
  }
}

export function normalizeTickers(input: unknown) {
  if (!Array.isArray(input)) return []
  const seen = new Set<string>()
  const tickers: string[] = []
  for (const value of input) {
    if (typeof value !== 'string') continue
    const ticker = value.trim().toUpperCase()
    if (!/^[A-Z0-9][A-Z0-9.\-]{0,11}$/.test(ticker)) continue
    if (seen.has(ticker)) continue
    seen.add(ticker)
    tickers.push(ticker)
    if (tickers.length >= 80) break
  }
  return tickers
}

export async function fetchSnapshots(tickers: string[]): Promise<MarketSnapshot[]> {
  const unique = normalizeTickers(tickers)
  if (unique.length === 0) return []

  const res = await fetch('/api/market/snapshots', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tickers: unique }),
  })

  const body = (await res.json().catch(() => null)) as
    | { snapshots?: MarketSnapshot[]; error?: string }
    | null

  if (!res.ok) {
    throw new Error(body?.error || 'Could not load Yahoo quotes.')
  }

  return body?.snapshots ?? []
}
