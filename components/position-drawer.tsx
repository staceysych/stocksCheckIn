'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { Loader2, X } from 'lucide-react'
import { formatCompact, formatDate, formatNumber, formatPct, formatPrice } from '@/lib/format'
import {
  INTENT_LABEL,
  defaultIntent,
  exclusiveLimits,
  intentClass,
  showBuyLimits,
  showSellLimits,
  isNearBuy,
  isNearSell,
  maTone,
  sellTone,
  targetTone,
  type Intent,
  type MaTone,
  type Position,
  type PositionUserPatch,
  type TargetTone,
} from '@/lib/watchlist'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { RangeBar } from '@/components/range-bar'
import { MetricTip } from '@/components/metric-tip'
import { IntentSelect } from '@/components/intent-select'
import { PlanTargets } from '@/components/plan-targets'
import { YahooQuoteLink } from '@/components/yahoo-quote-link'
import type { MetricId } from '@/lib/metrics'
import { useWatchlist } from '@/lib/use-watchlist'

type PositionDrawerProps = {
  position: Position | null
  onClose: () => void
}

export function PositionDrawer({ position, onClose }: PositionDrawerProps) {
  const { updateTicker, removeTicker } = useWatchlist()
  const [name, setName] = useState('')
  const [target, setTarget] = useState('')
  const [target2, setTarget2] = useState('')
  const [sell, setSell] = useState('')
  const [sell2, setSell2] = useState('')
  const [idea, setIdea] = useState('')
  const [owned, setOwned] = useState(false)
  const [shares, setShares] = useState('')
  const [cost, setCost] = useState('')
  const [intent, setIntent] = useState<Intent>('watch')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!position) return
    setName(position.name)
    setTarget(position.target === null ? '' : String(position.target))
    setTarget2(position.target2 === null ? '' : String(position.target2))
    setSell(position.sell === null ? '' : String(position.sell))
    setSell2(position.sell2 === null ? '' : String(position.sell2))
    setIdea(position.idea)
    setOwned(position.owned)
    setShares(position.shares === null ? '' : String(position.shares))
    setCost(position.cost === null ? '' : String(position.cost))
    setIntent(position.intent)
    setError(null)
    setPending(false)
  }, [position?.row])

  if (!position) return null

  const nextShares = owned ? parseOptionalNumber(shares) : null
  const nextCost = owned ? parseOptionalNumber(cost) : null
  const leftoverLimits =
    (!showBuyLimits(intent) && (position.target !== null || position.target2 !== null)) ||
    (!showSellLimits(intent) && (position.sell !== null || position.sell2 !== null))
  const dirty =
    name.trim() !== position.name ||
    idea.trim() !== position.idea ||
    (showBuyLimits(intent) && numberDirty(target, position.target)) ||
    (showBuyLimits(intent) && numberDirty(target2, position.target2)) ||
    (showSellLimits(intent) && numberDirty(sell, position.sell)) ||
    (showSellLimits(intent) && numberDirty(sell2, position.sell2)) ||
    leftoverLimits ||
    owned !== position.owned ||
    nextShares !== position.shares ||
    nextCost !== position.cost ||
    intent !== position.intent

  const onSave = async (event: FormEvent) => {
    event.preventDefault()
    const parsedTarget = showBuyLimits(intent) ? parseOptionalNumber(target) : null
    const parsedTarget2 = showBuyLimits(intent) ? parseOptionalNumber(target2) : null
    const parsedSell = showSellLimits(intent) ? parseOptionalNumber(sell) : null
    const parsedSell2 = showSellLimits(intent) ? parseOptionalNumber(sell2) : null
    const parsedShares = owned ? parseOptionalNumber(shares) : null
    const parsedCost = owned ? parseOptionalNumber(cost) : null
    if (parsedTarget === false) {
      setError('Buy under must be a number.')
      return
    }
    if (parsedTarget2 === false) {
      setError('Buy under 2 must be a number.')
      return
    }
    if (parsedSell === false) {
      setError('Sell above must be a number.')
      return
    }
    if (parsedSell2 === false) {
      setError('Sell above 2 must be a number.')
      return
    }
    if (parsedShares === false) {
      setError('Shares must be a number.')
      return
    }
    if (parsedCost === false) {
      setError('Avg buy price must be a number.')
      return
    }
    if (owned && parsedShares === null) {
      setError('How many shares do you own?')
      return
    }

    const limits = exclusiveLimits(intent, {
      target: parsedTarget,
      target2: parsedTarget2,
      sell: parsedSell,
      sell2: parsedSell2,
    })
    const patch: PositionUserPatch = {
      name: name.trim(),
      idea: idea.trim(),
      ...limits,
      shares: parsedShares,
      cost: parsedCost,
      intent,
    }

    setPending(true)
    setError(null)
    try {
      await updateTicker(position.row, patch)
      setTarget(limits.target === null ? '' : String(limits.target))
      setTarget2(limits.target2 === null ? '' : String(limits.target2))
      setSell(limits.sell === null ? '' : String(limits.sell))
      setSell2(limits.sell2 === null ? '' : String(limits.sell2))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save changes.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close details" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-md flex-col border-l border-border bg-background">
        <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <p className="flex items-center gap-1 font-mono text-sm">
              <YahooQuoteLink ticker={position.ticker} />
              {position.ticker}
            </p>
            <p className="text-lg font-medium tracking-tight">{position.name || 'Unnamed'}</p>
            {position.sector ? <p className="text-xs text-muted-foreground">{position.sector}</p> : null}
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tracking-wide uppercase">
              {position.owned ? (
                <MetricTip metric="shares">
                  <span className="text-muted-foreground">Own {formatNumber(position.shares)}</span>
                </MetricTip>
              ) : null}
              {position.intent !== 'watch' && position.intent !== 'hold' ? (
                <MetricTip metric="intent">
                  <span className={intentClass(position.intent)}>{INTENT_LABEL[position.intent]}</span>
                </MetricTip>
              ) : null}
              {position.inSellZone ? (
                <MetricTip metric="sellZone">
                  <span className="text-sell">In sell zone</span>
                </MetricTip>
              ) : isNearSell(position) ? (
                <MetricTip metric="nearSell">
                  <span className="text-sell/80">Within 5% of a sell target</span>
                </MetricTip>
              ) : null}
              {position.inBuyZone ? (
                <MetricTip metric="buyZone">
                  <span className="text-buy">In buy zone</span>
                </MetricTip>
              ) : isNearBuy(position) ? (
                <MetricTip metric="nearBuy">
                  <span className="text-buy/80">Within 5% of a buy target</span>
                </MetricTip>
              ) : null}
            </div>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
            <X />
          </Button>
        </header>

        <form onSubmit={onSave} className="flex min-h-0 flex-1 flex-col">
        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="mb-6 flex items-end justify-between gap-3">
            <div>
              <p className="font-mono text-2xl tabular-nums">{formatPrice(position.price, position.currency)}</p>
              <p className={position.changepct !== null && position.changepct >= 0 ? 'text-up' : 'text-down'}>
                {formatPct(position.changepct)}
              </p>
            </div>
              <RangeBar
                position={position.rangePosition}
                inBuyZone={position.inBuyZone}
                inSellZone={position.inSellZone}
                className="w-32"
              />
          </div>

          {position.quoteUnavailable ? (
            <p className="mb-4 text-xs text-muted-foreground">Yahoo hasn’t returned a quote yet. Try Refresh.</p>
          ) : null}

          <div className="grid gap-4">
            <label className="grid gap-1.5 text-sm">
              <MetricTip metric="name">
                <span>Name</span>
              </MetricTip>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={owned}
                onChange={(event) => {
                  const nextOwned = event.target.checked
                  setOwned(nextOwned)
                  if (!nextOwned) {
                    setShares('')
                    setCost('')
                    setIntent(defaultIntent(false, Boolean(target.trim() || target2.trim())))
                    return
                  }
                  setIntent(intent === 'watch' || intent === 'buy' ? 'hold' : intent)
                }}
                className="size-4 rounded border-input accent-foreground"
              />
              <MetricTip metric="shares">
                <span>I already own this</span>
              </MetricTip>
            </label>
            {owned ? (
              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1.5 text-sm">
                  <MetricTip metric="shares">
                    <span>Shares</span>
                  </MetricTip>
                  <Input
                    value={shares}
                    inputMode="decimal"
                    onChange={(event) => setShares(event.target.value)}
                  />
                </label>
                <label className="grid gap-1.5 text-sm">
                  <MetricTip metric="cost">
                    <span>Avg buy price</span>
                  </MetricTip>
                  <Input
                    value={cost}
                    inputMode="decimal"
                    onChange={(event) => setCost(event.target.value)}
                  />
                </label>
              </div>
            ) : null}
            {position.owned ? (
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-[11px] tracking-wide text-muted-foreground uppercase">Value</p>
                  <p className="font-mono tabular-nums">{formatPrice(position.marketValue, position.currency)}</p>
                </div>
                <div>
                  <MetricTip metric="pnl">
                    <span className="text-[11px] tracking-wide text-muted-foreground uppercase">P/L</span>
                  </MetricTip>
                  <p
                    className={cn(
                      'font-mono tabular-nums',
                      position.pnl === null ? 'text-muted-foreground' : position.pnl >= 0 ? 'text-up' : 'text-down',
                    )}
                  >
                    {formatPrice(position.pnl, position.currency)} {position.pnlPct !== null ? formatPct(position.pnlPct) : ''}
                  </p>
                </div>
              </div>
            ) : null}
            <label className="grid gap-1.5 text-sm">
              <MetricTip metric="intent">
                <span>Plan</span>
              </MetricTip>
              <IntentSelect value={intent} owned={owned} onChange={setIntent} />
            </label>
            <PlanTargets
              intent={intent}
              price={position.price}
              values={{ target, target2, sell, sell2 }}
              saved={{
                target: position.target,
                target2: position.target2,
                sell: position.sell,
                sell2: position.sell2,
              }}
              onChange={(field, value) => {
                if (field === 'target') setTarget(value)
                if (field === 'target2') setTarget2(value)
                if (field === 'sell') setSell(value)
                if (field === 'sell2') setSell2(value)
              }}
            />
            <label className="grid gap-1.5 text-sm">
              <MetricTip metric="idea">
                <span>IDEA</span>
              </MetricTip>
              <Textarea
                value={idea}
                rows={5}
                onChange={(event) => setIdea(event.target.value)}
              />
            </label>
          </div>

          <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <Stat
              metric="pctToTarget"
              label="% to target"
              value={formatPct(position.pctToTarget)}
              className={targetValueClass(targetTone(position.price, position.target))}
            />
            <Stat
              metric="pctToSell"
              label="% to sell"
              value={formatPct(position.pctToSell)}
              className={sellValueClass(sellTone(position.price, position.sell))}
            />
            <Stat metric="pctExpect" label="% expect" value={formatPct(position.pctExpect)} />
            <Stat
              metric="ma20"
              label="MA20"
              value={formatPrice(position.ma20, position.currency)}
              className={maValueClass(maTone(position.price, position.ma20))}
            />
            <Stat
              metric="ma50"
              label="MA50"
              value={formatPrice(position.ma50, position.currency)}
              className={maValueClass(maTone(position.price, position.ma50))}
            />
            <Stat
              metric="ma100"
              label="MA100"
              value={formatPrice(position.ma100, position.currency)}
              className={maValueClass(maTone(position.price, position.ma100))}
            />
            <Stat
              metric="ma200"
              label="MA200"
              value={formatPrice(position.ma200, position.currency)}
              className={maValueClass(maTone(position.price, position.ma200))}
            />
            <Stat metric="pe" label="PE" value={formatNumber(position.pe)} />
            <Stat metric="forwardPe" label="Fwd PE" value={formatNumber(position.forwardPe)} />
            <Stat metric="peg" label="PEG" value={formatNumber(position.peg)} />
            <Stat metric="shortRatio" label="Short" value={formatNumber(position.shortRatio)} />
            <Stat metric="priceToBook" label="P/B" value={formatNumber(position.priceToBook)} />
            <Stat metric="priceToSales" label="P/S" value={formatNumber(position.priceToSales)} />
            <Stat metric="divYield" label="Yield" value={formatPct(position.divYield)} />
            <Stat metric="targetAvg" label="1Y tgt" value={formatPrice(position.targetAvg, position.currency)} />
            <Stat metric="targetLow" label="1Y low" value={formatPrice(position.targetLow, position.currency)} />
            <Stat metric="targetHigh" label="1Y high" value={formatPrice(position.targetHigh, position.currency)} />
            <Stat metric="earnings" label="Earnings" value={formatDate(position.earnings)} />
            <Stat metric="exDiv" label="Ex-div" value={formatDate(position.exDiv)} />
            <Stat metric="low52" label="52w low" value={formatPrice(position.low52, position.currency)} />
            <Stat metric="high52" label="52w high" value={formatPrice(position.high52, position.currency)} />
            <Stat metric="marketcap" label="Market cap" value={formatCompact(position.marketcap)} />
            <Stat metric="volume" label="Volume" value={formatCompact(position.volume)} />
            <Stat metric="beta" label="Beta" value={formatNumber(position.beta)} />
            <Stat metric="tradetime" label="As of" value={formatDate(position.tradetime) === '—' ? '—' : formatAsOf(position.tradetime)} />
          </dl>
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-border px-5 py-4">
          <Button
            type="button"
            variant="destructive"
            disabled={pending}
            onClick={async () => {
              await removeTicker(position.row)
              onClose()
            }}
          >
            Remove ticker
          </Button>
          <div className="flex items-center gap-3">
            {error ? <p className="max-w-[12rem] text-right text-sm text-destructive">{error}</p> : null}
            <Button type="submit" variant="save" disabled={pending || !dirty}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Save
            </Button>
          </div>
        </footer>
        </form>
      </aside>
    </div>
  )
}

