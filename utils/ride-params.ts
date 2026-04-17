import type { SelectedRide } from "../components/ride/ride-types";

const getParam = (value?: string | string[]) => (Array.isArray(value) ? value[0] : value);

export function serializeRide(ride: SelectedRide) {
  return {
    pickupLat: String(ride.pickup.latitude),
    pickupLng: String(ride.pickup.longitude),
    dropLat: String(ride.dropoff.latitude),
    dropLng: String(ride.dropoff.longitude),
    distance: ride.distance.toFixed(1),
    duration: ride.duration.toFixed(0),
    rideLabel: ride.option.label,
    rideDescription: ride.option.description,
    fare: String(ride.fare),
    path: JSON.stringify(ride.path),
  };
}

export function parseStringParam(value?: string | string[]) {
  return getParam(value) || "";
}

export function parseNumberParam(value?: string | string[]) {
  const parsed = Number(getParam(value));

  return Number.isFinite(parsed) ? parsed : null;
}

export function deserializeRide(params: Record<string, string | string[]> | null): SelectedRide | null {
  if (!params) return null;

  const pickupLat = parseNumberParam(params.pickupLat);
  const pickupLng = parseNumberParam(params.pickupLng);
  const dropLat = parseNumberParam(params.dropLat);
  const dropLng = parseNumberParam(params.dropLng);
  const distance = parseNumberParam(params.distance);
  const duration = parseNumberParam(params.duration);
  const fare = parseNumberParam(params.fare);

  if (pickupLat === null || pickupLng === null || dropLat === null || dropLng === null || distance === null || duration === null || fare === null) {
    return null;
  }

  let path: { latitude: number; longitude: number }[] = [];
  try {
    const pathStr = getParam(params.path);
    if (pathStr) path = JSON.parse(pathStr);
  } catch {
    // ignore parse error
  }

  return {
    pickup: { latitude: pickupLat, longitude: pickupLng },
    dropoff: { latitude: dropLat, longitude: dropLng },
    distance,
    duration,
    fare,
    option: {
      label: parseStringParam(params.rideLabel),
      description: parseStringParam(params.rideDescription),
      baseFare: 0,
      perKm: 0,
      perMin: 0,
    },
    path,
  };
}
