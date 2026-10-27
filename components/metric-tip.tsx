'use client'

import type { ReactNode } from 'react'
import { Info } from 'lucide-react'
import { METRIC_HELP, type MetricId } from '@/lib/metrics'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export function MetricTip({
  metric,
  children,
  className,
}: {
  metric: MetricId
  children: ReactNode
  className?: string
}) {
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      {children}
      <Tooltip>
        <TooltipTrigger
          delay={150}
          render={
            <button
              type="button"
              className="inline-flex size-3.5 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground"
              aria-label={`About ${metricLabel(metric)}`}
              onClick={(event) => event.stopPropagation()}
            />
          }
        >
          <Info className="size-3" aria-hidden />
        </TooltipTrigger>
        <TooltipContent>{METRIC_HELP[metric]}</TooltipContent>
      </Tooltip>
    </span>
  )
}

function metricLabel(metric: MetricId) {
  switch (metric) {
    case 'pctToTarget':
      return '% to target'
    case 'pctVsMa200':
      return '% vs 200'
    case 'pctExpect':
      return '% expect'
    case 'forwardPe':
      return 'forward PE'
    case 'priceToBook':
      return 'price to book'
    case 'priceToSales':
      return 'price to sales'
    case 'divYield':
      return 'yield'
    case 'shortRatio':
      return 'short ratio'
    case 'targetAvg':
      return '1 year target'
    case 'targetLow':
      return '1 year low'
    case 'targetHigh':
      return '1 year high'
    case 'low52':
      return '52 week low'
    case 'high52':
      return '52 week high'
    case 'range52':
      return '52 week range'
    case 'changepct':
      return 'change'
    case 'tradetime':
      return 'as of'
    case 'marketcap':
      return 'market cap'
    case 'buyZone':
      return 'buy zone'
    case 'nearBuy':
      return 'near buy'
    case 'buyUpTo':
      return 'buy up to'
    case 'sellUpTo':
      return 'sell up to'
    case 'diversification':
      return 'sector mix'
    case 'sectorIdeas':
      return 'look list'
    case 'holdingPct':
      return 'sector weight'
    default:
      return metric
  }
}
