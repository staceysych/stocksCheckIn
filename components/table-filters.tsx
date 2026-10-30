'use client'

import { useState, type ReactNode } from 'react'
import { ListFilter, Plus, X } from 'lucide-react'
import { Menu } from '@base-ui/react/menu'
import { Popover } from '@base-ui/react/popover'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  chipHasValue,
  clearChip,
  EMPTY_FILTERS,
  uniqueSectors,
  type FilterChipId,
  type TableFilters,
} from '@/lib/table-query'
import type { Position } from '@/lib/watchlist'

const popupClass = cn(
  'origin-(--transform-origin) rounded-lg bg-popover text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10',
  'duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
)

const itemClass = cn(
  'flex w-full cursor-default items-center rounded-md px-2 py-1.5 text-left text-sm outline-none select-none',
  'data-highlighted:bg-accent data-highlighted:text-accent-foreground',
)

const selectClass = cn(
  'h-8 w-full min-w-44 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none',
  'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
  'dark:bg-input/30',
)

type AddOption = {
  id: FilterChipId
  label: string
  patch?: Partial<TableFilters>
  openEditor: boolean
}

const ADD_OPTIONS: AddOption[] = [
  { id: 'target', label: 'No target price', patch: { target: 'none' }, openEditor: false },
  { id: 'target', label: 'With target price', patch: { target: 'set' }, openEditor: false },
  { id: 'updatedAfter', label: 'Target updated after', openEditor: true },
  { id: 'updatedBefore', label: 'Target updated before', openEditor: true },
  { id: 'sector', label: 'Sector', openEditor: true },
  { id: 'pctExpect', label: '% expect', openEditor: true },
  { id: 'owned', label: 'Own', patch: { owned: 'yes' }, openEditor: false },
  { id: 'owned', label: 'Not own', patch: { owned: 'no' }, openEditor: false },
]

type TableFiltersBarProps = {
  positions: Position[]
  filters: TableFilters
  onChange: (filters: TableFilters) => void
}

export function TableFiltersBar({ positions, filters, onChange }: TableFiltersBarProps) {
  const [pinned, setPinned] = useState<FilterChipId[]>([])
  const [editing, setEditing] = useState<FilterChipId | null>(null)
  const chips = visibleChips(filters, pinned)
  const available = ADD_OPTIONS.filter((option) => !chips.includes(option.id))
  const { names, missing } = uniqueSectors(positions)

  const add = (option: AddOption) => {
    setPinned((current) => (current.includes(option.id) ? current : [...current, option.id]))
    if (option.patch) onChange({ ...filters, ...option.patch })
    setEditing(option.openEditor ? option.id : null)
  }

  const remove = (id: FilterChipId) => {
    setPinned((current) => current.filter((chip) => chip !== id))
    onChange(clearChip(filters, id))
    if (editing === id) setEditing(null)
  }

  const clearAll = () => {
    setPinned([])
    setEditing(null)
    onChange(EMPTY_FILTERS)
  }

  const set = (patch: Partial<TableFilters>) => onChange({ ...filters, ...patch })

  return (
    <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5">
      {chips.map((id) => (
        <FilterChip
          key={id}
          id={id}
          filters={filters}
          open={editing === id}
          onOpenChange={(open) => setEditing(open ? id : null)}
          onRemove={() => remove(id)}
        >
          <ChipEditor
            id={id}
            filters={filters}
            onChange={set}
            onDone={() => setEditing(null)}
            sectors={names}
            missingSector={missing}
          />
        </FilterChip>
      ))}
      <Menu.Root modal={false} onOpenChange={(open) => { if (open) setEditing(null) }}>
        <Menu.Trigger
          aria-label="Add filter"
          title="Filters"
          className={cn(
            'inline-flex h-6 shrink-0 items-center justify-center gap-1 rounded-full text-sky-100',
            'bg-sky-300/10 ring-1 ring-sky-200/25 hover:bg-sky-300/18 hover:text-sky-50',
            'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
            'data-popup-open:bg-sky-300/18 data-popup-open:text-sky-50',
            chips.length === 0 ? 'px-2' : 'size-6',
          )}
        >
          {chips.length === 0 ? <ListFilter className="size-3.5" aria-hidden /> : <Plus className="size-3.5" aria-hidden />}
          {chips.length === 0 ? <span className="text-[11px] font-medium">Filters</span> : null}
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner className="isolate z-50" sideOffset={6} align="end">
            <Menu.Popup className={cn(popupClass, 'min-w-48 p-1')}>
              {available.length === 0 ? (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">All filters are on the list.</p>
              ) : (
                available.map((option) => (
                  <Menu.Item
                    key={`${option.id}-${option.label}`}
                    className={itemClass}
                    onClick={() => add(option)}
                  >
                    {option.label}
                  </Menu.Item>
                ))
              )}
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
      {chips.length > 0 ? (
        <button
          type="button"
          onClick={clearAll}
          className="h-6 shrink-0 rounded-full px-2 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          Clear all
        </button>
      ) : null}
    </div>
  )
}

function FilterChip({
  id,
  filters,
  open,
  onOpenChange,
  onRemove,
  children,
}: {
  id: FilterChipId
  filters: TableFilters
  open: boolean
  onOpenChange: (open: boolean) => void
  onRemove: () => void
  children: ReactNode
}) {
  return (
    <div className="flex h-6 items-center overflow-hidden rounded-full bg-sky-300/10 text-[11px] leading-none text-sky-100 ring-1 ring-sky-200/25">
      <Popover.Root open={open} onOpenChange={onOpenChange}>
        <Popover.Trigger
          className={cn(
            'h-full px-2 text-left hover:bg-sky-300/18',
            'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
            'data-popup-open:bg-sky-300/18',
          )}
        >
          {chipLabel(id, filters)}
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner className="isolate z-50" sideOffset={6} align="start">
            <Popover.Popup className={cn(popupClass, 'min-w-52 p-2')}>{children}</Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
      <button
        type="button"
        aria-label={`Remove ${chipTitle(id)} filter`}
        onClick={onRemove}
        className="inline-flex size-6 items-center justify-center text-sky-100/70 hover:bg-sky-300/18 hover:text-sky-50"
      >
        <X className="size-3" aria-hidden />
      </button>
    </div>
  )
}

