import { NextResponse } from 'next/server'
import { isYahooSector, type YahooSector } from '@/lib/sectors'
import { yahooSectorIdeas } from '@/lib/yahoo-ideas'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Expected JSON with a sectors array.' }, { status: 400 })
  }

  const payload = body as { sectors?: unknown; exclude?: unknown; limit?: unknown }
  const sectors = Array.isArray(payload.sectors)
    ? payload.sectors.filter((value): value is YahooSector => typeof value === 'string' && isYahooSector(value)).slice(0, 3)
    : []
  const exclude = Array.isArray(payload.exclude)
    ? payload.exclude.filter((value): value is string => typeof value === 'string').slice(0, 80)
    : []
  const limit =
    typeof payload.limit === 'number' && Number.isFinite(payload.limit) ? Math.min(15, Math.max(1, Math.floor(payload.limit))) : 5

  if (sectors.length === 0) {
    return NextResponse.json({ error: 'Add at least one Yahoo sector.' }, { status: 400 })
  }

  try {
    const groups = await yahooSectorIdeas(sectors, exclude, limit)
    return NextResponse.json({ groups })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Yahoo request failed.'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
