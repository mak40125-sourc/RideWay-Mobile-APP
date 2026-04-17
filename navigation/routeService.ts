import type { Coordinates } from "../components/home/types";
import type { RouteData, Maneuver } from "./navigationState";

const VALHALLA_BASE_URL = "https://valhalla1.openstreetmap.de";

export async function fetchRoute(
  pickup: Coordinates,
  dropoff: Coordinates
): Promise<RouteData | null> {
  try {
    const response = await fetch(`${VALHALLA_BASE_URL}/route`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        locations: [
          { lat: pickup.latitude, lon: pickup.longitude },
          { lat: dropoff.latitude, lon: dropoff.longitude },
        ],
        costing: "auto",
        directions_options: {
          units: "km",
        },
      }),
    });

    if (!response.ok) {
      console.error("Route request failed:", response.status);
      return fallbackRoute(pickup, dropoff);
    }

    const data = await response.json();
    const route = data.route?.[0];

    if (!route) {
      return fallbackRoute(pickup, dropoff);
    }

    return parseRouteGeometry(route, pickup, dropoff);
  } catch (error) {
    console.error("Route fetch error:", error);
    return fallbackRoute(pickup, dropoff);
  }
}

export async function fetchAlternateRoutes(
  pickup: Coordinates,
  dropoff: Coordinates
): Promise<RouteData[]> {
  const routes: RouteData[] = [];

  try {
    const response = await fetch(`${VALHALLA_BASE_URL}/route`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        locations: [
          { lat: pickup.latitude, lon: pickup.longitude },
          { lat: dropoff.latitude, lon: dropoff.longitude },
        ],
        costing: "auto",
        directions_options: {
          units: "km",
        },
        alternate_paths: true,
      }),
    });

    if (!response.ok) {
      return routes;
    }

    const data = await response.json();
    const alternates = data.alternates || [];
    
    for (const alt of alternates.slice(0, 2)) {
      const parsed = parseRouteGeometry(alt, pickup, dropoff);
      if (parsed) {
        routes.push(parsed);
      }
    }
  } catch (error) {
    console.error("Alternate routes error:", error);
  }

  return routes;
}

export async function reroute(
  driverLocation: Coordinates,
  destination: Coordinates
): Promise<RouteData | null> {
  return fetchRoute(driverLocation, destination);
}

const FALLBACK_WAYPOINTS = 10;

function fallbackRoute(pickup: Coordinates, dropoff: Coordinates): RouteData {
  const path: Coordinates[] = [];
  const steps = FALLBACK_WAYPOINTS - 1;

  for (let i = 0; i < FALLBACK_WAYPOINTS; i++) {
    const t = i / steps;
    path.push({
      latitude: pickup.latitude + (dropoff.latitude - pickup.latitude) * t,
      longitude: pickup.longitude + (dropoff.longitude - pickup.longitude) * t,
    });
  }

  const totalDistance = calculateHaversineDistance(pickup, dropoff);
  const avgSpeed = 30 / 3.6;
  const duration = totalDistance / avgSpeed;

  const maneuvers: Maneuver[] = [
    {
      type: "depart",
      instruction: "Head towards destination",
      distance: totalDistance * 0.7,
      street: "",
      coordinate: path[Math.floor(path.length * 0.3)],
    },
    {
      type: "continue",
      instruction: `Continue for ${Math.round(totalDistance * 0.5)} km`,
      distance: totalDistance * 0.5,
      street: "",
      coordinate: path[Math.floor(path.length * 0.6)],
    },
    {
      type: "arrive",
      instruction: "You have arrived",
      distance: 0,
      street: "",
      coordinate: dropoff,
    },
  ];

  return {
    path,
    maneuvers,
    distance: totalDistance,
    duration: Math.round(duration / 60),
  };
}

function calculateHaversineDistance(from: Coordinates, to: Coordinates): number {
  const R = 6371;
  const φ1 = (from.latitude * Math.PI) / 180;
  const φ2 = (to.latitude * Math.PI) / 180;
  const Δφ = ((to.latitude - from.latitude) * Math.PI) / 180;
  const Δλ = ((to.longitude - from.longitude) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function parseRouteGeometry(
  route: any,
  pickup: Coordinates,
  dropoff: Coordinates
): RouteData | null {
  try {
    const shape = route.shape || [];
    const maneuvers = route.legs?.[0]?.maneuvers || [];

    if (shape.length === 0) {
      return fallbackRoute(pickup, dropoff);
    }

    const path: Coordinates[] = shape.map((point: any) => ({
      latitude: point[0],
      longitude: point[1],
    }));

    const parsedManeuvers: Maneuver[] = [];

    for (const m of maneuvers) {
      const typeMap: Record<string, Maneuver["type"]> = {
        depart: "depart",
        arrive: "arrive",
        turn: "turn",
        merge: "merge",
        fork: "fork",
        "end of road": "end of road",
        continue: "continue",
        roundabout: "roundabout",
      };

      const modifierMap: Record<string, Maneuver["modifier"]> = {
        left: "left",
        right: "right",
        "slight left": "slight left",
        "slight right": "slight right",
        "sharp left": "sharp left",
        "sharp right": "sharp right",
        uturn: "uturn",
      };

      const instruction = buildInstruction(m);

      const maneuverIndex = m.begin_path_index || 0;
      const coordinate = path[Math.min(maneuverIndex, path.length - 1)] || dropoff;

      parsedManeuvers.push({
        type: typeMap[m.type] || "continue",
        modifier: modifierMap[m.modifier],
        instruction,
        distance: m.distance || 0,
        street: m.street?.name || m.street || "",
        coordinate,
      });
    }

    if (parsedManeuvers.length === 0) {
      return fallbackRoute(pickup, dropoff);
    }

    const totalDistance = route.summary?.length || route.summary?.distance || 0;
    const totalDuration = route.summary?.time || route.summary?.duration || 0;

    return {
      path,
      maneuvers: parsedManeuvers,
      distance: totalDistance,
      duration: Math.round(totalDuration / 60),
    };
  } catch (error) {
    console.error("Parse route error:", error);
    return fallbackRoute(pickup, dropoff);
  }
}

function buildInstruction(maneuver: any): string {
  const type = maneuver.type || "";
  const modifier = maneuver.modifier || "";
  const street = maneuver.street?.name || "";
  const distance = Math.round(maneuver.distance || 0);

  if (type === "arrive") {
    return "You have arrived";
  }

  if (type === "depart") {
    return "Start navigation";
  }

  if (type === "turn") {
    return `${modifier} turn onto ${street || "road"}`;
  }

  if (type === "continue") {
    return `Continue on ${street || "road"} for ${distance}m`;
  }

  if (type === "roundabout") {
    return `Take exit ${maneuver.exit_number || 1} on roundabout`;
  }

  if (type === "fork") {
    return `${modifier} fork onto ${street || "road"}`;
  }

  if (type === "merge") {
    return `Merge onto ${street || "road"}`;
  }

  if (type === "end of road") {
    return `${modifier} turn onto ${street || "road"}`;
  }

  return type;
}