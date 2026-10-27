import {
  HEADERS,
  HISTORY_RANGE,
  HISTORY_SHEET,
  META_SHEET,
  SCHEMA_VERSION,
  V1_MARKET_HEADERS,
  V2_MARKET_HEADERS,
  WATCHLIST_RANGE,
  cellA1,
  colLetter,
  rowRange,
  sheetValue,
} from '@/lib/schema'
import { fetchSnapshots, type MarketSnapshot } from '@/lib/market'
import {
  applySnapshot,
  parseHistoryRows,
  parseWatchlistRows,
  snapshotCells,
  type Intent,
  type Position,
  type PositionUserPatch,
  type WatchlistSnapshot,
} from '@/lib/watchlist'

const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets'

export class SheetsError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message)
    this.name = 'SheetsError'
  }
}

export type WorkbookRef = {
  spreadsheetId: string
  watchlistSheetId: number
  metaSheetId: number
  historySheetId: number
  schemaVersion?: number
}

export async function sheetsFetch(token: string, url: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${token}`)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  const res = await fetch(url, { ...init, headers })
  if (res.ok) return res

  let detail = res.statusText
  try {
    const body = (await res.json()) as { error?: { message?: string } }
    if (body.error?.message) detail = body.error.message
  } catch {
    // Sheets sometimes returns an empty body on auth failures.
  }
  throw new SheetsError(detail, res.status)
}

type SheetValues = { values?: unknown[][] }

export async function readWatchlist(token: string, spreadsheetId: string): Promise<WatchlistSnapshot> {
  const query = [
    `ranges=${encodeURIComponent(WATCHLIST_RANGE)}`,
    `ranges=${encodeURIComponent(`${META_SHEET}!A1:B2`)}`,
    `ranges=${encodeURIComponent(HISTORY_RANGE)}`,
    'valueRenderOption=UNFORMATTED_VALUE',
    'dateTimeRenderOption=FORMATTED_STRING',
  ].join('&')
  const res = await sheetsFetch(token, `${SHEETS_API}/${spreadsheetId}/values:batchGet?${query}`)

  const data = (await res.json()) as { valueRanges?: SheetValues[] }
  const watchlistValues = data.valueRanges?.[0]?.values ?? []
  const metaValues = data.valueRanges?.[1]?.values ?? []
  const historyValues = data.valueRanges?.[2]?.values ?? []
  const lastRefresh = metaValues.find((row) => String(row[0]) === 'lastRefresh')?.[1]
  const headers = (watchlistValues[0] ?? []).map((value) => String(value))
  const aligned = alignRows(headers, watchlistValues)

  return {
    spreadsheetId,
    spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    positions: parseWatchlistRows(aligned),
    history: parseHistoryRows(historyValues),
    lastRefresh: lastRefresh ? String(lastRefresh) : null,
  }
}

function alignRows(headers: string[], rows: unknown[][]) {
  if (headers.length === 0) return [Array.from(HEADERS), ...rows.slice(1)]
  const index = new Map(headers.map((header, i) => [header, i]))
  const missingRequired = HEADERS.slice(0, 4).some((header) => !index.has(header))
  if (missingRequired) return rows
  return rows.map((row, rowIndex) => {
    if (rowIndex === 0) return Array.from(HEADERS)
    return HEADERS.map((header) => row[index.get(header) ?? -1] ?? '')
  })
}

export type PositionInput = {
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
}

export function dataRow(input: PositionInput, snapshot?: MarketSnapshot) {
  const market = snapshot ? snapshotCells(snapshot) : null
  return HEADERS.map((header) => {
    if (header === 'ticker') return input.ticker
    if (header === 'name') return input.name || snapshot?.name || ''
    if (header === 'idea') return input.idea
    if (header === 'target') return sheetValue(input.target)
    if (header === 'target2') return sheetValue(input.target2)
    if (header === 'sell') return sheetValue(input.sell)
    if (header === 'sell2') return sheetValue(input.sell2)
    if (header === 'buyUpTo') return sheetValue(input.buyUpTo)
    if (header === 'sellUpTo') return sheetValue(input.sellUpTo)
    if (header === 'shares') return sheetValue(input.shares)
    if (header === 'cost') return sheetValue(input.cost)
    if (header === 'intent') return input.intent
    if (!market) return ''
    if (header === 'sector') return market.sector
    return sheetValue(market[header as keyof typeof market] as string | number | null)
  })
}

export async function appendPosition(
  token: string,
  spreadsheetId: string,
  input: PositionInput,
  snapshot?: MarketSnapshot,
) {
  await sheetsFetch(token, `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(WATCHLIST_RANGE)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
    method: 'POST',
    body: JSON.stringify({ values: [dataRow(input, snapshot)] }),
  })
}

