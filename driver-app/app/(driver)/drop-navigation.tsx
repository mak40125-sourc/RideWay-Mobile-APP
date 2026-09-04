import { useState } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useDriverStore } from '../../store/driverStore';
import { useRideStore } from '../../store/rideStore';
import { rideAPI } from '../../services/rideAPI';
import NavigationScreen from '../../components/navigation/NavigationScreen';

function getCoords(loc: any) {
  if (loc?.latitude != null) return { latitude: loc.latitude, longitude: loc.longitude };
  if (loc?.lat != null) return { latitude: loc.lat, longitude: loc.lng };
  return null;
}

function getAddress(loc: any, fallbackAddress?: string | null): string {
  if (loc?.address) return loc.address;
  if (fallbackAddress) return fallbackAddress;
  if (loc?.latitude != null) return `${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}`;
  if (loc?.lat != null) return `${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}`;
  return 'Drop-off location';
}

export default function DropNavigationScreen() {
  const router = useRouter();
  const { setStatus } = useDriverStore();
  const { current_ride } = useRideStore();
  const [completing, setCompleting] = useState(false);

  const drop = current_ride?.drop_location;
  const rideId = current_ride?.id;
  const destination = getCoords(drop);
  const destinationLabel = getAddress(drop, current_ride?.drop_address);
  const fare = current_ride?.fare || 0;

  const handleCompleteRide = async () => {
    if (!rideId || completing) return;
    setCompleting(true);
    const ts = new Date().toISOString();
    // eslint-disable-next-line no-console
    console.log(`[RIDEWAY-DIAG] DRIVER_RIDE_COMPLETED_REQUEST ts=${ts} rideId=${rideId} status=RIDE_COMPLETED`);
    try {
      const ride = await rideAPI.updateRideStatus(rideId, 'RIDE_COMPLETED');
      // eslint-disable-next-line no-console
      console.log(`[RIDEWAY-DIAG] DRIVER_RIDE_COMPLETED_RESPONSE ts=${new Date().toISOString()} rideId=${rideId} status=${ride?.status ?? 'unknown'} ride=${JSON.stringify(ride).slice(0,300)}`);
      setStatus('RIDE_COMPLETED');
      // eslint-disable-next-line no-console
      console.log(`[RIDEWAY-DIAG] DRIVER_RIDE_STATE_UPDATED ts=${new Date().toISOString()} rideId=${rideId} driverStatus=RIDE_COMPLETED`);
      router.push('/(driver)/ride-completed');
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.log(`[RIDEWAY-DIAG] DRIVER_RIDE_COMPLETED_RESPONSE ts=${new Date().toISOString()} rideId=${rideId} error=${err?.message ?? String(err)}`);
      Alert.alert('Error', err?.message || 'Failed to complete ride');
      setCompleting(false);
    }
  };

  return (
    <NavigationScreen
      destination={destination}
      destinationKey={rideId ? `drop:${rideId}` : 'drop:unknown'}
      destinationLabel={destinationLabel}
      actionLabel="Complete Ride"
      actionLoading={completing}
      onAction={handleCompleteRide}
      statusText={fare > 0 ? `Trip fare ₹${fare}` : undefined}
    />
  );
}
