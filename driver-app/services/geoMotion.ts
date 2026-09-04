import type { Coordinate } from '../types/navigation';

// Pure, dependency-free geometry/kinematic helpers for rendering smooth
// vehicle motion. These never touch navigation state — they only describe how
// to interpolate a display position/heading between two GPS fixes.

export function isValidHeading(h: unknown): h is number {
  return typeof h === 'number' && Number.isFinite(h) && h >= 0 && h < 360;
}

// Shortest signed angular difference in degrees in the range (-180, 180].
// Handles the 0°/360° boundary: diff(2, 359) === -3, not +357.
export function angleDiff(from: number, to: number): number {
  let d = ((to - from) % 360 + 540) % 360 - 180;
  return d;
}

/** Interpolate two headings along the shortest arc. */
export function interpolateBearing(from: number, to: number, t: number): number {
  return (((from + angleDiff(from, to) * t) % 360) + 360) % 360;
}

/** Great-circle bearing (degrees, 0 = north) from a → b. */
export function bearingBetween(a: Coordinate, b: Coordinate): number {
  const φ1 = (a.latitude * Math.PI) / 180;
  const φ2 = (b.latitude * Math.PI) / 180;
  const Δλ = ((b.longitude - a.longitude) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
}

/** Ease-in-out cubic; smooth start and stop without bounce. */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Linear position interpolation (fine for short segments). */
export function interpolateCoord(a: Coordinate, b: Coordinate, t: number): Coordinate {
  return {
    latitude: a.latitude + (b.latitude - a.latitude) * t,
    longitude: a.longitude + (b.longitude - a.longitude) * t,
  };
}

export function coordDistanceM(a: Coordinate, b: Coordinate): number {
  const R = 6371000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const la1 = (a.latitude * Math.PI) / 180;
  const la2 = (b.latitude * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Resolve a smoothed vehicle heading. */
export function resolveHeading(
  gpsHeading: number | null,
  from: Coordinate,
  to: Coordinate,
  current: number,
  distanceM: number
): number {
  if (!isValidHeading(gpsHeading)) {
    // No compass — fall back to direction of travel when actually moving.
    if (distanceM > 1) return bearingBetween(from, to);
    return current;
  }
  // Use the GPS heading directly; the caller smooths rotation over time.
  return gpsHeading;
}