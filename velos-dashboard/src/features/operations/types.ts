export type DriverStatus = 'AVAILABLE' | 'ON_RIDE' | 'OFFLINE'

export type RideStatus = 'SEARCHING' | 'DRIVER_ASSIGNED' | 'ONGOING'

export interface LatLng {
  lat: number
  lng: number
}

export interface DriverMarker {
  id: string
  name: string
  vehicleType: string
  status: DriverStatus
  position: LatLng
  currentRideId?: string
}

export interface RideMarker {
  id: string
  rider: string
  driver?: string
  status: RideStatus
  durationMin: number
  position: LatLng
}

export interface OperationsSummary {
  onlineDrivers: number
  availableDrivers: number
  driversOnRide: number
  activeRides: number
  searchingRides: number
}

export type AttentionKind = 'searching' | 'disconnected' | 'unassigned'

export interface AttentionItem {
  id: string
  kind: AttentionKind
  title: string
  detail: string
  time: string
}

export interface ActiveRideRow {
  id: string
  status: RideStatus
  rider: string
  driver: string
  durationMin: number
  location: string
}
