import { diagLogger } from '../utils/diagLog';
import type {
  Coordinate,
  FlattenedRoute,
  ManeuverIcon,
  ManeuverInstruction,
  NavRoute,
  NavStep,
  OsrmManeuver,
  OsrmResponse,
  OsrmRoute,
  OsrmStep,
} from '../types/navigation';

const DEFAULT_OSRM_BASE_URL = 'https://router.project-osrm.org';
const REQUEST_TIMEOUT_MS = 15000;

function getOsrmBaseUrl(): string {
  return (process.env.EXPO_PUBLIC_OSRM_BASE_URL || DEFAULT_OSRM_BASE_URL).replace(/\/$/, '');
}

export function haversineM(a: Coordinate, b: Coordinate): number {
  const R = 6371000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatDistanceM(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) meters = 0;
  if (meters < 1000) return `${Math.round(meters)} m`;
  const km = meters / 1000;
  return `${km >= 10 ? km.toFixed(0) : km.toFixed(1)} km`;
}

export async function fetchNavRoute(
  origin: Coordinate,
  destination: Coordinate
): Promise<NavRoute> {
  const base = getOsrmBaseUrl();
  const url =
    `${base}/route/v1/driving/` +
    `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}` +
    `?alternatives=false&steps=true&overview=full&geometries=geojson`;
  diagLogger.log('OSRM_REQUEST_ATTEMPT', `origin=${origin.latitude.toFixed(5)},${origin.longitude.toFixed(5)} dest=${destination.latitude.toFixed(5)},${destination.longitude.toFixed(5)} base=${base}`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, { signal: controller.signal });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (controller.signal.aborted) {
      diagLogger.log('OSRM_REQUEST_FAIL', `timeout url=${url} msg=${msg}`);
      throw new Error('Route request timed out');
    }
    diagLogger.log('OSRM_REQUEST_FAIL', `network url=${url} msg=${msg} base=${base}`);
    throw new Error('Route request failed. Check connectivity to the routing server.');
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    diagLogger.log('OSRM_REQUEST_FAIL', `status=${response.status} url=${url}`);
    throw new Error(`Route request failed with ${response.status}`);
  }

  const data = (await response.json()) as OsrmResponse;
  const route = data.routes?.[0];
  if (!route) {
    diagLogger.log('OSRM_NO_ROUTE', `url=${url} code=${data.code ?? ''}`);
    throw new Error('No route found for these locations');
  }

  const built = buildNavRoute(route, origin, destination);
  diagLogger.log(
    'OSRM_REQUEST_SUCCESS',
    `source=FRESH_OSRM points=${built.geometry.length} distanceM=${Math.round(built.distanceM)} steps=${built.steps.length} url=${url}`
  );
  return built;
}

function decodeGeoJson(coordinates?: [number, number][]): Coordinate[] {
  return (coordinates ?? []).map(([longitude, latitude]) => ({ latitude, longitude }));
}

function buildNavRoute(route: OsrmRoute, origin: Coordinate, destination: Coordinate): NavRoute {
  const geometry = decodeGeoJson(route.geometry?.coordinates);
  const rawSteps = route.legs?.[0]?.steps ?? [];

  const steps: NavStep[] = rawSteps.map((step: OsrmStep, index: number) => {
    const maneuverLocation: Coordinate = {
      latitude: step.maneuver.location[1],
      longitude: step.maneuver.location[0],
    };
    return {
      index,
      distance: step.distance,
      duration: step.duration,
      name: step.name || '',
      geometry: decodeGeoJson(step.geometry?.coordinates),
      maneuverLocation,
      maneuver: { ...step.maneuver, coordinate: maneuverLocation },
      instruction: buildManeuverInstruction(step.maneuver, step.name, step.ref),
    };
  });

  if (steps.length === 0) {
    steps.push({
      index: 0,
      distance: route.distance,
      duration: route.duration,
      name: 'Destination',
      geometry: geometry.length >= 2 ? geometry : [origin, destination],
      maneuverLocation: destination,
      maneuver: {
        type: 'arrive',
        location: [destination.longitude, destination.latitude],
        coordinate: destination,
      },
      instruction: {
        primary: 'Arrive at destination',
        roadName: null,
        icon: { name: 'location', rotation: 0 },
        connector: null,
      },
    });
  }

  const flattened = buildFlattened(steps);

  return {
    origin,
    destination,
    distanceM: route.distance,
    durationS: route.duration,
    geometry,
    steps,
    flattened,
    fetchedAt: Date.now(),
  };
}

