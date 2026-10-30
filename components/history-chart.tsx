'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AreaSeries,
  ColorType,
  LineSeries,
  LineStyle,
  createChart,
  type Logical,
  type LogicalRange,
  type Time,
} from 'lightweight-charts'
import { X } from 'lucide-react'
import useSWR from 'swr'
import { formatDate, formatPrice } from '@/lib/format'
import { showBuyLimits, showSellLimits, type Position, type PriceHistory } from '@/lib/watchlist'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { YahooQuoteLink } from '@/components/yahoo-quote-link'
import { TickerPicker } from '@/components/ticker-picker'
import { fetchSnapshots, type DailyClose } from '@/lib/market'

const PRICE = '#5ee0c0'
const BUY = '#4ecad8'
const SELL = '#c48ae0'
const AVG = '#e8edf4'
const GRID = 'rgba(255,255,255,0.06)'
const TEXT = '#9aa3b2'
const CROSS = 'rgba(255,255,255,0.35)'
const MAX_CHART_STOCKS = 4
const MAX_COMPARES = MAX_CHART_STOCKS - 1
const COMPARE_COLORS = ['#f43f5e', '#4ade80', '#c084fc'] as const

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
  const [compareTickers, setCompareTickers] = useState<string[]>([])
  const [pickingCompare, setPickingCompare] = useState(false)
  const [mas, setMas] = useState<MaPeriod[]>([])
  const [range, setRange] = useState<RangeId>('3m')
  const position = positions.find((row) => row.ticker === ticker) ?? positions[0] ?? null
  const closes = position ? history[position.ticker] ?? [] : []
  const rangeDays = RANGE_OPTIONS.find((option) => option.id === range)?.days ?? null
  const visibleWindow = rangeWindow(closes, rangeDays)
  const avgCost = position?.cost !== null && position.cost > 0 ? position.cost : null
  const compareExclude = [position?.ticker, ...compareTickers].filter((value): value is string => Boolean(value))
  const compareOptions = positions.filter((row) => !compareExclude.includes(row.ticker))
  const atCompareLimit = compareTickers.length >= MAX_COMPARES
  const comparing = compareTickers.length > 0
  const missingHistory = compareTickers.filter((symbol) => !(history[symbol]?.length))
  const { data: fetchedHistory } = useSWR(
    missingHistory.length > 0 ? ['compare-history', missingHistory.join(',')] : null,
    async () => {
      const snapshots = await fetchSnapshots(missingHistory)
      const extra: PriceHistory = {}
      for (const snapshot of snapshots) {
        if (snapshot.closes.length > 0) extra[snapshot.ticker] = snapshot.closes
      }
      return extra
    },
    { revalidateOnFocus: false },
  )
  const compares = useMemo(() => {
    const span = dateSpan(closes)
    return compareTickers.flatMap((symbol, index) => {
      const row = positions.find((item) => item.ticker === symbol)
      if (!row) return []
      const raw = history[row.ticker] ?? fetchedHistory?.[row.ticker] ?? []
      return [
        {
          ticker: row.ticker,
          currency: row.currency || 'USD',
          price: row.price,
          closes: span ? clipCloses(raw, span.from, span.to) : raw,
          color: COMPARE_COLORS[index % COMPARE_COLORS.length],
        },
      ]
    })
  }, [compareTickers, positions, history, fetchedHistory, closes])

  const toggleMa = (period: MaPeriod) => {
    setMas((current) => (current.includes(period) ? current.filter((item) => item !== period) : [...current, period]))
  }

  const setPrimary = (next: string) => {
    setTicker(next)
    setCompareTickers((current) => current.filter((symbol) => symbol !== next))
  }

  const addCompare = (next: string) => {
    setCompareTickers((current) => {
      if (current.length >= MAX_COMPARES || current.includes(next) || next === position?.ticker) return current
      return [...current, next]
    })
    setPickingCompare(false)
  }

  useEffect(() => {
    if (!activeTicker) return
    setTicker(activeTicker)
    setCompareTickers((current) => current.filter((symbol) => symbol !== activeTicker))
  }, [activeTicker])

  useEffect(() => {
    if (!ticker && positions[0]) setTicker(positions[0].ticker)
  }, [ticker, positions])

  useEffect(() => {
    const known = new Set(positions.map((row) => row.ticker))
    setCompareTickers((current) => {
      const next = current.filter((symbol) => known.has(symbol) && symbol !== ticker).slice(0, MAX_COMPARES)
      return next.length === current.length && next.every((symbol, index) => symbol === current[index]) ? current : next
    })
  }, [positions, ticker])

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <header className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {position ? <YahooQuoteLink ticker={position.ticker} /> : null}
          <TickerPicker positions={positions} ticker={ticker} onChange={setPrimary} />
          <Button
            type="button"
            variant="outline"
            aria-expanded={pickingCompare}
            disabled={compareOptions.length === 0 || atCompareLimit}
            title={atCompareLimit ? `Compare up to ${MAX_CHART_STOCKS} stocks` : 'Compare with another ticker'}
            onClick={() => setPickingCompare((open) => !open)}
          >
            Compare
          </Button>
          {pickingCompare && !atCompareLimit ? (
            <TickerPicker
              positions={positions}
              ticker=""
              exclude={compareExclude}
              allowEmpty
              placeholder="Compare with…"
              ariaLabel="Compare with ticker"
              onChange={addCompare}
            />
          ) : null}
          {compares.map((series) => (
            <span
              key={series.ticker}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2 font-mono text-xs"
            >
              <span className="size-1.5 rounded-full" style={{ background: series.color }} />
              {series.ticker}
              <button
                type="button"
                aria-label={`Remove ${series.ticker} from compare`}
                className="inline-flex size-4 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground"
                onClick={() => setCompareTickers((current) => current.filter((symbol) => symbol !== series.ticker))}
              >
                <X className="size-3" aria-hidden />
              </button>
            </span>
          ))}
        </div>
        {position ? (
          <div className="flex flex-wrap items-center justify-end gap-3 font-mono text-sm tabular-nums">
            <span>{formatPrice(position.price, position.currency)}</span>
            {compares.map((series) => (
              <span key={series.ticker} className="text-muted-foreground">
                <span style={{ color: series.color }}>{series.ticker}</span>{' '}
                {formatPrice(series.price, series.currency)}
              </span>
            ))}
          </div>
        ) : null}
      </header>
      <div className="flex flex-wrap items-center gap-2 px-4 pt-2 text-[12px] text-muted-foreground">
        {!comparing
          ? MA_OPTIONS.map((option) => {
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
            })
          : null}
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
            key={`${position?.ticker}:${avgCost}:${compareTickers.join(',')}`}
            closes={closes}
            price={position?.price ?? null}
            currency={position?.currency || 'USD'}
            buy={!comparing && position && showBuyLimits(position.intent) ? position.target : null}
            sell={!comparing && position && showSellLimits(position.intent) ? position.sell : null}
            avg={comparing ? null : avgCost}
            mas={comparing ? [] : mas}
            rangeDays={rangeDays}
            compares={compares}
          />
          <div className="flex flex-wrap items-center gap-3 px-4 pb-3 text-[12px] text-muted-foreground">
            <LegendDot color={PRICE} label="Price" />
            {!comparing && position && showBuyLimits(position.intent) && position.target !== null ? (
              <LegendDot color={BUY} label="Buy under" />
            ) : null}
            {!comparing && position && showSellLimits(position.intent) && position.sell !== null ? (
              <LegendDot color={SELL} label="Sell above" />
            ) : null}
            {!comparing && avgCost !== null ? <LegendDot color={AVG} label="Avg cost" /> : null}
            {compares.map((series) => (
              <LegendDot key={series.ticker} color={series.color} label={series.ticker} />
            ))}
            <p className="ml-auto">
              {visibleWindow
                ? `${formatDate(visibleWindow.from)} – ${formatDate(visibleWindow.to)}. Scroll to zoom, drag to pan.`
                : 'Scroll to zoom, drag to pan.'}
            </p>
          </div>
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

