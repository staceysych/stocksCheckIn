'use client'

import { useState, type FormEvent, type SyntheticEvent } from 'react'
import { CirclePlus, Loader2 } from 'lucide-react'
import { formatNumber, formatPrice } from '@/lib/format'
import { addShareLot, normalizeIntent, type Position } from '@/lib/watchlist'
import { useWatchlist } from '@/lib/use-watchlist'
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

type AddSharesDialogProps = {
  position: Position
}

export function AddSharesButton({ position }: AddSharesDialogProps) {
  const { updateTicker } = useWatchlist()
  const [open, setOpen] = useState(false)
  const [qty, setQty] = useState('')
  const [price, setPrice] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const stopRowSelect = (event: SyntheticEvent) => {
    event.stopPropagation()
  }

  const reset = () => {
    setQty('')
    setPrice('')
    setError(null)
    setPending(false)
  }

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) {
      setQty('')
      setPrice(position.price === null ? '' : String(position.price))
      setError(null)
      setPending(false)
      return
    }
    setTimeout(reset, 150)
  }

  const parsedQty = Number(qty)
  const parsedPrice = Number(price)
  const qtyOk = qty.trim() !== '' && Number.isFinite(parsedQty) && parsedQty > 0
  const priceOk = price.trim() !== '' && Number.isFinite(parsedPrice) && parsedPrice >= 0
  const preview = qtyOk && priceOk ? addShareLot(position.shares, position.cost, parsedQty, parsedPrice) : null

  const saveLot = async () => {
    if (!qtyOk) {
      setError('Shares to add must be greater than 0.')
      return
    }
    if (!priceOk) {
      setError('Purchase price must be a number.')
      return
    }
    const next = addShareLot(position.shares, position.cost, parsedQty, parsedPrice)
    setPending(true)
    setError(null)
    try {
      await updateTicker(position.row, {
        shares: next.shares,
        cost: next.cost,
        intent: normalizeIntent(position.intent, true, position.target !== null),
      })
      handleOpenChange(false)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not add shares.')
      setPending(false)
    }
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    event.stopPropagation()
    void saveLot()
  }

  return (
    <>
      <Button
        type="button"
        title="Add shares"
        aria-label={`Add shares to ${position.ticker}`}
        onClick={(event) => {
          stopRowSelect(event)
          handleOpenChange(true)
        }}
        onPointerDown={stopRowSelect}
        className="w-full bg-buy/20 text-buy ring-1 ring-buy/40 hover:bg-buy/30 hover:text-buy"
      >
        <CirclePlus aria-hidden />
        Add shares
      </Button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md" onClick={stopRowSelect} onPointerDown={stopRowSelect}>
          <form onSubmit={onSubmit} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>Add shares · {position.ticker}</DialogTitle>
              <DialogDescription>
                {position.shares !== null && position.shares > 0
                  ? `You hold ${formatNumber(position.shares)} at ${formatPrice(position.cost, position.currency)} avg.`
                  : 'No shares recorded yet. This lot becomes your holding and average price.'}
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1.5 text-xs">
                <span>Shares to add</span>
                <Input
                  value={qty}
                  onChange={(event) => setQty(event.target.value)}
                  inputMode="decimal"
                  placeholder="10"
                  autoFocus
                  required
                />
              </label>
              <label className="grid gap-1.5 text-xs">
                <span>Purchase price</span>
                <Input
                  value={price}
                  onChange={(event) => setPrice(event.target.value)}
                  inputMode="decimal"
                  placeholder="400"
                  required
                />
              </label>
            </div>
            {preview ? (
              <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                After this lot:{' '}
                <span className="font-mono text-foreground">
                  {formatNumber(preview.shares)} @ {formatPrice(preview.cost, position.currency)}
                </span>
              </p>
            ) : null}
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <DialogFooter>
              <Button type="button" disabled={pending} onClick={() => void saveLot()}>
                {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
                Save lot
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
