import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getWebSocketUrl } from '../services/api';
import { diagLogger } from '../utils/diagLog';
import type { RideRequest } from '../types/ride';

interface UseWebSocketCallbacks {
  onRideRequest: (request: RideRequest) => void;
}

export function useWebSocket(callbacks: UseWebSocketCallbacks) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    let mounted = true;

    const connect = async () => {
      const token = await AsyncStorage.getItem('supabase_token');
      if (!token) {
        diagLogger.log('SOCKET_NO_TOKEN', 'stopping; no auth token');
        return;
      }

      const wsUrl = getWebSocketUrl();
      diagLogger.setSocketUrl(wsUrl);
      diagLogger.setNetwork('UNKNOWN');
      diagLogger.log('SOCKET_CONNECTING', wsUrl);
      const socket = io(wsUrl, {
        auth: { token },
        transports: ['websocket'],
        autoConnect: true,
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: Infinity,
      });

      socket.on('connect', () => {
        if (!mounted) return;
        diagLogger.setSocketId(socket.id ?? null);
        diagLogger.setNetwork('UP');
        diagLogger.log('SOCKET_CONNECTED', `sid=${socket.id} (room: driver:[driver-id])`);
      });

      socket.on('ride:request', (data: any) => {
        if (!mounted) return;
        diagLogger.log(
          'SOCKET_EVENT_RIDE_REQUEST',
          `rideId=${data?.rideId} raw=${JSON.stringify(data)?.slice(0, 220)}`
        );
        const request: RideRequest = {
          rideId: data.rideId,
          pickup: data.pickup,
          dropoff: data.dropoff,
          fare: data.fare,
          distance: data.distance,
          duration: data.duration,
          riderName: data.riderName,
          passengerName: data.passengerName || null,
          passengerPhone: data.passengerPhone || null,
          expiresAt: typeof data.expiresAt === 'number' ? data.expiresAt : null,
        };
        callbacks.onRideRequest(request);
      });

      socket.on('disconnect', (reason) => {
        diagLogger.setNetwork('DOWN');
        diagLogger.setSocketId(null);
        diagLogger.log('SOCKET_DISCONNECT', `reason=${reason}`);
      });

      socket.on('connect_error', (err) => {
        diagLogger.setNetwork('DOWN');
        diagLogger.log('SOCKET_ERROR', err?.message ?? String(err));
      });

      socket.on('reconnect_attempt', (attempt) => {
        diagLogger.log('SOCKET_RECONNECT_ATTEMPT', `attempt=${attempt}`);
      });

      socket.on('reconnect', (attempt) => {
        diagLogger.setNetwork('UP');
        diagLogger.setSocketId(socket.id ?? null);
        diagLogger.log('SOCKET_RECONNECTED', `attempt=${attempt} socket.id=${socket.id}`);
        diagLogger.log('RIDE_RECONCILIATION_STARTED', `socket_reconnect attempt=${attempt}`);
        void (async () => {
          try {
            const [{ reconcileRideOnce }, { useStartupStore }, authMod] = await Promise.all([
              import('../services/rideRecoveryService'),
              import('../store/startupStore'),
              import('../contexts/AuthContext'),
            ]);
            void authMod;
            const { useDriverStore } = await import('../store/driverStore');
            // Auth user id via driver store fallback: rideRecoveryService resolves via passed id.
            // Use persisted driver user_id if available, else skip (startup will handle).
            const driverUserId = useDriverStore.getState().driver?.user_id ?? null;
            if (!driverUserId) {
              diagLogger.log('RIDE_RECOVERY_FAILED', 'socket_reconnect no-driver-user-id deferred to startup');
              return;
            }
            const st = useStartupStore.getState();
            if (!st.appReady) {
              diagLogger.log('RECONCILE_DEFERRED', 'socket_reconnect before APP_READY');
              return;
            }
            await reconcileRideOnce('socket_reconnect', driverUserId);
          } catch (err) {
            diagLogger.log('RIDE_RECOVERY_FAILED', `socket_reconnect err=${err instanceof Error ? err.message : String(err)}`);
          }
        })();
      });

      socketRef.current = socket;
    };

    connect();

    return () => {
      mounted = false;
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, []);

  return { disconnect };
}
