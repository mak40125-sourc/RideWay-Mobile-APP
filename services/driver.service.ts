import type { Coordinates } from "../components/home/types";
import { api } from "../services/api";

export type DriverLocationUpdate = {
  driverId: string;
  location: Coordinates;
};

export type NearbyDriver = {
  user_id: string;
  vehicle_type: string;
  vehicle_number: string;
  distance: number;
};

export async function updateDriverLocation({ location }: DriverLocationUpdate) {
  return api.put("/drivers/location", { location });
}

export async function goOnline(driverId: string): Promise<void> {
  return api.put("/drivers/online", { driverId, isOnline: true });
}

export async function goOffline(driverId: string): Promise<void> {
  return api.put("/drivers/offline", { driverId, isOnline: false });
}

export async function getNearbyDrivers(lat: number, lng: number, radius = 3000): Promise<NearbyDriver[]> {
  return api.get<NearbyDriver[]>(`/drivers/nearby?lat=${lat}&lng=${lng}&radius=${radius}`);
}
