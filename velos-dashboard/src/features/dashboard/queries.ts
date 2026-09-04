import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { dashboardApi } from './api'
import type { DriverDetail, DriversQuery, RideDetail, RidesQuery } from './types'

export const useDashboardStats = () =>
  useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: dashboardApi.getStats,
  })

export const useRides = (params: RidesQuery) =>
  useQuery({
    queryKey: ['rides', params],
    queryFn: () => dashboardApi.listRides(params),
    placeholderData: keepPreviousData,
  })

export const useRide = (id: string | null) =>
  useQuery({
    queryKey: ['ride', id],
    queryFn: () => dashboardApi.getRide(id as string),
    enabled: !!id,
  })

export const useDrivers = (params: DriversQuery) =>
  useQuery({
    queryKey: ['drivers', params],
    queryFn: () => dashboardApi.listDrivers(params),
    placeholderData: keepPreviousData,
  })

export const useDriver = (id: string | null) =>
  useQuery({
    queryKey: ['driver', id],
    queryFn: () => dashboardApi.getDriver(id as string),
    enabled: !!id,
  })

export const useDriverKyc = (id: string | null) =>
  useQuery({
    queryKey: ['driverKyc', id],
    queryFn: () => dashboardApi.getDriverKyc(id as string),
    enabled: !!id,
  })

export const useReviewDriverKyc = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      driverId,
      payload,
    }: {
      driverId: string
      payload: Parameters<typeof dashboardApi.reviewDriverKyc>[1]
    }) => dashboardApi.reviewDriverKyc(driverId, payload),
    onSuccess: (_data, { driverId }) => {
      queryClient.invalidateQueries({ queryKey: ['driverKyc', driverId] })
      queryClient.invalidateQueries({ queryKey: ['driver', driverId] })
      queryClient.invalidateQueries({ queryKey: ['drivers'] })
    },
  })
}

export type { RideDetail, DriverDetail }
