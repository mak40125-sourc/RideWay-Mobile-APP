import * as Location from "expo-location";
import { create } from "zustand";
import type { Coordinates, RideEstimate, RideOption, SearchResult } from "../components/home/types";
import { rideOptions } from "../components/ride/ride-config";

// Idempotency guard so the permission/GPS chain runs exactly once per app
// launch no matter how many effects request it (root layout + home screen).
let locationBootstrapStarted = false;

interface HomeState {
  sheetIndex: number;
  setSheetIndex: (index: number) => void;

  location: Coordinates | null;
  permissionDenied: boolean;
  loadingLocation: boolean;
  isRefreshingLocation: boolean;

  query: string;
  results: SearchResult[];
  isSearching: boolean;

  selectedDestination: SearchResult | null;

  estimate: RideEstimate | null;
  loadingEstimate: boolean;

  selectedOption: RideOption;

  searchMode: "destination" | "pickup";
  pickupQuery: string;
  pickupResults: SearchResult[];
  isSearchingPickup: boolean;
  selectedPickup: SearchResult | null;

  setLocation: (location: Coordinates | null) => void;
  setPermissionDenied: (denied: boolean) => void;
  setLoadingLocation: (loading: boolean) => void;
  setIsRefreshingLocation: (refreshing: boolean) => void;
  setQuery: (query: string) => void;
  setResults: (results: SearchResult[]) => void;
  setIsSearching: (searching: boolean) => void;
  setSelectedDestination: (dest: SearchResult | null) => void;
  setEstimate: (estimate: RideEstimate | null) => void;
  setLoadingEstimate: (loading: boolean) => void;
  setSelectedOption: (option: RideOption) => void;
  bootstrapLocation: () => Promise<void>;
  resetDestination: () => void;
  setSearchMode: (mode: "destination" | "pickup") => void;
  setPickupQuery: (query: string) => void;
  setPickupResults: (results: SearchResult[]) => void;
  setIsSearchingPickup: (searching: boolean) => void;
  setSelectedPickup: (pickup: SearchResult | null) => void;
}

export const useHomeStore = create<HomeState>((set, get) => ({
  sheetIndex: 0,
  setSheetIndex: (index) => set({ sheetIndex: index }),

  location: null,
  permissionDenied: false,
  loadingLocation: true,
  isRefreshingLocation: false,

  query: "",
  results: [],
  isSearching: false,

  selectedDestination: null,

  estimate: null,
  loadingEstimate: false,

  selectedOption: rideOptions[0],

  searchMode: "destination",
  pickupQuery: "",
  pickupResults: [],
  isSearchingPickup: false,
  selectedPickup: null,

  setLocation: (location) => set({ location }),
  setPermissionDenied: (denied) => set({ permissionDenied: denied }),
  setLoadingLocation: (loading) => set({ loadingLocation: loading }),
  setIsRefreshingLocation: (refreshing) => set({ isRefreshingLocation: refreshing }),
  setQuery: (query) => set({ query }),
  setResults: (results) => set({ results }),
  setIsSearching: (searching) => set({ isSearching: searching }),
  setSelectedDestination: (dest) => set({ selectedDestination: dest }),
  setEstimate: (estimate) => set({ estimate }),
  setLoadingEstimate: (loading) => set({ loadingEstimate: loading }),
  setSelectedOption: (option) => set({ selectedOption: option }),

  // Extracted verbatim from the rider home screen's mount-time loader so the
  // permission + GPS chain can start while auth restoration is still in
  // flight, instead of serializing behind it. Runs at most once per launch.
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

  resetDestination: () => set({ selectedDestination: null, estimate: null, query: "" }),
  setSearchMode: (mode) => set({ searchMode: mode }),
  setPickupQuery: (query) => set({ pickupQuery: query }),
  setPickupResults: (results) => set({ pickupResults: results }),
  setIsSearchingPickup: (searching) => set({ isSearchingPickup: searching }),
  setSelectedPickup: (pickup) => set({ selectedPickup: pickup }),
}));
