import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { useDriverStore } from '../store/driverStore';
import { useRideStore } from '../store/rideStore';
import { useStartupStore } from '../store/startupStore';
import { reconcileRideOnce } from '../services/rideRecoveryService';
import { useNavigationRecovery } from './useNavigationRecovery';
import { diagLogger } from '../utils/diagLog';

function targetRouteForRide(ride: { status: string } | null, driverStatus: string): string {
  if (!ride) return '/(driver)/home';
  switch (ride.status) {
    case 'DRIVER_ASSIGNED':
    case 'DRIVER_ARRIVING':
      return driverStatus === 'ARRIVED_AT_PICKUP' ? '/(driver)/ride-progress' : '/(driver)/pickup-navigation';
    case 'RIDE_STARTED':
      return driverStatus === 'NAVIGATING_TO_DROP' ? '/(driver)/drop-navigation' : '/(driver)/ride-progress';
    default:
      return '/(driver)/home';
  }
}

export function useDriverStartup() {
  const { authUser, authState } = useAuth();
  const driverHydrated = useDriverStore((s) => s._hasHydrated);
  const rideHydrated = useRideStore((s) => s._hasHydrated);
  const { recoverNavigationFromRide } = useNavigationRecovery();
  const router = useRouter();
  const pathname = usePathname();
  const didInitRef = useRef(false);
  const routedRef = useRef<string | null>(null);

  useEffect(() => {
    diagLogger.log('DRIVER_STARTUP_BEGIN', `authState=${authState} driverHydrated=${driverHydrated} rideHydrated=${rideHydrated}`);
    if (authState === 'BOOTSTRAPPING') {
      useStartupStore.getState().setPhase('AUTH_HYDRATING');
      diagLogger.log('DRIVER_AUTH_HYDRATION_STARTED');
      return;
    }
    if (authState === 'UNAUTHENTICATED') {
      diagLogger.log('DRIVER_AUTH_READY', 'UNAUTHENTICATED');
      useStartupStore.getState().setPhase('AUTH_READY');
      useStartupStore.getState().markAppReady();
      return;
    }
    // AUTHENTICATED
    diagLogger.log('DRIVER_AUTH_READY', `user=${authUser?.id ?? 'null'}`);
    useStartupStore.getState().setPhase('AUTH_READY');

    if (!driverHydrated || !rideHydrated) {
      useStartupStore.getState().setPhase('PERSISTED_HYDRATING');
      return;
    }
    diagLogger.log('DRIVER_PERSISTENCE_HYDRATED', `driverHydrated=${driverHydrated} rideHydrated=${rideHydrated}`);
    useStartupStore.getState().setPhase('PERSISTED_READY');

    if (didInitRef.current) return;
    didInitRef.current = true;

    void (async () => {
      useStartupStore.getState().setPhase('RIDE_RECONCILING');
      diagLogger.log('DRIVER_RIDE_RECOVERY_STARTED', 'source=startup');
      const ride = await reconcileRideOnce('startup', authUser?.id ?? null);
      const { status: driverStatus } = useDriverStore.getState();
      await recoverNavigationFromRide(ride, 'startup');
      useStartupStore.getState().markAppReady();
      diagLogger.log('DRIVER_STARTUP_READY', `rideId=${ride?.id ?? 'null'} status=${ride?.status ?? 'null'} driverStatus=${driverStatus}`);

      const target = targetRouteForRide(ride, useDriverStore.getState().status);
      if (pathname !== target && routedRef.current !== target) {
        routedRef.current = target;
        diagLogger.log('STARTUP_ROUTE', `from=${pathname} to=${target} rideId=${ride?.id ?? 'null'}`);
        try {
          router.replace(target as never);
        } catch {}
      }
    })();
  }, [authState, authUser, driverHydrated, rideHydrated]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return;
      const st = useStartupStore.getState();
      if (!st.appReady) return;
      if (authState !== 'AUTHENTICATED') return;
      const uid = authUser?.id ?? null;
      if (!uid) return;
      void (async () => {
        const ride = await reconcileRideOnce('foreground', uid);
        await recoverNavigationFromRide(ride, 'foreground');
      })();
    });
    return () => sub.remove();
  }, [authState, authUser]);
}