type CompareLine = {
  ticker: string
  currency: string
  price: number | null
  closes: DailyClose[]
  color: string
}

function PriceCanvas({
  closes,
  price: quotedPrice,
  currency,
  buy,
  sell,
  avg,
  mas,
  rangeDays,
  compares,
}: {
  closes: DailyClose[]
  price: number | null
  currency: string
  buy: number | null
  sell: number | null
  avg: number | null
  mas: MaPeriod[]
  rangeDays: number | null
  compares: CompareLine[]
}) {
  const host = useRef<HTMLDivElement>(null)
  const visibleRange = useRef<LogicalRange | null>(null)
  const appliedDays = useRef(rangeDays)
  const appliedSpan = useRef('')

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
      leftPriceScale: {
        visible: compares.length > 0,
        borderColor: GRID,
        scaleMargins: { top: 0.08, bottom: 0.08 },
      },
      rightPriceScale: {
        visible: true,
        borderColor: GRID,
        scaleMargins: { top: 0.08, bottom: 0.08 },
      },
      timeScale: { borderColor: GRID },
      crosshair: {
        vertLine: { color: CROSS, labelBackgroundColor: '#24303a' },
        horzLine: { color: CROSS, labelBackgroundColor: '#24303a' },
      },
      localization: {
        priceFormatter: (price: number) => formatPrice(price, currency),
      },
    })

    const window = rangeWindow(closes, rangeDays)
    const inWindow = (rows: DailyClose[]) => (window ? clipCloses(rows, window.from, window.to) : rows)
    const comparing = compares.length > 0
    const mainCurrent = seriesCurrent(quotedPrice, closes)
    let bandPct = 0.05
    if (comparing) {
      if (mainCurrent) bandPct = Math.max(bandPct, deviationPct(inWindow(closes), mainCurrent))
      for (const series of compares) {
        const current = seriesCurrent(series.price, series.closes)
        if (current) bandPct = Math.max(bandPct, deviationPct(inWindow(series.closes), current))
      }
      bandPct *= 1.12
    }
    const scaleAround = (current: number | null) =>
      comparing && current
        ? () => ({
            priceRange: {
              minValue: current * (1 - bandPct),
              maxValue: current * (1 + bandPct),
            },
          })
        : undefined

    const price = chart.addSeries(AreaSeries, {
      lineColor: PRICE,
      topColor: 'rgba(94, 224, 192, 0.28)',
      bottomColor: 'rgba(94, 224, 192, 0.02)',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      priceScaleId: 'right',
      autoscaleInfoProvider: scaleAround(mainCurrent),
    })
    const mainPoints = linePoints(closes)
    if (mainPoints.length > 0) price.setData(mainPoints)

    compares.forEach((series, index) => {
      const points = linePoints(series.closes)
      if (points.length === 0) return
      const scaleId = index === 0 ? 'left' : `compare-${series.ticker}`
      const current = seriesCurrent(series.price, series.closes)
      const line = chart.addSeries(LineSeries, {
        color: series.color,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: true,
        title: series.ticker,
        priceScaleId: scaleId,
        autoscaleInfoProvider: scaleAround(current),
      })
      line.setData(points)
      chart.priceScale(scaleId).applyOptions({
        visible: index === 0,
        autoScale: true,
        scaleMargins: { top: 0.08, bottom: 0.08 },
      })
    })
    if (compares.some((series) => linePoints(series.closes).length > 0)) {
      chart.priceScale('left').applyOptions({
        visible: true,
        autoScale: true,
        scaleMargins: { top: 0.08, bottom: 0.08 },
      })
    }

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
    if (avg !== null) {
      chart
        .addSeries(LineSeries, {
          color: AVG,
          lineWidth: 2,
          lineStyle: LineStyle.Dashed,
          priceLineVisible: true,
          lastValueVisible: true,
          title: 'Avg cost',
          priceScaleId: 'right',
          crosshairMarkerVisible: false,
        })
        .setData(linePoints(closes).map((row) => ({ ...row, value: avg })))
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
          priceScaleId: 'right',
        })
        .setData(data)
    }

    const times = seriesTimes(closes, compares)
    const spanKey = `${times[0] ?? ''}:${times[times.length - 1] ?? ''}:${times.length}`
    const scale = chart.timeScale()
    if (appliedDays.current !== rangeDays || appliedSpan.current !== spanKey) {
      visibleRange.current = null
      appliedDays.current = rangeDays
      appliedSpan.current = spanKey
    }
    if (visibleRange.current) scale.setVisibleLogicalRange(visibleRange.current)
    else applyVisibleRange(scale, times, rangeDays)

    const rememberRange = (range: LogicalRange | null) => {
      if (range) visibleRange.current = range
    }
    scale.subscribeVisibleLogicalRangeChange(rememberRange)

    return () => {
      scale.unsubscribeVisibleLogicalRangeChange(rememberRange)
      chart.remove()
    }
  }, [closes, quotedPrice, mas, currency, buy, sell, avg, rangeDays, compares])

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

