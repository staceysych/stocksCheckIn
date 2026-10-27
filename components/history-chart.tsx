'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AreaSeries,
  ColorType,
  LineSeries,
  LineStyle,
  createChart,
  type LogicalRange,
  type Time,
} from 'lightweight-charts'
import { formatDate, formatPrice } from '@/lib/format'
import { showBuyLimits, showSellLimits, type Position, type PriceHistory } from '@/lib/watchlist'
import { cn } from '@/lib/utils'
import { YahooQuoteLink } from '@/components/yahoo-quote-link'
import type { DailyClose } from '@/lib/market'

const PRICE = '#5ee0c0'
const BUY = '#4ecad8'
const SELL = '#c48ae0'
const GRID = 'rgba(255,255,255,0.06)'
const TEXT = '#9aa3b2'
const CROSS = 'rgba(255,255,255,0.35)'

const MA_OPTIONS = [
  { period: 20, color: '#7ec8d9' },
  { period: 50, color: '#8aa4d4' },
  { period: 100, color: '#b08dcc' },
  { period: 200, color: '#c4a35a' },
] as const

type MaPeriod = (typeof MA_OPTIONS)[number]['period']

type HistoryChartProps = {
  positions: Position[]
  history: PriceHistory
  activeTicker?: string
}

export function HistoryChart({ positions, history, activeTicker }: HistoryChartProps) {
  const [ticker, setTicker] = useState(activeTicker || positions[0]?.ticker || '')
  const [mas, setMas] = useState<MaPeriod[]>([])
  const position = positions.find((row) => row.ticker === ticker) ?? positions[0] ?? null
  const closes = position ? history[position.ticker] ?? [] : []

  const toggleMa = (period: MaPeriod) => {
    setMas((current) => (current.includes(period) ? current.filter((item) => item !== period) : [...current, period]))
  }

  useEffect(() => {
    if (activeTicker && positions.some((row) => row.ticker === activeTicker)) {
      setTicker(activeTicker)
    }
  }, [activeTicker, positions])

  useEffect(() => {
    if (!ticker && positions[0]) setTicker(positions[0].ticker)
  }, [ticker, positions])

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-wrap gap-1.5 border-b border-border px-3 py-2.5">
        {positions.map((row) => {
          const selected = row.ticker === ticker
          return (
            <button
              key={row.row}
              type="button"
              onClick={() => setTicker(row.ticker)}
              className={cn(
                'rounded-md px-2 py-1 font-mono text-xs hover:bg-accent',
                selected ? 'bg-accent text-foreground' : 'text-muted-foreground',
              )}
            >
              {row.ticker}
            </button>
          )
        })}
      </div>
      {position ? (
        <header className="flex flex-wrap items-end justify-between gap-3 px-4 pt-4">
          <div>
            <p className="flex items-center gap-1 font-mono text-sm">
              <YahooQuoteLink ticker={position.ticker} />
              {position.ticker}
            </p>
            <p className="text-base font-medium tracking-tight">{position.name || position.ticker}</p>
          </div>
          <p className="font-mono text-sm tabular-nums">{formatPrice(position.price, position.currency)}</p>
        </header>
      ) : null}
      <div className="flex flex-wrap items-center gap-2 px-4 pt-2 text-[12px] text-muted-foreground">
        <LegendDot color={PRICE} label="Price" />
        {MA_OPTIONS.map((option) => {
          const on = mas.includes(option.period)
          const ready = closes.length >= option.period
          return (
            <button
              key={option.period}
              type="button"
              disabled={!ready}
              onClick={() => toggleMa(option.period)}
              title={ready ? (on ? `Hide MA${option.period}` : `Add MA${option.period}`) : `Need ${option.period} daily closes`}
              className={cn(
                'rounded-md px-2 py-1 font-mono text-xs',
                on ? 'text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                !ready && 'cursor-not-allowed opacity-40 hover:bg-transparent hover:text-muted-foreground',
              )}
              style={on ? { background: `${option.color}33`, color: option.color } : undefined}
            >
              MA{option.period}
            </button>
          )
        })}
        {position && showBuyLimits(position.intent) && position.target !== null ? (
          <LegendDot color={BUY} label="Buy under" />
        ) : null}
        {position && showSellLimits(position.intent) && position.sell !== null ? (
          <LegendDot color={SELL} label="Sell above" />
        ) : null}
      </div>
      {closes.length === 0 ? (
        <p className="px-4 py-16 text-center text-sm text-muted-foreground">
          No daily closes for this ticker yet. Refresh to load about a year of Yahoo history.
        </p>
      ) : (
        <>
          <PriceCanvas
            key={position?.ticker}
            closes={closes}
            currency={position?.currency || 'USD'}
            buy={position && showBuyLimits(position.intent) ? position.target : null}
            sell={position && showSellLimits(position.intent) ? position.sell : null}
            mas={mas}
          />
          <p className="px-4 pb-3 text-[12px] text-muted-foreground">
            {formatDate(closes[0].date)} – {formatDate(closes[closes.length - 1].date)}. Scroll to zoom, drag to pan.
          </p>
        </>
      )}
    </section>
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

function PriceCanvas({
  closes,
  currency,
  buy,
  sell,
  mas,
}: {
  closes: DailyClose[]
  currency: string
  buy: number | null
  sell: number | null
  mas: MaPeriod[]
}) {
  const host = useRef<HTMLDivElement>(null)
  const visibleRange = useRef<LogicalRange | null>(null)
  const pricePoints = useMemo(
    () => closes.map((row) => ({ time: row.date as Time, value: row.close })),
    [closes],
  )

  useEffect(() => {
    const el = host.current
    if (!el) return

    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: TEXT,
        fontFamily: 'IBM Plex Mono, ui-monospace, monospace',
        fontSize: 11,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: GRID },
        horzLines: { color: GRID },
      },
      rightPriceScale: { borderColor: GRID },
      timeScale: { borderColor: GRID },
      crosshair: {
        vertLine: { color: CROSS, labelBackgroundColor: '#24303a' },
        horzLine: { color: CROSS, labelBackgroundColor: '#24303a' },
      },
      localization: {
        priceFormatter: (price: number) => formatPrice(price, currency),
      },
    })

    const price = chart.addSeries(AreaSeries, {
      lineColor: PRICE,
      topColor: 'rgba(94, 224, 192, 0.28)',
      bottomColor: 'rgba(94, 224, 192, 0.02)',
      lineWidth: 2,
      priceLineVisible: false,
    })
    price.setData(pricePoints)

    if (buy !== null) {
      price.createPriceLine({
        price: buy,
        color: BUY,
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        title: 'Buy',
        axisLabelVisible: true,
      })
    }
    if (sell !== null) {
      price.createPriceLine({
        price: sell,
        color: SELL,
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        title: 'Sell',
        axisLabelVisible: true,
      })
    }

    for (const period of mas) {
      const option = MA_OPTIONS.find((item) => item.period === period)
      const data = averageSeries(closes, period)
      if (!option || data.length === 0) continue
      chart
        .addSeries(LineSeries, {
          color: option.color,
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        })
        .setData(data)
    }

    const scale = chart.timeScale()
    if (visibleRange.current) scale.setVisibleLogicalRange(visibleRange.current)
    else scale.fitContent()

    const rememberRange = (range: LogicalRange | null) => {
      if (range) visibleRange.current = range
    }
    scale.subscribeVisibleLogicalRangeChange(rememberRange)

    return () => {
      scale.unsubscribeVisibleLogicalRangeChange(rememberRange)
      chart.remove()
    }
  }, [pricePoints, closes, mas, currency, buy, sell])

  return <div ref={host} className="h-[420px] w-full" />
}

function averageSeries(closes: DailyClose[], n: number) {
  if (closes.length < n) return []
  const points: { time: Time; value: number }[] = []
  let sum = 0
  for (let i = 0; i < closes.length; i++) {
    sum += closes[i].close
    if (i >= n) sum -= closes[i - n].close
    if (i >= n - 1) {
      points.push({ time: closes[i].date as Time, value: sum / n })
    }
  }
  return points
}
