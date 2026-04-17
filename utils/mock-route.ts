import type { Coordinates } from "../components/home/types";

export function buildMockRoutePath(pickup: Coordinates, dropoff?: Coordinates | null, steps = 24) {
  if (!dropoff) {
    return [pickup];
  }

  return Array.from({ length: steps + 1 }, (_, index) => {
    const progress = index / steps;
    const arcOffset = Math.sin(progress * Math.PI) * 0.01;

    return {
      latitude: pickup.latitude + (dropoff.latitude - pickup.latitude) * progress + arcOffset,
      longitude: pickup.longitude + (dropoff.longitude - pickup.longitude) * progress,
    };
  });
}
