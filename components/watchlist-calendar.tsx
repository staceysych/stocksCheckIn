'use client'

import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  dateEvents,
  eventsByDay,
  localDayKey,
  monthCells,
  shiftMonth,
  type DateEvent,
} from '@/lib/calendar'
import type { Position } from '@/lib/watchlist'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

type WatchlistCalendarProps = {
  positions: Position[]
  onSelect: (row: number) => void
}

export function WatchlistCalendar({ positions, onSelect }: WatchlistCalendarProps) {
  const [open, setOpen] = useState(false)
  const [cursor, setCursor] = useState(() => {
    const today = new Date()
    return { year: today.getFullYear(), month: today.getMonth() }
  })

  useEffect(() => {
    if (!open) return
    const today = new Date()
    setCursor({ year: today.getFullYear(), month: today.getMonth() })
  }, [open])

  const todayKey = localDayKey(new Date())
  const events = useMemo(() => dateEvents(positions), [positions])
  const grouped = useMemo(() => eventsByDay(events), [events])
  const cells = useMemo(() => monthCells(cursor.year, cursor.month), [cursor])
  const monthLabel = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(
    new Date(cursor.year, cursor.month, 1),
  )

  const openPosition = (row: number) => {
    setOpen(false)
    onSelect(row)
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Open earnings and ex-div calendar"
        title="Earnings and ex-div"
        onClick={() => setOpen(true)}
      >
        <CalendarDays aria-hidden />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Calendar</DialogTitle>
            <DialogDescription>Earnings and ex-div dates from Yahoo for names on your list.</DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium tracking-tight">{monthLabel}</p>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  const today = new Date()
                  setCursor({ year: today.getFullYear(), month: today.getMonth() })
                }}
              >
                Today
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label="Previous month"
                onClick={() => setCursor((current) => shiftMonth(current.year, current.month, -1))}
              >
                <ChevronLeft aria-hidden />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label="Next month"
                onClick={() => setCursor((current) => shiftMonth(current.year, current.month, 1))}
              >
                <ChevronRight aria-hidden />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-border bg-border">
            {WEEKDAYS.map((label) => (
              <div key={label} className="bg-card px-1.5 py-1.5 text-center text-[10px] tracking-wide text-muted-foreground uppercase">
                {label}
              </div>
            ))}
            {cells.map((cell) => {
              const dayEvents = grouped.get(cell.dayKey) ?? []
              const isToday = cell.dayKey === todayKey
              const shown = dayEvents.slice(0, 3)
              const extra = dayEvents.length - shown.length
              return (
                <div
                  key={cell.dayKey}
                  className={cn(
                    'min-h-[5.25rem] bg-popover p-1.5',
                    !cell.inMonth && 'opacity-40',
                    isToday && 'ring-1 ring-inset ring-foreground/25',
                  )}
                >
                  <p
                    className={cn(
                      'mb-1 flex size-5 items-center justify-center rounded-full text-[11px] tabular-nums',
                      isToday && 'bg-foreground text-background',
                    )}
                  >
                    {cell.day}
                  </p>
                  <ul className="grid gap-0.5">
                    {shown.map((event) => (
                      <li key={`${event.kind}-${event.row}`}>
                        <EventChip event={event} onSelect={openPosition} />
                      </li>
                    ))}
                    {extra > 0 ? <li className="px-1 text-[10px] text-muted-foreground">+{extra}</li> : null}
                  </ul>
                </div>
              )
            })}
          </div>

          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="rounded-md bg-buy/30 px-1.5 py-0.5 font-mono text-[11px] font-medium text-buy">EARN</span>
              Earnings
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="rounded-md bg-sky-500/25 px-1.5 py-0.5 font-mono text-[11px] font-medium text-sky-300">DIV</span>
              Ex-div
            </span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function EventChip({ event, onSelect }: { event: DateEvent; onSelect: (row: number) => void }) {
  const isEarnings = event.kind === 'earnings'
  const className = cn(
    'block w-full truncate rounded-md px-1.5 py-0.5 text-left font-mono text-[11px] font-medium leading-tight',
    isEarnings ? 'bg-buy/30 text-buy' : 'bg-sky-500/25 text-sky-300',
  )
  return (
    <button
      type="button"
      onClick={(click) => {
        click.stopPropagation()
        onSelect(event.row)
      }}
      title={`${event.ticker} ${isEarnings ? 'earnings' : 'ex-div'}`}
      className={className}
    >
      {event.ticker}
    </button>
  )
}
