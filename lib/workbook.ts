import {
  HEADERS,
  HISTORY_SHEET,
  META_SHEET,
  SCHEMA_VERSION,
  WATCHLIST_SHEET,
  WORKBOOK_NAME,
  colLetter,
} from '@/lib/schema'
import { SheetsError, sheetsFetch, type WorkbookRef } from '@/lib/sheets'

const DRIVE_API = 'https://www.googleapis.com/drive/v3'
const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets'
const fileIdByUser = new Map<string, WorkbookRef>()

function cacheKey(userSub: string) {
  return `watchlist:spreadsheet:${userSub}`
}

function remembered(userSub: string): WorkbookRef | null {
  const live = fileIdByUser.get(userSub)
  if (isCurrentWorkbook(live)) return live
  try {
    const raw = window.sessionStorage.getItem(cacheKey(userSub))
    const parsed = raw ? (JSON.parse(raw) as WorkbookRef) : null
    if (isCurrentWorkbook(parsed)) return parsed
    return null
  } catch {
    return null
  }
}

function isCurrentWorkbook(ref: WorkbookRef | null | undefined): ref is WorkbookRef {
  return Boolean(ref?.spreadsheetId && ref.historySheetId != null && ref.schemaVersion === SCHEMA_VERSION)
}

function remember(userSub: string, ref: WorkbookRef) {
  const stored = { ...ref, schemaVersion: SCHEMA_VERSION }
  fileIdByUser.set(userSub, stored)
  window.sessionStorage.setItem(cacheKey(userSub), JSON.stringify(stored))
}

export function forgetWorkbook(userSub?: string) {
  if (userSub) {
    fileIdByUser.delete(userSub)
    window.sessionStorage.removeItem(cacheKey(userSub))
    return
  }
  fileIdByUser.clear()
}

type SheetProperties = {
  properties?: {
    sheetId?: number
    title?: string
    hidden?: boolean
    gridProperties?: { frozenRowCount?: number; columnCount?: number; rowCount?: number }
  }
}

async function searchWorkbook(token: string) {
  const query = encodeURIComponent(
    `name = '${WORKBOOK_NAME}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`,
  )
  const res = await sheetsFetch(
    token,
    `${DRIVE_API}/files?q=${query}&fields=files(id)&pageSize=1&spaces=drive`,
  )
  const data = (await res.json()) as { files?: { id: string }[] }
  return data.files?.[0]?.id ?? null
}

function headerCells() {
  return HEADERS.map((header) => ({
    userEnteredValue: { stringValue: header },
    userEnteredFormat: { textFormat: { bold: true } },
  }))
}

async function createWorkbook(token: string) {
  const res = await sheetsFetch(token, SHEETS_API, {
    method: 'POST',
    body: JSON.stringify({
      properties: {
        title: WORKBOOK_NAME,
        locale: 'en_US',
      },
      sheets: [
        {
          properties: {
            title: WATCHLIST_SHEET,
            index: 0,
            gridProperties: { frozenRowCount: 1, rowCount: 1000, columnCount: HEADERS.length + 2 },
          },
          data: [
            {
              startRow: 0,
              startColumn: 0,
              rowData: [{ values: headerCells() }],
            },
          ],
        },
        {
          properties: {
            title: HISTORY_SHEET,
            index: 1,
            gridProperties: { frozenRowCount: 1, rowCount: 320, columnCount: 80 },
          },
        },
        {
          properties: {
            title: META_SHEET,
            index: 2,
            hidden: true,
            gridProperties: { rowCount: 10, columnCount: 2 },
          },
          data: [
            {
              startRow: 0,
              startColumn: 0,
              rowData: [
                {
                  values: [
                    { userEnteredValue: { stringValue: 'schemaVersion' } },
                    { userEnteredValue: { numberValue: SCHEMA_VERSION } },
                  ],
                },
                {
                  values: [
                    { userEnteredValue: { stringValue: 'lastRefresh' } },
                    { userEnteredValue: { stringValue: '' } },
                  ],
                },
              ],
            },
          ],
        },
      ],
    }),
  })
  const created = (await res.json()) as { spreadsheetId?: string; sheets?: SheetProperties[] }
  if (!created.spreadsheetId) throw new SheetsError('Google did not return a spreadsheet id.')
  return refFromSheets(created.spreadsheetId, created.sheets ?? [])
}

