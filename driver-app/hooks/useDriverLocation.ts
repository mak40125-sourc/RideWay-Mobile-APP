import { useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { useDriverStore } from '../store/driverStore';
import { driverAPI } from '../services/driverAPI';
import { GPS_UPDATE_INTERVAL } from '../constants/wallet';

export const useDriverLocation = () => {
  const { setLocation } = useDriverStore();
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const watchSubscription = useRef<Location.LocationSubscription | null>(null);
  const lastSyncRef = useRef(0);

  const syncLocation = async (coords: { latitude: number; longitude: number }) => {
    const now = Date.now();
    if (now - lastSyncRef.current < GPS_UPDATE_INTERVAL) return;
    if (!useDriverStore.getState().is_online) return;
    lastSyncRef.current = now;
    try {
      await driverAPI.updateLocation({
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: 0,
        timestamp: now,
      });
    } catch {
      // Silent: location sync failure should not break tracking
    }
  };

  const startTracking = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Location permission denied');
        return;
      }

      setIsTracking(true);

      watchSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: GPS_UPDATE_INTERVAL,
          distanceInterval: 5,
        },
        (location) => {
          setLocation({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracy: location.coords.accuracy || 0,
            timestamp: Date.now(),
          });
          syncLocation(location.coords);
        }
      );
    } catch (err) {
      setError('Failed to start location tracking');
    }
  };

  const stopTracking = () => {
    if (watchSubscription.current) {
      watchSubscription.current.remove();
      watchSubscription.current = null;
    }
    setIsTracking(false);
  };

  useEffect(() => {
    Location.requestForegroundPermissionsAsync().catch(() => {});

    return () => {
      stopTracking();
    };
  }, []);

  return { startTracking, stopTracking, isTracking, error };
};