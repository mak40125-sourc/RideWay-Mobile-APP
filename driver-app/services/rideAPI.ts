import { api } from './api';
import { supabase } from '../lib/supabase';
import type { Location, Ride, RideStatus } from '../types/ride';

// PostgREST serializes PostGIS geography/geometry columns as EWKB hex.
// 2D Point with SRID (25 bytes, little-endian):
//   byteOrder(1) | type(4) | srid(4) | x(8) | y(8)
// WKT order is POINT(longitude latitude), so x = longitude, y = latitude.
function decodeEwkbPoint(hex: string): Location | null {
  if (typeof hex !== 'string' || !/^[0-9a-fA-F]+$/.test(hex)) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  if (bytes.length !== 25 || bytes[0] !== 1) return null; // little-endian only
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.length);
  if (view.getUint32(1, true) !== 0x20000001) return null; // Point + SRID-present flag
  if (view.getUint32(5, true) !== 4326) return null;        // this app is always SRID 4326
  return { latitude: view.getFloat64(17, true), longitude: view.getFloat64(9, true) };
}

function transformRide(raw: any): Ride {
  const coords = (loc: any, address?: string | null): Location | null => {
    const withAddress = (point: Location): Location =>
      address ? { ...point, address } : point;
    if (typeof loc === 'string') {
      const point = decodeEwkbPoint(loc);
      return point ? withAddress(point) : null;
    }
    if (loc?.coordinates?.[1] != null && loc?.coordinates?.[0] != null) {
      return withAddress({ latitude: loc.coordinates[1], longitude: loc.coordinates[0] });
    }
    if (loc?.latitude != null && loc?.longitude != null) {
      return withAddress({ latitude: loc.latitude, longitude: loc.longitude });
    }
    return null; // explicit invalid/missing — caller must handle, never {0,0}
  };

  return {
    id: raw.id,
    rider_id: raw.rider_id,
    driver_id: raw.driver_id ?? null,
    status: raw.status as RideStatus,
    pickup_location: coords(raw.pickup_location, raw.pickup_address),
    drop_location: coords(raw.drop_location, raw.drop_address),
    pickup_address: raw.pickup_address ?? null,
    drop_address: raw.drop_address ?? null,
    fare: Number(raw.fare),
    distance: Number(raw.distance),
    duration: Number(raw.duration),
    created_at: raw.created_at,
    updated_at: raw.updated_at,
  };
}

export const rideAPI = {
  acceptRide: async (rideId: string): Promise<Ride> => {
    const raw = await api.post<any>(`/rides/${rideId}/accept`, {});
    return transformRide(raw);
  },

  updateRideStatus: async (rideId: string, status: string): Promise<Ride> => {
    const raw = await api.put<any>(`/rides/${rideId}/status`, { status });
    return transformRide(raw);
  },

  getRideDetails: async (rideId: string): Promise<Ride | null> => {
    try {
      const raw = await api.get<any>(`/rides/${rideId}`);
      return transformRide(raw);
    } catch (err: any) {
      if (err?.status === 404) return null;
      throw err;
    }
  },

  subscribeToRideUpdates: (rideId: string, callback: (ride: Ride) => void) => {
    return supabase
      .channel(`ride-${rideId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rides',
          filter: `id=eq.${rideId}`,
        },
        (payload) => {
          callback(transformRide(payload.new));
        }
      )
      .subscribe();
  },
};
