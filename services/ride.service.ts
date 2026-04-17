import type { Coordinates } from "../components/home/types";
import { api } from "../services/api";

export type RideRequestPayload = {
  riderId: string;
  pickup: Coordinates;
  dropoff: Coordinates;
  fare: number;
  distance: number;
  duration: number;
  vehicleType: string;
};

export type Ride = {
  id: string;
  rider_id: string;
  driver_id: string | null;
  pickup_location: { coordinates: [number, number] };
  drop_location: { coordinates: [number, number] };
  pickup_address: string | null;
  drop_address: string | null;
  fare: number;
  distance: number;
  duration: number;
  status: string;
  created_at: string;
  updated_at: string;
};

export type RideRequestResult = {
  ride: Ride;
  candidateCount: number;
};

export async function requestRide(payload: RideRequestPayload): Promise<RideRequestResult> {
  return api.post<RideRequestResult>("/rides/request", payload);
}

export async function getRide(rideId: string): Promise<Ride> {
  return api.get<Ride>(`/rides/${rideId}`);
}

export async function completeRide(rideId: string): Promise<Ride> {
  return api.post<Ride>(`/rides/${rideId}/complete`, {});
}

export async function cancelRide(rideId: string): Promise<Ride> {
  return api.post<Ride>(`/rides/${rideId}/cancel`, {});
}

export async function getRiderActiveRide(riderId: string): Promise<Ride | null> {
  return api.get<Ride | null>(`/rides/rider/${riderId}/active`);
}
