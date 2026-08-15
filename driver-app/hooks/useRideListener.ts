import { useEffect, useRef } from 'react';
import { useRideStore } from '../store/rideStore';
import { useDriverStore } from '../store/driverStore';
import { useWebSocket } from './useWebSocket';
import { rideAPI } from '../services/rideAPI';
import { diagLogger } from '../utils/diagLog';

interface UseRideListenerOptions {
  onRequest?: () => void;
  onRideUpdate?: () => void;
}

export const useRideListener = (options?: UseRideListenerOptions) => {
  const { setCurrentRequest, setCurrentRide, clearRide } = useRideStore();
  const { is_online, status, driver } = useDriverStore();
  const currentRideIdRef = useRef<string | null>(null);

  const optionsRef = useRef(options);
  const gateRef = useRef({ is_online, status, driver });
  useEffect(() => {
    optionsRef.current = options;
    gateRef.current = { is_online, status, driver };
  });

  useWebSocket({
    onRideRequest: (request) => {
      const { is_online, status, driver } = gateRef.current;
      const online = is_online;
      const stat = status;
      const hasDriver = !!driver;
      if (is_online && status === 'ONLINE_IDLE' && driver) {
        diagLogger.log('RIDE_REQUEST_RENDER', `rideId=${request.rideId} online=${online} status=${stat} driver=${hasDriver}`);
        setCurrentRequest(request);
        optionsRef.current?.onRequest?.();
      } else {
        diagLogger.log(
          'RIDE_REQUEST_DROPPED',
          `rideId=${request.rideId} online=${online} status=${stat} driver=${hasDriver} reason=gate-failed`
        );
      }
    },
  });

  useEffect(() => {
    const rideId = useRideStore.getState().current_ride?.id;
    if (rideId && rideId !== currentRideIdRef.current) {
      currentRideIdRef.current = rideId;

      const sub = rideAPI.subscribeToRideUpdates(rideId, (updatedRide) => {
        diagLogger.log('RIDE_UPDATE_EVENT', `rideId=${rideId} status=${updatedRide.status}`);
        setCurrentRide(updatedRide);
        options?.onRideUpdate?.();
      });

      return () => {
        diagLogger.log('RIDE_SUB_UNSUB', `rideId=${rideId}`);
        sub.unsubscribe();
      };
    }
  }, []);

  return { clearRide };
};
