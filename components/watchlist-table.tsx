'use client'

import { useMemo } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { formatDate, formatNumber, formatPct, formatPrice } from '@/lib/format'
import {
  INTENT_LABEL,
  groupByPlanSection,
  intentClass,
  isNearBuy,
  isNearSell,
  maTone,
  sectionShowsBuyTarget,
  sectionShowsSellTarget,
  sellTone,
  showBuyLimits,
  showSellLimits,
  sizeNotional,
  targetTone,
  type MaTone,
  type PlanSection,
  type Position,
  type TargetTone,
} from '@/lib/watchlist'
import { cn } from '@/lib/utils'
import { RangeBar } from '@/components/range-bar'
import { MetricTip } from '@/components/metric-tip'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { YahooQuoteLink } from '@/components/yahoo-quote-link'
import { EarningsMark } from '@/components/earnings-mark'
import type { MetricId } from '@/lib/metrics'
import type { SortKey, SortState } from '@/lib/table-query'

export type TableView = 'overview' | 'range' | 'valuation' | 'calendar' | 'chart' | 'sectors' | 'sectorOverview'

const TICKER_COL = 'w-48 min-w-48 max-w-48'

type WatchlistTableProps = {
  positions: Position[]
  view: TableView
  selectedRow: number | null
  onSelect: (row: number) => void
  sort: SortState
  onToggleSort: (key: SortKey) => void
}

