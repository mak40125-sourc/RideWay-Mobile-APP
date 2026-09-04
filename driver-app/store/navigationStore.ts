import { create } from 'zustand';
import { haversineM, snapToFlattenedM } from '../services/osrmNavigation';
import type { Coordinate, NavRoute } from '../types/navigation';
import { diagLogger } from '../utils/diagLog';

export type NavStatus = 'idle' | 'fetching' | 'active' | 'error';

const OFF_ROUTE_THRESHOLD_M = 120;
const REROUTE_MIN_INTERVAL_MS = 15000;
const FALLBACK_SPEED_MPS = 8.33;

function computeMetrics(
  route: NavRoute,
  position: Coordinate
): {
  currentStepIndex: number;
  distanceToManeuverM: number;
  remainingDistanceM: number;
  remainingDurationS: number;
  routeProgress: number;
  distanceM: number;
} {
  const snap = snapToFlattenedM(position, route.flattened);
  const totalM = route.flattened.totalM || 1;
  const remainingDistanceM = Math.max(0, totalM - snap.cumM);
  const remainingDurationS = (route.durationS * remainingDistanceM) / totalM;
  const routeProgress = Math.min(1, Math.max(0, snap.cumM / totalM));
  const currentStepIndex = route.flattened.stepOfPoint[snap.index] ?? route.steps.length - 1;
  const stepEndCum = route.flattened.stepEndCum[currentStepIndex] ?? totalM;
  const distanceToManeuverM = Math.max(0, stepEndCum - snap.cumM);
  return {
    currentStepIndex,
    distanceToManeuverM,
    remainingDistanceM,
    remainingDurationS,
    routeProgress,
    distanceM: snap.distanceM,
  };
}

interface NavigationState {
  active: boolean;
  destination: Coordinate | null;
  destinationKey: string | null;
  destinationLabel: string;
  position: Coordinate | null;
  heading: number | null;
  route: NavRoute | null;
  status: NavStatus;
  error: string | null;
  currentStepIndex: number;
  distanceToManeuverM: number;
  remainingDistanceM: number;
  remainingDurationS: number;
  routeProgress: number;
  isOffRoute: boolean;
  isRerouting: boolean;
  lastRerouteAt: number;

  startNavigation: (destination: Coordinate, key: string, label: string) => void;
  stopNavigation: () => void;
  updatePosition: (position: Coordinate, heading?: number | null) => void;
  applyRoute: (route: NavRoute) => void;
  setStatus: (status: NavStatus, error?: string | null) => void;
  requestReroute: () => void;
  cancelRerouting: () => void;
}

