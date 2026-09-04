export type Coordinate = {
  latitude: number;
  longitude: number;
};

export type OsrmManeuver = {
  type: string;
  modifier?: string;
  location: [number, number];
  bearing_before?: number;
  bearing_after?: number;
  exit?: number;
};

export type OsrmStep = {
  distance: number;
  duration: number;
  geometry?: { type: 'LineString'; coordinates: [number, number][] } | null;
  name: string;
  ref?: string;
  destinations?: string;
  exit?: string;
  maneuver: OsrmManeuver;
  instruction?: string;
};

export type OsrmLeg = {
  distance?: number;
  duration?: number;
  steps?: OsrmStep[];
};

export type OsrmRoute = {
  distance: number;
  duration: number;
  geometry?: { type: 'LineString'; coordinates: [number, number][] } | null;
  legs?: OsrmLeg[];
};

export type OsrmResponse = {
  code?: string;
  routes?: OsrmRoute[];
};

export type ManeuverIcon = {
  name: 'arrow-up' | 'arrow-redo-circle-outline' | 'location';
  rotation: number;
};

export type ManeuverInstruction = {
  primary: string;
  roadName: string | null;
  icon: ManeuverIcon;
  connector?: 'onto' | 'on' | null;
};

export type NavStep = {
  index: number;
  distance: number;
  duration: number;
  name: string;
  geometry: Coordinate[];
  maneuverLocation: Coordinate;
  maneuver: OsrmManeuver & { coordinate: Coordinate };
  instruction: ManeuverInstruction;
};

export type FlattenedRoute = {
  coords: Coordinate[];
  cumM: number[];
  stepOfPoint: number[];
  stepEndCum: number[];
  totalM: number;
};

export type NavRoute = {
  origin: Coordinate;
  destination: Coordinate;
  distanceM: number;
  durationS: number;
  geometry: Coordinate[];
  steps: NavStep[];
  flattened: FlattenedRoute;
  fetchedAt: number;
};