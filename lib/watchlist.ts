import { HEADER_INDEX, HEADERS, type Header } from '@/lib/schema'
import type { DailyClose, MarketSnapshot } from '@/lib/market'

export const INTENTS = ['buy', 'add', 'trim', 'sell', 'watch', 'hold'] as const
export type Intent = (typeof INTENTS)[number]

export const INTENT_LABEL: Record<Intent, string> = {
  buy: 'Buy',
  add: 'Buy more',
  trim: 'Trim',
  sell: 'Sell all',
  watch: 'Watch',
  hold: 'Hold',
}

const INTENT_ALIASES: Record<string, Intent> = {
  buy: 'buy',
  add: 'add',
  'buy more': 'add',
  buymore: 'add',
  trim: 'trim',
  sell: 'sell',
  'sell all': 'sell',
  sellall: 'sell',
  watch: 'watch',
  hold: 'hold',
}

export type Position = {
  row: number
  ticker: string
  name: string
  idea: string
  target: number | null
  target2: number | null
  sell: number | null
  sell2: number | null
  buyUpTo: number | null
  sellUpTo: number | null
  shares: number | null
  cost: number | null
  intent: Intent
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
  pctExpect: number | null
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
  exDiv: string
  earnings: string
  quoteUnavailable: boolean
  pctToTarget: number | null
  pctToSell: number | null
  pctVsMa200: number | null
  inBuyZone: boolean
  inSellZone: boolean
  rangePosition: number | null
  owned: boolean
  marketValue: number | null
  costBasis: number | null
  pnl: number | null
  pnlPct: number | null
}

export type PositionUserPatch = Partial<
  Pick<
    Position,
    'name' | 'idea' | 'target' | 'target2' | 'sell' | 'sell2' | 'buyUpTo' | 'sellUpTo' | 'shares' | 'cost' | 'intent'
  >
>

export type PriceHistory = Record<string, DailyClose[]>

export type WatchlistSnapshot = {
  spreadsheetId: string
  spreadsheetUrl: string
  positions: Position[]
  history: PriceHistory
  lastRefresh: string | null
}

function cell(row: unknown[], header: Header) {
  return row[HEADER_INDEX[header]]
}

export function isErrorValue(value: unknown) {
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  return trimmed.startsWith('#')
}

export function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  if (isErrorValue(value)) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string') return null
  const cleaned = value.trim().replace(/[$,]/g, '')
  if (!cleaned) return null
  const percent = cleaned.endsWith('%')
  const n = Number(percent ? cleaned.slice(0, -1) : cleaned)
  return Number.isFinite(n) ? n : null
}

function parseText(value: unknown) {
  if (value === null || value === undefined || isErrorValue(value)) return ''
  return String(value).trim()
}

type DerivedKeys =
  | 'pctToTarget'
  | 'pctToSell'
  | 'inBuyZone'
  | 'inSellZone'
  | 'rangePosition'
  | 'pctVsMa200'
  | 'owned'
  | 'marketValue'
  | 'costBasis'
  | 'pnl'
  | 'pnlPct'

export function derivePosition(fields: Omit<Position, DerivedKeys>): Position {
  const owned = fields.shares !== null && fields.shares > 0
  const intent = normalizeIntent(fields.intent, owned, fields.target !== null)
  const usingBuy = showBuyLimits(intent)
  const usingSell = showSellLimits(intent)
  const pctToTarget =
    usingBuy && fields.price !== null && fields.target !== null && fields.target !== 0
      ? ((fields.price - fields.target) / fields.target) * 100
      : null
  const pctToSell =
    usingSell && fields.price !== null && fields.sell !== null && fields.sell !== 0
      ? ((fields.price - fields.sell) / fields.sell) * 100
      : null
  const inBuyZone = usingBuy && fields.price !== null && fields.target !== null && fields.price <= fields.target
  const inSellZone = usingSell && fields.price !== null && fields.sell !== null && fields.price >= fields.sell
  const span = fields.low52 !== null && fields.high52 !== null ? fields.high52 - fields.low52 : null
  const rangePosition =
    fields.price !== null && fields.low52 !== null && span !== null && span > 0
      ? Math.min(1, Math.max(0, (fields.price - fields.low52) / span))
      : null
  const pctVsMa200 =
    fields.price !== null && fields.ma200 !== null && fields.ma200 !== 0
      ? ((fields.price / fields.ma200) - 1) * 100
      : null
  const shares = fields.shares
  const marketValue = shares !== null && shares > 0 && fields.price !== null ? shares * fields.price : null
  const costBasis = shares !== null && shares > 0 && fields.cost !== null ? shares * fields.cost : null
  const pnl = marketValue !== null && costBasis !== null ? marketValue - costBasis : null
  const pnlPct =
    fields.price !== null && fields.cost !== null && fields.cost !== 0
      ? ((fields.price - fields.cost) / fields.cost) * 100
      : null

  return {
    ...fields,
    intent,
    pctToTarget,
    pctToSell,
    inBuyZone,
    inSellZone,
    rangePosition,
    pctVsMa200,
    owned,
    marketValue,
    costBasis,
    pnl,
    pnlPct: owned ? pnlPct : null,
  }
}

