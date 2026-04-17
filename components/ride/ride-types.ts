import type { Coordinates, RideOption } from "../home/types";

export type RideRouteParams = {
  pickupLat?: string | string[];
  pickupLng?: string | string[];
  dropLat?: string | string[];
  dropLng?: string | string[];
};

export type ParsedRideRoute = {
  pickup: Coordinates;
  dropoff: Coordinates;
};

export type SelectedRide = {
  option: RideOption;
  fare: number;
  distance: number;
  duration: number;
  path: Coordinates[];
  pickup: Coordinates;
  dropoff: Coordinates;
};
