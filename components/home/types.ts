export type Coordinates = {
  latitude: number;
  longitude: number;
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
};