function linePoints(closes: DailyClose[]) {
  const seen = new Set<string>()
  const points: { time: Time; value: number }[] = []
  for (const row of closes) {
    if (!row.date || seen.has(row.date) || !Number.isFinite(row.close)) continue
    seen.add(row.date)
    points.push({ time: row.date as Time, value: row.close })
  }
  return points.sort((left, right) => String(left.time).localeCompare(String(right.time)))
}

function dateSpan(closes: DailyClose[]) {
  const dates = closes.map((row) => row.date).filter(Boolean).sort()
  if (dates.length === 0) return null
  return { from: dates[0], to: dates[dates.length - 1] }
}

function clipCloses(closes: DailyClose[], from: string, to: string) {
  return closes.filter((row) => row.date >= from && row.date <= to)
}

function seriesCurrent(quoted: number | null, closes: DailyClose[]) {
  if (quoted !== null && Number.isFinite(quoted) && quoted > 0) return quoted
  const points = linePoints(closes)
  return points.length > 0 ? points[points.length - 1].value : null
}

function deviationPct(closes: DailyClose[], current: number) {
  let max = 0
  for (const row of closes) {
    if (!Number.isFinite(row.close) || row.close <= 0) continue
    max = Math.max(max, Math.abs(row.close / current - 1))
  }
  return max
}

function seriesTimes(closes: DailyClose[], compares: CompareLine[]) {
  const seen = new Set<string>()
  const times: string[] = []
  for (const row of [...closes, ...compares.flatMap((series) => series.closes)]) {
    if (!row.date || seen.has(row.date)) continue
    seen.add(row.date)
    times.push(row.date)
  }
  return times.sort()
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
  scale: { setVisibleLogicalRange: (range: LogicalRange) => void; fitContent: () => void },
  times: string[],
  days: number | null,
) {
  if (times.length === 0) return
  if (days === null) {
    scale.fitContent()
    return
  }
  const last = times[times.length - 1]
  const fromMs = Date.parse(last) - days * 86_400_000
  let from = 0
  for (let i = 0; i < times.length; i++) {
    if (Date.parse(times[i]) >= fromMs) {
      from = i
      break
    }
  }
  try {
    scale.setVisibleLogicalRange({ from: from as Logical, to: (times.length - 1) as Logical })
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
