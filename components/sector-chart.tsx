'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { Loader2, Plus } from 'lucide-react'
import { formatCompact, formatPrice } from '@/lib/format'
import { isYahooSector, lightSectors, sectorColor, SECTOR_ETFS, type SectorIdeaGroup } from '@/lib/sectors'
import { sectorAllocation, type Position, type SectorSlice } from '@/lib/watchlist'
import { useWatchlist } from '@/lib/use-watchlist'
import { cn } from '@/lib/utils'
import { MetricTip } from '@/components/metric-tip'
import { YahooQuoteLink } from '@/components/yahoo-quote-link'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

type SectorChartProps = {
  positions: Position[]
  onSelect: (row: number) => void
}

export function SectorChart({ positions, onSelect }: SectorChartProps) {
  const owned = positions.some((position) => position.owned && (position.marketValue ?? 0) > 0)
  const [mode, setMode] = useState<'value' | 'count'>(owned ? 'value' : 'count')
  const [active, setActive] = useState<string | null>(null)
  const slices = useMemo(() => sectorAllocation(positions, mode), [positions, mode])
  const currency = positions.find((position) => position.currency)?.currency || 'USD'
  const total = slices.reduce((sum, slice) => sum + slice.value, 0)
  const selected = slices.find((slice) => slice.sector === active) ?? null

  return (
    <div className="flex flex-col gap-4">
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h2 className="text-base font-medium tracking-tight">
          <MetricTip metric="diversification">
            <span>Sector mix</span>
          </MetricTip>
        </h2>
        <div className="flex rounded-lg bg-muted p-[3px] text-xs">
          <ModeButton
            label="Value"
            active={mode === 'value'}
            disabled={!owned}
            onClick={() => setMode('value')}
          />
          <ModeButton label="Names" active={mode === 'count'} onClick={() => setMode('count')} />
        </div>
      </header>

      {slices.length === 0 ? (
        <p className="px-4 py-16 text-center text-sm text-muted-foreground">
          {mode === 'value'
            ? 'Add shares on names you own to see how value splits across Yahoo sectors.'
            : 'No tickers yet.'}
        </p>
      ) : (
        <div className="grid gap-6 p-4 lg:grid-cols-[minmax(0,280px)_1fr] lg:items-start">
          <Donut
            slices={slices}
            active={active}
            onSelect={setActive}
            center={
              mode === 'value' ? formatPrice(total, currency) : `${total} name${total === 1 ? '' : 's'}`
            }
            caption={mode === 'value' ? 'Holdings' : 'On your list'}
          />
          <ul className="grid gap-1">
            {slices.map((slice) => {
              const color = sectorColor(slice.sector)
              const on = active === slice.sector
              return (
                <li key={slice.sector}>
                  <button
                    type="button"
                    onClick={() => setActive(on ? null : slice.sector)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-accent',
                      on && 'bg-accent',
                    )}
                  >
                    <span className="size-2.5 shrink-0 rounded-sm" style={{ background: color }} />
                    <span className="min-w-0 flex-1 truncate text-sm">{slice.sector}</span>
                    <span className="font-mono text-xs tabular-nums text-muted-foreground">
                      {mode === 'value' ? formatCompact(slice.value) : slice.value}
                    </span>
                    <span className="w-14 text-right font-mono text-xs tabular-nums">
                      {(slice.weight * 100).toFixed(1)}%
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {selected ? (
        <div className="border-t border-border px-4 py-3">
          <p className="mb-2 text-xs tracking-wide text-muted-foreground uppercase">
            {selected.sector} · {selected.positions.length}
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {selected.positions.map((position) => (
              <li key={position.row}>
                <button
                  type="button"
                  onClick={() => onSelect(position.row)}
                  className="rounded-md bg-secondary px-2 py-1 font-mono text-xs hover:bg-accent"
                >
                  {position.ticker}
                  {mode === 'value' && position.marketValue !== null ? (
                    <span className="ml-1.5 text-muted-foreground">{formatCompact(position.marketValue)}</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
    <LookList positions={positions} slices={slices} active={active} onOpenSector={setActive} />
    </div>
  )
}

function ModeButton({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string
  active: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'rounded-md px-2.5 py-1',
        active ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
        disabled && 'cursor-not-allowed opacity-40 hover:text-muted-foreground',
      )}
    >
      {label}
    </button>
  )
}

function Donut({
  slices,
  active,
  onSelect,
  center,
  caption,
}: {
  slices: SectorSlice[]
  active: string | null
  onSelect: (sector: string | null) => void
  center: string
  caption: string
}) {
  const arcs = donutArcs(slices)
  return (
    <div className="relative mx-auto w-full max-w-[280px]">
      <svg viewBox="0 0 200 200" className="h-auto w-full" role="img" aria-label="Sector allocation">
        {arcs.map((arc) => {
          const dimmed = active !== null && active !== arc.sector
          return (
            <path
              key={arc.sector}
              d={arc.path}
              fill={sectorColor(arc.sector)}
              fillOpacity={dimmed ? 0.28 : 1}
              className="cursor-pointer"
              onClick={() => onSelect(active === arc.sector ? null : arc.sector)}
            >
              <title>
                {arc.sector} {(arc.weight * 100).toFixed(1)}%
              </title>
            </path>
          )
        })}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <p className="font-mono text-sm tabular-nums">{center}</p>
        <p className="text-[12px] text-muted-foreground">{caption}</p>
      </div>
    </div>
  )
}

function LookList({
  positions,
  slices,
  active,
  onOpenSector,
}: {
  positions: Position[]
  slices: SectorSlice[]
  active: string | null
  onOpenSector: (sector: string | null) => void
}) {
  const { addTicker, hasTicker } = useWatchlist()
  const [adding, setAdding] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const light = useMemo(() => lightSectors(slices), [slices])
  const focused = active && isYahooSector(active) ? active : null
  const unknownSelected = Boolean(active) && !focused
  const columns = useMemo(() => {
    if (!focused) return light
    const slice = slices.find((item) => item.sector === focused)
    return [{ sector: focused, etf: SECTOR_ETFS[focused], weight: slice?.weight ?? 0 }]
  }, [focused, light, slices])
  const ideaLimit = focused ? 12 : 5
  const owned = new Set(positions.map((position) => position.ticker))
  const { data, error: loadError, isLoading } = useSWR(
    unknownSelected || columns.length === 0
      ? null
      : ['sector-ideas', columns.map((item) => item.sector).join('|'), ideaLimit],
    async () => {
      const res = await fetch('/api/market/sector-ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectors: columns.map((item) => item.sector),
          exclude: [...owned],
          limit: ideaLimit,
        }),
      })
      const body = (await res.json().catch(() => null)) as { groups?: SectorIdeaGroup[]; error?: string } | null
      if (!res.ok) throw new Error(body?.error || 'Could not load sector ideas.')
      return body?.groups ?? []
    },
    { revalidateOnFocus: false },
  )

  const add = async (ticker: string, name: string) => {
    setAdding(ticker)
    setError(null)
    try {
      await addTicker({
        ticker,
        name,
        idea: '',
        target: null,
        target2: null,
        sell: null,
        sell2: null,
        buyUpTo: null,
        sellUpTo: null,
        shares: null,
        cost: null,
        intent: 'watch',
      })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : `Could not add ${ticker}.`)
    } finally {
      setAdding(null)
    }
  }

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <header className="border-b border-border px-4 py-3">
        <h2 className="text-base font-medium tracking-tight">
          <MetricTip metric="sectorIdeas">
            <span>Look next</span>
          </MetricTip>
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {focused
            ? `More individual stocks in ${focused}. A look list, not a buy list.`
            : 'Individual stocks in the three Yahoo sectors you hold least. Click a sector in your mix to look there instead.'}
        </p>
      </header>
      {unknownSelected ? (
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">
          Look next uses Yahoo’s 11 GICS sectors. {active} doesn’t map to one.
        </p>
      ) : isLoading ? (
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">Loading Yahoo holdings…</p>
      ) : loadError ? (
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">
          {loadError instanceof Error ? loadError.message : 'Could not load Yahoo holdings.'}
        </p>
      ) : (
        <div className={cn('grid gap-5 p-4', focused ? 'lg:grid-cols-1' : 'lg:grid-cols-3')}>
          {columns.map((item) => {
            const group = data?.find((row) => row.sector === item.sector)
            const ideas = (group?.ideas ?? []).filter((idea) => !hasTicker(idea.ticker))
            return (
              <div key={item.sector} className="min-w-0">
                <button
                  type="button"
                  onClick={() => onOpenSector(focused ? null : item.sector)}
                  className="mb-2 flex w-full items-center gap-2 text-left"
                >
                  <span className="size-2.5 shrink-0 rounded-sm" style={{ background: sectorColor(item.sector) }} />
                  <span className="min-w-0 flex-1 truncate text-sm">{item.sector}</span>
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {(item.weight * 100).toFixed(1)}%
                  </span>
                </button>
                {ideas.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No new names from Yahoo for this sector.</p>
                ) : (
                  <ul className={cn('grid gap-1.5', focused && 'sm:grid-cols-2')}>
                    {ideas.map((idea) => (
                      <li key={idea.ticker} className="flex items-center gap-2 rounded-lg px-1 py-0.5 hover:bg-accent">
                        <YahooQuoteLink ticker={idea.ticker} />
                        <div className="min-w-0 flex-1">
                          <p className="font-mono text-xs">{idea.ticker}</p>
                          <p className="truncate text-[12px] text-muted-foreground">{idea.name || '—'}</p>
                        </div>
                        {idea.holdingPct !== null ? (
                          <Tooltip>
                            <TooltipTrigger
                              delay={150}
                              className="cursor-pointer bg-transparent p-0 font-mono text-[12px] tabular-nums text-muted-foreground"
                            >
                              {idea.holdingPct.toFixed(1)}%
                            </TooltipTrigger>
                            <TooltipContent>
                              Weight in the {item.sector} sector ETF. How large this name is in the sector, not in your
                              portfolio.
                            </TooltipContent>
                          </Tooltip>
                        ) : null}
                        <Button
                          type="button"
                          variant="outline"
                          size="xs"
                          disabled={adding === idea.ticker}
                          onClick={() => void add(idea.ticker, idea.name)}
                        >
                          {adding === idea.ticker ? <Loader2 className="animate-spin" aria-hidden /> : <Plus aria-hidden />}
                          Add
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      )}
      {error ? <p className="px-4 pb-3 text-sm text-destructive">{error}</p> : null}
    </section>
  )
}

function donutArcs(slices: SectorSlice[]) {
  const cx = 100
  const cy = 100
  const outer = 86
  const inner = 54
  let start = -Math.PI / 2
  return slices.map((slice) => {
    const sweep = slice.weight * 2 * Math.PI
    const end = start + sweep
    const path = slice.weight >= 0.999 ? fullDonut(cx, cy, outer, inner) : donutSlice(cx, cy, outer, inner, start, end)
    const arc = { ...slice, path }
    start = end
    return arc
  })
}

function fullDonut(cx: number, cy: number, outer: number, inner: number) {
  return [
    `M ${cx} ${cy - outer}`,
    `A ${outer} ${outer} 0 1 1 ${cx} ${cy + outer}`,
    `A ${outer} ${outer} 0 1 1 ${cx} ${cy - outer}`,
    `M ${cx} ${cy - inner}`,
    `A ${inner} ${inner} 0 1 0 ${cx} ${cy + inner}`,
    `A ${inner} ${inner} 0 1 0 ${cx} ${cy - inner}`,
    'Z',
  ].join(' ')
}

function donutSlice(cx: number, cy: number, outer: number, inner: number, start: number, end: number) {
  const large = end - start > Math.PI ? 1 : 0
  const [sx, sy] = polar(cx, cy, outer, start)
  const [ex, ey] = polar(cx, cy, outer, end)
  const [ix, iy] = polar(cx, cy, inner, end)
  const [jx, jy] = polar(cx, cy, inner, start)
  return `M ${sx} ${sy} A ${outer} ${outer} 0 ${large} 1 ${ex} ${ey} L ${ix} ${iy} A ${inner} ${inner} 0 ${large} 0 ${jx} ${jy} Z`
}

function polar(cx: number, cy: number, r: number, angle: number): [number, number] {
  return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)]
}
