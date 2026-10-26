import { cn } from '@/lib/utils'

export function RangeBar({
  position,
  inBuyZone,
  inSellZone,
  className,
}: {
  position: number | null
  inBuyZone?: boolean
  inSellZone?: boolean
  className?: string
}) {
  if (position === null) {
    return <span className="text-muted-foreground">—</span>
  }

  const pct = `${Math.min(100, Math.max(0, position * 100))}%`
  const fill = inSellZone ? 'bg-sell/70' : inBuyZone ? 'bg-buy/70' : 'bg-foreground/45'
  const needle = inSellZone ? 'bg-sell' : inBuyZone ? 'bg-buy' : 'bg-foreground'

  return (
    <span className={cn('relative mx-1 block h-2 w-28 rounded-full bg-foreground/15', className)} aria-hidden>
      <span className={cn('absolute inset-y-0 left-0 rounded-full', fill)} style={{ width: pct }} />
      <span
        className={cn('absolute top-1/2 h-3.5 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full', needle)}
        style={{ left: pct }}
      />
    </span>
  )
}
