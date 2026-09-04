const fareFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

const createdFormatter = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const timeFormatter = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

export function formatFare(fare: number): string {
  return fareFormatter.format(fare)
}

export function formatDistance(distanceKm: number): string {
  const value = Number.isInteger(distanceKm) ? String(distanceKm) : distanceKm.toFixed(1)
  return `${value} km`
}

export function formatCreatedAt(iso: string): string {
  return createdFormatter.format(new Date(iso))
}

export function formatRideTime(iso?: string): string | undefined {
  if (!iso) return undefined
  return timeFormatter.format(new Date(iso))
}
