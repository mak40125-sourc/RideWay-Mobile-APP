import type { RideOption } from "../home/types";
import type { ParsedRideRoute, RideRouteParams } from "./ride-types";

const parseSingleValue = (value?: string | string[]) => {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
};

const parseCoordinate = (value?: string | string[]) => {
  const parsed = Number(parseSingleValue(value));

  return Number.isFinite(parsed) ? parsed : null;
};

export function parseRideRoute(params: RideRouteParams): ParsedRideRoute | null {
  const pickupLat = parseCoordinate(params.pickupLat);
  const pickupLng = parseCoordinate(params.pickupLng);
  const dropLat = parseCoordinate(params.dropLat);
  const dropLng = parseCoordinate(params.dropLng);

  if ([pickupLat, pickupLng, dropLat, dropLng].some((value) => value === null)) {
    return null;
  }

  return {
    pickup: {
      latitude: pickupLat as number,
      longitude: pickupLng as number,
    },
    dropoff: {
      latitude: dropLat as number,
      longitude: dropLng as number,
    },
  };
}

// Legacy display fallback only. The backend pricing engine
// (backend/src/modules/pricing) is authoritative; this local formula must
// never be trusted for booking. Used only when backend estimates are
// unreachable, and overwritten by authoritative values on ride creation.
export function calculateRideFare(option: RideOption, distance: number, duration: number) {
  return Math.round(option.baseFare + distance * option.perKm + duration * option.perMin);
}

// City-driving arrival estimate derived from the driver's live location (the
// store's `driver.location` realtime channel). Never a hardcoded ETA — when no
// location is known the UI falls back to a generic "arriving" label instead.
const ARRIVAL_AVERAGE_KMH = 30;

export function estimateDriverEtaMinutes(from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(to.latitude - from.latitude);
  const dLng = toRad(to.longitude - from.longitude);
  const lat1 = toRad(from.latitude);
  const lat2 = toRad(to.latitude);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceKm = earthRadiusKm * c;
  return Math.max(1, Math.round((distanceKm / ARRIVAL_AVERAGE_KMH) * 60));
}
