import { NextResponse } from 'next/server'
import { normalizeTickers } from '@/lib/market'
import { yahooSnapshots } from '@/lib/yahoo'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Expected JSON with a tickers array.' }, { status: 400 })
  }

  const tickers = normalizeTickers((body as { tickers?: unknown }).tickers)
  if (tickers.length === 0) {
    return NextResponse.json({ error: 'Add at least one ticker.' }, { status: 400 })
  }

  try {
    const snapshots = await yahooSnapshots(tickers)
    return NextResponse.json({ snapshots })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Yahoo request failed.'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