export async function updatePositionFields(
  token: string,
  spreadsheetId: string,
  row: number,
  patch: PositionUserPatch,
) {
  const data: { range: string; values: unknown[][] }[] = []
  if (patch.name !== undefined) data.push({ range: cellA1('name', row), values: [[patch.name]] })
  if (patch.idea !== undefined) data.push({ range: cellA1('idea', row), values: [[patch.idea]] })
  if (patch.target !== undefined) data.push({ range: cellA1('target', row), values: [[sheetValue(patch.target)]] })
  if (patch.target2 !== undefined) data.push({ range: cellA1('target2', row), values: [[sheetValue(patch.target2)]] })
  if (patch.sell !== undefined) data.push({ range: cellA1('sell', row), values: [[sheetValue(patch.sell)]] })
  if (patch.sell2 !== undefined) data.push({ range: cellA1('sell2', row), values: [[sheetValue(patch.sell2)]] })
  if (patch.buyUpTo !== undefined) data.push({ range: cellA1('buyUpTo', row), values: [[sheetValue(patch.buyUpTo)]] })
  if (patch.sellUpTo !== undefined) data.push({ range: cellA1('sellUpTo', row), values: [[sheetValue(patch.sellUpTo)]] })
  if (patch.shares !== undefined) data.push({ range: cellA1('shares', row), values: [[sheetValue(patch.shares)]] })
  if (patch.cost !== undefined) data.push({ range: cellA1('cost', row), values: [[sheetValue(patch.cost)]] })
  if (patch.intent !== undefined) data.push({ range: cellA1('intent', row), values: [[patch.intent]] })
  if (data.length === 0) return

  await sheetsFetch(token, `${SHEETS_API}/${spreadsheetId}/values:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      valueInputOption: 'USER_ENTERED',
      data,
    }),
  })
}

export async function deletePositionRow(token: string, ref: WorkbookRef, row: number) {
  await sheetsFetch(token, `${SHEETS_API}/${ref.spreadsheetId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: ref.watchlistSheetId,
              dimension: 'ROWS',
              startIndex: row - 1,
              endIndex: row,
            },
          },
        },
      ],
    }),
  })
}

export async function touchMetaRefresh(token: string, spreadsheetId: string) {
  const stamp = new Date().toISOString()
  await sheetsFetch(
    token,
    `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(`${META_SHEET}!A1:B2`)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      body: JSON.stringify({
        values: [
          ['schemaVersion', SCHEMA_VERSION],
          ['lastRefresh', stamp],
        ],
      }),
    },
  )
  return stamp
}

export async function refreshQuotes(token: string, ref: WorkbookRef) {
  const current = await readWatchlist(token, ref.spreadsheetId)
  const tickers = current.positions.map((position) => position.ticker)
  const snapshots = await fetchSnapshots(tickers)
  const byTicker = new Map(snapshots.map((snapshot) => [snapshot.ticker, snapshot]))
  const nextPositions = current.positions.map((position) => {
    const snapshot = byTicker.get(position.ticker)
    return snapshot ? applySnapshot(position, snapshot) : position
  })

  await writeMarketRows(token, ref.spreadsheetId, nextPositions, byTicker)
  await writeHistory(token, ref, snapshots.filter((snapshot) => snapshot.closes.length > 0))
  const stamp = await touchMetaRefresh(token, ref.spreadsheetId)
  const latest = await readWatchlist(token, ref.spreadsheetId)
  return { ...latest, lastRefresh: latest.lastRefresh ?? stamp }
}

async function writeMarketRows(
  token: string,
  spreadsheetId: string,
  positions: Position[],
  snapshots: Map<string, MarketSnapshot>,
) {
  const data: { range: string; values: unknown[][] }[] = []
  for (const position of positions) {
    const snapshot = snapshots.get(position.ticker)
    if (!snapshot) continue
    const market = snapshotCells(snapshot)
    data.push({
      range: rowRange('price', 'tradetime', position.row),
      values: [V1_MARKET_HEADERS.map((header) => sheetValue(market[header as keyof typeof market] as string | number | null))],
    })
    data.push({
      range: rowRange('sector', 'earnings', position.row),
      values: [V2_MARKET_HEADERS.map((header) => sheetValue(market[header as keyof typeof market] as string | number | null))],
    })
    if (!position.name && snapshot.name) {
      data.push({ range: cellA1('name', position.row), values: [[snapshot.name]] })
    }
  }
  if (data.length === 0) return

  for (let i = 0; i < data.length; i += 40) {
    await sheetsFetch(token, `${SHEETS_API}/${spreadsheetId}/values:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: data.slice(i, i + 40),
      }),
    })
  }
}

async function writeHistory(token: string, ref: WorkbookRef, snapshots: MarketSnapshot[]) {
  const dates = [...new Set(snapshots.flatMap((snapshot) => snapshot.closes.map((row) => row.date)))].sort()
  const tickers = snapshots.map((snapshot) => snapshot.ticker)
  const columnCount = Math.max(2, tickers.length + 1)
  const rowCount = Math.max(2, dates.length + 1)

  await sheetsFetch(token, `${SHEETS_API}/${ref.spreadsheetId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: [
        {
          updateSheetProperties: {
            properties: {
              sheetId: ref.historySheetId,
              gridProperties: { frozenRowCount: 1, rowCount: rowCount + 10, columnCount: columnCount + 4 },
            },
            fields: 'gridProperties.frozenRowCount,gridProperties.rowCount,gridProperties.columnCount',
          },
        },
        {
          updateCells: {
            range: { sheetId: ref.historySheetId },
            fields: 'userEnteredValue',
          },
        },
      ],
    }),
  })

  if (tickers.length === 0) return

  const closesByTicker = new Map(
    snapshots.map((snapshot) => [snapshot.ticker, new Map(snapshot.closes.map((row) => [row.date, row.close]))]),
  )
  const values: unknown[][] = [['Date', ...tickers]]
  for (const date of dates) {
    values.push([date, ...tickers.map((ticker) => closesByTicker.get(ticker)?.get(date) ?? '')])
  }

  const lastCol = colLetter(tickers.length)
  await sheetsFetch(
    token,
    `${SHEETS_API}/${ref.spreadsheetId}/values/${encodeURIComponent(`${HISTORY_SHEET}!A1:${lastCol}${values.length}`)}?valueInputOption=RAW`,
    {
      method: 'PUT',
      body: JSON.stringify({ values }),
    },
  )
}
