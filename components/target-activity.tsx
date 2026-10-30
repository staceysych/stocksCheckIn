import { activityFieldLabel, type TargetActivity } from '@/lib/activity'
import { formatDateTime, formatPrice } from '@/lib/format'
import { MetricTip } from '@/components/metric-tip'
import { cn } from '@/lib/utils'

type TargetActivityHistoryProps = {
  events: TargetActivity[]
  currency?: string
}

export function TargetActivityHistory({ events, currency }: TargetActivityHistoryProps) {
  return (
    <section>
      <h3 className="text-xs tracking-wide text-muted-foreground uppercase">
        <MetricTip metric="targetActivity">
          <span>Target price history</span>
        </MetricTip>
      </h3>
      {events.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          No target changes yet. Save a buy-under or sell-above price to start a log.
        </p>
      ) : (
        <ol className="mt-4">
          {events.map((event, index) => (
            <li
              key={`${event.at}-${event.field}-${event.from}-${event.to}-${index}`}
              className="relative grid gap-0.5 border-l border-border py-3 pl-4"
            >
              <span
                className={cn(
                  'absolute top-4 -left-px size-2 -translate-x-1/2 rounded-full',
                  index === 0 ? 'bg-foreground' : 'bg-muted-foreground/50',
                  event.field === 'sell' ? 'ring-2 ring-sell/30' : 'ring-2 ring-buy/30',
                )}
                aria-hidden
              />
              <p className={cn('text-xs tracking-wide uppercase', event.field === 'sell' ? 'text-sell' : 'text-buy')}>
                {activityFieldLabel(event.field)}
              </p>
              <p className="font-mono text-sm tabular-nums">
                {formatAmount(event.from, currency)}
                <span className="mx-1.5 text-muted-foreground">→</span>
                {formatAmount(event.to, currency)}
              </p>
              <p className="text-xs text-muted-foreground">{formatDateTime(event.at)}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

function formatAmount(value: number | null, currency?: string) {
  return value === null ? 'none' : formatPrice(value, currency)
}
