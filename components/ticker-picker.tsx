'use client'

import { Check, ChevronsUpDown, Search } from 'lucide-react'
import { Combobox } from '@base-ui/react/combobox'
import { INTENT_LABEL, type Intent, type Position } from '@/lib/watchlist'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type TickerOption = {
  ticker: string
  name: string
  intent: Intent
}

type TickerPickerProps = {
  positions: Position[]
  ticker: string
  onChange: (ticker: string) => void
  exclude?: string[]
  allowEmpty?: boolean
  placeholder?: string
  ariaLabel?: string
}

export function TickerPicker({
  positions,
  ticker,
  onChange,
  exclude = [],
  allowEmpty = false,
  placeholder = 'Choose a ticker',
  ariaLabel = 'Choose ticker',
}: TickerPickerProps) {
  const blocked = new Set(exclude)
  const items: TickerOption[] = positions
    .filter((row) => !blocked.has(row.ticker))
    .map((row) => ({
      ticker: row.ticker,
      name: row.name,
      intent: row.intent,
    }))
  const matched = items.find((item) => item.ticker === ticker) ?? null
  const value = matched ?? (allowEmpty ? null : items[0] ?? null)

  return (
    <Combobox.Root
      items={items}
      value={value}
      onValueChange={(next) => {
        if (next) onChange(next.ticker)
      }}
      itemToStringLabel={(item) => `${item.ticker} ${item.name} ${INTENT_LABEL[item.intent]}`.trim()}
      isItemEqualToValue={(item, selected) => Boolean(selected && item.ticker === selected.ticker)}
      autoHighlight
    >
      <Combobox.Trigger
        aria-label={ariaLabel}
        className={cn(
          'flex h-auto w-72 max-w-full items-center justify-between gap-3 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-left text-sm outline-none',
          'hover:bg-muted/60 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
          'data-popup-open:border-ring data-popup-open:ring-3 data-popup-open:ring-ring/50',
          'dark:bg-input/30',
        )}
      >
        <Combobox.Value>
          {(selected: TickerOption | null) =>
            selected ? (
              <span className="flex min-w-0 flex-col">
                <span className="font-mono text-sm leading-tight">{selected.ticker}</span>
                <span className="truncate text-[12px] font-normal text-muted-foreground">
                  {selected.name || selected.ticker}
                </span>
              </span>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )
          }
        </Combobox.Value>
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </Combobox.Trigger>
      <Combobox.Portal>
        <Combobox.Positioner className="isolate z-50" align="start" sideOffset={6}>
          <Combobox.Popup
            aria-label={ariaLabel}
            className={cn(
              'flex w-(--anchor-width) min-w-72 origin-(--transform-origin) flex-col overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10',
              'duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
            )}
          >
            <div className="p-1.5 pb-0">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Combobox.Input
                  placeholder="Search ticker or name"
                  render={<Input className="h-8 pl-8 dark:bg-input/30" />}
                />
              </div>
            </div>
            <Combobox.Empty className="text-center text-sm text-muted-foreground">
              <span className="block px-3 py-4">No matching tickers.</span>
            </Combobox.Empty>
            <Combobox.List className="max-h-72 overflow-y-auto overscroll-contain p-1">
              {(item: TickerOption) => (
                <Combobox.Item
                  key={item.ticker}
                  value={item}
                  className={cn(
                    'flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none select-none',
                    'data-highlighted:bg-accent data-highlighted:text-accent-foreground',
                    'data-disabled:pointer-events-none data-disabled:opacity-50',
                  )}
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="flex items-baseline gap-2">
                      <span className="font-mono">{item.ticker}</span>
                      <span className="text-[11px] text-muted-foreground">{INTENT_LABEL[item.intent]}</span>
                    </span>
                    <span className="truncate text-[12px] text-muted-foreground">{item.name || item.ticker}</span>
                  </span>
                  <Combobox.ItemIndicator>
                    <Check className="size-4 text-foreground" aria-hidden />
                  </Combobox.ItemIndicator>
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  )
}
