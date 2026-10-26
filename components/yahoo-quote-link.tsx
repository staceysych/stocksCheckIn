'use client'

import type { SyntheticEvent } from 'react'
import { ExternalLink } from 'lucide-react'
import { yahooQuoteUrl } from '@/lib/yahoo-quote'
import { cn } from '@/lib/utils'

export function YahooQuoteLink({
  ticker,
  className,
}: {
  ticker: string
  className?: string
}) {
  const stopRowSelect = (event: SyntheticEvent) => {
    event.stopPropagation()
  }

  return (
    <a
      href={yahooQuoteUrl(ticker)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Open ${ticker} on Yahoo Finance`}
      title="Yahoo Finance"
      onClick={stopRowSelect}
      onPointerDown={stopRowSelect}
      className={cn(
        'inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground',
        'hover:bg-muted hover:text-foreground',
        'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
        className,
      )}
    >
      <ExternalLink className="size-3" aria-hidden />
    </a>
  )
}
