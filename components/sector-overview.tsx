'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { Loader2, RefreshCw } from 'lucide-react'
import { SECTOR_ETFS, YAHOO_SECTORS, sectorColor, type YahooSector } from '@/lib/sectors'
import {
  formatStat,
  markerPosition,
  readSectorStatsCache,
  writeSectorStatsCache,
  type MetricStats,
  type SectorStatsSnapshot,
} from '@/lib/sector-stats'
import { formatRelativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { MetricTip } from '@/components/metric-tip'

const MIN = '#9aa3b2'
const MEDIAN = '#5ee0c0'
const AVG = '#c8d0da'
const MAX = '#e0a35e'

async function loadSectorStats(sector: YahooSector): Promise<SectorStatsSnapshot> {
  const res = await fetch('/api/market/sector-stats', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sector }),
  })
  const body = (await res.json().catch(() => null)) as { snapshot?: SectorStatsSnapshot; error?: string } | null
  if (!res.ok || !body?.snapshot) throw new Error(body?.error || 'Could not load sector stats.')
  writeSectorStatsCache(body.snapshot)
  return body.snapshot
}

export function SectorOverview() {
  const [sector, setSector] = useState<YahooSector | null>(null)
  const cached = useMemo(() => (sector ? readSectorStatsCache(sector) : null), [sector])
  const { data, error, isLoading, isValidating, mutate } = useSWR(
    sector ? ['sector-stats', sector] : null,
    ([, next]: [string, YahooSector]) => loadSectorStats(next),
    {
      fallbackData: cached ?? undefined,
      revalidateOnFocus: false,
      revalidateIfStale: false,
      revalidateOnMount: !cached,
      dedupingInterval: 60 * 60 * 1000,
    },
  )
  const snapshot = data ?? cached ?? null
  const pending = Boolean(sector) && ((isLoading && !snapshot) || isValidating)

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h2 className="text-base font-medium tracking-tight">
            <MetricTip metric="sectorOverview">
              <span>Sectors overview</span>
            </MetricTip>
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Valuation for stocks in each sector ETF. Refresh this tab on its own — it is not updated with watchlist quotes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {snapshot ? (
            <span className="text-xs text-muted-foreground">{formatRelativeTime(snapshot.fetchedAt)}</span>
          ) : null}
          <Button
            type="button"
            variant="outline"
            disabled={!sector || pending}
            onClick={() => {
              if (!sector) return
              void mutate(loadSectorStats(sector), { revalidate: false })
            }}
          >
            <RefreshCw className={pending ? 'animate-spin' : undefined} aria-hidden />
            Refresh sector
          </Button>
        </div>
      </header>

      <div className="grid gap-0 lg:grid-cols-[minmax(16rem,18rem)_1fr]">
        <ul className="border-b border-border lg:border-r lg:border-b-0">
          {YAHOO_SECTORS.map((name) => {
            const on = sector === name
            return (
              <li key={name}>
                <button
                  type="button"
                  onClick={() => setSector(on ? null : name)}
                  className={cn(
                    'flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-accent',
                    on && 'bg-accent',
                  )}
                >
                  <span className="size-2.5 shrink-0 rounded-sm" style={{ background: sectorColor(name) }} />
                  <span className="min-w-0 flex-1 truncate text-sm">{name}</span>
                  <span className="font-mono text-[11px] text-muted-foreground">{SECTOR_ETFS[name]}</span>
                </button>
              </li>
            )
          })}
        </ul>

        <div className="min-w-0 p-4">
          {!sector ? (
            <p className="py-16 text-center text-sm text-muted-foreground">Pick a sector to see ETF valuation stats.</p>
          ) : pending && !snapshot ? (
            <p className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Loading {sector} holdings from Yahoo…
            </p>
          ) : error && !snapshot ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              {error instanceof Error ? error.message : 'Could not load sector stats.'}
            </p>
          ) : snapshot ? (
            <SectorDetail snapshot={snapshot} />
          ) : null}
        </div>
      </div>
    </section>
  )
}

