import type { RideStatus, RideType } from '../../lib/rideStatus'

export type { RideStatus, RideType } from '../../lib/rideStatus'
export {
  RIDE_STATUS_LABEL,
  RIDE_TYPE_LABEL,
  RIDE_TYPES,
  RIDE_STATUSES,
} from '../../lib/rideStatus'

export type RideStatusFilter = 'ALL' | RideStatus

export interface Ride {
  id: string
  status: RideStatus
  type: RideType | null
  rider: string
  driver: string | null
  pickup: string | null
  destination: string | null
  fare: number
  distanceKm: number
  durationMin: number | null
  createdAt: string
  updatedAt: string | null
}
