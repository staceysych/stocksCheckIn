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
  { period: 20, color: '#ff8a4a' },
  { period: 50, color: '#4d8aff' },
  { period: 100, color: '#ff5aa5' },
  { period: 200, color: '#e8c547' },
] as const

const RANGE_OPTIONS = [
  { id: '7d', label: '7D', days: 7 },
  { id: '15d', label: '15D', days: 15 },
  { id: '1m', label: '1M', days: 30 },
  { id: '3m', label: '3M', days: 91 },
  { id: '6m', label: '6M', days: 182 },
  { id: '1y', label: '1Y', days: 365 },
  { id: '3y', label: '3Y', days: 1096 },
  { id: 'max', label: 'Max', days: null },
] as const

type MaPeriod = (typeof MA_OPTIONS)[number]['period']
type RangeId = (typeof RANGE_OPTIONS)[number]['id']

type HistoryChartProps = {
  positions: Position[]
  history: PriceHistory
  activeTicker?: string
}

export function HistoryChart({ positions, history, activeTicker }: HistoryChartProps) {
  const [ticker, setTicker] = useState(activeTicker || positions[0]?.ticker || '')
  const [mas, setMas] = useState<MaPeriod[]>([])
  const [range, setRange] = useState<RangeId>('3m')
  const position = positions.find((row) => row.ticker === ticker) ?? positions[0] ?? null
  const closes = position ? history[position.ticker] ?? [] : []
  const rangeDays = RANGE_OPTIONS.find((option) => option.id === range)?.days ?? null
  const visibleWindow = rangeWindow(closes, rangeDays)

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
                'rounded-md border px-2 py-1 font-mono text-xs',
                !ready && 'cursor-not-allowed opacity-40',
              )}
              style={{
                color: option.color,
                background: on ? `${option.color}2e` : `${option.color}12`,
                borderColor: on ? `${option.color}80` : `${option.color}3d`,
              }}
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
        <div className="ml-auto flex flex-wrap gap-1">
          {RANGE_OPTIONS.map((option) => {
            const selected = option.id === range
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setRange(option.id)}
                title={rangeTitle(option.id)}
                className={cn(
                  'rounded-md px-2 py-1 font-mono text-xs hover:bg-accent',
                  selected ? 'bg-accent text-foreground' : 'text-muted-foreground',
                )}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      </div>
      {closes.length === 0 ? (
        <p className="px-4 py-16 text-center text-sm text-muted-foreground">
          No daily closes for this ticker yet. Refresh to load Yahoo history.
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
            rangeDays={rangeDays}
          />
          <p className="px-4 pb-3 text-[12px] text-muted-foreground">
            {visibleWindow
              ? `${formatDate(visibleWindow.from)} – ${formatDate(visibleWindow.to)}. Scroll to zoom, drag to pan.`
              : 'Scroll to zoom, drag to pan.'}
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
  rangeDays,
}: {
  closes: DailyClose[]
  currency: string
  buy: number | null
  sell: number | null
  mas: MaPeriod[]
  rangeDays: number | null
}) {
  const host = useRef<HTMLDivElement>(null)
  const visibleRange = useRef<LogicalRange | null>(null)
  const appliedDays = useRef(rangeDays)
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
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        })
        .setData(data)
    }

    const scale = chart.timeScale()
    if (appliedDays.current !== rangeDays) {
      visibleRange.current = null
      appliedDays.current = rangeDays
    }
    if (visibleRange.current) scale.setVisibleLogicalRange(visibleRange.current)
    else applyVisibleRange(scale, closes, rangeDays)

    const rememberRange = (range: LogicalRange | null) => {
      if (range) visibleRange.current = range
    }
    scale.subscribeVisibleLogicalRangeChange(rememberRange)

    return () => {
      scale.unsubscribeVisibleLogicalRangeChange(rememberRange)
      chart.remove()
    }
  }, [pricePoints, closes, mas, currency, buy, sell, rangeDays])

  return <div ref={host} className="h-[420px] w-full" />
}

function rangeTitle(id: RangeId) {
  switch (id) {
    case '7d':
      return '7 days'
    case '15d':
      return '15 days'
    case '1m':
      return 'Month'
    case '3m':
      return '3 months'
    case '6m':
      return '6 months'
    case '1y':
      return 'Year'
    case '3y':
      return '3 years'
    case 'max':
      return 'Max'
  }
}

function rangeWindow(closes: DailyClose[], days: number | null) {
  if (closes.length === 0) return null
  const last = closes[closes.length - 1]
  if (days === null) return { from: closes[0].date, to: last.date }
  const fromMs = Date.parse(last.date) - days * 86_400_000
  const firstMs = Date.parse(closes[0].date)
  const from = new Date(Math.max(fromMs, firstMs)).toISOString().slice(0, 10)
  return { from, to: last.date }
}

function applyVisibleRange(
  scale: { setVisibleRange: (range: { from: Time; to: Time }) => void; fitContent: () => void },
  closes: DailyClose[],
  days: number | null,
) {
  const window = rangeWindow(closes, days)
  if (!window || days === null) {
    scale.fitContent()
    return
  }
  try {
    scale.setVisibleRange({ from: window.from as Time, to: window.to as Time })
  } catch {
    scale.fitContent()
  }
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