function refFromSheets(spreadsheetId: string, sheets: SheetProperties[]): WorkbookRef {
  const watchlist = sheets.find((sheet) => sheet.properties?.title === WATCHLIST_SHEET)
  const meta = sheets.find((sheet) => sheet.properties?.title === META_SHEET)
  const history = sheets.find((sheet) => sheet.properties?.title === HISTORY_SHEET)
  if (watchlist?.properties?.sheetId == null) throw new SheetsError('Watchlist sheet is missing.')
  if (meta?.properties?.sheetId == null) throw new SheetsError('Meta sheet is missing.')
  if (history?.properties?.sheetId == null) throw new SheetsError('History sheet is missing.')
  return {
    spreadsheetId,
    watchlistSheetId: watchlist.properties.sheetId,
    metaSheetId: meta.properties.sheetId,
    historySheetId: history.properties.sheetId,
  }
}

async function loadSpreadsheet(token: string, spreadsheetId: string) {
  const res = await sheetsFetch(
    token,
    `${SHEETS_API}/${spreadsheetId}?fields=spreadsheetId,sheets.properties`,
  )
  const data = (await res.json()) as { spreadsheetId?: string; sheets?: SheetProperties[] }
  return data
}

async function ensureSchema(token: string, spreadsheetId: string): Promise<WorkbookRef> {
  const data = await loadSpreadsheet(token, spreadsheetId)
  const sheets = data.sheets ?? []
  const requests: unknown[] = []

  const watchlist = sheets.find((sheet) => sheet.properties?.title === WATCHLIST_SHEET)
  const hasWatchlist = Boolean(watchlist)
  const hasMeta = sheets.some((sheet) => sheet.properties?.title === META_SHEET)
  const hasHistory = sheets.some((sheet) => sheet.properties?.title === HISTORY_SHEET)

  if (!hasWatchlist) {
    requests.push({
      addSheet: {
        properties: {
          title: WATCHLIST_SHEET,
          gridProperties: { frozenRowCount: 1, rowCount: 1000, columnCount: HEADERS.length + 2 },
        },
      },
    })
  } else if ((watchlist?.properties?.gridProperties?.columnCount ?? 0) < HEADERS.length) {
    requests.push({
      updateSheetProperties: {
        properties: {
          sheetId: watchlist?.properties?.sheetId,
          gridProperties: { columnCount: HEADERS.length + 2 },
        },
        fields: 'gridProperties.columnCount',
      },
    })
  }
  if (!hasHistory) {
    requests.push({
      addSheet: {
        properties: {
          title: HISTORY_SHEET,
          gridProperties: { frozenRowCount: 1, rowCount: 320, columnCount: 80 },
        },
      },
    })
  }
  if (!hasMeta) {
    requests.push({
      addSheet: {
        properties: {
          title: META_SHEET,
          hidden: true,
          gridProperties: { rowCount: 10, columnCount: 2 },
        },
      },
    })
  }

  if (requests.length > 0) {
    await sheetsFetch(token, `${SHEETS_API}/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({ requests }),
    })
  }

  const headerRes = await sheetsFetch(
    token,
    `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(`${WATCHLIST_SHEET}!1:1`)}`,
  )
  const headerData = (await headerRes.json()) as { values?: unknown[][] }
  const headers = (headerData.values?.[0] ?? []).map((value) => String(value))
  const needsHeaders = headers[0] !== 'ticker'
  const missing = HEADERS.filter((header) => !headers.includes(header))

  if (needsHeaders) {
    await sheetsFetch(
      token,
      `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(`${WATCHLIST_SHEET}!A1`)}?valueInputOption=RAW`,
      {
        method: 'PUT',
        body: JSON.stringify({ values: [Array.from(HEADERS)] }),
      },
    )
  } else if (missing.length > 0) {
    const start = colLetter(headers.length)
    await sheetsFetch(
      token,
      `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(`${WATCHLIST_SHEET}!${start}1`)}?valueInputOption=RAW`,
      {
        method: 'PUT',
        body: JSON.stringify({ values: [missing] }),
      },
    )
  }

  await sheetsFetch(
    token,
    `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(`${META_SHEET}!A1:B1`)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      body: JSON.stringify({ values: [['schemaVersion', SCHEMA_VERSION]] }),
    },
  )

  const latest = await loadSpreadsheet(token, spreadsheetId)
  return refFromSheets(spreadsheetId, latest.sheets ?? [])
}

export async function getWorkbook(token: string, userSub: string): Promise<WorkbookRef> {
  const cached = remembered(userSub)
  if (cached) return cached

  const existingId = await searchWorkbook(token)
  const ref = existingId ? await ensureSchema(token, existingId) : await createWorkbook(token)
  remember(userSub, ref)
  return ref
}

export async function getWorkbookFresh(token: string, userSub: string): Promise<WorkbookRef> {
  forgetWorkbook(userSub)
  return getWorkbook(token, userSub)
}