export function parseIntent(value: unknown): Intent | null {
  const raw = parseText(value).toLowerCase()
  return INTENT_ALIASES[raw] ?? null
}

export function defaultIntent(owned: boolean, hasTarget: boolean): Intent {
  if (owned) return 'hold'
  return hasTarget ? 'buy' : 'watch'
}

export function normalizeIntent(value: string | Intent | null | undefined, owned: boolean, hasTarget: boolean): Intent {
  const parsed = typeof value === 'string' ? parseIntent(value) : value ?? null
  if (parsed) {
    if (owned && (parsed === 'watch' || parsed === 'buy')) return 'hold'
    if (!owned && (parsed === 'add' || parsed === 'trim' || parsed === 'sell' || parsed === 'hold')) {
      return hasTarget ? 'buy' : 'watch'
    }
    return parsed
  }
  return defaultIntent(owned, hasTarget)
}

export function intentClass(intent: Intent) {
  if (intent === 'sell' || intent === 'trim') return 'text-sell'
  if (intent === 'add' || intent === 'buy') return 'text-buy'
  return 'text-muted-foreground'
}

export const PLAN_SECTIONS = ['buy', 'add', 'trim', 'sell', 'watchHold'] as const
export type PlanSection = (typeof PLAN_SECTIONS)[number]

export const PLAN_SECTION_LABEL: Record<PlanSection, string> = {
  buy: 'Buy',
  add: 'Buy more',
  trim: 'Trim',
  sell: 'Sell all',
  watchHold: 'Watch and hold',
}

export function planSection(intent: Intent): PlanSection {
  if (intent === 'watch' || intent === 'hold') return 'watchHold'
  return intent
}

export function sectionShowsBuyTarget(section: PlanSection) {
  return section === 'buy' || section === 'add' || section === 'watchHold'
}

export function sectionShowsSellTarget(section: PlanSection) {
  return section === 'trim' || section === 'sell'
}

export function groupByPlanSection(positions: Position[]) {
  return PLAN_SECTIONS.map((sectionId) => ({
    id: sectionId,
    label: PLAN_SECTION_LABEL[sectionId],
    positions: positions.filter((position) => planSection(position.intent) === sectionId),
  })).filter((section) => section.positions.length > 0)
}

export type SectorSlice = {
  sector: string
  value: number
  weight: number
  positions: Position[]
}

export function sectorAllocation(positions: Position[], mode: 'value' | 'count'): SectorSlice[] {
  const rows =
    mode === 'value'
      ? positions.filter((position) => position.owned && position.marketValue !== null && position.marketValue > 0)
      : positions
  const buckets = new Map<string, Position[]>()
  for (const position of rows) {
    const label = position.sector || 'Unclassified'
    const group = buckets.get(label)
    if (group) group.push(position)
    else buckets.set(label, [position])
  }
  const sized = [...buckets.entries()].map(([sector, group]) => {
    const value =
      mode === 'value'
        ? group.reduce((total, position) => total + (position.marketValue ?? 0), 0)
        : group.length
    return { sector, value, positions: group }
  })
  const total = sized.reduce((sum, slice) => sum + slice.value, 0)
  return sized
    .map((slice) => ({
      ...slice,
      weight: total === 0 ? 0 : slice.value / total,
      positions: [...slice.positions].sort((left, right) => {
        if (mode === 'value') return (right.marketValue ?? 0) - (left.marketValue ?? 0)
        return left.ticker.localeCompare(right.ticker)
      }),
    }))
    .sort((left, right) => right.value - left.value || left.sector.localeCompare(right.sector))
}

export function planTargetHint(intent: Intent) {
  switch (intent) {
    case 'buy':
      return 'Set a buy-under price so the row lights up when it’s in your zone.'
    case 'add':
      return 'Set a buy-under price for the next lot.'
    case 'trim':
      return 'Set a sell-above price to trim part of the position.'
    case 'sell':
      return 'Set a sell-above price so the row lights up when it’s time to sell all.'
    case 'hold':
      return 'Hold doesn’t use a buy or sell price. Switch the plan to set one.'
    case 'watch':
      return 'Optional: add a buy-under price if you might enter.'
  }
}

export function showBuyLimits(intent: Intent) {
  return intent === 'buy' || intent === 'add' || intent === 'watch'
}

