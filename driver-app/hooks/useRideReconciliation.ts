import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useDriverStore } from '../store/driverStore';
import { useRideStore } from '../store/rideStore';
import { useStartupStore } from '../store/startupStore';
import { reconcileRideOnce } from '../services/rideRecoveryService';
import { diagLogger } from '../utils/diagLog';

const RETRY_INTERVAL_MS = 20000;

export function useRideReconciliation() {
  const { authUser } = useAuth();
  const driverHydrated = useDriverStore((s) => s._hasHydrated);
  const rideHydrated = useRideStore((s) => s._hasHydrated);

  useEffect(() => {
    if (!authUser || !driverHydrated || !rideHydrated) return;
    const appReady = useStartupStore.getState().appReady;
    // During initial startup, useDriverStartup owns the first reconcile.
    // This hook provides ongoing poll + foreground reconciliation after APP_READY,
    // plus a safety net if startup hasn't completed yet (it will dedup via in-flight mutex).
    if (!appReady) {
      diagLogger.log('RECONCILE_DEFERRED', 'startup owns first reconcile');
    }

    const onForeground = () => {
      diagLogger.log('RECONCILE_FOREGROUND');
      diagLogger.log('RIDE_RECONCILIATION_STARTED', 'foreground');
      void reconcileRideOnce('foreground', authUser.id);
    };

    const interval = setInterval(() => {
      const st = useStartupStore.getState();
      if (!st.appReady) return;
      void reconcileRideOnce('poll', authUser.id);
    }, RETRY_INTERVAL_MS);

    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') onForeground();
    });

    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [authUser, driverHydrated, rideHydrated]);

  return null;
}
