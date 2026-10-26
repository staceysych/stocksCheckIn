import { HEADER_INDEX, HEADERS, type Header } from '@/lib/schema'
import type { MarketSnapshot } from '@/lib/market'

export const INTENTS = ['watch', 'buy', 'hold', 'add', 'sell'] as const
export type Intent = (typeof INTENTS)[number]

export const INTENT_LABEL: Record<Intent, string> = {
  watch: 'Watch',
  buy: 'Buy',
  hold: 'Hold',
  add: 'Buy more',
  sell: 'Sell',
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
  Pick<Position, 'name' | 'idea' | 'target' | 'target2' | 'sell' | 'sell2' | 'shares' | 'cost' | 'intent'>
>

export type WatchlistSnapshot = {
  spreadsheetId: string
  spreadsheetUrl: string
  positions: Position[]
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
  const intent = normalizeIntent(fields.intent, owned, fields.target !== null || fields.target2 !== null)
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
  const buyPrices = [fields.target, fields.target2].filter((value): value is number => value !== null)
  const sellPrices = [fields.sell, fields.sell2].filter((value): value is number => value !== null)
  const inBuyZone =
    usingBuy && fields.price !== null && buyPrices.some((target) => fields.price !== null && fields.price <= target)
  const inSellZone =
    usingSell && fields.price !== null && sellPrices.some((sell) => fields.price !== null && fields.price >= sell)
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
  return INTENTS.includes(raw as Intent) ? (raw as Intent) : null
}

export function defaultIntent(owned: boolean, hasTarget: boolean): Intent {
  if (owned) return 'hold'
  return hasTarget ? 'buy' : 'watch'
}

export function normalizeIntent(value: string | Intent | null | undefined, owned: boolean, hasTarget: boolean): Intent {
  const parsed = typeof value === 'string' ? parseIntent(value) : value ?? null
  if (parsed) {
    if (owned && (parsed === 'watch' || parsed === 'buy')) return 'hold'
    return parsed
  }
  return defaultIntent(owned, hasTarget)
}

export function intentClass(intent: Intent) {
  if (intent === 'sell') return 'text-sell'
  if (intent === 'add' || intent === 'buy') return 'text-buy'
  return 'text-muted-foreground'
}

export const PLAN_SECTIONS = ['buy', 'sell', 'holdWatch'] as const
export type PlanSection = (typeof PLAN_SECTIONS)[number]

export const PLAN_SECTION_LABEL: Record<PlanSection, string> = {
  buy: 'Buy',
  sell: 'Sell',
  holdWatch: 'Hold & watch',
}

export function planSection(intent: Intent): PlanSection {
  if (intent === 'sell') return 'sell'
  if (intent === 'buy' || intent === 'add') return 'buy'
  return 'holdWatch'
}

export function groupByPlanSection(positions: Position[]) {
  return PLAN_SECTIONS.map((sectionId) => ({
    id: sectionId,
    label: PLAN_SECTION_LABEL[sectionId],
    positions: positions.filter((position) => planSection(position.intent) === sectionId),
  })).filter((section) => section.positions.length > 0)
}

export function planTargetHint(intent: Intent) {
  switch (intent) {
    case 'buy':
      return 'Set a buy-under price so the row lights up when it’s in your zone.'
    case 'add':
      return 'Set a buy-under price for the next lot.'
    case 'sell':
      return 'Set a sell-above price so the row lights up when it’s time to take profit.'
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
  return intent === 'sell'
}

export function exclusiveLimits(
  intent: Intent,
  limits: {
    target: number | null
    target2: number | null
    sell: number | null
    sell2: number | null
  },
) {
  if (showSellLimits(intent)) {
    return { target: null, target2: null, sell: limits.sell, sell2: limits.sell2 }
  }
  if (showBuyLimits(intent)) {
    return { target: limits.target, target2: limits.target2, sell: null, sell2: null }
  }
  return { target: null, target2: null, sell: null, sell2: null }
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

export function isNearBuy(position: Pick<Position, 'intent' | 'inBuyZone' | 'price' | 'target' | 'target2'>) {
  return (
    showBuyLimits(position.intent) &&
    !position.inBuyZone &&
    (targetTone(position.price, position.target) === 'close' || targetTone(position.price, position.target2) === 'close')
  )
}

export function isNearSell(position: Pick<Position, 'intent' | 'inSellZone' | 'price' | 'sell' | 'sell2'>) {
  return (
    showSellLimits(position.intent) &&
    !position.inSellZone &&
    (sellTone(position.price, position.sell) === 'close' || sellTone(position.price, position.sell2) === 'close')
  )
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