function SectorDetail({ snapshot }: { snapshot: SectorStatsSnapshot }) {
  return (
    <div className="grid gap-6">
      <div>
        <h3 className="text-base font-medium tracking-tight">{snapshot.sector}</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {snapshot.etf} holdings · {snapshot.holdings} names used for stats
        </p>
      </div>

      {snapshot.metrics.length === 0 ? (
        <p className="text-sm text-muted-foreground">Yahoo didn’t return enough valuation numbers for this sector.</p>
      ) : (
        <>
          <StatsChart metrics={snapshot.metrics} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs tracking-wide text-muted-foreground uppercase">
                  <th className="pb-2 font-medium">Metric</th>
                  <th className="pb-2 text-right font-medium">Min</th>
                  <th className="pb-2 text-right font-medium">Median</th>
                  <th className="pb-2 text-right font-medium">Avg</th>
                  <th className="pb-2 text-right font-medium">Max</th>
                  <th className="pb-2 text-right font-medium">n</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.metrics.map((metric) => (
                  <tr key={metric.id} className="border-b border-border/60">
                    <td className="py-2">{metric.label}</td>
                    <td className="py-2 text-right font-mono tabular-nums">{formatStat(metric.min, metric.kind)}</td>
                    <td className="py-2 text-right font-mono tabular-nums">{formatStat(metric.median, metric.kind)}</td>
                    <td className="py-2 text-right font-mono tabular-nums">{formatStat(metric.avg, metric.kind)}</td>
                    <td className="py-2 text-right font-mono tabular-nums">{formatStat(metric.max, metric.kind)}</td>
                    <td className="py-2 text-right font-mono tabular-nums text-muted-foreground">{metric.n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

function StatsChart({ metrics }: { metrics: MetricStats[] }) {
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3 text-[12px] text-muted-foreground">
        <LegendDot color={MIN} label="Min" />
        <LegendDot color={MEDIAN} label="Median" />
        <LegendDot color={AVG} label="Avg" />
        <LegendDot color={MAX} label="Max" />
      </div>
      <div className="grid gap-3">
        {metrics.map((metric) => (
          <div key={metric.id} className="grid grid-cols-[4.5rem_1fr] items-center gap-3">
            <p className="truncate text-xs text-muted-foreground">{metric.label}</p>
            <div className="relative h-6 rounded-md bg-muted">
              <span
                className="absolute inset-y-1 rounded-sm"
                style={{
                  left: `${markerPosition(metric.min, metric.min, metric.max)}%`,
                  right: `${100 - markerPosition(metric.max, metric.min, metric.max)}%`,
                  background: 'color-mix(in oklab, var(--foreground) 12%, transparent)',
                }}
              />
              <Marker left={markerPosition(metric.min, metric.min, metric.max)} color={MIN} label={`Min ${formatStat(metric.min, metric.kind)}`} />
              <Marker left={markerPosition(metric.max, metric.min, metric.max)} color={MAX} label={`Max ${formatStat(metric.max, metric.kind)}`} />
              <Marker left={markerPosition(metric.avg, metric.min, metric.max)} color={AVG} shape="circle" label={`Avg ${formatStat(metric.avg, metric.kind)}`} />
              <Marker
                left={markerPosition(metric.median, metric.min, metric.max)}
                color={MEDIAN}
                shape="diamond"
                label={`Median ${formatStat(metric.median, metric.kind)}`}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Marker({
  left,
  color,
  label,
  shape = 'tick',
}: {
  left: number
  color: string
  label: string
  shape?: 'tick' | 'circle' | 'diamond'
}) {
  return (
    <span
      title={label}
      className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${left}%` }}
    >
      {shape === 'circle' ? (
        <span className="block size-2.5 rounded-full ring-2 ring-background" style={{ background: color }} />
      ) : shape === 'diamond' ? (
        <span className="block size-2.5 rotate-45 ring-2 ring-background" style={{ background: color }} />
      ) : (
        <span className="block h-4 w-0.5 rounded-full" style={{ background: color }} />
      )}
    </span>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="size-1.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  )
}
