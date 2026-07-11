import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Alert } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
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

function getAddress(loc: any): string {
  return loc?.address || 'Loading...';
}

export default function PickupNavigationScreen() {
  const router = useRouter();
  const { setStatus } = useDriverStore();
  const { current_request, current_ride } = useRideStore();
  const [arriving, setArriving] = useState(false);

  const ride = current_ride;
  const rideId = ride?.id || current_request?.rideId;
  const pickup = current_request?.pickup || ride?.pickup_location;
  const pickupAddress = getAddress(pickup);
  const coords = getCoords(pickup);

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
    <View style={styles.container}>
      <MapView
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        showsUserLocation
        initialRegion={{
          latitude: coords.latitude,
          longitude: coords.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }}
      >
        <Marker coordinate={coords} title="Pickup Location" />
      </MapView>

      <View style={styles.topOverlay}>
        <View style={styles.routeInfo}>
          <Text style={styles.instruction}>Navigate to pickup</Text>
          <Text style={styles.eta}>{current_request?.distance} km away</Text>
        </View>
      </View>

      <View style={styles.bottomCard}>
        <View style={styles.addressRow}>
          <View style={styles.dot} />
          <View style={styles.addressInfo}>
            <Text style={styles.label}>Pickup</Text>
            <Text style={styles.address}>{pickupAddress}</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.callButton}>
            <Ionicons name="call-outline" size={18} color={colors.text} style={{ marginRight: 6 }} />
            <Text style={styles.callText}>Call Rider</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.arrivedButton, arriving && styles.buttonDisabled]}
          onPress={handleArrived}
          disabled={arriving}
        >
          <Text style={styles.arrivedText}>{arriving ? 'Updating...' : 'Arrived'}</Text>
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
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  callButton: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  callText: {
    fontSize: fontSize.md,
    color: colors.text,
  },
  cancelButton: {
    width: 80,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: fontSize.md,
    color: colors.error,
  },
  arrivedButton: {
    backgroundColor: colors.success,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  arrivedText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.background,
  },
});
