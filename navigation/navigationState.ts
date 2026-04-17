import { create } from "zustand";
import type { Coordinates } from "../components/home/types";

export type NavigationState =
  | "IDLE"
  | "TO_PICKUP"
  | "ARRIVED_PICKUP"
  | "TO_DROPOFF"
  | "TRIP_COMPLETED";

export interface Maneuver {
  type: "turn" | "depart" | "arrive" | "merge" | "fork" | "end of road" | "continue" | "roundabout";
  modifier?: "left" | "right" | "slight left" | "slight right" | "sharp left" | "sharp right" | "uturn";
  instruction: string;
  distance: number;
  street: string;
  coordinate: Coordinates;
}

export interface RouteData {
  path: Coordinates[];
  maneuvers: Maneuver[];
  distance: number;
  duration: number;
}

export interface NavigationStore {
  state: NavigationState;
  pickup: Coordinates | null;
  dropoff: Coordinates | null;
  driverLocation: Coordinates | null;
  route: RouteData | null;
  currentManeuverIndex: number;
  eta: number | null;
  distanceRemaining: number;
  isNavigating: boolean;
  isRerouting: boolean;
  
  initializeNavigation: (pickup: Coordinates, dropoff: Coordinates) => void;
  startNavigation: () => void;
  setDriverLocation: (location: Coordinates) => void;
  setRoute: (route: RouteData) => void;
  advanceManeuver: () => void;
  setArrivedPickup: () => void;
  completeTrip: () => void;
  reset: () => void;
  setRerouting: (isRerouting: boolean) => void;
}

export const useNavigationStore = create<NavigationStore>((set, get) => ({
  state: "IDLE",
  pickup: null,
  dropoff: null,
  driverLocation: null,
  route: null,
  currentManeuverIndex: 0,
  eta: null,
  distanceRemaining: 0,
  isNavigating: false,
  isRerouting: false,

  initializeNavigation: (pickup, dropoff) => {
    set({
      state: "TO_PICKUP",
      pickup,
      dropoff,
      currentManeuverIndex: 0,
      isNavigating: true,
    });
  },

  startNavigation: () => {
    set({ isNavigating: true });
  },

  setDriverLocation: (location) => {
    const { route, state } = get();
    if (!route) {
      set({ driverLocation: location });
      return;
    }

    const currentManeuver = route.maneuvers[get().currentManeuverIndex];
    if (currentManeuver) {
      const distanceToManeuver = calculateDistance(location, currentManeuver.coordinate);
      if (distanceToManeuver < 30) {
        get().advanceManeuver();
      }
    }

    set({ driverLocation: location });
  },

  setRoute: (route) => {
    set({
      route,
      distanceRemaining: route.distance,
      eta: Date.now() + route.duration * 1000,
    });
  },

  advanceManeuver: () => {
    const { route, currentManeuverIndex, distanceRemaining } = get();
    if (!route) return;

    const nextIndex = currentManeuverIndex + 1;
    if (nextIndex >= route.maneuvers.length) {
      if (get().state === "TO_PICKUP") {
        set({ currentManeuverIndex: nextIndex, state: "ARRIVED_PICKUP" });
      } else if (get().state === "TO_DROPOFF") {
        set({ currentManeuverIndex: nextIndex, state: "TRIP_COMPLETED", isNavigating: false });
      }
      return;
    }

    const nextManeuver = route.maneuvers[nextIndex];
    set({
      currentManeuverIndex: nextIndex,
      distanceRemaining: distanceRemaining - nextManeuver.distance,
    });
  },

  setArrivedPickup: () => {
    const { dropoff } = get();
    if (dropoff) {
      set({ state: "TO_DROPOFF", currentManeuverIndex: 0 });
    }
  },

  completeTrip: () => {
    set({ state: "TRIP_COMPLETED", isNavigating: false });
  },

  reset: () => {
    set({
      state: "IDLE",
      pickup: null,
      dropoff: null,
      driverLocation: null,
      route: null,
      currentManeuverIndex: 0,
      eta: null,
      distanceRemaining: 0,
      isNavigating: false,
      isRerouting: false,
    });
  },

  setRerouting: (isRerouting) => {
    set({ isRerouting });
  },
}));

function calculateDistance(from: Coordinates, to: Coordinates): number {
  const R = 6371e3;
  const φ1 = (from.latitude * Math.PI) / 180;
  const φ2 = (to.latitude * Math.PI) / 180;
  const Δφ = ((to.latitude - from.latitude) * Math.PI) / 180;
  const Δλ = ((to.longitude - from.longitude) * Math.PI) / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}