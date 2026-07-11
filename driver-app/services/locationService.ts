import * as Location from 'expo-location';
import { GPS_UPDATE_INTERVAL } from '../constants/wallet';

type LocationCallback = (location: Location.LocationObject) => void;

let watchSubscription: Location.LocationSubscription | null = null;

export const locationService = {
  requestPermissions: async (): Promise<boolean> => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  },

  requestBackgroundPermissions: async (): Promise<boolean> => {
    const { status } = await Location.requestBackgroundPermissionsAsync();
    return status === 'granted';
  },

  startTracking: async (callback: LocationCallback) => {
    const hasPermission = await locationService.requestPermissions();
    if (!hasPermission) {
      throw new Error('Location permission denied');
    }

    watchSubscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: GPS_UPDATE_INTERVAL,
        distanceInterval: 5,
      },
      callback
    );

    return watchSubscription;
  },

  stopTracking: () => {
    if (watchSubscription) {
      watchSubscription.remove();
      watchSubscription = null;
    }
  },

  getCurrentPosition: async (): Promise<Location.LocationObject> => {
    return Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
  },

  isServiceEnabled: async (): Promise<boolean> => {
    return Location.hasServicesEnabledAsync();
  },
};
