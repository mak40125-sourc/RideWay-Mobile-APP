export type RideStatus =
  | 'REQUESTED'
  | 'DRIVER_ASSIGNED'
  | 'DRIVER_ARRIVING'
  | 'RIDE_STARTED'
  | 'RIDE_COMPLETED'
  | 'CANCELLED';

export interface Location {
  latitude: number;
  longitude: number;
  address?: string;
}

export interface Ride {
  id: string;
  rider_id: string;
  driver_id: string | null;
  status: RideStatus;
  pickup_location: Location;
  drop_location: Location;
  fare: number;
  distance: number;
  duration: number;
  created_at: string;
  updated_at: string;
}

export interface RideRequest {
  rideId: string;
  pickup: { lat: number; lng: number; address: string };
  dropoff: { lat: number; lng: number; address: string };
  fare: number;
  distance: number;
  duration: number;
  riderName: string;
}
