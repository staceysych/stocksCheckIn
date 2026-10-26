'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useWatchlist } from '@/lib/use-watchlist'
import { exclusiveLimits, showBuyLimits, showSellLimits, type Intent } from '@/lib/watchlist'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { IntentSelect } from '@/components/intent-select'
import { PlanTargets } from '@/components/plan-targets'

type AddTickerDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function parseOptionalNumber(value: string, label: string): { ok: true; value: number | null } | { ok: false; error: string } {
  if (!value.trim()) return { ok: true, value: null }
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return { ok: false, error: `${label} must be a number.` }
  if (parsed < 0) return { ok: false, error: `${label} cannot be negative.` }
  return { ok: true, value: parsed }
}

export function AddTickerDialog({ open, onOpenChange }: AddTickerDialogProps) {
  const { addTicker, hasTicker } = useWatchlist()
  const [ticker, setTicker] = useState('')
  const [name, setName] = useState('')
  const [target, setTarget] = useState('')
  const [target2, setTarget2] = useState('')
  const [sell, setSell] = useState('')
  const [sell2, setSell2] = useState('')
  const [idea, setIdea] = useState('')
  const [owned, setOwned] = useState(false)
  const [shares, setShares] = useState('')
  const [cost, setCost] = useState('')
  const [intent, setIntent] = useState<Intent>('buy')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setTicker('')
    setName('')
    setTarget('')
    setTarget2('')
    setSell('')
    setSell2('')
    setIdea('')
    setOwned(false)
    setShares('')
    setCost('')
    setIntent('buy')
    setError(null)
    setPending(false)
  }

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next)
    if (!next) setTimeout(reset, 150)
  }

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const symbol = ticker.trim().toUpperCase()
    if (!symbol) {
      setError('A ticker is required.')
      return
    }
    if (hasTicker(symbol)) {
      setError(`${symbol} is already on your list.`)
      return
    }
    const parsedTarget = showBuyLimits(intent) ? parseOptionalNumber(target, 'Buy target') : { ok: true as const, value: null }
    const parsedTarget2 = showBuyLimits(intent) ? parseOptionalNumber(target2, 'Second buy target') : { ok: true as const, value: null }
    const parsedSell = showSellLimits(intent) ? parseOptionalNumber(sell, 'Sell target') : { ok: true as const, value: null }
    const parsedSell2 = showSellLimits(intent) ? parseOptionalNumber(sell2, 'Second sell target') : { ok: true as const, value: null }
    const parsedShares = parseOptionalNumber(shares, 'Shares')
    const parsedCost = parseOptionalNumber(cost, 'Buy price')
    if (!parsedTarget.ok) {
      setError(parsedTarget.error)
      return
    }
    if (!parsedTarget2.ok) {
      setError(parsedTarget2.error)
      return
    }
    if (!parsedSell.ok) {
      setError(parsedSell.error)
      return
    }
    if (!parsedSell2.ok) {
      setError(parsedSell2.error)
      return
    }
    if (!parsedShares.ok) {
      setError(parsedShares.error)
      return
    }
    if (!parsedCost.ok) {
      setError(parsedCost.error)
      return
    }
    if (owned && parsedShares.value === null) {
      setError('How many shares do you own?')
      return
    }

    const nextShares = owned ? parsedShares.value : null
    const nextCost = owned ? parsedCost.value : null
    const limits = exclusiveLimits(intent, {
      target: parsedTarget.value,
      target2: parsedTarget2.value,
      sell: parsedSell.value,
      sell2: parsedSell2.value,
    })

    setPending(true)
    setError(null)
    try {
      await addTicker({
        ticker: symbol,
        name: name.trim(),
        idea: idea.trim(),
        ...limits,
        shares: nextShares,
        cost: nextCost,
        intent,
      })
      handleOpenChange(false)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not add ticker.')
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <form onSubmit={onSubmit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Add ticker</DialogTitle>
            <DialogDescription>
              Say whether you own it and what you want to do. Then add a buy or sell price if it helps.
            </DialogDescription>
          </DialogHeader>

          <label className="grid gap-1.5 text-sm">
            <span>Ticker</span>
            <Input
              value={ticker}
              onChange={(event) => setTicker(event.target.value.toUpperCase())}
              placeholder="MSFT"
              autoFocus
              required
              className="font-mono uppercase"
            />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span>Name</span>
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Microsoft" />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={owned}
              onChange={(event) => {
                const next = event.target.checked
                setOwned(next)
                setIntent(next ? 'hold' : 'buy')
              }}
              className="size-4 rounded border-input accent-foreground"
            />
            I already own this
          </label>
          {owned ? (
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1.5 text-sm">
                <span>Shares</span>
                <Input
                  value={shares}
                  onChange={(event) => setShares(event.target.value)}
                  inputMode="decimal"
                  placeholder="10"
                />
              </label>
              <label className="grid gap-1.5 text-sm">
                <span>Avg buy price</span>
                <Input
                  value={cost}
                  onChange={(event) => setCost(event.target.value)}
                  inputMode="decimal"
                  placeholder="400"
                />
              </label>
            </div>
          ) : null}
          <label className="grid gap-1.5 text-sm">
            <span>Plan</span>
            <IntentSelect value={intent} owned={owned} onChange={setIntent} />
          </label>
          <PlanTargets
            intent={intent}
            values={{ target, target2, sell, sell2 }}
            onChange={(field, value) => {
              if (field === 'target') setTarget(value)
              if (field === 'target2') setTarget2(value)
              if (field === 'sell') setSell(value)
              if (field === 'sell2') setSell2(value)
            }}
          />
          <label className="grid gap-1.5 text-sm">
            <span>IDEA</span>
            <Textarea
              value={idea}
              onChange={(event) => setIdea(event.target.value)}
              placeholder="Why this name is on the list"
              rows={3}
            />
          </label>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Add to watchlist
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
