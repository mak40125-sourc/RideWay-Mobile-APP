import { useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { useDriverStore } from '../store/driverStore';
import { GPS_UPDATE_INTERVAL } from '../constants/wallet';

export const useDriverLocation = () => {
  const { setLocation } = useDriverStore();
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const watchSubscription = useRef<Location.LocationSubscription | null>(null);

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
    return () => {
      stopTracking();
    };
  }, []);

  return { startTracking, stopTracking, isTracking, error };
};