export function buildFlattened(steps: NavStep[]): FlattenedRoute {
  const coords: Coordinate[] = [];
  const cumM: number[] = [];
  const stepOfPoint: number[] = [];
  const stepEndCum: number[] = [];
  let totalM = 0;

  const append = (point: Coordinate, step: number) => {
    const last = coords[coords.length - 1];
    if (last && last.latitude === point.latitude && last.longitude === point.longitude) return;
    if (coords.length > 0) {
      totalM += haversineM(coords[coords.length - 1], point);
    }
    coords.push(point);
    cumM.push(totalM);
    stepOfPoint.push(step);
  };

  for (let s = 0; s < steps.length; s++) {
    const step = steps[s];
    for (let i = 0; i < step.geometry.length; i++) {
      append(step.geometry[i], s);
    }
    append(step.maneuverLocation, s);
    stepEndCum.push(totalM);
  }

  return { coords, cumM, stepOfPoint, stepEndCum, totalM };
}

export type SnapResult = { cumM: number; index: number; distanceM: number };

export function snapToFlattenedM(point: Coordinate, flat: FlattenedRoute): SnapResult {
  const { coords, cumM } = flat;
  const n = coords.length;
  if (n === 0) return { cumM: 0, index: 0, distanceM: 0 };
  if (n === 1) {
    return { cumM: 0, index: 0, distanceM: haversineM(point, coords[0]) };
  }

  let best = -1;
  let bestDist2 = Infinity;
  let bestT = 0;
  let bestPoint: Coordinate = coords[0];

  for (let i = 0; i < n - 1; i++) {
    const a = coords[i];
    const b = coords[i + 1];
    const dx = b.longitude - a.longitude;
    const dy = b.latitude - a.latitude;
    const len2 = dx * dx + dy * dy;
    let t = 0;
    if (len2 > 0) {
      t = Math.max(0, Math.min(1, ((point.longitude - a.longitude) * dx + (point.latitude - a.latitude) * dy) / len2));
    }
    const px = a.longitude + t * dx;
    const py = a.latitude + t * dy;
    const ddx = point.longitude - px;
    const ddy = point.latitude - py;
    const d2 = ddx * ddx + ddy * ddy;
    if (d2 < bestDist2) {
      bestDist2 = d2;
      best = i;
      bestT = t;
      bestPoint = { latitude: py, longitude: px };
    }
  }

  if (best < 0) return { cumM: 0, index: 0, distanceM: 0 };
  const cumMAt = cumM[best] + bestT * (cumM[best + 1] - cumM[best]);
  return { cumM: cumMAt, index: best, distanceM: haversineM(point, bestPoint) };
}

/**
 * Same projection as `snapToFlattenedM` but returns the projected coordinate on
 * the route rather than cumulative-metre metrics. Used ONLY for rendering the
 * visual vehicle so it stays aligned with the road. Navigation progress/off-route
 * decisions keep using `snapToFlattenedM` and are never affected by this.
 */
export function snapToRoutePoint(point: Coordinate, flat: FlattenedRoute): Coordinate | null {
  const { coords } = flat;
  const n = coords.length;
  if (n === 0) return null;
  if (n === 1) return coords[0];

  let best = -1;
  let bestDist2 = Infinity;
  let bestPoint: Coordinate = coords[0];

  for (let i = 0; i < n - 1; i++) {
    const a = coords[i];
    const b = coords[i + 1];
    const dx = b.longitude - a.longitude;
    const dy = b.latitude - a.latitude;
    const len2 = dx * dx + dy * dy;
    let t = 0;
    if (len2 > 0) {
      t = Math.max(0, Math.min(1, ((point.longitude - a.longitude) * dx + (point.latitude - a.latitude) * dy) / len2));
    }
    const px = a.longitude + t * dx;
    const py = a.latitude + t * dy;
    const ddx = point.longitude - px;
    const ddy = point.latitude - py;
    const d2 = ddx * ddx + ddy * ddy;
    if (d2 < bestDist2) {
      bestDist2 = d2;
      best = i;
      bestPoint = { latitude: py, longitude: px };
    }
  }

  if (best < 0) return coords[0];
  return bestPoint;
}

