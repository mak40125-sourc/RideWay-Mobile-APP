import { apiGet, apiPost } from '../../lib/apiClient'
import type {
  DashboardStats,
  DriverDetail,
  DriverKyc,
  DriversResponse,
  KycStatus,
  RideDetail,
  RidesResponse,
} from './types'

export interface RidesQuery {
  search?: string
  status?: string
  from?: string
  to?: string
  page?: number
  pageSize?: number
}

export interface DriversQuery {
  status?: 'all' | 'online' | 'offline'
  kycStatus?: 'all' | KycStatus
  search?: string
  page?: number
  pageSize?: number
}

export interface ReviewDriverKycPayload {
  action: 'start_review' | 'approve' | 'reject' | 'request_correction'
  reason?: string
  reviewer?: string
}

export const dashboardApi = {
  getStats: () => apiGet<DashboardStats>('/dashboard/stats'),
  listRides: (params: RidesQuery) => apiGet<RidesResponse>('/dashboard/rides', params),
  getRide: (id: string) => apiGet<RideDetail>(`/dashboard/rides/${id}`),
  listDrivers: (params: DriversQuery) => apiGet<DriversResponse>('/dashboard/drivers', params),
  getDriver: (id: string) => apiGet<DriverDetail>(`/dashboard/drivers/${id}`),
  getDriverKyc: (id: string) => apiGet<DriverKyc>(`/dashboard/drivers/${id}/kyc`),
  reviewDriverKyc: (id: string, payload: ReviewDriverKycPayload) =>
    apiPost<{ driverId: string; kycStatus: KycStatus; isVerified: boolean }>(
      `/dashboard/drivers/${id}/kyc/review`,
      payload,
    ),
}
