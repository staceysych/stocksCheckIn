import { NextResponse } from 'next/server'
import { isYahooSector } from '@/lib/sectors'
import { yahooSectorStats } from '@/lib/yahoo-sector-stats'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Expected JSON with a sector.' }, { status: 400 })
  }

  const sector = (body as { sector?: unknown }).sector
  if (typeof sector !== 'string' || !isYahooSector(sector)) {
    return NextResponse.json({ error: 'Pick a Yahoo sector.' }, { status: 400 })
  }

  try {
    const snapshot = await yahooSectorStats(sector)
    return NextResponse.json({ snapshot })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Yahoo request failed.'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
