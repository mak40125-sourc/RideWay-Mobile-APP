import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Alert } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useRouter } from 'expo-router';
import { useDriverStore } from '../../store/driverStore';
import { useRideStore } from '../../store/rideStore';
import { rideAPI } from '../../services/rideAPI';
import { colors, spacing, borderRadius, fontSize, fontWeight } from '../../constants/theme';

const { width, height } = Dimensions.get('window');

function getCoords(loc: any) {
  if (loc?.latitude != null) return { latitude: loc.latitude, longitude: loc.longitude };
  if (loc?.lat != null) return { latitude: loc.lat, longitude: loc.lng };
  return { latitude: 12.9716, longitude: 77.5946 };
}

export default function RideProgressScreen() {
  const router = useRouter();
  const { setStatus } = useDriverStore();
  const { current_ride } = useRideStore();
  const [starting, setStarting] = useState(false);

  const pickup = current_ride?.pickup_location;
  const drop = current_ride?.drop_location;
  const rideId = current_ride?.id;
  const dropAddress = current_ride?.drop_location?.address || current_ride?.pickup_address || 'Loading...';

  const handleStartRide = async () => {
    if (!rideId || starting) return;
    setStarting(true);
    try {
      await rideAPI.updateRideStatus(rideId, 'RIDE_STARTED');
      setStatus('NAVIGATING_TO_DROP');
      router.push('/(driver)/drop-navigation');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to start ride');
      setStarting(false);
    }
  };

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        showsUserLocation
        initialRegion={{
          latitude: getCoords(pickup).latitude,
          longitude: getCoords(pickup).longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }}
      >
        {pickup && <Marker coordinate={getCoords(pickup)} title="Pickup" />}
        {drop && <Marker coordinate={getCoords(drop)} title="Drop" pinColor="red" />}
      </MapView>

      <View style={styles.bottomCard}>
        <Text style={styles.title}>Rider has boarded</Text>

        <View style={styles.info}>
          <Text style={styles.infoLabel}>Trip to</Text>
          <Text style={styles.infoAddress}>{dropAddress}</Text>
        </View>

        <TouchableOpacity
          style={[styles.startButton, starting && styles.buttonDisabled]}
          onPress={handleStartRide}
          disabled={starting}
        >
          <Text style={styles.startText}>{starting ? 'Starting...' : 'Start Ride'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  map: {
    width: width,
    height: height,
  },
  bottomCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.background,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  info: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  infoLabel: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  infoAddress: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.text,
  },
  startButton: {
    backgroundColor: colors.success,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  startText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.background,
  },
});
