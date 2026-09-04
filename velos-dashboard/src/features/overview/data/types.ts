export type TrendDirection = 'up' | 'down' | 'flat'

export interface Metric {
  id: string
  label: string
  value: string
  change?: number
  trend?: TrendDirection
  comparison?: string
  /** Real supporting context shown under the value (replaces fabricated trend %). */
  footnote?: string
}

export interface OperationsSummary {
  activeRides: number
  availableDrivers: number
  searchingRides: number
}

export type AttentionKind = 'searching' | 'offline'

export interface AttentionItem {
  id: string
  kind: AttentionKind
  title: string
  detail: string
  time: string
}