function ChipEditor({
  id,
  filters,
  onChange,
  onDone,
  sectors,
  missingSector,
}: {
  id: FilterChipId
  filters: TableFilters
  onChange: (patch: Partial<TableFilters>) => void
  onDone: () => void
  sectors: string[]
  missingSector: boolean
}) {
  if (id === 'target') {
    return (
      <ChoiceList
        value={filters.target === 'any' ? 'none' : filters.target}
        options={[
          { value: 'none', label: 'No target price' },
          { value: 'set', label: 'With target price' },
        ]}
        onChange={(value) => {
          onChange({ target: value })
          onDone()
        }}
      />
    )
  }
  if (id === 'owned') {
    return (
      <ChoiceList
        value={filters.owned === 'any' ? 'yes' : filters.owned}
        options={[
          { value: 'yes', label: 'Own' },
          { value: 'no', label: 'Not own' },
        ]}
        onChange={(value) => {
          onChange({ owned: value })
          onDone()
        }}
      />
    )
  }
  if (id === 'updatedAfter' || id === 'updatedBefore') {
    return (
      <label className="grid gap-1.5 text-xs text-muted-foreground">
        {id === 'updatedAfter' ? 'Target updated after' : 'Target updated before'}
        <Input
          type="date"
          autoFocus
          value={id === 'updatedAfter' ? filters.updatedAfter : filters.updatedBefore}
          onChange={(event) =>
            onChange(id === 'updatedAfter' ? { updatedAfter: event.target.value } : { updatedBefore: event.target.value })
          }
          className="h-8 text-sm"
        />
      </label>
    )
  }
  if (id === 'sector') {
    return (
      <label className="grid gap-1.5 text-xs text-muted-foreground">
        Sector
        <select
          autoFocus
          value={filters.sector === null ? '' : filters.sector === '' ? '__none__' : filters.sector}
          onChange={(event) => {
            const value = event.target.value
            if (!value) {
              onChange({ sector: null })
              return
            }
            onChange({ sector: value === '__none__' ? '' : value })
            onDone()
          }}
          className={selectClass}
        >
          <option value="">Choose a sector</option>
          {missingSector ? <option value="__none__">No sector</option> : null}
          {sectors.map((sector) => (
            <option key={sector} value={sector}>
              {sector}
            </option>
          ))}
        </select>
      </label>
    )
  }
  return (
    <div className="grid gap-1.5">
      <span className="text-xs text-muted-foreground">% expect</span>
      <div className="flex items-center gap-1.5">
        <Input
          autoFocus
          value={filters.pctExpectMin}
          onChange={(event) => onChange({ pctExpectMin: event.target.value })}
          inputMode="decimal"
          placeholder="Min"
          aria-label="% expect minimum"
          className="h-8 w-20 text-sm"
        />
        <span className="text-xs text-muted-foreground">to</span>
        <Input
          value={filters.pctExpectMax}
          onChange={(event) => onChange({ pctExpectMax: event.target.value })}
          inputMode="decimal"
          placeholder="Max"
          aria-label="% expect maximum"
          className="h-8 w-20 text-sm"
        />
      </div>
    </div>
  )
}

function ChoiceList<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <div className="flex flex-col gap-0.5">
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(itemClass, selected && 'bg-accent text-accent-foreground')}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

function visibleChips(filters: TableFilters, pinned: FilterChipId[]) {
  const chips: FilterChipId[] = []
  for (const id of pinned) {
    if (!chips.includes(id)) chips.push(id)
  }
  for (const id of ['target', 'owned', 'updatedAfter', 'updatedBefore', 'sector', 'pctExpect'] as const) {
    if (chipHasValue(filters, id) && !chips.includes(id)) chips.push(id)
  }
  return chips
}

function chipTitle(id: FilterChipId) {
  switch (id) {
    case 'target':
      return 'Target'
    case 'owned':
      return 'Own'
    case 'updatedAfter':
      return 'Target updated after'
    case 'updatedBefore':
      return 'Target updated before'
    case 'sector':
      return 'Sector'
    case 'pctExpect':
      return '% expect'
  }
}

function chipLabel(id: FilterChipId, filters: TableFilters) {
  switch (id) {
    case 'target':
      return filters.target === 'set' ? 'With target' : 'No target'
    case 'owned':
      return filters.owned === 'no' ? 'Not own' : 'Own'
    case 'updatedAfter':
      return filters.updatedAfter ? `After ${formatChipDate(filters.updatedAfter)}` : 'After'
    case 'updatedBefore':
      return filters.updatedBefore ? `Before ${formatChipDate(filters.updatedBefore)}` : 'Before'
    case 'sector':
      if (filters.sector === null) return 'Sector'
      if (filters.sector === '') return 'No sector'
      return filters.sector
    case 'pctExpect': {
      const min = filters.pctExpectMin.trim()
      const max = filters.pctExpectMax.trim()
      if (min && max) return `% expect ${min}–${max}`
      if (min) return `% expect ≥ ${min}`
      if (max) return `% expect ≤ ${max}`
      return '% expect'
    }
  }
}

function formatChipDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return value
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(
    new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  )
}
