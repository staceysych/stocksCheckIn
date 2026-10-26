import { formatPct, formatPrice } from '@/lib/format'
import { isNearBuy, isNearSell, type Position } from '@/lib/watchlist'
import { MetricTip } from '@/components/metric-tip'
import type { MetricId } from '@/lib/metrics'

export function SummaryChips({ positions, onSelect }: { positions: Position[]; onSelect: (row: number) => void }) {
  const buyZone = positions.filter((position) => position.inBuyZone)
  const sellZone = positions.filter((position) => position.inSellZone)
  const near = positions.filter((position) => isNearBuy(position))
  const nearSell = positions.filter((position) => isNearSell(position))
  const movers = [...positions]
    .filter((position) => position.changepct !== null)
    .sort((a, b) => Math.abs(b.changepct ?? 0) - Math.abs(a.changepct ?? 0))
    .slice(0, 3)

  if (positions.length === 0) return null

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Chip metric="buyZone" title={`Buy zone (${buyZone.length})`}>
        {buyZone.length === 0 ? (
          <p className="text-xs text-muted-foreground">No names at or below your target.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {buyZone.map((position) => (
              <li key={position.row}>
                <button
                  type="button"
                  onClick={() => onSelect(position.row)}
                  className="rounded-md bg-buy/15 px-2 py-1 font-mono text-xs text-buy hover:bg-buy/25"
                >
                  {position.ticker} {formatPrice(position.price, position.currency)} ≤ {formatPrice(position.target, position.currency)}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Chip>
      <Chip metric="sellZone" title={`Sell zone (${sellZone.length})`}>
        {sellZone.length === 0 ? (
          <p className="text-xs text-muted-foreground">No names at or above your sell price.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {sellZone.map((position) => (
              <li key={position.row}>
                <button
                  type="button"
                  onClick={() => onSelect(position.row)}
                  className="rounded-md bg-sell/15 px-2 py-1 font-mono text-xs text-sell hover:bg-sell/25"
                >
                  {position.ticker} {formatPrice(position.price, position.currency)} ≥{' '}
                  {formatPrice(liveSell(position), position.currency)}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Chip>
      {near.length > 0 ? (
        <Chip metric="nearBuy" title={`Near buy (${near.length})`}>
          <ul className="flex flex-wrap gap-2">
            {near.map((position) => (
              <li key={position.row}>
                <button
                  type="button"
                  onClick={() => onSelect(position.row)}
                  className="rounded-md bg-buy/10 px-2 py-1 font-mono text-xs text-buy/80 hover:bg-buy/20"
                >
                  {position.ticker} {formatPct(position.pctToTarget)}
                </button>
              </li>
            ))}
          </ul>
        </Chip>
      ) : null}
      {nearSell.length > 0 ? (
        <Chip metric="nearSell" title={`Near sell (${nearSell.length})`}>
          <ul className="flex flex-wrap gap-2">
            {nearSell.map((position) => (
              <li key={position.row}>
                <button
                  type="button"
                  onClick={() => onSelect(position.row)}
                  className="rounded-md bg-sell/10 px-2 py-1 font-mono text-xs text-sell/80 hover:bg-sell/20"
                >
                  {position.ticker} {formatPct(position.pctToSell)}
                </button>
              </li>
            ))}
          </ul>
        </Chip>
      ) : null}
      <Chip metric="movers" title="Today’s movers">
        {movers.length === 0 ? (
          <p className="text-xs text-muted-foreground">Quotes will appear after a refresh.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {movers.map((position) => {
              const up = (position.changepct ?? 0) >= 0
              return (
                <li key={position.row}>
                  <button
                    type="button"
                    onClick={() => onSelect(position.row)}
                    className="rounded-md bg-secondary px-2 py-1 font-mono text-xs hover:bg-accent"
                  >
                    {position.ticker}{' '}
                    <span className={up ? 'text-up' : 'text-down'}>{formatPct(position.changepct)}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </Chip>
    </div>
  )
}

function liveSell(position: Position) {
  const levels = [position.sell, position.sell2].filter((value): value is number => value !== null)
  if (position.price === null) return position.sell
  return levels.find((level) => position.price !== null && position.price >= level) ?? position.sell
}

function Chip({
  metric,
  title,
  children,
}: {
  metric: MetricId
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-border bg-card px-4 py-3">
      <h2 className="mb-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        <MetricTip metric={metric}>
          <span>{title}</span>
        </MetricTip>
      </h2>
      {children}
    </section>
  )
}
