import { create } from "zustand";
import type { Coordinates, RideEstimate, RideOption, SearchResult } from "../components/home/types";
import { rideOptions } from "../components/ride/ride-config";

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
  resetDestination: () => void;
}

export const useHomeStore = create<HomeState>((set) => ({
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
  resetDestination: () => set({ selectedDestination: null, estimate: null, query: "" }),
}));
