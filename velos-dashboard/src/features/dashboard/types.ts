import type { RideStatus, RideType } from '../../lib/rideStatus'

export interface DashboardStats {
  totalRides: number
  activeRides: number
  completedRides: number
  cancelledRides: number
  searchingRides: number
  revenue: number
  todayRides: number
  todayRevenue: number
  yesterdayRides: number
  yesterdayRevenue: number
  totalDrivers: number
  onlineDrivers: number
  availableDrivers: number
}

export interface RideListItem {
  id: string
  status: RideStatus
  rider: string
  driver: string | null
  type: RideType | null
  pickup: string | null
  destination: string | null
  fare: number
  distanceKm: number
  durationMin: number | null
  createdAt: string
  updatedAt: string | null
}

export interface RidesResponse {
  rides: RideListItem[]
  total: number
  page: number
  pageSize: number
}

export interface RideParty {
  id: string | null
  name: string
  phone: string | null
}

export interface RideDriver extends RideParty {
  vehicleType: RideType | null
  vehicleNumber: string | null
  vehicleModel: string | null
  vehicleColor: string | null
}

export interface RideDetail {
  id: string
  status: RideStatus
  rider: RideParty
  driver: RideDriver | null
  type: RideType | null
  pickup: string | null
  destination: string | null
  fare: number
  distanceKm: number
  durationMin: number | null
  createdAt: string
  updatedAt: string | null
}

export interface DriverCurrentRide {
  id: string
  status: RideStatus
  rider?: string | null
  pickup?: string | null
  destination?: string | null
  fare?: number | null
}

export type KycStatus = 'pending' | 'in_review' | 'verified' | 'needs_correction' | 'rejected'

export interface KycDocument {
  id: string
  documentType: string
  status: 'pending' | 'approved' | 'rejected'
  rejectionReason: string | null
  uploadedAt: string
  url: string | null
}

export interface KycReviewEvent {
  id: string
  reviewer: string | null
  action: string
  previousStatus: KycStatus | null
  newStatus: KycStatus
  reason: string | null
  createdAt: string
}

export interface DriverKyc {
  driverId: string
  kycStatus: KycStatus
  isVerified: boolean
  documents: KycDocument[]
  history: KycReviewEvent[]
}

export interface DriverListItem {
  id: string
  name: string
  phone: string | null
  vehicleType: RideType | null
  vehicleNumber: string | null
  vehicleModel: string | null
  vehicleColor: string | null
  isOnline: boolean
  kycStatus: KycStatus
  documentsCount: number
  lastActiveAt: string | null
  joinedAt: string
  currentRide: DriverCurrentRide | null
}

export interface DriversResponse {
  drivers: DriverListItem[]
  total: number
  page: number
  pageSize: number
}

export interface DriverStats {
  totalRides: number
  completedRides: number
  cancelledRides: number
  totalEarnings: number
}

export interface DriverDetail extends DriverListItem {
  currentRide: DriverCurrentRide | null
  stats: DriverStats
}

export type RidesQuery = {
  search?: string
  status?: RideStatus | 'ALL'
  from?: string
  to?: string
  page?: number
  pageSize?: number
}

export type DriversQuery = {
  search?: string
  status?: 'all' | 'online' | 'offline'
  kycStatus?: 'all' | KycStatus
  page?: number
  pageSize?: number
}
