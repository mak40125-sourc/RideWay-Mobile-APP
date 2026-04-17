import type { Coordinates, RideEstimate } from "../components/home/types";

const OSRM_BASE_URL = "https://router.project-osrm.org";

type OsrmRouteResponse = {
  routes?: Array<{
    distance: number;
    duration: number;
    geometry?: {
      coordinates?: [number, number][];
    };
  }>;
};

export async function getRouteEstimate(pickup: Coordinates, dropoff: Coordinates): Promise<RideEstimate | null> {
  const response = await fetch(
    `${OSRM_BASE_URL}/route/v1/driving/${pickup.longitude},${pickup.latitude};${dropoff.longitude},${dropoff.latitude}?overview=full&geometries=geojson`
  );

  if (!response.ok) {
    throw new Error(`OSRM request failed with ${response.status}`);
  }

  const data = (await response.json()) as OsrmRouteResponse;
  const route = data.routes?.[0];

  if (!route) {
    return null;
  }

  const path =
    route.geometry?.coordinates?.map(([longitude, latitude]) => ({
      latitude,
      longitude,
    })) ?? [pickup, dropoff];

  return {
    distance: Number((route.distance / 1000).toFixed(1)),
    duration: Math.max(1, Math.round(route.duration / 60)),
    path,
  };
}
