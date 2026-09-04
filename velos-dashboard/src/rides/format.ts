export function formatCreatedAt(iso?: string | null): string {
  if (!iso) return '—'
  const date = new Date(iso)
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function formatRideTime(iso?: string | null): string {
  if (!iso) return '—'
  const date = new Date(iso)
  return date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

export function formatFare(amount?: number | null): string {
  if (amount == null) return '—'
  return `₹${amount.toLocaleString('en-IN')}`
}

export function formatDistance(km?: number | null): string {
  if (km == null) return '—'
  return `${km.toLocaleString('en-IN', { maximumFractionDigits: 1 })} km`
}
