export function formatPrice(value: number | null, currency = 'USD') {
  if (value === null) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
    maximumFractionDigits: value >= 1000 ? 2 : value >= 1 ? 2 : 4,
  }).format(value)
}

export function formatNumber(value: number | null, digits = 2) {
  if (value === null) return '—'
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  }).format(value)
}

export function formatPct(value: number | null, digits = 2) {
  if (value === null) return '—'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(digits)}%`
}

export function formatCompact(value: number | null) {
  if (value === null) return '—'
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

export function formatDate(value: string) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(
    date,
  )
}

export function refreshAgeMinutes(iso: string | null) {
  if (!iso) return null
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return null
  return Math.max(0, Math.round((Date.now() - then) / 60_000))
}

export function formatRelativeTime(iso: string | null) {
  if (!iso) return 'Not yet refreshed'
  const minutes = refreshAgeMinutes(iso)
  if (minutes === null) return iso
  if (minutes < 1) return 'Just now'
  if (minutes === 1) return '1 min ago'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours === 1) return '1 hour ago'
  if (hours < 24) return `${hours} hours ago`
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(
    new Date(iso),
  )
}
