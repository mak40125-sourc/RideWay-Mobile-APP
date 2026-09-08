import { useCallback, useRef } from 'react';
import * as Location from 'expo-location';
import { useNavigationStore } from '../store/navigationStore';
import { useDriverStore } from '../store/driverStore';
import { useStartupStore } from '../store/startupStore';
import { diagLogger } from '../utils/diagLog';
import type { Ride } from '../types/ride';

function isValidGps(lat: number | null | undefined, lng: number | null | undefined): boolean {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    (lat !== 0 || lng !== 0)
  );
}

function targetForRide(ride: Ride): { coords: { latitude: number; longitude: number } | null; key: string | null; label: string } {
  const pick = ride.pickup_location;
  const drop = ride.drop_location;
  if (ride.status === 'DRIVER_ASSIGNED' || ride.status === 'DRIVER_ARRIVING') {
    if (pick && isValidGps(pick.latitude, pick.longitude)) {
      return {
        coords: { latitude: pick.latitude, longitude: pick.longitude },
        key: `pickup:${ride.id}`,
        label: ride.pickup_address || 'Pickup',
      };
    }
    return { coords: null, key: `pickup:${ride.id}`, label: ride.pickup_address || 'Pickup' };
  }
  if (ride.status === 'RIDE_STARTED') {
    if (drop && isValidGps(drop.latitude, drop.longitude)) {
      return {
        coords: { latitude: drop.latitude, longitude: drop.longitude },
        key: `drop:${ride.id}`,
        label: ride.drop_address || 'Destination',
      };
    }
    return { coords: null, key: `drop:${ride.id}`, label: ride.drop_address || 'Destination' };
  }
  return { coords: null, key: null, label: '' };
}

let navInFlight: Promise<void> | null = null;

export function useNavigationRecovery() {
  const generationRef = useRef(0);

  const recoverNavigationFromRide = useCallback(async (ride: Ride | null, source: string): Promise<void> => {
    if (navInFlight) return navInFlight;
    const task = (async (): Promise<void> => {
      const gen = useStartupStore.getState().nextGeneration();
      generationRef.current = gen;
      const startup = useStartupStore.getState();
      startup.setPhase('NAV_RECONCILING');
      diagLogger.log('DRIVER_NAV_RECOVERY_STARTED', `rideId=${ride?.id ?? 'null'} status=${ride?.status ?? 'null'} source=${source} gen=${gen}`);

      if (!ride || ride.status === 'RIDE_COMPLETED' || ride.status === 'CANCELLED') {
        try {
          useNavigationStore.getState().stopNavigation();
        } catch {}
        useStartupStore.getState().setNavRecovery('NOT_REQUIRED');
        diagLogger.log('DRIVER_NAV_RECOVERY_COMPLETED', `reason=no-navigation-required source=${source} gen=${gen}`);
        return;
      }

      const target = targetForRide(ride);
      if (!target.coords || !target.key) {
        diagLogger.log('DRIVER_NAV_RECOVERY_FAILED', `rideId=${ride.id} reason=missing-target-coords source=${source} gen=${gen}`);
        useStartupStore.getState().setNavRecovery('FAILED');
        return;
      }

      let gps: { latitude: number; longitude: number } | null = null;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          diagLogger.log('DRIVER_NAV_RECOVERY_FAILED', `rideId=${ride.id} reason=gps-permission-denied source=${source} gen=${gen}`);
          useStartupStore.getState().setNavRecovery('PENDING_GPS');
          return;
        }
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        if (!isValidGps(pos.coords.latitude, pos.coords.longitude)) {
          diagLogger.log('DRIVER_NAV_RECOVERY_FAILED', `rideId=${ride.id} reason=gps-invalid source=${source} gen=${gen}`);
          useStartupStore.getState().setNavRecovery('PENDING_GPS');
          return;
        }
        gps = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        useDriverStore.getState().setLocation({
          latitude: gps.latitude,
          longitude: gps.longitude,
          accuracy: pos.coords.accuracy || 0,
          timestamp: Date.now(),
          heading: pos.coords.heading != null && pos.coords.heading >= 0 ? pos.coords.heading : undefined,
        });
        diagLogger.log('DRIVER_NAV_RECOVERY_GPS_READY', `rideId=${ride.id} lat=${gps.latitude.toFixed(5)} lng=${gps.longitude.toFixed(5)} source=${source} gen=${gen}`);
      } catch (e) {
        diagLogger.log('DRIVER_NAV_RECOVERY_FAILED', `rideId=${ride.id} reason=gps-error msg=${e instanceof Error ? e.message : String(e)} source=${source} gen=${gen}`);
        useStartupStore.getState().setNavRecovery('PENDING_GPS');
        return;
      }

      if (generationRef.current !== gen || useStartupStore.getState().recoveryGeneration !== gen) {
        diagLogger.log('DRIVER_NAV_RECOVERY_FAILED', `rideId=${ride.id} reason=superseded gen=${gen} source=${source}`);
        return;
      }

      try {
        useNavigationStore.getState().startNavigation(target.coords, target.key, target.label);
        diagLogger.log('DRIVER_NAV_RECOVERY_ROUTE_READY', `rideId=${ride.id} key=${target.key} source=${source} gen=${gen} origin=${gps!.latitude.toFixed(5)},${gps!.longitude.toFixed(5)}`);
        useStartupStore.getState().setNavRecovery('RECONSTRUCTED');
        diagLogger.log('DRIVER_NAV_RECOVERY_COMPLETED', `rideId=${ride.id} key=${target.key} source=${source} gen=${gen}`);
      } catch (e) {
        diagLogger.log('DRIVER_NAV_RECOVERY_FAILED', `rideId=${ride.id} reason=startNavigation msg=${e instanceof Error ? e.message : String(e)} source=${source} gen=${gen}`);
        useStartupStore.getState().setNavRecovery('FAILED');
      }
    })();
    navInFlight = task;
    try {
      await task;
    } finally {
      navInFlight = null;
    }
  }, []);

  return { recoverNavigationFromRide };
}