export function WatchlistTable({ positions, view, selectedRow, onSelect, sort, onToggleSort }: WatchlistTableProps) {
  const sections = useMemo(() => groupByPlanSection(positions), [positions])

  if (sections.length === 0) {
    return <p className="py-16 text-center text-sm text-muted-foreground">No names match these filters.</p>
  }

  return (
    <div className="flex flex-col gap-8">
      {sections.map((section) => (
        <section key={section.id} className="flex flex-col gap-2.5">
          <header className="flex items-baseline gap-2">
            <h2 className={cn('text-base font-medium tracking-tight', sectionTitleClass(section.id))}>{section.label}</h2>
            <span className="text-xs tabular-nums text-muted-foreground">{section.positions.length}</span>
          </header>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="relative isolate overflow-x-auto">
              <table className="w-full min-w-[1120px] table-fixed border-separate border-spacing-0 text-sm">
                <colgroup>
                  <col className={TICKER_COL} />
                </colgroup>
                <ColumnHeads view={view} section={section.id} sort={sort} onToggle={onToggleSort} />
                <tbody>
                  {section.positions.map((position) => (
                    <PositionRow
                      key={position.row}
                      position={position}
                      view={view}
                      section={section.id}
                      selected={position.row === selectedRow}
                      onSelect={onSelect}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ))}
    </div>
  )
}

function sectionTitleClass(section: PlanSection) {
  if (section === 'buy') return 'text-buy'
  if (section === 'sell') return 'text-sell'
  return undefined
}

function PositionRow({
  position,
  view,
  section,
  selected,
  onSelect,
}: {
  position: Position
  view: TableView
  section: PlanSection
  selected: boolean
  onSelect: (row: number) => void
}) {
  return (
    <tr
      onClick={() => onSelect(position.row)}
      className={cn(
        'group cursor-pointer border-b border-border/70 hover:bg-white/5',
        position.inSellZone && 'bg-row-sell hover:bg-row-sell',
        !position.inSellZone && position.inBuyZone && 'bg-row-buy hover:bg-row-buy',
        selected && 'bg-accent hover:bg-accent',
      )}
    >
      <td
        className={cn(
          'sticky left-0 z-20 overflow-hidden bg-background px-3 py-2.5 font-mono text-sm font-medium whitespace-nowrap shadow-[1px_0_0_0_var(--border)]',
          TICKER_COL,
          'group-hover:bg-white/5',
          position.inSellZone && 'bg-row-sell hover:bg-row-sell group-hover:bg-row-sell',
          !position.inSellZone && position.inBuyZone && 'bg-row-buy hover:bg-row-buy group-hover:bg-row-buy',
          selected && 'bg-accent hover:bg-accent group-hover:bg-accent',
        )}
      >
        <span className="flex w-full min-w-0 items-center gap-1.5">
          <YahooQuoteLink ticker={position.ticker} />
          <TickerLabel ticker={position.ticker} name={position.name} />
          <TickerTag position={position} />
          <span className="ml-auto flex shrink-0 items-center">
            <EarningsMark earnings={position.earnings} />
          </span>
        </span>
      </td>
      {view === 'overview' ? (
        <>
          <td className="px-3 py-2.5 text-right font-mono tabular-nums">
            {position.quoteUnavailable ? (
              <span className="text-muted-foreground">n/a</span>
            ) : (
              formatPrice(position.price, position.currency)
            )}
          </td>
          <ChangeCell value={position.changepct} />
          <td className="px-3 py-2.5 text-right font-mono tabular-nums">{formatPrice(position.targetAvg, position.currency)}</td>
          <ChangeCell value={position.pctExpect} />
          {sectionShowsBuyTarget(section) ? (
            <>
              <TargetCell
                price={position.price}
                target={position.target}
                currency={position.currency}
                active={showBuyLimits(position.intent)}
              />
              <PctToTargetCell
                price={position.price}
                target={position.target}
                value={position.pctToTarget}
                active={showBuyLimits(position.intent)}
              />
              <SizeCell
                qty={showBuyLimits(position.intent) ? position.buyUpTo : null}
                price={position.price}
                currency={position.currency}
              />
            </>
          ) : null}
          {sectionShowsSellTarget(section) ? (
            <>
              <SellCell
                price={position.price}
                sell={position.sell}
                currency={position.currency}
                active={showSellLimits(position.intent)}
              />
              <PctToSellCell
                price={position.price}
                sell={position.sell}
                value={position.pctToSell}
                active={showSellLimits(position.intent)}
              />
              <SizeCell
                qty={showSellLimits(position.intent) ? position.sellUpTo : null}
                price={position.price}
                currency={position.currency}
              />
            </>
          ) : null}
          <td className={cn('px-3 py-2.5 text-xs tracking-wide uppercase', intentClass(position.intent))}>
            {INTENT_LABEL[position.intent]}
          </td>
          <PnlCell position={position} />
        </>
      ) : null}
      {view === 'range' ? (
        <>
          <td className="px-3 py-2.5 text-right font-mono tabular-nums">
            {position.quoteUnavailable ? (
              <span className="text-muted-foreground">n/a</span>
            ) : (
              formatPrice(position.price, position.currency)
            )}
          </td>
          <MaCell price={position.price} ma={position.ma20} currency={position.currency} />
          <MaCell price={position.price} ma={position.ma50} currency={position.currency} />
          <MaCell price={position.price} ma={position.ma100} currency={position.currency} />
          <MaCell price={position.price} ma={position.ma200} currency={position.currency} />
          <td className="px-3 py-2.5">
            <RangeBar
              position={position.rangePosition}
              inBuyZone={position.inBuyZone}
              inSellZone={position.inSellZone}
            />
          </td>
          <td className="px-3 py-2.5 text-right font-mono tabular-nums">{formatPrice(position.low52, position.currency)}</td>
          <td className="px-3 py-2.5 text-right font-mono tabular-nums">{formatPrice(position.high52, position.currency)}</td>
        </>
      ) : null}
      {view === 'valuation' ? (
        <>
          <td className="px-3 py-2.5 text-right font-mono tabular-nums">{formatNumber(position.pe)}</td>
          <td className="px-3 py-2.5 text-right font-mono tabular-nums">{formatNumber(position.forwardPe)}</td>
          <td className="px-3 py-2.5 text-right font-mono tabular-nums">{formatNumber(position.peg)}</td>
          <td className="px-3 py-2.5 text-right font-mono tabular-nums">{formatNumber(position.priceToBook)}</td>
          <td className="px-3 py-2.5 text-right font-mono tabular-nums">{formatNumber(position.priceToSales)}</td>
          <td className="px-3 py-2.5 text-right font-mono tabular-nums">{formatPct(position.divYield)}</td>
          <td className="px-3 py-2.5 text-right font-mono tabular-nums">{formatNumber(position.shortRatio)}</td>
          <td className="px-3 py-2.5 text-right font-mono tabular-nums">{formatPrice(position.targetAvg, position.currency)}</td>
          <td className="px-3 py-2.5 text-right font-mono tabular-nums">{formatPct(position.pctExpect)}</td>
        </>
      ) : null}
      {view === 'calendar' ? (
        <>
          <td className="max-w-[140px] truncate px-3 py-2.5 text-muted-foreground">{position.sector || '—'}</td>
          <td className="px-3 py-2.5 font-mono">{formatDate(position.earnings)}</td>
          <td className="px-3 py-2.5 font-mono">{formatDate(position.exDiv)}</td>
          <td className="px-3 py-2.5 font-mono text-muted-foreground">{formatAsOf(position.tradetime)}</td>
        </>
      ) : null}
    </tr>
  )
}

function TickerLabel({ ticker, name }: { ticker: string; name: string }) {
  if (!name) return ticker

  return (
    <Tooltip>
      <TooltipTrigger delay={150} className="cursor-pointer bg-transparent p-0 font-inherit text-inherit">
        {ticker}
      </TooltipTrigger>
      <TooltipContent>{name}</TooltipContent>
    </Tooltip>
  )
}

function TickerTag({ position }: { position: Position }) {
  if (isNearSell(position)) {
    return <span className="text-xs tracking-wide text-sell/80 uppercase">Near</span>
  }
  if (isNearBuy(position)) {
    return <span className="text-xs tracking-wide text-buy/80 uppercase">Near</span>
  }
  if (position.owned) {
    return <span className="text-xs tracking-wide text-muted-foreground uppercase">Own</span>
  }
  return null
}

function PnlCell({ position }: { position: Position }) {
  if (!position.owned || position.pnlPct === null) {
    return <td className="px-3 py-2.5 text-right font-mono text-muted-foreground">—</td>
  }
  const up = position.pnlPct >= 0
  return (
    <td className={cn('px-3 py-2.5 text-right font-mono tabular-nums', up ? 'text-up' : 'text-down')}>
      {formatPct(position.pnlPct)}
    </td>
  )
}

function formatAsOf(value: string) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(
    date,
  )
}

function targetClass(tone: TargetTone) {
  if (tone === 'live') return 'bg-buy/20 text-buy'
  if (tone === 'close') return 'bg-buy/10 text-buy/80'
  return ''
}

function sellClass(tone: TargetTone) {
  if (tone === 'live') return 'bg-sell/20 text-sell'
  if (tone === 'close') return 'bg-sell/10 text-sell/80'
  return ''
}

function maClass(tone: MaTone) {
  if (tone === 'pullback') return 'text-up'
  if (tone === 'extended') return 'text-down'
  return ''
}

function targetTitle(tone: TargetTone) {
  if (tone === 'live') return 'Price is at or under this buy target'
  if (tone === 'close') return 'Price is within 5% above this buy target'
  return undefined
}

function sellTitle(tone: TargetTone) {
  if (tone === 'live') return 'Price is at or above this sell target'
  if (tone === 'close') return 'Price is within 5% below this sell target'
  return undefined
}

function TargetCell({
  price,
  target,
  currency,
  active = true,
}: {
  price: number | null
  target: number | null
  currency: string
  active?: boolean
}) {
  if (!active) return <td className="px-3 py-2.5 text-right font-mono text-muted-foreground">—</td>
  const tone = targetTone(price, target)
  return (
    <td className={cn('px-3 py-2.5 text-right font-mono tabular-nums', targetClass(tone))} title={targetTitle(tone)}>
      {formatPrice(target, currency)}
    </td>
  )
}

function PctToTargetCell({
  price,
  target,
  value,
  active = true,
}: {
  price: number | null
  target: number | null
  value: number | null
  active?: boolean
}) {
  if (!active) return <td className="px-3 py-2.5 text-right font-mono text-muted-foreground">—</td>
  const tone = targetTone(price, target)
  return (
    <td className={cn('px-3 py-2.5 text-right font-mono tabular-nums', targetClass(tone))} title={targetTitle(tone)}>
      {formatPct(value)}
    </td>
  )
}

function SellCell({
  price,
  sell,
  currency,
  active = true,
}: {
  price: number | null
  sell: number | null
  currency: string
  active?: boolean
}) {
  if (!active) return <td className="px-3 py-2.5 text-right font-mono text-muted-foreground">—</td>
  const tone = sellTone(price, sell)
  return (
    <td className={cn('px-3 py-2.5 text-right font-mono tabular-nums', sellClass(tone))} title={sellTitle(tone)}>
      {formatPrice(sell, currency)}
    </td>
  )
}

function PctToSellCell({
  price,
  sell,
  value,
  active = true,
}: {
  price: number | null
  sell: number | null
  value: number | null
  active?: boolean
}) {
  if (!active) return <td className="px-3 py-2.5 text-right font-mono text-muted-foreground">—</td>
  const tone = sellTone(price, sell)
  return (
    <td className={cn('px-3 py-2.5 text-right font-mono tabular-nums', sellClass(tone))} title={sellTitle(tone)}>
      {formatPct(value)}
    </td>
  )
}

function pctVsMa(price: number | null, ma: number | null) {
  if (price === null || ma === null || ma === 0) return null
  return (price / ma - 1) * 100
}

function MaCell({
  price,
  ma,
  currency,
}: {
  price: number | null
  ma: number | null
  currency: string
}) {
  const tone = maTone(price, ma)
  const pct = pctVsMa(price, ma)
  return (
    <td className={cn('px-3 py-2.5 text-right font-mono tabular-nums', maClass(tone))}>
      {ma === null ? (
        '—'
      ) : (
        <Tooltip>
          <TooltipTrigger delay={150} className="cursor-pointer bg-transparent p-0 font-inherit text-inherit tabular-nums">
            {formatPct(pct)}
          </TooltipTrigger>
          <TooltipContent>{formatPrice(ma, currency)}</TooltipContent>
        </Tooltip>
      )}
    </td>
  )
}

function SizeCell({
  qty,
  price,
  currency,
}: {
  qty: number | null
  price: number | null
  currency: string
}) {
  if (qty === null) return <td className="px-3 py-2.5 text-right font-mono text-muted-foreground">—</td>
  const cash = sizeNotional(qty, price)
  return (
    <td className="px-3 py-2.5 text-right font-mono tabular-nums">
      {cash === null ? (
        formatNumber(qty)
      ) : (
        <Tooltip>
          <TooltipTrigger delay={150} className="cursor-pointer bg-transparent p-0 font-inherit text-inherit tabular-nums">
            {formatNumber(qty)}
          </TooltipTrigger>
          <TooltipContent>{formatPrice(cash, currency)} at last</TooltipContent>
        </Tooltip>
      )}
    </td>
  )
}

function ChangeCell({ value }: { value: number | null }) {
  if (value === null) return <td className="px-3 py-2.5 text-right font-mono text-muted-foreground">—</td>
  const up = value >= 0
  return (
    <td className={cn('px-3 py-2.5 text-right font-mono tabular-nums', up ? 'text-up' : 'text-down')}>
      {formatPct(value)}
    </td>
  )
}

function ColumnHeads({
  view,
  section,
  sort,
  onToggle,
}: {
  view: TableView
  section: PlanSection
  sort: SortState
  onToggle: (key: SortKey) => void
}) {
  return (
    <thead className="bg-card text-xs tracking-wide text-muted-foreground uppercase">
      <tr className="border-b border-border">
        <SortHead metric="ticker" label="Ticker" active={sort.key === 'ticker'} dir={sort.dir} onClick={() => onToggle('ticker')} sticky />
        {view === 'overview' ? (
          <>
            <SortHead metric="price" label="Price" active={sort.key === 'price'} dir={sort.dir} onClick={() => onToggle('price')} numeric />
            <SortHead metric="changepct" label="Chg" active={sort.key === 'changepct'} dir={sort.dir} onClick={() => onToggle('changepct')} numeric />
            <SortHead metric="targetAvg" label="1Y tgt" active={sort.key === 'targetAvg'} dir={sort.dir} onClick={() => onToggle('targetAvg')} numeric />
            <SortHead metric="pctExpect" label="% to 1Y" active={sort.key === 'pctExpect'} dir={sort.dir} onClick={() => onToggle('pctExpect')} numeric />
            {sectionShowsBuyTarget(section) ? (
              <>
                <SortHead metric="target" label="Buy target" active={sort.key === 'target'} dir={sort.dir} onClick={() => onToggle('target')} numeric />
                <SortHead metric="pctToTarget" label="% to tgt" active={sort.key === 'pctToTarget'} dir={sort.dir} onClick={() => onToggle('pctToTarget')} numeric />
                <SortHead metric="buyUpTo" label="Buy up to" active={sort.key === 'buyUpTo'} dir={sort.dir} onClick={() => onToggle('buyUpTo')} numeric />
              </>
            ) : null}
            {sectionShowsSellTarget(section) ? (
              <>
                <SortHead metric="sell" label="Sell target" active={sort.key === 'sell'} dir={sort.dir} onClick={() => onToggle('sell')} numeric />
                <SortHead metric="pctToSell" label="% to tgt" active={sort.key === 'pctToSell'} dir={sort.dir} onClick={() => onToggle('pctToSell')} numeric />
                <SortHead metric="sellUpTo" label="Sell up to" active={sort.key === 'sellUpTo'} dir={sort.dir} onClick={() => onToggle('sellUpTo')} numeric />
              </>
            ) : null}
            <SortHead metric="intent" label="Plan" active={sort.key === 'intent'} dir={sort.dir} onClick={() => onToggle('intent')} />
            <SortHead metric="pnl" label="P/L" active={sort.key === 'pnlPct'} dir={sort.dir} onClick={() => onToggle('pnlPct')} numeric />
          </>
        ) : null}
        {view === 'range' ? (
          <>
            <SortHead metric="price" label="Price" active={sort.key === 'price'} dir={sort.dir} onClick={() => onToggle('price')} numeric />
            <SortHead metric="ma20" label="MA20%" active={sort.key === 'ma20'} dir={sort.dir} onClick={() => onToggle('ma20')} numeric />
            <SortHead metric="ma50" label="MA50%" active={sort.key === 'ma50'} dir={sort.dir} onClick={() => onToggle('ma50')} numeric />
            <SortHead metric="ma100" label="MA100%" active={sort.key === 'ma100'} dir={sort.dir} onClick={() => onToggle('ma100')} numeric />
            <SortHead metric="ma200" label="MA200%" active={sort.key === 'ma200'} dir={sort.dir} onClick={() => onToggle('ma200')} numeric />
            <SortHead metric="range52" label="52w" active={sort.key === 'range52'} dir={sort.dir} onClick={() => onToggle('range52')} />
            <SortHead metric="low52" label="Low" active={sort.key === 'low52'} dir={sort.dir} onClick={() => onToggle('low52')} numeric />
            <SortHead metric="high52" label="High" active={sort.key === 'high52'} dir={sort.dir} onClick={() => onToggle('high52')} numeric />
          </>
        ) : null}
        {view === 'valuation' ? (
          <>
            <SortHead metric="pe" label="PE" active={sort.key === 'pe'} dir={sort.dir} onClick={() => onToggle('pe')} numeric />
            <SortHead metric="forwardPe" label="Fwd PE" active={sort.key === 'forwardPe'} dir={sort.dir} onClick={() => onToggle('forwardPe')} numeric />
            <SortHead metric="peg" label="PEG" active={sort.key === 'peg'} dir={sort.dir} onClick={() => onToggle('peg')} numeric />
            <SortHead metric="priceToBook" label="P/B" active={sort.key === 'priceToBook'} dir={sort.dir} onClick={() => onToggle('priceToBook')} numeric />
            <SortHead metric="priceToSales" label="P/S" active={sort.key === 'priceToSales'} dir={sort.dir} onClick={() => onToggle('priceToSales')} numeric />
            <SortHead metric="divYield" label="Yield" active={sort.key === 'divYield'} dir={sort.dir} onClick={() => onToggle('divYield')} numeric />
            <SortHead metric="shortRatio" label="Short" active={sort.key === 'shortRatio'} dir={sort.dir} onClick={() => onToggle('shortRatio')} numeric />
            <SortHead metric="targetAvg" label="1Y tgt" active={sort.key === 'targetAvg'} dir={sort.dir} onClick={() => onToggle('targetAvg')} numeric />
            <SortHead metric="pctExpect" label="% expect" active={sort.key === 'pctExpect'} dir={sort.dir} onClick={() => onToggle('pctExpect')} numeric />
          </>
        ) : null}
        {view === 'calendar' ? (
          <>
            <SortHead metric="sector" label="Sector" active={sort.key === 'sector'} dir={sort.dir} onClick={() => onToggle('sector')} />
            <SortHead metric="earnings" label="Earnings" active={sort.key === 'earnings'} dir={sort.dir} onClick={() => onToggle('earnings')} />
            <SortHead metric="exDiv" label="Ex-div" active={sort.key === 'exDiv'} dir={sort.dir} onClick={() => onToggle('exDiv')} />
            <SortHead metric="tradetime" label="As of" active={sort.key === 'tradetime'} dir={sort.dir} onClick={() => onToggle('tradetime')} />
          </>
        ) : null}
      </tr>
    </thead>
  )
}

function SortHead({
  metric,
  label,
  active,
  dir,
  onClick,
  numeric,
  sticky,
}: {
  metric: MetricId
  label: string
  active: boolean
  dir: 'asc' | 'desc'
  onClick: () => void
  numeric?: boolean
  sticky?: boolean
}) {
  return (
    <th
      aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={cn(
        'px-3 py-2 font-medium',
        numeric ? 'text-right' : 'text-left',
        sticky && cn('sticky left-0 z-30 overflow-hidden bg-card shadow-[1px_0_0_0_var(--border)]', TICKER_COL),
      )}
    >
      <MetricTip metric={metric}>
        <button type="button" onClick={onClick} className="inline-flex items-center gap-1 hover:text-foreground">
          {label}
          {active ? dir === 'asc' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" /> : null}
        </button>
      </MetricTip>
    </th>
  )
}
