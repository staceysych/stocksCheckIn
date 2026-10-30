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
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      <Chip metric="buyZone" title={`Buy zone (${buyZone.length})`}>
        {buyZone.length === 0 ? (
          <p className="text-xs text-muted-foreground">None at target.</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {buyZone.map((position) => (
              <li key={position.row}>
                <button
                  type="button"
                  onClick={() => onSelect(position.row)}
                  title={`${position.ticker} ${formatPrice(position.price, position.currency)} ≤ ${formatPrice(position.target, position.currency)}`}
                  className="rounded-full bg-buy/15 px-2 py-0.5 font-mono text-xs text-buy hover:bg-buy/25"
                >
                  {position.ticker}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Chip>
      <Chip metric="sellZone" title={`Sell zone (${sellZone.length})`}>
        {sellZone.length === 0 ? (
          <p className="text-xs text-muted-foreground">None at target.</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {sellZone.map((position) => (
              <li key={position.row}>
                <button
                  type="button"
                  onClick={() => onSelect(position.row)}
                  title={`${position.ticker} ${formatPrice(position.price, position.currency)} ≥ ${formatPrice(position.sell, position.currency)}`}
                  className="rounded-full bg-sell/15 px-2 py-0.5 font-mono text-xs text-sell hover:bg-sell/25"
                >
                  {position.ticker}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Chip>
      {near.length > 0 ? (
        <Chip metric="nearBuy" title={`Near buy (${near.length})`}>
          <ul className="flex flex-wrap gap-1.5">
            {near.map((position) => (
              <li key={position.row}>
                <button
                  type="button"
                  onClick={() => onSelect(position.row)}
                  className="rounded-full bg-buy/10 px-2 py-0.5 font-mono text-xs text-buy/80 hover:bg-buy/20"
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
          <ul className="flex flex-wrap gap-1.5">
            {nearSell.map((position) => (
              <li key={position.row}>
                <button
                  type="button"
                  onClick={() => onSelect(position.row)}
                  className="rounded-full bg-sell/10 px-2 py-0.5 font-mono text-xs text-sell/80 hover:bg-sell/20"
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
          <ul className="flex flex-wrap gap-1.5">
            {movers.map((position) => {
              const up = (position.changepct ?? 0) >= 0
              return (
                <li key={position.row}>
                  <button
                    type="button"
                    onClick={() => onSelect(position.row)}
                    className="rounded-full bg-sky-500/15 px-2 py-0.5 font-mono text-xs text-sky-200 ring-1 ring-sky-400/25 hover:bg-sky-500/25"
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
    <section className="rounded-xl border border-border bg-card px-3 py-2">
      <h2 className="mb-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        <MetricTip metric={metric}>
          <span>{title}</span>
        </MetricTip>
      </h2>
      {children}
    </section>
  )
}
