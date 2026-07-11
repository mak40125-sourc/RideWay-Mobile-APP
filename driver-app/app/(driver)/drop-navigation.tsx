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
  return { latitude: 12.9352, longitude: 77.6245 };
}

export default function DropNavigationScreen() {
  const router = useRouter();
  const { setStatus } = useDriverStore();
  const { current_ride } = useRideStore();
  const [completing, setCompleting] = useState(false);

  const drop = current_ride?.drop_location;
  const rideId = current_ride?.id;
  const fare = current_ride?.fare || 0;
  const dropAddress = current_ride?.drop_location?.address || current_ride?.drop_address || 'Loading...';

  const handleCompleteRide = async () => {
    if (!rideId || completing) return;
    setCompleting(true);
    try {
      await rideAPI.updateRideStatus(rideId, 'RIDE_COMPLETED');
      setStatus('RIDE_COMPLETED');
      router.push('/(driver)/ride-completed');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to complete ride');
      setCompleting(false);
    }
  };

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        showsUserLocation
        initialRegion={{
          latitude: getCoords(drop).latitude,
          longitude: getCoords(drop).longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }}
      >
        {drop && <Marker coordinate={getCoords(drop)} title="Drop Location" />}
      </MapView>

      <View style={styles.topOverlay}>
        <View style={styles.routeInfo}>
          <Text style={styles.instruction}>Continue to destination</Text>
          <Text style={styles.eta}>{current_ride?.distance} km · {current_ride?.duration} min</Text>
        </View>
      </View>

      <View style={styles.bottomCard}>
        <View style={styles.addressRow}>
          <View style={[styles.dot, styles.dotDrop]} />
          <View style={styles.addressInfo}>
            <Text style={styles.label}>Drop-off</Text>
            <Text style={styles.address}>{dropAddress}</Text>
          </View>
        </View>

        <View style={styles.fareInfo}>
          <Text style={styles.fareLabel}>Fare</Text>
          <Text style={styles.fareValue}>₹{fare}</Text>
        </View>

        <TouchableOpacity
          style={[styles.completeButton, completing && styles.buttonDisabled]}
          onPress={handleCompleteRide}
          disabled={completing}
        >
          <Text style={styles.completeText}>{completing ? 'Completing...' : 'Complete Ride'}</Text>
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
  topOverlay: {
    position: 'absolute',
    top: 50,
    left: spacing.md,
    right: spacing.md,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  routeInfo: {
    alignItems: 'center',
  },
  instruction: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  eta: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
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
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.success,
    marginRight: spacing.md,
  },
  dotDrop: {
    backgroundColor: colors.error,
  },
  addressInfo: {
    flex: 1,
  },
  label: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginBottom: 2,
  },
  address: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.text,
  },
  fareInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  fareLabel: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  fareValue: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  completeButton: {
    backgroundColor: colors.success,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  completeText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.background,
  },
});
