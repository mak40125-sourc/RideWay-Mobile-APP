import { useEffect, useRef } from 'react';
import { useRideStore } from '../store/rideStore';
import { useDriverStore } from '../store/driverStore';
import { useWebSocket } from './useWebSocket';
import { rideAPI } from '../services/rideAPI';

interface UseRideListenerOptions {
  onRequest?: () => void;
  onRideUpdate?: () => void;
}

export const useRideListener = (options?: UseRideListenerOptions) => {
  const { setCurrentRequest, setCurrentRide, clearRide } = useRideStore();
  const { is_online, status, driver } = useDriverStore();
  const currentRideIdRef = useRef<string | null>(null);

  useWebSocket({
    onRideRequest: (request) => {
      if (is_online && status === 'ONLINE_IDLE' && driver) {
        setCurrentRequest(request);
        options?.onRequest?.();
      }
    },
  });

  useEffect(() => {
    const rideId = useRideStore.getState().current_ride?.id;
    if (rideId && rideId !== currentRideIdRef.current) {
      currentRideIdRef.current = rideId;

      const sub = rideAPI.subscribeToRideUpdates(rideId, (updatedRide) => {
        setCurrentRide(updatedRide);
        options?.onRideUpdate?.();
      });

      return () => {
        sub.unsubscribe();
      };
    }
  }, []);

  return { clearRide };
};
