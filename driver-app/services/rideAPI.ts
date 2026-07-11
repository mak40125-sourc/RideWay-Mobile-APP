import { supabase } from '../lib/supabase';
import type { Ride, RideRequest } from '../types/ride';

export const rideAPI = {
  acceptRide: async (rideId: string, driverId: string) => {
    return supabase
      .from('rides')
      .update({ driver_id: driverId, status: 'ACCEPTED' })
      .eq('id', rideId);
  },

  updateRideStatus: async (rideId: string, status: string) => {
    return supabase
      .from('rides')
      .update({ status })
      .eq('id', rideId);
  },

  getRideDetails: async (rideId: string): Promise<Ride | null> => {
    const { data } = await supabase
      .from('rides')
      .select('*')
      .eq('id', rideId)
      .single();
    return data;
  },

  subscribeToRideRequests: (callback: (request: RideRequest) => void) => {
    return supabase
      .channel('ride-requests')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ride_requests' },
        (payload) => {
          callback(payload.new as RideRequest);
        }
      )
      .subscribe();
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
          callback(payload.new as Ride);
        }
      )
      .subscribe();
  },
};
