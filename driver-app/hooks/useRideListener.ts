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

  const currentRideId = useRideStore((s) => s.current_ride?.id ?? null);

  useEffect(() => {
    const rideId = currentRideId;
    if (!rideId) return;
    if (rideId === currentRideIdRef.current) return;
    currentRideIdRef.current = rideId;

    const sub = rideAPI.subscribeToRideUpdates(rideId, (updatedRide) => {
      const incoming = updatedRide.status;
      const cur = useRideStore.getState().current_ride?.status;
      const curOrder = statusOrder(cur);
      const incOrder = statusOrder(incoming);
      if (curOrder !== null && incOrder !== null && incOrder < curOrder) {
        diagLogger.log('RIDE_STALE_TRANSITION', `rideId=${rideId} cur=${cur} incoming=${incoming} ignored`);
        return;
      }
      diagLogger.log('RIDE_UPDATE_EVENT', `rideId=${rideId} status=${updatedRide.status}`);
      setCurrentRide(updatedRide);
      optionsRef.current?.onRideUpdate?.();
    });

    return () => {
      diagLogger.log('RIDE_SUB_UNSUB', `rideId=${rideId}`);
      sub.unsubscribe();
      if (currentRideIdRef.current === rideId) currentRideIdRef.current = null;
    };
  }, [currentRideId]);

  return { clearRide };
};

function statusOrder(s?: string | null): number | null {
  const ORDER: Record<string, number> = { REQUESTED: 0, SEARCHING_DRIVER: 1, DRIVER_ASSIGNED: 2, DRIVER_ARRIVING: 3, RIDE_STARTED: 4, RIDE_COMPLETED: 5, CANCELLED: 5 };
  if (!s) return null;
  return ORDER[s] ?? null;
}
