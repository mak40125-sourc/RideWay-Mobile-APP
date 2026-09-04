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
  pickup_location: Location | null;
  drop_location: Location | null;
  pickup_address: string | null;
  drop_address: string | null;
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
  /**
   * When the ride is booked on behalf of someone else, these describe the actual
   * passenger. Null/empty for a normal ride where the rider is also the passenger.
   */
  passengerName?: string | null;
  passengerPhone?: string | null;
  /**
   * Epoch ms at which the backend offer expires (ride:request Redis TTL).
   * Null when the connected backend predates the field; the UI falls back to
   * a local window instead of displaying a fabricated deadline.
   */
  expiresAt?: number | null;
}
