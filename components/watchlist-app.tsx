'use client'

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { Plus, RefreshCw } from 'lucide-react'
import { GOOGLE_CLIENT_ID, useGoogleSession } from '@/lib/google-auth'
import { useWatchlist } from '@/lib/use-watchlist'
import { formatRelativeTime, refreshAgeMinutes } from '@/lib/format'
import { cn } from '@/lib/utils'
import { usMarketStatus } from '@/lib/watchlist'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { GoogleSessionProvider } from '@/components/google-session-provider'
import { SignInView, Mark } from '@/components/sign-in-view'
import { AccountButton } from '@/components/account-button'
import { AddTickerDialog } from '@/components/add-ticker-dialog'
import { WatchlistTable, type TableView } from '@/components/watchlist-table'
import { TableFiltersBar } from '@/components/table-filters'
import {
  applyFilters,
  DEFAULT_SORT,
  EMPTY_FILTERS,
  isTableView,
  nextSort,
  sortPositions,
  type TableFilters,
} from '@/lib/table-query'
import { SectorChart } from '@/components/sector-chart'
import { SectorOverview } from '@/components/sector-overview'
import { WatchlistCalendar } from '@/components/watchlist-calendar'
import { PositionDrawer } from '@/components/position-drawer'
import { SummaryChips } from '@/components/summary-chips'
import { TooltipProvider } from '@/components/ui/tooltip'

const HistoryChart = dynamic(
  () => import('@/components/history-chart').then((mod) => mod.HistoryChart),
  {
    ssr: false,
    loading: () => <p className="py-16 text-center text-sm text-muted-foreground">Loading chart…</p>,
  },
)

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
  const [filters, setFilters] = useState<TableFilters>(EMPTY_FILTERS)
  const [sort, setSort] = useState(DEFAULT_SORT)
  const selected = positions.find((position) => position.row === selectedRow) ?? null
  const market = usMarketStatus()
  const tablePositions = useMemo(
    () => sortPositions(applyFilters(positions, filters), sort),
    [positions, filters, sort],
  )

  if (!GOOGLE_CLIENT_ID || status === 'signed-out' || status === 'misconfigured') return <SignInView />

  return (
    <TooltipProvider>
    <div className="mx-auto flex min-h-dvh w-full max-w-[90rem] flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
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
            <h1 className="text-base font-medium tracking-tight">Watchlist</h1>
            <span
              className={`rounded-full px-2 py-0.5 text-xs tracking-wide uppercase ${
                market === 'open' ? 'bg-up/15 text-up' : 'bg-secondary text-muted-foreground'
              }`}
            >
              Market {market}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <RefreshAge iso={snapshot.lastRefresh} />
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
            <div className="flex flex-wrap items-center gap-2">
              <Tabs value={view} onValueChange={(value) => setView(value as TableView)}>
                <TabsList>
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="range">Range</TabsTrigger>
                  <TabsTrigger value="valuation">Valuation</TabsTrigger>
                  <TabsTrigger value="calendar">Calendar</TabsTrigger>
                  <TabsTrigger value="chart">Chart</TabsTrigger>
                  <TabsTrigger value="sectors">Sectors</TabsTrigger>
                  <TabsTrigger value="sectorOverview">Sectors overview</TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2">
                {isTableView(view) ? (
                  <TableFiltersBar positions={positions} filters={filters} onChange={setFilters} />
                ) : null}
                <WatchlistCalendar positions={positions} onSelect={setSelectedRow} />
              </div>
            </div>
            {view === 'chart' ? (
              <HistoryChart positions={positions} history={snapshot.history} activeTicker={selected?.ticker} />
            ) : view === 'sectors' ? (
              <SectorChart positions={positions} onSelect={setSelectedRow} />
            ) : view === 'sectorOverview' ? (
              <SectorOverview />
            ) : (
              <WatchlistTable
                positions={tablePositions}
                view={view}
                selectedRow={selectedRow}
                onSelect={setSelectedRow}
                sort={sort}
                onToggleSort={(key) => setSort((current) => nextSort(current, key))}
              />
            )}
          </>
        )}
      </main>

      <AddTickerDialog open={adding} onOpenChange={setAdding} />
      <PositionDrawer position={selected} onClose={() => setSelectedRow(null)} />
    </div>
    </TooltipProvider>
  )
}

function RefreshAge({ iso }: { iso: string | null }) {
  const [age, setAge] = useState<{ minutes: number | null; label: string } | null>(null)

  useEffect(() => {
    const tick = () => {
      setAge({ minutes: refreshAgeMinutes(iso), label: formatRelativeTime(iso) })
    }
    tick()
    const id = window.setInterval(tick, 30_000)
    return () => window.clearInterval(id)
  }, [iso])

  const minutes = age === null ? null : age.minutes
  const tone =
    age === null
      ? null
      : minutes === null || minutes > 60
        ? 'red'
        : minutes > 30
          ? 'orange'
          : minutes > 10
            ? 'yellow'
            : null

  return (
    <p
      suppressHydrationWarning
      className={cn(
        'hidden text-xs sm:block',
        tone ? 'rounded-md px-2 py-0.5' : 'text-muted-foreground',
        tone === 'yellow' && 'bg-yellow-400/20 text-yellow-300',
        tone === 'orange' && 'bg-orange-500/20 text-orange-300',
        tone === 'red' && 'bg-down/20 text-down',
      )}
    >
      {age?.label ?? ''}
    </p>
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
