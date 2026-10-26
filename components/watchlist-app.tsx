'use client'

import { useState } from 'react'
import { Plus, RefreshCw } from 'lucide-react'
import { GOOGLE_CLIENT_ID, useGoogleSession } from '@/lib/google-auth'
import { useWatchlist } from '@/lib/use-watchlist'
import { formatRelativeTime } from '@/lib/format'
import { usMarketStatus } from '@/lib/watchlist'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { GoogleSessionProvider } from '@/components/google-session-provider'
import { SignInView, Mark } from '@/components/sign-in-view'
import { AccountButton } from '@/components/account-button'
import { AddTickerDialog } from '@/components/add-ticker-dialog'
import { WatchlistTable, type TableView } from '@/components/watchlist-table'
import { WatchlistCalendar } from '@/components/watchlist-calendar'
import { PositionDrawer } from '@/components/position-drawer'
import { SummaryChips } from '@/components/summary-chips'
import { TooltipProvider } from '@/components/ui/tooltip'

export function WatchlistApp() {
  return (
    <GoogleSessionProvider>
      <Shell />
    </GoogleSessionProvider>
  )
}

function Shell() {
  const { status } = useGoogleSession()
  const { snapshot, positions, isLoading, error, retry, refresh, syncStatus, syncMessage } = useWatchlist()
  const [adding, setAdding] = useState(false)
  const [view, setView] = useState<TableView>('overview')
  const [selectedRow, setSelectedRow] = useState<number | null>(null)
  const selected = positions.find((position) => position.row === selectedRow) ?? null
  const market = usMarketStatus()

  if (!GOOGLE_CLIENT_ID || status === 'signed-out' || status === 'misconfigured') return <SignInView />

  return (
    <TooltipProvider>
    <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <header className="flex flex-col gap-4">
        {status === 'signed-in' ? (
          <AccountButton
            syncStatus={syncStatus}
            syncMessage={syncMessage}
            spreadsheetUrl={snapshot.spreadsheetUrl || undefined}
          />
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Mark />
            <h1 className="text-lg font-medium tracking-tight">Watchlist</h1>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] tracking-wide uppercase ${
                market === 'open' ? 'bg-up/15 text-up' : 'bg-secondary text-muted-foreground'
              }`}
            >
              Market {market}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <p className="hidden text-xs text-muted-foreground sm:block">{formatRelativeTime(snapshot.lastRefresh)}</p>
            <Button
              variant="outline"
              onClick={() => void refresh()}
              disabled={status !== 'signed-in' || syncStatus === 'refreshing' || syncStatus === 'saving'}
            >
              <RefreshCw className={syncStatus === 'refreshing' ? 'animate-spin' : undefined} aria-hidden />
              Refresh
            </Button>
            <Button onClick={() => setAdding(true)} disabled={status !== 'signed-in'}>
              <Plus aria-hidden />
              Add ticker
            </Button>
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-4">
        {status === 'loading' || isLoading ? (
          <p className="py-20 text-center text-sm text-muted-foreground">Opening your watchlist…</p>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <p className="max-w-md text-sm text-muted-foreground">Couldn’t load your watchlist. {error}</p>
            <Button variant="secondary" onClick={() => retry()}>
              Try again
            </Button>
          </div>
        ) : positions.length === 0 ? (
          <EmptyState onAdd={() => setAdding(true)} />
        ) : (
          <>
            <SummaryChips positions={positions} onSelect={setSelectedRow} />
            <div className="flex items-center justify-between gap-3">
              <Tabs value={view} onValueChange={(value) => setView(value as TableView)}>
                <TabsList>
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="range">Range</TabsTrigger>
                  <TabsTrigger value="valuation">Valuation</TabsTrigger>
                  <TabsTrigger value="calendar">Calendar</TabsTrigger>
                </TabsList>
              </Tabs>
              <WatchlistCalendar positions={positions} onSelect={setSelectedRow} />
            </div>
            <WatchlistTable positions={positions} view={view} selectedRow={selectedRow} onSelect={setSelectedRow} />
          </>
        )}
      </main>

      <AddTickerDialog open={adding} onOpenChange={setAdding} />
      <PositionDrawer position={selected} onClose={() => setSelectedRow(null)} />
    </div>
    </TooltipProvider>
  )
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border py-24 text-center">
      <p className="text-sm text-muted-foreground">Add a ticker to start your watchlist.</p>
      <Button onClick={onAdd}>
        <Plus aria-hidden />
        Add ticker
      </Button>
    </div>
  )
}
