export type RideStatus = 
  | 'PENDING'
  | 'ACCEPTED'
  | 'ARRIVED'
  | 'STARTED'
  | 'COMPLETED'
  | 'CANCELLED';

export interface Location {
  latitude: number;
  longitude: number;
  address?: string;
}

export interface Ride {
  id: string;
  rider_id: string;
  driver_id: string;
  status: RideStatus;
  pickup_location: Location;
  drop_location: Location;
  estimated_fare: number;
  actual_fare?: number;
  distance_km?: number;
  duration_minutes?: number;
  rider_name?: string;
  rider_phone?: string;
  rider_rating?: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

export interface RideRequest {
  id: string;
  pickup: Location;
  drop: Location;
  estimated_fare: number;
  distance_km: number;
  rider_name: string;
  rider_rating: number;
  expires_at: number;
}