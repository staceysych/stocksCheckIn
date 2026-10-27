'use client'

import { planTargetHint, sellTone, showBuyLimits, showSellLimits, sizeNotional, targetTone, type Intent } from '@/lib/watchlist'
import { formatPrice } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { MetricTip } from '@/components/metric-tip'

type LimitValues = {
  target: string
  buyUpTo: string
  sell: string
  sellUpTo: string
}

type PlanTargetsProps = {
  intent: Intent
  values: LimitValues
  onChange: (field: keyof LimitValues, value: string) => void
  price?: number | null
  currency?: string
  saved?: {
    target: number | null
    sell: number | null
  }
}

export function PlanTargets({ intent, values, onChange, price = null, currency = 'USD', saved }: PlanTargetsProps) {
  const showBuy = showBuyLimits(intent)
  const showSell = showSellLimits(intent)
  const buyCash = sizeNotional(optionalNumber(values.buyUpTo), price)
  const sellCash = sizeNotional(optionalNumber(values.sellUpTo), price)

  return (
    <div className="grid gap-3">
      <p className="text-xs text-muted-foreground">{planTargetHint(intent)}</p>
      {showBuy ? (
        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1.5 text-xs">
            <MetricTip metric="target" className={cn(targetTone(price, saved?.target ?? null) !== 'none' && 'text-buy')}>
              <span>Buy under{limitHint(targetTone(price, saved?.target ?? null))}</span>
            </MetricTip>
            <Input
              value={values.target}
              onChange={(event) => onChange('target', event.target.value)}
              inputMode="decimal"
              placeholder="400"
            />
          </label>
          <label className="grid gap-1.5 text-xs">
            <MetricTip metric="buyUpTo">
              <span>Buy up to</span>
            </MetricTip>
            <Input
              value={values.buyUpTo}
              onChange={(event) => onChange('buyUpTo', event.target.value)}
              inputMode="decimal"
              placeholder="10"
            />
            {buyCash !== null ? (
              <p className="text-xs text-muted-foreground">{formatPrice(buyCash, currency)} at last</p>
            ) : null}
          </label>
        </div>
      ) : null}
      {showSell ? (
        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1.5 text-xs">
            <MetricTip metric="sell" className={cn(sellTone(price, saved?.sell ?? null) !== 'none' && 'text-sell')}>
              <span>Sell above{limitHint(sellTone(price, saved?.sell ?? null))}</span>
            </MetricTip>
            <Input
              value={values.sell}
              onChange={(event) => onChange('sell', event.target.value)}
              inputMode="decimal"
              placeholder="480"
            />
          </label>
          <label className="grid gap-1.5 text-xs">
            <MetricTip metric="sellUpTo">
              <span>Sell up to</span>
            </MetricTip>
            <Input
              value={values.sellUpTo}
              onChange={(event) => onChange('sellUpTo', event.target.value)}
              inputMode="decimal"
              placeholder="10"
            />
            {sellCash !== null ? (
              <p className="text-xs text-muted-foreground">{formatPrice(sellCash, currency)} at last</p>
            ) : null}
          </label>
        </div>
      ) : null}
    </div>
  )
}

function optionalNumber(value: string) {
  if (!value.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function limitHint(tone: ReturnType<typeof targetTone>) {
  if (tone === 'live') return ' · live'
  if (tone === 'close') return ' · near'
  return ''
}