export function showSellLimits(intent: Intent) {
  return intent === 'sell' || intent === 'trim'
}

export function exclusiveLimits(
  intent: Intent,
  limits: {
    target: number | null
    buyUpTo: number | null
    sell: number | null
    sellUpTo: number | null
  },
) {
  if (showSellLimits(intent)) {
    return {
      target: null,
      target2: null,
      buyUpTo: null,
      sell: limits.sell,
      sell2: null,
      sellUpTo: limits.sellUpTo,
    }
  }
  if (showBuyLimits(intent)) {
    return {
      target: limits.target,
      target2: null,
      buyUpTo: limits.buyUpTo,
      sell: null,
      sell2: null,
      sellUpTo: null,
    }
  }
  return { target: null, target2: null, buyUpTo: null, sell: null, sell2: null, sellUpTo: null }
}

export function sizeNotional(qty: number | null, price: number | null) {
  if (qty === null || price === null) return null
  return qty * price
}

export const CLOSE_TO_TARGET_PCT = 5

export type TargetTone = 'live' | 'close' | 'none'
export type MaTone = 'pullback' | 'extended' | 'none'

export function targetTone(price: number | null, target: number | null): TargetTone {
  if (price === null || target === null) return 'none'
  if (price <= target) return 'live'
  if (target === 0) return 'none'
  return ((price - target) / target) * 100 <= CLOSE_TO_TARGET_PCT ? 'close' : 'none'
}

export function sellTone(price: number | null, sell: number | null): TargetTone {
  if (price === null || sell === null) return 'none'
  if (price >= sell) return 'live'
  if (sell === 0) return 'none'
  return ((sell - price) / sell) * 100 <= CLOSE_TO_TARGET_PCT ? 'close' : 'none'
}

export function isNearBuy(position: Pick<Position, 'intent' | 'inBuyZone' | 'price' | 'target'>) {
  return showBuyLimits(position.intent) && !position.inBuyZone && targetTone(position.price, position.target) === 'close'
}

export function isNearSell(position: Pick<Position, 'intent' | 'inSellZone' | 'price' | 'sell'>) {
  return showSellLimits(position.intent) && !position.inSellZone && sellTone(position.price, position.sell) === 'close'
}

export function maTone(price: number | null, ma: number | null): MaTone {
  if (price === null || ma === null) return 'none'
  if (price < ma) return 'pullback'
  if (price > ma) return 'extended'
  return 'none'
}

export function parseWatchlistRows(rows: unknown[][]): Position[] {
  const body = rows.slice(1)
  const positions: Position[] = []

  body.forEach((row, index) => {
    const sheetRow = index + 2
    const ticker = parseText(cell(row, 'ticker')).toUpperCase()
    if (!ticker) return

    const priceRaw = cell(row, 'price')
    const quoteUnavailable = isErrorValue(priceRaw) || parseNumber(priceRaw) === null

    positions.push(
      derivePosition({
        row: sheetRow,
        ticker,
        name: parseText(cell(row, 'name')),
        idea: parseText(cell(row, 'idea')),
        target: parseNumber(cell(row, 'target')),
        target2: parseNumber(cell(row, 'target2')),
        sell: parseNumber(cell(row, 'sell')),
        sell2: parseNumber(cell(row, 'sell2')),
        buyUpTo: parseNumber(cell(row, 'buyUpTo')),
        sellUpTo: parseNumber(cell(row, 'sellUpTo')),
        shares: parseNumber(cell(row, 'shares')),
        cost: parseNumber(cell(row, 'cost')),
        intent: parseIntent(cell(row, 'intent')) ?? 'watch',
        sector: parseText(cell(row, 'sector')),
        price: parseNumber(priceRaw),
        changepct: parseNumber(cell(row, 'changepct')),
        change: parseNumber(cell(row, 'change')),
        low52: parseNumber(cell(row, 'low52')),
        high52: parseNumber(cell(row, 'high52')),
        ma20: parseNumber(cell(row, 'ma20')),
        ma50: parseNumber(cell(row, 'ma50')),
        ma100: parseNumber(cell(row, 'ma100')),
        ma200: parseNumber(cell(row, 'ma200')),
        pctExpect: parseNumber(cell(row, 'pctExpect')),
        pe: parseNumber(cell(row, 'pe')),
        peTtm: parseNumber(cell(row, 'peTtm')),
        forwardPe: parseNumber(cell(row, 'forwardPe')),
        eps: parseNumber(cell(row, 'eps')),
        peg: parseNumber(cell(row, 'peg')),
        priceToBook: parseNumber(cell(row, 'priceToBook')),
        priceToSales: parseNumber(cell(row, 'priceToSales')),
        divYield: parseNumber(cell(row, 'divYield')),
        shortRatio: parseNumber(cell(row, 'shortRatio')),
        beta: parseNumber(cell(row, 'beta')),
        marketcap: parseNumber(cell(row, 'marketcap')),
        volume: parseNumber(cell(row, 'volume')),
        currency: parseText(cell(row, 'currency')),
        tradetime: parseText(cell(row, 'tradetime')),
        targetAvg: parseNumber(cell(row, 'targetAvg')),
        targetLow: parseNumber(cell(row, 'targetLow')),
        targetHigh: parseNumber(cell(row, 'targetHigh')),
        exDiv: parseText(cell(row, 'exDiv')),
        earnings: parseText(cell(row, 'earnings')),
        quoteUnavailable,
      }),
    )
  })

  return positions
}

