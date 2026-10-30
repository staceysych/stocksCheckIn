'use client'

import type { SyntheticEvent } from 'react'
import { CalendarDays } from 'lucide-react'
import { earningsProximity, earningsWindowLabel, type EarningsUrgency } from '@/lib/calendar'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export function EarningsMark({ earnings }: { earnings: string }) {
  const proximity = earningsProximity(earnings)
  if (!proximity) return null

  const stopRowSelect = (event: SyntheticEvent) => {
    event.stopPropagation()
  }

  return (
    <Tooltip>
      <TooltipTrigger
        delay={150}
        render={
          <button
            type="button"
            className={cn(
              'inline-flex size-4 shrink-0 items-center justify-center rounded-sm',
              urgencyClass(proximity.urgency),
            )}
            aria-label={`Earnings ${earningsWindowLabel(proximity.urgency).toLowerCase()}`}
            onClick={stopRowSelect}
            onPointerDown={stopRowSelect}
          />
        }
      >
        <CalendarDays className="size-3.5" aria-hidden />
      </TooltipTrigger>
      <TooltipContent>
        <p>{countdownLabel(proximity.days)} · {formatDate(proximity.dayKey)}</p>
        <p className="mt-0.5 text-muted-foreground">{earningsWindowLabel(proximity.urgency)}</p>
      </TooltipContent>
    </Tooltip>
  )
}

function urgencyClass(urgency: EarningsUrgency) {
  if (urgency === 'week') return 'text-orange-400'
  if (urgency === 'fortnight') return 'text-amber-300'
  return 'text-yellow-200'
}

function countdownLabel(days: number) {
  if (days === 0) return 'Earnings today'
  if (days === 1) return 'Earnings tomorrow'
  return `Earnings in ${days} days`
}
