'use client'

import { useMemo, useState } from 'react'
import { formatCompact, formatPrice } from '@/lib/format'
import { sectorAllocation, type Position, type SectorSlice } from '@/lib/watchlist'
import { cn } from '@/lib/utils'
import { MetricTip } from '@/components/metric-tip'

const SECTOR_COLORS: Record<string, string> = {
  Technology: '#5ee0c0',
  'Financial Services': '#8aa4d4',
  Healthcare: '#7ec8d9',
  'Consumer Cyclical': '#e0a35e',
  'Communication Services': '#b08dcc',
  Industrials: '#9aa3b2',
  'Consumer Defensive': '#7eb87a',
  Energy: '#e08a5e',
  'Basic Materials': '#c4a35a',
  'Real Estate': '#6eb5c9',
  Utilities: '#5d9bce',
  Unclassified: '#6b7280',
}

const FALLBACK_COLORS = ['#5ee0c0', '#8aa4d4', '#e0a35e', '#b08dcc', '#7ec8d9', '#c4a35a', '#e08a5e', '#7eb87a']

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

function sectorColor(sector: string) {
  if (SECTOR_COLORS[sector]) return SECTOR_COLORS[sector]
  let hash = 0
  for (const char of sector) hash = (hash + char.charCodeAt(0)) % FALLBACK_COLORS.length
  return FALLBACK_COLORS[hash]
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
