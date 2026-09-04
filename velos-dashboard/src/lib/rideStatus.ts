import type { StatusBadgeColor } from '../components/ui/StatusBadge'

/**
 * Canonical ride lifecycle statuses. These mirror the backend `ride_status`
 * Postgres enum and are the single source of truth for the dashboard — the old
 * mock vocabulary (SEARCHING / MATCHING / ONGOING …) has been retired.
 */
export type RideStatus =
  | 'IDLE'
  | 'REQUESTED'
  | 'SEARCHING_DRIVER'
  | 'DRIVER_ASSIGNED'
  | 'DRIVER_ARRIVING'
  | 'RIDE_STARTED'
  | 'RIDE_COMPLETED'
  | 'CANCELLED'

/** Vehicle categories, mirroring the backend `vehicle_type` enum. */
export type RideType = 'bike' | 'mini' | 'sedan' | 'shuttle'

export const RIDE_STATUSES: RideStatus[] = [
  'REQUESTED',
  'SEARCHING_DRIVER',
  'DRIVER_ASSIGNED',
  'DRIVER_ARRIVING',
  'RIDE_STARTED',
  'RIDE_COMPLETED',
  'CANCELLED',
]

export const RIDE_STATUS_LABEL: Record<RideStatus, string> = {
  IDLE: 'Idle',
  REQUESTED: 'Requested',
  SEARCHING_DRIVER: 'Searching',
  DRIVER_ASSIGNED: 'Driver assigned',
  DRIVER_ARRIVING: 'Driver arriving',
  RIDE_STARTED: 'Ongoing',
  RIDE_COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
}

export const RIDE_STATUS_BADGE: Record<RideStatus, StatusBadgeColor> = {
  IDLE: 'neutral',
  REQUESTED: 'info',
  SEARCHING_DRIVER: 'warning',
  DRIVER_ASSIGNED: 'info',
  DRIVER_ARRIVING: 'info',
  RIDE_STARTED: 'primary',
  RIDE_COMPLETED: 'success',
  CANCELLED: 'error',
}

export type ChipColor = 'primary' | 'info' | 'warning' | 'success' | 'error'

export const RIDE_STATUS_CHIP: Record<RideStatus, ChipColor> = {
  IDLE: 'info',
  REQUESTED: 'info',
  SEARCHING_DRIVER: 'warning',
  DRIVER_ASSIGNED: 'info',
  DRIVER_ARRIVING: 'info',
  RIDE_STARTED: 'primary',
  RIDE_COMPLETED: 'success',
  CANCELLED: 'error',
}

export const RIDE_TYPES: RideType[] = ['bike', 'mini', 'sedan', 'shuttle']

export const RIDE_TYPE_LABEL: Record<RideType, string> = {
  bike: 'Bike',
  mini: 'Mini',
  sedan: 'Sedan',
  shuttle: 'Shuttle',
}
