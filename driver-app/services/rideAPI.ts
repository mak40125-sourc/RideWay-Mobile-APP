import { api } from './api';
import { supabase } from '../lib/supabase';
import type { Ride, RideStatus } from '../types/ride';

function transformRide(raw: any): Ride {
  const coords = (loc: any) => ({
    latitude: loc?.coordinates?.[1] ?? loc?.latitude ?? 0,
    longitude: loc?.coordinates?.[0] ?? loc?.longitude ?? 0,
  });

  return {
    id: raw.id,
    rider_id: raw.rider_id,
    driver_id: raw.driver_id ?? null,
    status: raw.status as RideStatus,
    pickup_location: coords(raw.pickup_location),
    drop_location: coords(raw.drop_location),
    fare: Number(raw.fare),
    distance: Number(raw.distance),
    duration: Number(raw.duration),
    created_at: raw.created_at,
    updated_at: raw.updated_at,
  };
}

export const rideAPI = {
  acceptRide: async (rideId: string): Promise<Ride> => {
    const raw = await api.post<any>(`/rides/${rideId}/accept`);
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
    } catch {
      return null;
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
