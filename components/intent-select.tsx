'use client'

import { INTENT_LABEL, type Intent } from '@/lib/watchlist'
import { cn } from '@/lib/utils'

const OWNED_INTENTS = ['hold', 'add', 'trim', 'sell'] as const
const WATCH_INTENTS = ['watch', 'buy'] as const

type IntentSelectProps = {
  value: Intent
  owned: boolean
  onChange: (intent: Intent) => void
  id?: string
}

export function IntentSelect({ value, owned, onChange, id }: IntentSelectProps) {
  const options = owned ? OWNED_INTENTS : WATCH_INTENTS
  const selected = (options as readonly Intent[]).includes(value) ? value : options[0]

  return (
    <select
      id={id}
      value={selected}
      onChange={(event) => onChange(event.target.value as Intent)}
      className={cn(
        'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none',
        'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
        'dark:bg-input/30',
      )}
    >
      {options.map((intent) => (
        <option key={intent} value={intent}>
          {INTENT_LABEL[intent]}
        </option>
      ))}
    </select>
  )
}
