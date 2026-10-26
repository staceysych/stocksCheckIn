'use client'

import { planTargetHint, sellTone, showBuyLimits, showSellLimits, targetTone, type Intent } from '@/lib/watchlist'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { MetricTip } from '@/components/metric-tip'

type LimitValues = {
  target: string
  target2: string
  sell: string
  sell2: string
}

type PlanTargetsProps = {
  intent: Intent
  values: LimitValues
  onChange: (field: keyof LimitValues, value: string) => void
  price?: number | null
  saved?: {
    target: number | null
    target2: number | null
    sell: number | null
    sell2: number | null
  }
}

export function PlanTargets({ intent, values, onChange, price = null, saved }: PlanTargetsProps) {
  const showBuy = showBuyLimits(intent)
  const showSell = showSellLimits(intent)

  return (
    <div className="grid gap-3">
      <p className="text-xs text-muted-foreground">{planTargetHint(intent)}</p>
      {showBuy ? (
        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1.5 text-sm">
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
          <label className="grid gap-1.5 text-sm">
            <MetricTip metric="target2" className={cn(targetTone(price, saved?.target2 ?? null) !== 'none' && 'text-buy')}>
              <span>Buy under 2{limitHint(targetTone(price, saved?.target2 ?? null))}</span>
            </MetricTip>
            <Input
              value={values.target2}
              onChange={(event) => onChange('target2', event.target.value)}
              inputMode="decimal"
              placeholder="Optional"
            />
          </label>
        </div>
      ) : null}
      {showSell ? (
        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1.5 text-sm">
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
          <label className="grid gap-1.5 text-sm">
            <MetricTip metric="sell2" className={cn(sellTone(price, saved?.sell2 ?? null) !== 'none' && 'text-sell')}>
              <span>Sell above 2{limitHint(sellTone(price, saved?.sell2 ?? null))}</span>
            </MetricTip>
            <Input
              value={values.sell2}
              onChange={(event) => onChange('sell2', event.target.value)}
              inputMode="decimal"
              placeholder="Optional"
            />
          </label>
        </div>
      ) : null}
    </div>
  )
}

function limitHint(tone: ReturnType<typeof targetTone>) {
  if (tone === 'live') return ' · live'
  if (tone === 'close') return ' · near'
  return ''
}
