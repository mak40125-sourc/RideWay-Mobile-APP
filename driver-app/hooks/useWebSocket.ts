import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getWebSocketUrl } from '../services/api';
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
      if (!token) return;

      const wsUrl = getWebSocketUrl();
      const socket = io(wsUrl, {
        auth: { token },
        transports: ['websocket'],
        autoConnect: true,
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: Infinity,
      });

      socket.on('connect', () => {
        console.log('WebSocket connected');
      });

      socket.on('ride:request', (data: any) => {
        if (!mounted) return;
        const request: RideRequest = {
          rideId: data.rideId,
          pickup: data.pickup,
          dropoff: data.dropoff,
          fare: data.fare,
          distance: data.distance,
          duration: data.duration,
          riderName: data.riderName,
        };
        callbacks.onRideRequest(request);
      });

      socket.on('disconnect', (reason) => {
        console.log('WebSocket disconnected:', reason);
      });

      socket.on('connect_error', (err) => {
        console.log('WebSocket connection error:', err.message);
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
