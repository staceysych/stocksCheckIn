export const SCHEMA_VERSION = 5
export const WORKBOOK_NAME = 'stocks-watchlist'
export const WATCHLIST_SHEET = 'Watchlist'
export const META_SHEET = '_Meta'
export const HISTORY_SHEET = 'History'

export const HEADERS = [
  'ticker',
  'name',
  'idea',
  'target',
  'price',
  'changepct',
  'change',
  'low52',
  'high52',
  'pe',
  'eps',
  'marketcap',
  'volume',
  'beta',
  'currency',
  'tradetime',
  'target2',
  'sector',
  'ma20',
  'ma50',
  'ma100',
  'ma200',
  'pctExpect',
  'peTtm',
  'forwardPe',
  'priceToBook',
  'priceToSales',
  'divYield',
  'peg',
  'shortRatio',
  'targetAvg',
  'targetLow',
  'targetHigh',
  'exDiv',
  'earnings',
  'shares',
  'cost',
  'intent',
  'sell',
  'sell2',
  'buyUpTo',
  'sellUpTo',
] as const

export type Header = (typeof HEADERS)[number]

export const USER_HEADERS = [
  'ticker',
  'name',
  'idea',
  'target',
  'target2',
  'shares',
  'cost',
  'intent',
  'sell',
  'sell2',
  'buyUpTo',
  'sellUpTo',
] as const
export type UserHeader = (typeof USER_HEADERS)[number]

export const MARKET_HEADERS = HEADERS.filter(
  (header) => !USER_HEADERS.includes(header as UserHeader),
) as Exclude<Header, UserHeader>[]

export const HEADER_INDEX = Object.fromEntries(HEADERS.map((header, index) => [header, index])) as Record<
  Header,
  number
>

export function colLetter(index: number) {
  let n = index + 1
  let letters = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    letters = String.fromCharCode(65 + rem) + letters
    n = Math.floor((n - 1) / 26)
  }
  return letters
}

export const LAST_COL = colLetter(HEADERS.length - 1)
export const WATCHLIST_RANGE = `${WATCHLIST_SHEET}!A:${LAST_COL}`
export const HISTORY_RANGE = `${HISTORY_SHEET}!A:DZ`
export const V1_MARKET_HEADERS = HEADERS.slice(HEADER_INDEX.price, HEADER_INDEX.tradetime + 1)
export const V2_MARKET_HEADERS = HEADERS.slice(HEADER_INDEX.sector, HEADER_INDEX.earnings + 1)

export function cellRef(header: Header, row: number) {
  return `${colLetter(HEADER_INDEX[header])}${row}`
}

export function cellA1(header: Header, row: number) {
  return `${WATCHLIST_SHEET}!${cellRef(header, row)}`
}

export function rowRange(start: Header, end: Header, row: number) {
  return `${WATCHLIST_SHEET}!${cellRef(start, row)}:${cellRef(end, row)}`
}

export function sheetValue(value: string | number | null | undefined) {
  if (value === null || value === undefined) return ''
  return value
}
