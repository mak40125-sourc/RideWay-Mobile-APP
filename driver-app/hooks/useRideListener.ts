import { useEffect, useRef } from 'react';
import { useRideStore } from '../store/rideStore';
import { useDriverStore } from '../store/driverStore';
import { rideAPI } from '../services/rideAPI';

export const useRideListener = () => {
  const { setCurrentRequest, setCurrentRide, clearRide } = useRideStore();
  const { is_online, status, driver } = useDriverStore();
  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);

  useEffect(() => {
    if (is_online && status === 'ONLINE_IDLE' && driver) {
      subscriptionRef.current = rideAPI.subscribeToRideRequests((request) => {
        setCurrentRequest(request);
      });
    }

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
    };
  }, [is_online, status, driver]);

  return { clearRide };
};
