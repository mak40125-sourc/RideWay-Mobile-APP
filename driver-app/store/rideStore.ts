import { create } from 'zustand';
import type { Ride, RideRequest, RideStatus } from '../types/ride';

interface RideState {
  current_ride: Ride | null;
  current_request: RideRequest | null;
  request_timeout: number | null;
  
  setCurrentRide: (ride: Ride | null) => void;
  setCurrentRequest: (request: RideRequest | null) => void;
  setRequestTimeout: (timeout: number | null) => void;
  updateRideStatus: (status: RideStatus) => void;
  clearRide: () => void;
}

export const useRideStore = create<RideState>()((set) => ({
  current_ride: null,
  current_request: null,
  request_timeout: null,

  setCurrentRide: (ride) => set({ current_ride: ride }),
  setCurrentRequest: (request) => set({ current_request: request }),
  setRequestTimeout: (timeout) => set({ request_timeout: timeout }),
  updateRideStatus: (status) => set((state) => ({
    current_ride: state.current_ride ? { ...state.current_ride, status } : null
  })),
  clearRide: () => set({ current_ride: null, current_request: null, request_timeout: null }),
}));