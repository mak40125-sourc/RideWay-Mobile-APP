import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useDriverStore } from '../store/driverStore';
import { useRideStore } from '../store/rideStore';
import { rideAPI } from '../services/rideAPI';
import { diagLogger } from '../utils/diagLog';
import type { DriverStatus } from '../types/driver';
import type { RideStatus } from '../types/ride';

// Backend rides.status is authoritative. Local DriverStatus is a recovery
// cache only. This hook re-derives the local status from the backend on
// launch and whenever the app returns to the foreground, and retries while
// the backend is unreachable (retaining local state meanwhile).

const ACTIVE_RIDE_STATUSES: ReadonlySet<RideStatus> = new Set([
  'DRIVER_ASSIGNED',
  'DRIVER_ARRIVING',
  'RIDE_STARTED',
]);

const ACTIVE_DRIVER_STATUSES: ReadonlySet<DriverStatus> = new Set([
  'REQUEST_RECEIVED',
  'ACCEPTED',
  'NAVIGATING_TO_PICKUP',
  'ARRIVED_AT_PICKUP',
  'RIDE_STARTED',
  'NAVIGATING_TO_DROP',
  'RIDE_COMPLETED',
]);

const RETRY_INTERVAL_MS = 20000;

function backendStatusToDriverStatus(status: RideStatus): DriverStatus | null {
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

export function useRideReconciliation() {
  const { authUser } = useAuth();
  const driverHydrated = useDriverStore((s) => s._hasHydrated);
  const rideHydrated = useRideStore((s) => s._hasHydrated);

  const authUserRef = useRef(authUser);
  authUserRef.current = authUser;
  const runningRef = useRef(false);
  const retryTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!authUser || !driverHydrated || !rideHydrated) return;

    const stopRetry = () => {
      if (retryTimerRef.current) {
        clearInterval(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };

    const startRetry = () => {
      if (retryTimerRef.current) return;
      retryTimerRef.current = setInterval(() => {
        reconcile().catch(() => {});
      }, RETRY_INTERVAL_MS);
    };

    const resetToIdle = () => {
      const { is_online } = useDriverStore.getState();
      useDriverStore.getState().setStatus(is_online ? 'ONLINE_IDLE' : 'OFFLINE');
    };

    const clearStaleRide = (reason: string) => {
      const { current_ride } = useRideStore.getState();
      diagLogger.log('RECONCILE_CLEAR', `rideId=${current_ride?.id ?? 'none'} reason=${reason}`);
      useRideStore.getState().clearRide();
      resetToIdle();
      stopRetry();
    };

    const reconcile = async () => {
      if (runningRef.current) return;
      const user = authUserRef.current;
      if (!user) return;

      const { current_ride } = useRideStore.getState();
      const { status: driverStatus } = useDriverStore.getState();

      const needsReconcile = !!current_ride || ACTIVE_DRIVER_STATUSES.has(driverStatus);
      if (!needsReconcile) {
        stopRetry();
        return;
      }

      const rideId = current_ride?.id ?? null;
      if (!rideId) {
        clearStaleRide(`active-local-status-without-ride (${driverStatus})`);
        return;
      }

      runningRef.current = true;
      diagLogger.log('RECONCILE_START', `rideId=${rideId} localStatus=${driverStatus}`);
      try {
        let ride;
        try {
          ride = await rideAPI.getRideDetails(rideId);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          diagLogger.log('RECONCILE_UNAVAILABLE', `rideId=${rideId} err=${msg}`);
          startRetry();
          return;
        }

        if (!ride) {
          clearStaleRide('not-found');
          return;
        }

        if (ride.driver_id !== user.id) {
          clearStaleRide('not-assigned-to-me');
          return;
        }

        const mapped = backendStatusToDriverStatus(ride.status);
        if (!mapped) {
          clearStaleRide(`backend-status=${ride.status}`);
          return;
        }

        diagLogger.log(
          'RECONCILE_OVERRIDE',
          `rideId=${rideId} ${driverStatus}->${mapped} backend=${ride.status}`
        );
        useRideStore.getState().setCurrentRide(ride);
        useDriverStore.getState().setStatus(mapped);
        stopRetry();
      } finally {
        runningRef.current = false;
      }
    };

    reconcile().catch(() => {});

    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        diagLogger.log('RECONCILE_FOREGROUND');
        reconcile().catch(() => {});
      }
    });

    return () => {
      stopRetry();
      sub.remove();
    };
  }, [authUser, driverHydrated, rideHydrated]);

  return null;
}
