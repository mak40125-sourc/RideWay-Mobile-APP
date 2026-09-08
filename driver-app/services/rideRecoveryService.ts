import { rideAPI } from './rideAPI';
import { useDriverStore } from '../store/driverStore';
import { useRideStore } from '../store/rideStore';
import { useStartupStore } from '../store/startupStore';
import { diagLogger } from '../utils/diagLog';
import type { DriverStatus } from '../types/driver';
import type { Ride, RideStatus } from '../types/ride';

export const ACTIVE_RIDE_STATUSES: ReadonlySet<RideStatus> = new Set([
  'DRIVER_ASSIGNED',
  'DRIVER_ARRIVING',
  'RIDE_STARTED',
]);

export function backendStatusToDriverStatus(status: RideStatus): DriverStatus | null {
  switch (status) {
    case 'DRIVER_ASSIGNED':
      return 'NAVIGATING_TO_PICKUP';
    case 'DRIVER_ARRIVING':
      return 'ARRIVED_AT_PICKUP';
    case 'RIDE_STARTED':
      return 'NAVIGATING_TO_DROP';
    default:
      return null;
  }
}

let inFlight: Promise<Ride | null> | null = null;

function resetToIdle() {
  const { is_online } = useDriverStore.getState();
  useDriverStore.getState().setStatus(is_online ? 'ONLINE_IDLE' : 'OFFLINE');
}

function clearStaleRide(reason: string) {
  const { current_ride } = useRideStore.getState();
  diagLogger.log('RECONCILE_CLEAR', `rideId=${current_ride?.id ?? 'none'} reason=${reason}`);
  useRideStore.getState().clearRide();
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useNavigationStore } = require('../store/navigationStore');
    useNavigationStore.getState().stopNavigation();
  } catch {}
  resetToIdle();
}

export async function reconcileRideOnce(source: string, authUserId: string | null): Promise<Ride | null> {
  if (inFlight) return inFlight;
  const task = (async (): Promise<Ride | null> => {
    if (!authUserId) return null;
    const { current_ride } = useRideStore.getState();
    const { status: driverStatus } = useDriverStore.getState();
    const prevRideId = current_ride?.id ?? null;

    diagLogger.log('DRIVER_RIDE_RECOVERY_STARTED', `rideId=${prevRideId ?? 'null'} localStatus=${driverStatus} source=${source}`);
    diagLogger.log('RIDE_RECOVERY_STARTED', `rideId=${prevRideId ?? 'null'} localStatus=${driverStatus} source=${source}`);

    let ride: Ride | null = null;
    try {
      ride = await rideAPI.getMyActiveRide();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      diagLogger.log('RECONCILE_UNAVAILABLE', `rideId=${prevRideId ?? 'null'} err=${msg} source=${source}`);
      diagLogger.log('DRIVER_RIDE_RECOVERY_FAILED', `rideId=${prevRideId ?? 'null'} err=${msg} source=${source}`);
      useStartupStore.getState().setRideRecovery('FAILED');
      return useRideStore.getState().current_ride;
    }

    if (!ride && prevRideId) {
      try {
        const direct = await rideAPI.getRideDetails(prevRideId);
        if (!direct) {
          diagLogger.log('RIDE_RECOVERY_NOT_FOUND', `rideId=${prevRideId} source=${source}:direct`);
          clearStaleRide('not-found-direct');
          useStartupStore.getState().setRideRecovery('NOT_FOUND');
          return null;
        }
        if (direct.driver_id !== authUserId) {
          clearStaleRide('not-assigned-to-me-direct');
          useStartupStore.getState().setRideRecovery('NOT_FOUND');
          return null;
        }
        if (!ACTIVE_RIDE_STATUSES.has(direct.status)) {
          diagLogger.log('RIDE_RECOVERY_NOT_FOUND', `rideId=${prevRideId} backendStatus=${direct.status} source=${source}:direct`);
          clearStaleRide(`backend-status=${direct.status}-direct`);
          useStartupStore.getState().setRideRecovery('NOT_FOUND');
          return null;
        }
        ride = direct;
      } catch {
        diagLogger.log('DRIVER_RIDE_RECOVERY_FAILED', `rideId=${prevRideId} source=${source} direct-fetch-failed-keep-local`);
        useStartupStore.getState().setRideRecovery('FAILED');
        return useRideStore.getState().current_ride;
      }
      if (!ride) {
        return useRideStore.getState().current_ride;
      }
    }

    if (!ride) {
      diagLogger.log('RIDE_RECOVERY_NOT_FOUND', `source=${source} no local ride`);
      diagLogger.log('DRIVER_RIDE_RECOVERY_NOT_FOUND', `source=${source} no local ride`);
      const terminalDriverStatuses: ReadonlySet<DriverStatus> = new Set(['OFFLINE', 'ONLINE_IDLE']);
      if (!terminalDriverStatuses.has(driverStatus)) {
        diagLogger.log('RECONCILE_CLEAR', `reason=no-active-and-no-local source=${source} localStatus=${driverStatus}`);
        resetToIdle();
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const { useNavigationStore } = require('../store/navigationStore');
          useNavigationStore.getState().stopNavigation();
        } catch {}
      }
      useStartupStore.getState().setRideRecovery('NOT_FOUND');
      return null;
    }

    if (ride.driver_id !== authUserId) {
      clearStaleRide('not-assigned-to-me');
      useStartupStore.getState().setRideRecovery('NOT_FOUND');
      return null;
    }

    const mapped = backendStatusToDriverStatus(ride.status);
    if (!mapped) {
      diagLogger.log('RIDE_RECOVERY_NOT_FOUND', `rideId=${ride.id} backendStatus=${ride.status} source=${source}`);
      clearStaleRide(`backend-status=${ride.status}`);
      useStartupStore.getState().setRideRecovery('NOT_FOUND');
      return null;
    }

    diagLogger.log('RIDE_RECOVERY_FOUND', `rideId=${ride.id} backend=${ride.status} source=${source}`);
    diagLogger.log('DRIVER_RIDE_RECOVERY_FOUND', `rideId=${ride.id} backend=${ride.status} source=${source}`);
    diagLogger.log('RIDE_RECOVERY_HYDRATED', `rideId=${ride.id} ${driverStatus}->${mapped} backend=${ride.status}`);
    diagLogger.log('RECONCILE_OVERRIDE', `rideId=${ride.id} ${driverStatus}->${mapped} backend=${ride.status}`);
    useRideStore.getState().setCurrentRide(ride);
    useDriverStore.getState().setStatus(mapped);
    useStartupStore.getState().setRideRecovery('FOUND');
    return ride;
  })();
  inFlight = task;
  try {
    return await task;
  } finally {
    inFlight = null;
  }
}