function parseOptionalNumber(value: string) {
  if (!value.trim()) return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return false
  return parsed
}

function numberDirty(raw: string, saved: number | null) {
  const parsed = parseOptionalNumber(raw)
  if (parsed === false) return true
  return parsed !== saved
}

function formatAsOf(value: string) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(
    date,
  )
}

function targetValueClass(tone: TargetTone) {
  if (tone === 'live') return 'text-buy'
  if (tone === 'close') return 'text-buy/80'
  return undefined
}

function sellValueClass(tone: TargetTone) {
  if (tone === 'live') return 'text-sell'
  if (tone === 'close') return 'text-sell/80'
  return undefined
}

function maValueClass(tone: MaTone) {
  if (tone === 'pullback') return 'text-up'
  if (tone === 'extended') return 'text-down/80'
  return undefined
}

function Stat({
  metric,
  label,
  value,
  className,
}: {
  metric: MetricId
  label: string
  value: string
  className?: string
}) {
  return (
    <div>
      <dt className="text-[11px] tracking-wide text-muted-foreground uppercase">
        <MetricTip metric={metric}>
          <span>{label}</span>
        </MetricTip>
      </dt>
      <dd className={cn('font-mono text-sm tabular-nums', className)}>{value}</dd>
    </div>
  )
}
