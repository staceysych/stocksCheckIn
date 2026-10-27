type SliceWeight = {
  sector: string
  weight: number
}

export const YAHOO_SECTORS = [
  'Technology',
  'Financial Services',
  'Healthcare',
  'Consumer Cyclical',
  'Communication Services',
  'Industrials',
  'Consumer Defensive',
  'Energy',
  'Basic Materials',
  'Real Estate',
  'Utilities',
] as const

export type YahooSector = (typeof YAHOO_SECTORS)[number]

export const SECTOR_ETFS: Record<YahooSector, string> = {
  Technology: 'XLK',
  'Financial Services': 'XLF',
  Healthcare: 'XLV',
  'Consumer Cyclical': 'XLY',
  'Communication Services': 'XLC',
  Industrials: 'XLI',
  'Consumer Defensive': 'XLP',
  Energy: 'XLE',
  'Basic Materials': 'XLB',
  'Real Estate': 'XLRE',
  Utilities: 'XLU',
}

export const SECTOR_COLORS: Record<string, string> = {
  Technology: '#5ee0c0',
  'Financial Services': '#8aa4d4',
  Healthcare: '#7ec8d9',
  'Consumer Cyclical': '#e0a35e',
  'Communication Services': '#b08dcc',
  Industrials: '#9aa3b2',
  'Consumer Defensive': '#7eb87a',
  Energy: '#e08a5e',
  'Basic Materials': '#c4a35a',
  'Real Estate': '#6eb5c9',
  Utilities: '#5d9bce',
  Unclassified: '#6b7280',
}

const FALLBACK_COLORS = ['#5ee0c0', '#8aa4d4', '#e0a35e', '#b08dcc', '#7ec8d9', '#c4a35a', '#e08a5e', '#7eb87a']

export type LightSector = {
  sector: YahooSector
  etf: string
  weight: number
}

export type SectorIdea = {
  ticker: string
  name: string
  holdingPct: number | null
}

export type SectorIdeaGroup = {
  sector: YahooSector
  etf: string
  ideas: SectorIdea[]
}

export function isYahooSector(value: string): value is YahooSector {
  return (YAHOO_SECTORS as readonly string[]).includes(value)
}

export function sectorColor(sector: string) {
  if (SECTOR_COLORS[sector]) return SECTOR_COLORS[sector]
  let hash = 0
  for (const char of sector) hash = (hash + char.charCodeAt(0)) % FALLBACK_COLORS.length
  return FALLBACK_COLORS[hash]
}

export function lightSectors(slices: SliceWeight[], limit = 3): LightSector[] {
  const weight = new Map(slices.map((slice) => [slice.sector, slice.weight]))
  return YAHOO_SECTORS.map((sector, index) => ({
    sector,
    etf: SECTOR_ETFS[sector],
    weight: weight.get(sector) ?? 0,
    index,
  }))
    .sort((left, right) => left.weight - right.weight || left.index - right.index)
    .slice(0, limit)
    .map(({ sector, etf, weight }) => ({ sector, etf, weight }))
}