export function parseHistoryRows(rows: unknown[][]): PriceHistory {
  if (rows.length < 2) return {}
  const headers = (rows[0] ?? []).map((value) => String(value).trim().toUpperCase())
  const history: PriceHistory = {}

  for (let col = 1; col < headers.length; col++) {
    const ticker = headers[col]
    if (!ticker || ticker === 'DATE') continue
    const series: DailyClose[] = []
    for (let row = 1; row < rows.length; row++) {
      const date = parseHistoryDate(rows[row]?.[0])
      const close = parseNumber(rows[row]?.[col])
      if (!date || close === null) continue
      series.push({ date, close })
    }
    if (series.length > 0) history[ticker] = series
  }

  return history
}

function parseHistoryDate(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const utc = new Date(Date.UTC(1899, 11, 30) + value * 86_400_000)
    return Number.isNaN(utc.getTime()) ? '' : utc.toISOString().slice(0, 10)
  }
  const text = String(value ?? '').trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10)
  if (!text) return ''
  const parsed = new Date(text)
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10)
}

export function applySnapshot(position: Position, snapshot: MarketSnapshot): Position {
  return derivePosition({
    ...position,
    name: position.name || snapshot.name,
    sector: snapshot.sector || position.sector,
    price: snapshot.price,
    changepct: snapshot.changepct,
    change: snapshot.change,
    low52: snapshot.low52,
    high52: snapshot.high52,
    ma20: snapshot.ma20,
    ma50: snapshot.ma50,
    ma100: snapshot.ma100,
    ma200: snapshot.ma200,
    pctExpect: snapshot.pctExpect,
    pe: snapshot.pe,
    peTtm: snapshot.peTtm,
    forwardPe: snapshot.forwardPe,
    eps: snapshot.eps,
    peg: snapshot.peg,
    priceToBook: snapshot.priceToBook,
    priceToSales: snapshot.priceToSales,
    divYield: snapshot.divYield,
    shortRatio: snapshot.shortRatio,
    beta: snapshot.beta,
    marketcap: snapshot.marketcap,
    volume: snapshot.volume,
    currency: snapshot.currency || position.currency,
    tradetime: snapshot.tradetime,
    targetAvg: snapshot.targetAvg,
    targetLow: snapshot.targetLow,
    targetHigh: snapshot.targetHigh,
    exDiv: snapshot.exDiv,
    earnings: snapshot.earnings,
    quoteUnavailable: snapshot.quoteUnavailable,
  })
}

export function usMarketStatus(now = new Date()) {
  const ny = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const day = ny.getDay()
  if (day === 0 || day === 6) return 'closed' as const
  const minutes = ny.getHours() * 60 + ny.getMinutes()
  if (minutes >= 9 * 60 + 30 && minutes < 16 * 60) return 'open' as const
  return 'closed' as const
}

export function snapshotCells(snapshot: MarketSnapshot) {
  return {
    sector: snapshot.sector,
    price: snapshot.price,
    changepct: snapshot.changepct,
    change: snapshot.change,
    low52: snapshot.low52,
    high52: snapshot.high52,
    pe: snapshot.pe,
    eps: snapshot.eps,
    marketcap: snapshot.marketcap,
    volume: snapshot.volume,
    beta: snapshot.beta,
    currency: snapshot.currency,
    tradetime: snapshot.tradetime,
    ma20: snapshot.ma20,
    ma50: snapshot.ma50,
    ma100: snapshot.ma100,
    ma200: snapshot.ma200,
    pctExpect: snapshot.pctExpect,
    peTtm: snapshot.peTtm,
    forwardPe: snapshot.forwardPe,
    priceToBook: snapshot.priceToBook,
    priceToSales: snapshot.priceToSales,
    divYield: snapshot.divYield,
    peg: snapshot.peg,
    shortRatio: snapshot.shortRatio,
    targetAvg: snapshot.targetAvg,
    targetLow: snapshot.targetLow,
    targetHigh: snapshot.targetHigh,
    exDiv: snapshot.exDiv,
    earnings: snapshot.earnings,
  } as const
}
