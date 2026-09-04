import * as Location from "expo-location";
import { create } from "zustand";
import type {
  Coordinates,
  RideEstimate,
  RideOption,
  SelectedLocation,
} from "../components/home/types";
import { rideOptions } from "../components/ride/ride-config";

// Idempotency guard so the permission/GPS chain runs exactly once per app
// launch no matter how many effects request it (root layout + home screen).
let locationBootstrapStarted = false;

export type PassengerMode = "self" | "other";

export type Passenger = {
  name: string;
  phone: string;
};

interface HomeState {
  // Device GPS — deliberately distinct from a chosen pickup. The ride uses the
  // selected pickup, never this value directly once a pickup has been chosen.
  location: Coordinates | null;
  permissionDenied: boolean;
  loadingLocation: boolean;
  isRefreshingLocation: boolean;

  sheetIndex: number;
  setSheetIndex: (index: number) => void;

  // First-class, independently selectable endpoints.
  pickup: SelectedLocation | null;
  destination: SelectedLocation | null;
  setPickup: (pickup: SelectedLocation | null) => void;
  setDestination: (destination: SelectedLocation | null) => void;

  // Route / fare estimate derived once both endpoints are valid.
  estimate: RideEstimate | null;
  loadingEstimate: boolean;
  setEstimate: (estimate: RideEstimate | null) => void;
  setLoadingEstimate: (loading: boolean) => void;

  selectedOption: RideOption;
  setSelectedOption: (option: RideOption) => void;

  // "Book for someone else" support.
  passengerMode: PassengerMode;
  passenger: Passenger | null;
  setPassengerMode: (mode: PassengerMode) => void;
  setPassenger: (passenger: Passenger | null) => void;

  // Location bootstrap (GPS only).
  setLocation: (location: Coordinates | null) => void;
  setPermissionDenied: (denied: boolean) => void;
  setLoadingLocation: (loading: boolean) => void;
  setIsRefreshingLocation: (refreshing: boolean) => void;
  bootstrapLocation: () => Promise<void>;

  // Invalidate the active route/estimate (e.g. when an endpoint changes).
  clearEstimate: () => void;
  clearDestination: () => void;
  resetSelection: () => void;
}

export const useHomeStore = create<HomeState>((set, get) => ({
  location: null,
  permissionDenied: false,
  loadingLocation: true,
  isRefreshingLocation: false,

  sheetIndex: 0,
  setSheetIndex: (index) => set({ sheetIndex: index }),

  pickup: null,
  destination: null,
  setPickup: (pickup) => {
    const prev = get().pickup;
    // Changing the pickup invalidates any prior route/estimate.
    if (!prev || prev.coordinates.latitude !== pickup?.coordinates.latitude || prev.coordinates.longitude !== pickup?.coordinates.longitude) {
      set({ pickup, estimate: null });
    } else {
      set({ pickup });
    }
  },
  setDestination: (destination) => {
    const prev = get().destination;
    if (
      !prev ||
      prev.coordinates.latitude !== destination?.coordinates.latitude ||
      prev.coordinates.longitude !== destination?.coordinates.longitude
    ) {
      set({ destination, estimate: null });
    } else {
      set({ destination });
    }
  },

  estimate: null,
  loadingEstimate: false,
  setEstimate: (estimate) => set({ estimate }),
  setLoadingEstimate: (loading) => set({ loadingEstimate: loading }),

  selectedOption: rideOptions[0],
  setSelectedOption: (option) => set({ selectedOption: option }),

  passengerMode: "self",
  passenger: null,
  setPassengerMode: (mode) => set({ passengerMode: mode, passenger: mode === "self" ? null : get().passenger }),
  setPassenger: (passenger) => set({ passenger }),

  setLocation: (location) => set({ location }),
  setPermissionDenied: (denied) => set({ permissionDenied: denied }),
  setLoadingLocation: (loading) => set({ loadingLocation: loading }),
  setIsRefreshingLocation: (refreshing) => set({ isRefreshingLocation: refreshing }),

  bootstrapLocation: async () => {
    if (locationBootstrapStarted) return;
    locationBootstrapStarted = true;

    const { setLocation, setPermissionDenied, setLoadingLocation, setIsRefreshingLocation } = get();

    setLoadingLocation(true);
    setIsRefreshingLocation(false);

    const timeoutId = setTimeout(() => {
      setLoadingLocation(false);
      setIsRefreshingLocation(false);
    }, 10000);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setPermissionDenied(true);
        return;
      }

      let current = await Location.getLastKnownPositionAsync({});
      if (!current) {
        current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
      }

      setPermissionDenied(false);
      setLocation({
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      });
    } catch {
      setPermissionDenied(true);
    } finally {
      clearTimeout(timeoutId);
      setLoadingLocation(false);
      setIsRefreshingLocation(false);
    }
  },

  clearEstimate: () => set({ estimate: null }),
  clearDestination: () => set({ destination: null, estimate: null }),
  resetSelection: () => set({ pickup: null, destination: null, estimate: null }),
}));
