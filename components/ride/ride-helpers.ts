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

export function calculateRideFare(option: RideOption, distance: number, duration: number) {
  return Math.round(option.baseFare + distance * option.perKm + duration * option.perMin);
}
