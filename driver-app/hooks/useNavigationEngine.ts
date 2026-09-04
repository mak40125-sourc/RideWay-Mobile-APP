import { useEffect, useRef } from 'react';
import { useDriverStore } from '../store/driverStore';
import { useNavigationStore } from '../store/navigationStore';
import { fetchNavRoute } from '../services/osrmNavigation';
import { diagLogger } from '../utils/diagLog';
import type { Coordinate } from '../types/navigation';

const ROUTE_FETCH_MIN_INTERVAL_MS = 8000;
const ROUTE_RETRY_DELAY_MS = 8000;

export function useNavigationEngine(
  destination: Coordinate | null,
  destinationKey: string | null,
  destinationLabel: string,
  enabled: boolean
) {
  const driverLocation = useDriverStore((s) => s.location);
  const active = useNavigationStore((s) => s.active);
  const status = useNavigationStore((s) => s.status);
  const isOffRoute = useNavigationStore((s) => s.isOffRoute);
  const isRerouting = useNavigationStore((s) => s.isRerouting);

  const lastAttemptRef = useRef(0);
  const inFlightRef = useRef(false);
  const navSessionRef = useRef(0);
  const requestIdRef = useRef(0);
  const destinationRef = useRef(destination);
  destinationRef.current = destination;

  useEffect(() => {
    if (enabled && destinationRef.current && destinationKey) {
      // FIX: Always clear stale route on a new navigation attempt.
      // Previously `if (!active || key !== destinationKey)` allowed
      // `active===true && key===same` to skip startNavigation, so
      // a previous routeGeometry/visible Polyline survived when OSRM
      // was OFF or the fetch was gate-skipped. Now every enabled->
      // navigation immediately clears route and sets status=fetching.
      navSessionRef.current += 1;
      const sess = navSessionRef.current;
      diagLogger.log('NAV_SESSION_START', `sess=${sess} key=${destinationKey} label=${destinationLabel} prevKey=${useNavigationStore.getState().destinationKey ?? 'null'}`);
       
      console.log('[RIDEWAY-DIAG] NAV_SESSION_START', JSON.stringify({ sess, key: destinationKey }));
      useNavigationStore.getState().startNavigation(destinationRef.current, destinationKey, destinationLabel);
      // Reset fetch throttle so a same-key retry is not blocked by the 8s gate.
      lastAttemptRef.current = 0;
      inFlightRef.current = false;
    } else {
      useNavigationStore.getState().stopNavigation();
    }
    return () => {
      const state = useNavigationStore.getState();
      if (state.destinationKey === destinationKey) {
        state.stopNavigation();
      }
    };
  }, [enabled, destinationKey, destinationLabel]);

  useEffect(() => {
    if (!driverLocation) return;
    useNavigationStore.getState().updatePosition(
      { latitude: driverLocation.latitude, longitude: driverLocation.longitude },
      driverLocation.heading ?? null
    );
  }, [driverLocation]);

  useEffect(() => {
    if (isOffRoute) {
      useNavigationStore.getState().requestReroute();
    }
  }, [isOffRoute]);

  useEffect(() => {
    if (!active || status !== 'fetching' || isRerouting || !driverLocation) return;
    if (inFlightRef.current) return;
    const now = Date.now();
    if (now - lastAttemptRef.current < ROUTE_FETCH_MIN_INTERVAL_MS) return;

    const state = useNavigationStore.getState();
    if (!state.destination) return;

    inFlightRef.current = true;
    lastAttemptRef.current = now;
    const origin: Coordinate = {
      latitude: driverLocation.latitude,
      longitude: driverLocation.longitude,
    };
    requestIdRef.current += 1;
    const reqId = requestIdRef.current;
    const sess = navSessionRef.current;
    diagLogger.log(
      'NAV_ENGINE_FETCH',
      `reqId=${reqId} sess=${sess} origin=${origin.latitude.toFixed(5)},${origin.longitude.toFixed(5)} dest=${state.destination.latitude.toFixed(5)},${state.destination.longitude.toFixed(5)} key=${state.destinationKey} status=${status} curPoints=${useNavigationStore.getState().route?.geometry?.length ?? 0} inFlight=${inFlightRef.current}`
    );
     
    console.log('[RIDEWAY-DIAG] NAV_ENGINE_FETCH', JSON.stringify({ reqId, sess, key: state.destinationKey }));
    const capturedKey = state.destinationKey;
    const capturedSess = sess;

    fetchNavRoute(origin, state.destination)
      .then((route) => {
        const curKey = useNavigationStore.getState().destinationKey;
        const isStale = curKey !== capturedKey || capturedSess !== navSessionRef.current;
        diagLogger.log('NAV_ENGINE_APPLY', `reqId=${reqId} sess=${capturedSess}->curSess=${navSessionRef.current} points=${route.geometry.length} key=${capturedKey} curKey=${curKey} stale=${isStale} stack=${(new Error().stack || '').split('\n').slice(1, 4).join(' | ')}`);
         
        console.log('[RIDEWAY-DIAG] NAV_ENGINE_APPLY', JSON.stringify({ reqId, sess: capturedSess, curSess: navSessionRef.current, stale: isStale }));
        useNavigationStore.getState().applyRoute(route);
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        diagLogger.log('NAV_ENGINE_FETCH_FAIL', `reqId=${reqId} sess=${capturedSess} err=${msg} key=${capturedKey} curKey=${useNavigationStore.getState().destinationKey} prevRoute=${!!useNavigationStore.getState().route} prevPoints=${useNavigationStore.getState().route?.geometry?.length ?? 0} curSess=${navSessionRef.current}`);
        useNavigationStore.getState().setStatus('error', msg);
      })
      .finally(() => {
        inFlightRef.current = false;
      });
  }, [active, status, isRerouting, driverLocation]);

  useEffect(() => {
    if (status !== 'error') return;
    const id = setTimeout(() => {
      const state = useNavigationStore.getState();
      if (state.active && state.status === 'error') {
        state.setStatus('fetching');
      }
    }, ROUTE_RETRY_DELAY_MS);
    return () => clearTimeout(id);
  }, [status, active]);

  useEffect(() => {
    if (!active || !isRerouting || !driverLocation) return;
    if (inFlightRef.current) return;

    const state = useNavigationStore.getState();
    if (!state.destination) {
      state.cancelRerouting();
      return;
    }

    inFlightRef.current = true;
    const origin: Coordinate = {
      latitude: driverLocation.latitude,
      longitude: driverLocation.longitude,
    };
    requestIdRef.current += 1;
    const reqId = requestIdRef.current;
    const capturedKey = state.destinationKey;
    const sess = navSessionRef.current;
    diagLogger.log('NAV_ENGINE_REROUTE_FETCH', `reqId=${reqId} sess=${sess} origin=${origin.latitude.toFixed(5)},${origin.longitude.toFixed(5)} dest=${state.destination.latitude.toFixed(5)},${state.destination.longitude.toFixed(5)} key=${capturedKey}`);

    fetchNavRoute(origin, state.destination)
      .then((route) => {
        const curKey = useNavigationStore.getState().destinationKey;
        const isStale = curKey !== capturedKey || sess !== navSessionRef.current;
        diagLogger.log('NAV_ENGINE_REROUTE_APPLY', `reqId=${reqId} sess=${sess}->curSess=${navSessionRef.current} points=${route.geometry.length} key=${capturedKey} curKey=${curKey} stale=${isStale}`);
        useNavigationStore.getState().applyRoute(route);
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        diagLogger.log('NAV_ENGINE_REROUTE_FAIL', `reqId=${reqId} sess=${sess} err=${msg} prevPoints=${useNavigationStore.getState().route?.geometry?.length ?? 0} key=${capturedKey} curKey=${useNavigationStore.getState().destinationKey}`);
        const s = useNavigationStore.getState();
        s.cancelRerouting();
        s.setStatus('error', msg);
      })
      .finally(() => {
        inFlightRef.current = false;
      });
  }, [active, isRerouting, driverLocation]);
}