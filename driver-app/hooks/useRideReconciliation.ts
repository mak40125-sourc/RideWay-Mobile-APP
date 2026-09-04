import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useDriverStore } from '../store/driverStore';
import { useRideStore } from '../store/rideStore';
import { rideAPI } from '../services/rideAPI';
import { diagLogger } from '../utils/diagLog';
import type { DriverStatus } from '../types/driver';
import type { RideStatus } from '../types/ride';

// Backend rides.status is authoritative. Local cache is disposable.
// This hook discovers the authoritative active ride from backend by driver identity,
// not by locally-persisted rideId. So even if AsyncStorage is empty/corrupt after
// a crash, the active ride is recovered. Polls launch + interval + foreground.

const ACTIVE_RIDE_STATUSES: ReadonlySet<RideStatus> = new Set([
  'DRIVER_ASSIGNED',
  'DRIVER_ARRIVING',
  'RIDE_STARTED',
]);

const RETRY_INTERVAL_MS = 5000;

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

  useEffect(() => {
    if (!authUser || !driverHydrated || !rideHydrated) return;

    const resetToIdle = () => {
      const { is_online } = useDriverStore.getState();
      useDriverStore.getState().setStatus(is_online ? 'ONLINE_IDLE' : 'OFFLINE');
    };

    const clearStaleRide = (reason: string) => {
      const { current_ride } = useRideStore.getState();
      diagLogger.log('RECONCILE_CLEAR', `rideId=${current_ride?.id ?? 'none'} reason=${reason}`);
      useRideStore.getState().clearRide();
      resetToIdle();
    };

    const reconcile = async (source: string) => {
      if (runningRef.current) return;
      const user = authUserRef.current;
      if (!user) return;

      const { current_ride } = useRideStore.getState();
      const { status: driverStatus } = useDriverStore.getState();
      const prevRideId = current_ride?.id ?? null;

      runningRef.current = true;
      diagLogger.log('RIDE_RECOVERY_STARTED', `rideId=${prevRideId ?? 'null'} localStatus=${driverStatus} source=${source}`);
      diagLogger.log('RECONCILE_START', `rideId=${prevRideId ?? 'null'} localStatus=${driverStatus} source=${source}`);
      try {
        // Primary: discover active ride by driver identity (no local rideId required)
        let ride: Awaited<ReturnType<typeof rideAPI.getMyActiveRide>> = null;
        try {
          ride = await rideAPI.getMyActiveRide();
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          diagLogger.log('RECONCILE_UNAVAILABLE', `rideId=${prevRideId ?? 'null'} err=${msg} source=${source}`);
          diagLogger.log('RIDE_RECOVERY_FAILED', `rideId=${prevRideId ?? 'null'} err=${msg} source=${source}`);
          return;
        }

        if (!ride) {
          // No active ride for this driver. If we have a local ride cached, verify it directly before clearing.
          if (prevRideId) {
            try {
              const direct = await rideAPI.getRideDetails(prevRideId);
              if (!direct) {
                diagLogger.log('RIDE_RECOVERY_NOT_FOUND', `rideId=${prevRideId} source=${source}:direct`);
                clearStaleRide('not-found-direct');
                return;
              }
              if (direct.driver_id !== user.id) {
                clearStaleRide('not-assigned-to-me-direct');
                return;
              }
              if (!ACTIVE_RIDE_STATUSES.has(direct.status)) {
                diagLogger.log('RIDE_RECOVERY_NOT_FOUND', `rideId=${prevRideId} backendStatus=${direct.status} source=${source}:direct`);
                clearStaleRide(`backend-status=${direct.status}-direct`);
                return;
              }
              // Direct fetch found an active ride even though active-by-driver returned null — adopt it
              ride = direct;
            } catch {}
            if (!ride) {
              diagLogger.log('RIDE_RECOVERY_NOT_FOUND', `rideId=${prevRideId} source=${source}`);
              // No backend active ride and direct check failed to find active => keep local until we can confirm terminal? For now leave local if we can't fetch?
              // But if active-by-driver is null and we can't confirm, don't clear aggressively on network failure. Only clear when we positively know it's terminal or missing.
              return;
            }
          } else {
            diagLogger.log('RIDE_RECOVERY_NOT_FOUND', `source=${source} no local ride`);
            // No local ride and no backend active => ensure idle if we were in a stale active driver status without ride
            const terminalDriverStatuses: ReadonlySet<DriverStatus> = new Set(['OFFLINE', 'ONLINE_IDLE']);
            if (!terminalDriverStatuses.has(driverStatus)) {
              // Driver thinks they're in an active ride but backend says no active ride and we have no id — safe to reset after positive confirmation
              // Only reset if we just successfully fetched active (no network error). Already confirmed ride=null.
              // Keep idle recovery conservative: don't flip offline<->online, just clear stale driver status
              // If driver is in NAVIGATING etc without a ride, that's stale.
              diagLogger.log('RECONCILE_CLEAR', `reason=no-active-and-no-local source=${source} localStatus=${driverStatus}`);
              resetToIdle();
            }
            return;
          }
        }

        if (ride.driver_id !== user.id) {
          clearStaleRide('not-assigned-to-me');
          return;
        }

        const mapped = backendStatusToDriverStatus(ride.status);
        if (!mapped) {
          diagLogger.log('RIDE_RECOVERY_NOT_FOUND', `rideId=${ride.id} backendStatus=${ride.status} source=${source}`);
          clearStaleRide(`backend-status=${ride.status}`);
          return;
        }

        diagLogger.log('RIDE_RECOVERY_FOUND', `rideId=${ride.id} backend=${ride.status} source=${source}`);
        diagLogger.log('RIDE_RECOVERY_HYDRATED', `rideId=${ride.id} ${driverStatus}->${mapped} backend=${ride.status}`);
        diagLogger.log('RECONCILE_OVERRIDE', `rideId=${ride.id} ${driverStatus}->${mapped} backend=${ride.status}`);
        useRideStore.getState().setCurrentRide(ride);
        useDriverStore.getState().setStatus(mapped);
      } finally {
        runningRef.current = false;
      }
    };

    // Launch recovery immediately, then interval
    void reconcile('launch');
    const interval = setInterval(() => void reconcile('poll'), RETRY_INTERVAL_MS);

    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        diagLogger.log('RECONCILE_FOREGROUND');
        diagLogger.log('RIDE_RECONCILIATION_STARTED', 'foreground');
        void reconcile('foreground');
      }
    });

    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [authUser, driverHydrated, rideHydrated]);

  return null;
}
