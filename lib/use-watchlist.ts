'use client'

import { useEffect, useSyncExternalStore } from 'react'
import useSWR from 'swr'
import { refreshAgeMinutes } from '@/lib/format'
import { getAccessToken, useGoogleSession } from '@/lib/google-auth'
import { fetchSnapshots } from '@/lib/market'
import {
  SheetsError,
  appendPosition,
  deletePositionRow,
  readWatchlist,
  refreshQuotes,
  updatePositionFields,
  type PositionInput,
  type WorkbookRef,
} from '@/lib/sheets'
import { forgetWorkbook, getWorkbook, getWorkbookFresh } from '@/lib/workbook'
import { derivePosition, type PositionUserPatch, type WatchlistSnapshot } from '@/lib/watchlist'

export type SyncStatus = 'idle' | 'saving' | 'saved' | 'refreshing' | 'error'

const AUTO_REFRESH_AFTER_MINUTES = 24 * 60
const autoRefreshedUsers = new Set<string>()

type SyncState = {
  status: SyncStatus
  message: string | null
}

let syncState: SyncState = { status: 'idle', message: null }
const syncListeners = new Set<() => void>()

function setSyncState(next: SyncState) {
  syncState = next
  syncListeners.forEach((listener) => listener())
}

const emptySnapshot: WatchlistSnapshot = {
  spreadsheetId: '',
  spreadsheetUrl: '',
  positions: [],
  history: {},
  lastRefresh: null,
}

async function withWorkbook<T>(userSub: string, work: (token: string, ref: WorkbookRef) => Promise<T>) {
  const token = await getAccessToken()
  try {
    const ref = await getWorkbook(token, userSub)
    return await work(token, ref)
  } catch (error) {
    if (!(error instanceof SheetsError) || (error.status !== 404 && error.status !== 403)) throw error
    const retryToken = await getAccessToken()
    const ref = await getWorkbookFresh(retryToken, userSub)
    return work(retryToken, ref)
  }
}

async function loadSnapshot(userSub: string) {
  return withWorkbook(userSub, (token, ref) => readWatchlist(token, ref.spreadsheetId))
}

export function useWatchlist() {
  const { status, user } = useGoogleSession()
  const signedIn = status === 'signed-in' && user
  const { data, mutate, isLoading, error, isValidating } = useSWR<WatchlistSnapshot>(
    signedIn ? ['watchlist', user.sub] : null,
    ([, userSub]: [string, string]) => loadSnapshot(userSub),
    { revalidateOnFocus: false },
  )
  const sync = useSyncExternalStore(
    (listener) => {
      syncListeners.add(listener)
      return () => syncListeners.delete(listener)
    },
    () => syncState,
    () => syncState,
  )

  const snapshot = data ?? emptySnapshot

  const run = async (action: () => Promise<WatchlistSnapshot>, status: SyncStatus) => {
    setSyncState({ status, message: null })
    try {
      const next = await action()
      await mutate(next, { revalidate: false })
      setSyncState({ status: 'saved', message: null })
      return next
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Could not update your watchlist.'
      setSyncState({ status: 'error', message })
      await mutate()
      throw caught
    }
  }

  useEffect(() => {
    if (!user || !data) return
    if (autoRefreshedUsers.has(user.sub)) return
    if (data.positions.length === 0) return
    const age = refreshAgeMinutes(data.lastRefresh)
    if (age !== null && age < AUTO_REFRESH_AFTER_MINUTES) return
    autoRefreshedUsers.add(user.sub)
    void run(
      () => withWorkbook(user.sub, (token, ref) => refreshQuotes(token, ref)),
      'refreshing',
    )
  }, [user, data])

  return {
    snapshot,
    positions: snapshot.positions,
    isLoading: Boolean(signedIn) && isLoading && !data,
    isValidating,
    error: error instanceof Error ? error.message : null,
    syncStatus: sync.status,
    syncMessage: sync.message,
    hasTicker: (ticker: string) =>
      snapshot.positions.some((position) => position.ticker === ticker.trim().toUpperCase()),
    addTicker: async (input: PositionInput) => {
      if (!user) return
      const ticker = input.ticker.trim().toUpperCase()
      await run(async () => {
        const [yahoo] = await fetchSnapshots([ticker])
        await withWorkbook(user.sub, (token, ref) =>
          appendPosition(token, ref.spreadsheetId, { ...input, ticker, name: input.name || yahoo?.name || '' }, yahoo),
        )
        return withWorkbook(user.sub, (token, ref) => readWatchlist(token, ref.spreadsheetId))
      }, 'saving')
    },
    updateTicker: async (row: number, patch: PositionUserPatch) => {
      if (!user) return
      const optimistic: WatchlistSnapshot = {
        ...snapshot,
        positions: snapshot.positions.map((position) => {
          if (position.row !== row) return position
          return derivePosition({ ...position, ...patch })
        }),
      }
      await mutate(optimistic, { revalidate: false })
      await run(async () => {
        await withWorkbook(user.sub, (token, ref) => updatePositionFields(token, ref.spreadsheetId, row, patch))
        return withWorkbook(user.sub, (token, ref) => readWatchlist(token, ref.spreadsheetId))
      }, 'saving')
    },
    removeTicker: async (row: number) => {
      if (!user) return
      await mutate(
        {
          ...snapshot,
          positions: snapshot.positions.filter((position) => position.row !== row),
        },
        { revalidate: false },
      )
      await run(async () => {
        const token = await getAccessToken()
        const ref = await getWorkbook(token, user.sub)
        await deletePositionRow(token, ref, row)
        return readWatchlist(token, ref.spreadsheetId)
      }, 'saving')
    },
    refresh: async () => {
      if (!user) return
      await run(
        () => withWorkbook(user.sub, (token, ref) => refreshQuotes(token, ref)),
        'refreshing',
      )
    },
    retry: () => mutate(),
  }
}

export function clearWatchlistSession(userSub?: string) {
  if (userSub) autoRefreshedUsers.delete(userSub)
  else autoRefreshedUsers.clear()
  forgetWorkbook(userSub)
  setSyncState({ status: 'idle', message: null })
}
