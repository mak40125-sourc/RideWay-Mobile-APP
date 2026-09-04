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

function getAddress(loc: any): string {
  if (loc?.address) return loc.address;
  if (loc?.latitude != null) return `${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}`;
  if (loc?.lat != null) return `${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}`;
  return 'Pickup location';
}

export default function PickupNavigationScreen() {
  const router = useRouter();
  const { setStatus } = useDriverStore();
  const { current_request, current_ride } = useRideStore();
  const [arriving, setArriving] = useState(false);

  const ride = current_ride;
  const rideId = ride?.id || current_request?.rideId;
  const pickup = current_request?.pickup || ride?.pickup_location;
  const destination = getCoords(pickup);
  const destinationLabel = getAddress(pickup);

  const handleArrived = async () => {
    if (!rideId || arriving) return;
    setArriving(true);
    try {
      await rideAPI.updateRideStatus(rideId, 'DRIVER_ARRIVING');
      setStatus('ARRIVED_AT_PICKUP');
      router.push('/(driver)/ride-progress');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to update status');
      setArriving(false);
    }
  };

  const handleCancel = () => {
    setStatus('ONLINE_IDLE');
    router.back();
  };

  return (
    <NavigationScreen
      destination={destination}
      destinationKey={rideId ? `pickup:${rideId}` : 'pickup:unknown'}
      destinationLabel={destinationLabel}
      actionLabel="Arrived"
      actionLoading={arriving}
      onAction={handleArrived}
      onCancel={handleCancel}
      cancelLabel="Cancel"
    />
  );
}