function cardinalFromDeg(deg: number): string {
  const dirs = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
  const normalized = ((deg % 360) + 360) % 360;
  const idx = Math.round(normalized / 45) % 8;
  return dirs[idx];
}

export function maneuverIcon(maneuver: OsrmManeuver): ManeuverIcon {
  const { type, modifier } = maneuver;
  if (type === 'roundabout' || type === 'rotary' || type === 'roundabout turn') {
    return { name: 'arrow-redo-circle-outline', rotation: 0 };
  }
  if (type === 'arrive') return { name: 'location', rotation: 0 };
  if (type === 'uturn') return { name: 'arrow-up', rotation: 180 };

  switch (modifier) {
    case 'left':
      return { name: 'arrow-up', rotation: -90 };
    case 'right':
      return { name: 'arrow-up', rotation: 90 };
    case 'slight left':
      return { name: 'arrow-up', rotation: -40 };
    case 'slight right':
      return { name: 'arrow-up', rotation: 40 };
    case 'sharp left':
      return { name: 'arrow-up', rotation: -135 };
    case 'sharp right':
      return { name: 'arrow-up', rotation: 135 };
    case 'uturn':
      return { name: 'arrow-up', rotation: 180 };
    default:
      return { name: 'arrow-up', rotation: 0 };
  }
}

export function buildManeuverInstruction(
  maneuver: OsrmManeuver,
  name: string,
  ref?: string
): ManeuverInstruction {
  const type = maneuver.type;
  const mod = maneuver.modifier;
  const icon = maneuverIcon(maneuver);
  const roadName = name || ref || null;

  const withConnector = (primary: string, connector: 'onto' | 'on' | null): ManeuverInstruction => ({
    primary,
    roadName,
    icon,
    connector,
  });

  switch (type) {
    case 'depart':
      return withConnector(`Head ${cardinalFromDeg(maneuver.bearing_after ?? 0)}`, roadName ? 'on' : null);
    case 'arrive':
      return { primary: 'Arrive at destination', roadName: null, icon, connector: null };
    case 'roundabout':
    case 'rotary':
    case 'roundabout turn':
      return withConnector(
        maneuver.exit ? `Roundabout, exit ${maneuver.exit}` : 'Roundabout',
        roadName ? 'onto' : null
      );
    case 'fork':
      return withConnector(mod === 'left' ? 'Keep left' : mod === 'right' ? 'Keep right' : 'Keep straight', roadName ? 'onto' : null);
    case 'merge':
      return withConnector(mod ? `Merge ${mod}` : 'Merge', roadName ? 'onto' : null);
    case 'on ramp':
      return withConnector('Take the ramp', roadName ? 'onto' : null);
    case 'off ramp':
      return withConnector('Take the exit', roadName ? 'onto' : null);
    case 'end of road':
      return withConnector(mod ? `Turn ${mod} at end of road` : 'End of road', roadName ? 'onto' : null);
    case 'new name':
      return withConnector('Continue', roadName ? 'onto' : null);
    case 'continue':
      if (mod && mod !== 'straight') return withConnector(`Continue ${mod}`, roadName ? 'onto' : null);
      return withConnector('Continue straight', roadName ? 'onto' : null);
    case 'turn':
    default: {
      if (mod === 'left') return withConnector('Turn left', roadName ? 'onto' : null);
      if (mod === 'right') return withConnector('Turn right', roadName ? 'onto' : null);
      if (mod === 'slight left') return withConnector('Slight left', roadName ? 'onto' : null);
      if (mod === 'slight right') return withConnector('Slight right', roadName ? 'onto' : null);
      if (mod === 'sharp left') return withConnector('Sharp left', roadName ? 'onto' : null);
      if (mod === 'sharp right') return withConnector('Sharp right', roadName ? 'onto' : null);
      if (mod === 'uturn') return withConnector('Make a U-turn', roadName ? 'onto' : null);
      return withConnector('Proceed', roadName ? 'onto' : null);
    }
  }
}