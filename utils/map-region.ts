import type { Coordinates } from "../components/home/types";

export function buildMapRegion(pickup: Coordinates, dropoff?: Coordinates | null) {
  if (!dropoff) {
    return {
      latitude: pickup.latitude,
      longitude: pickup.longitude,
      latitudeDelta: 0.045,
      longitudeDelta: 0.045,
    };
  }

  return {
    latitude: (pickup.latitude + dropoff.latitude) / 2,
    longitude: (pickup.longitude + dropoff.longitude) / 2,
    latitudeDelta: Math.max(Math.abs(pickup.latitude - dropoff.latitude) * 1.4, 0.045),
    longitudeDelta: Math.max(Math.abs(pickup.longitude - dropoff.longitude) * 1.4, 0.045),
  };
}

export function buildMapEdgePadding(bottom = 320) {
  return {
    top: 120,
    right: 72,
    bottom,
    left: 72,
  };
}