export const useNavigationStore = create<NavigationState>()((set, get) => ({
  active: false,
  destination: null,
  destinationKey: null,
  destinationLabel: '',
  position: null,
  heading: null,
  route: null,
  status: 'idle',
  error: null,
  currentStepIndex: 0,
  distanceToManeuverM: 0,
  remainingDistanceM: 0,
  remainingDurationS: 0,
  routeProgress: 0,
  isOffRoute: false,
  isRerouting: false,
  lastRerouteAt: 0,

  startNavigation: (destination, key, label) => {
    const prev = get();
    const ts = new Date().toISOString();
    diagLogger.log(
      'NAV_START',
      `ts=${ts} key=${key} label=${label} dest=${destination.latitude.toFixed(5)},${destination.longitude.toFixed(5)} prevKey=${prev.destinationKey ?? 'null'} prevActive=${prev.active} prevStatus=${prev.status} prevPoints=${prev.route?.geometry?.length ?? 0} -> newPoints=0`
    );
     
    console.log('[RIDEWAY-DIAG] NAV_START', JSON.stringify({ ts, key, label, prevKey: prev.destinationKey, prevActive: prev.active, prevPoints: prev.route?.geometry?.length ?? 0 }));
    return set({
      active: true,
      destination,
      destinationKey: key,
      destinationLabel: label,
      route: null,
      status: 'fetching',
      error: null,
      currentStepIndex: 0,
      distanceToManeuverM: 0,
      remainingDistanceM: 0,
      remainingDurationS: 0,
      routeProgress: 0,
      isOffRoute: false,
      isRerouting: false,
    });
  },

  stopNavigation: () => {
    const prev = get().route?.geometry?.length ?? 0;
    diagLogger.log('NAV_STOP', `clearedRoute=true prevPoints=${prev} source=stopNavigation`);
    return set({
      active: false,
      destination: null,
      destinationKey: null,
      destinationLabel: '',
      route: null,
      status: 'idle',
      error: null,
      currentStepIndex: 0,
      distanceToManeuverM: 0,
      remainingDistanceM: 0,
      remainingDurationS: 0,
      routeProgress: 0,
      isOffRoute: false,
      isRerouting: false,
    });
  },

  updatePosition: (position, heading) => {
    const state = get();
    if (!state.active) {
      set({ position, heading });
      return;
    }

    const destination = state.destination;
    if (!destination) {
      set({ position, heading });
      return;
    }

    if (state.route) {
      const metrics = computeMetrics(state.route, position);
      const isOffRoute =
        state.status === 'active' &&
        !state.isRerouting &&
        metrics.distanceM > OFF_ROUTE_THRESHOLD_M;

      set({
        position,
        heading: heading != null ? heading : state.heading,
        remainingDistanceM: metrics.remainingDistanceM,
        remainingDurationS: metrics.remainingDurationS,
        routeProgress: metrics.routeProgress,
        currentStepIndex: metrics.currentStepIndex,
        distanceToManeuverM: metrics.distanceToManeuverM,
        isOffRoute,
      });
      return;
    }

    const remainingDistanceM = haversineM(position, destination);
    set({
      position,
      heading: heading != null ? heading : state.heading,
      remainingDistanceM,
      remainingDurationS: remainingDistanceM / FALLBACK_SPEED_MPS,
      routeProgress: 0,
      currentStepIndex: 0,
      distanceToManeuverM: remainingDistanceM,
      isOffRoute: false,
    });
  },

  applyRoute: (route) => {
    const ts = new Date().toISOString();
    const cur = get();
    const stack = (new Error().stack || '').split('\n').slice(2, 6).join(' | ');
    diagLogger.log(
      'NAV_APPLY_ROUTE_CALL',
      `ts=${ts} pointCount=${route.geometry.length} destKey=${cur.destinationKey ?? 'null'} routeDest=${route.destination.latitude.toFixed(5)},${route.destination.longitude.toFixed(5)} active=${cur.active} status=${cur.status} prevPoints=${cur.route?.geometry?.length ?? 0} source=FRESH_OSRM stack=${stack}`
    );
     
    console.log('[RIDEWAY-DIAG] NAV_APPLY_ROUTE_CALL', JSON.stringify({ ts, points: route.geometry.length, curKey: cur.destinationKey, active: cur.active, status: cur.status, prevPoints: cur.route?.geometry?.length ?? 0, stack }));
    diagLogger.log(
      'NAV_ROUTE_WRITTEN',
      `writer=applyRoute source=FRESH_OSRM pointCount=${route.geometry.length} origin=${route.origin.latitude.toFixed(4)},${route.origin.longitude.toFixed(4)} dest=${route.destination.latitude.toFixed(4)},${route.destination.longitude.toFixed(4)} fetchedAt=${route.fetchedAt} prevPoints=${cur.route?.geometry?.length ?? 0}`
    );
    const state = get();
    const position = state.position;
    const base = {
      route,
      status: 'active' as NavStatus,
      error: null,
      isOffRoute: false,
      isRerouting: false,
    };
    if (position) {
      const metrics = computeMetrics(route, position);
      set({
        ...base,
        currentStepIndex: metrics.currentStepIndex,
        distanceToManeuverM: metrics.distanceToManeuverM,
        remainingDistanceM: metrics.remainingDistanceM,
        remainingDurationS: metrics.remainingDurationS,
        routeProgress: metrics.routeProgress,
      });
      return;
    }
    set({
      ...base,
      currentStepIndex: 0,
      remainingDistanceM: route.distanceM,
      remainingDurationS: route.durationS,
      distanceToManeuverM: route.steps[0] ? route.steps[0].distance : route.distanceM,
    });
  },

  setStatus: (status, error) => {
    if (status === 'error') {
      diagLogger.log(
        'NAV_STATUS_ERROR',
        `status=error err=${error ?? ''} routePoints=${get().route?.geometry?.length ?? 0} routeExists=${!!get().route}`
      );
    } else if (status === 'fetching') {
      diagLogger.log('NAV_STATUS_FETCHING', `routeExists=${!!get().route} points=${get().route?.geometry?.length ?? 0}`);
    }
    return set({ status, error: error ?? null });
  },

  requestReroute: () => {
    const now = Date.now();
    if (now - get().lastRerouteAt < REROUTE_MIN_INTERVAL_MS) return;
    set({
      isRerouting: true,
      isOffRoute: false,
      lastRerouteAt: now,
      status: 'fetching',
    });
  },

  cancelRerouting: () => set({ isRerouting: false, isOffRoute: false }),
}));