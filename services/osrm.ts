import type { Coordinates, RideEstimate } from "../components/home/types";
import { getOsrmBaseUrl, getCachedEnvironment } from "../constants/environment";
import { api } from "./api";

type OsrmRouteResponse = {
  routes?: Array<{
    distance: number;
    duration: number;
    geometry?: {
      coordinates?: [number, number][];
    };
  }>;
};

type BackendRouteResponse = {
  distanceKm: number;
  durationMin: number;
  path: Coordinates[];
  source: string;
};

const CLIENT_TIMEOUT_MS = 10000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId)) as Promise<T>;
}

export async function getRouteEstimate(pickup: Coordinates, dropoff: Coordinates): Promise<RideEstimate | null> {
  const env = getCachedEnvironment();

  // LIGHTSAIL: route through existing Lightsail backend which proxies to PC OSRM via Tailscale.
  // Uses existing api helper (auth + base URL via environment) - no hardcoded IP.
  if (env === "LIGHTSAIL") {
    const data = await withTimeout(
      api.post<BackendRouteResponse>("/rides/route", { pickup, dropoff }),
      CLIENT_TIMEOUT_MS,
      "Route proxy"
    );
    if (!data || typeof data.distanceKm !== "number" || typeof data.durationMin !== "number") {
      return null;
    }
    const path: Coordinates[] =
      Array.isArray(data.path) && data.path.length
        ? data.path
        : [pickup, dropoff];
    return {
      distance: Number(Number(data.distanceKm).toFixed(1)),
      duration: Math.max(1, Math.round(data.durationMin)),
      path,
    };
  }

  // LOCAL: direct OSRM with client-side timeout so loadingEstimate never hangs forever.
  const osrmBaseUrl = getOsrmBaseUrl(env);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);
  try {
    const response = await fetch(
      `${osrmBaseUrl}/route/v1/driving/${pickup.longitude},${pickup.latitude};${dropoff.longitude},${dropoff.latitude}?overview=full&geometries=geojson`,
      { signal: controller.signal }
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
  } finally {
    clearTimeout(timeout);
  }
}
