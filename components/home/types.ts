export type Coordinates = {
  latitude: number;
  longitude: number;
};

// How a location was chosen. Drives UX + backend diagnostics and keeps the
// ride's authoritative origin independent from the device's live GPS fix.
export type LocationSource = "gps" | "search" | "map";

// A first-class, selectable location. Both pickup and destination are modeled
// with this shape so the map/search/GPS selection flows share one contract.
export type SelectedLocation = {
  coordinates: Coordinates;
  address: string | null;
  source: LocationSource;
};

export type SearchResult = {
  geometry?: {
    coordinates?: [number, number];
  };
  properties?: {
    name?: string;
    city?: string;
    state?: string;
    country?: string;
  };
};

export type RideEstimate = {
  distance: number;
  duration: number;
  path: Coordinates[];
};

export type RideOption = {
  label: string;
  description: string;
  baseFare: number;
  perKm: number;
  perMin: number;
  vehicleType: string;
};
