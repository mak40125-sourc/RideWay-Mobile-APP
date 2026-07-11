import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useDriverStore } from '../../store/driverStore';
import { useRideStore } from '../../store/rideStore';
import { colors, spacing, borderRadius, fontSize, fontWeight } from '../../constants/theme';

const { width, height } = Dimensions.get('window');

export default function PickupNavigationScreen() {
  const router = useRouter();
  const { setStatus } = useDriverStore();
  const { current_request, current_ride } = useRideStore();

  const pickup = current_request?.pickup || current_ride?.pickup_location;

  const handleArrived = () => {
    setStatus('ARRIVED_AT_PICKUP');
    router.push('/(driver)/ride-progress');
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
          latitude: pickup?.latitude || 12.9716,
          longitude: pickup?.longitude || 77.5946,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }}
      >
        {pickup && (
          <Marker coordinate={pickup} title="Pickup Location" />
        )}
      </MapView>

      <View style={styles.topOverlay}>
        <View style={styles.routeInfo}>
          <Text style={styles.instruction}>Turn right onto MG Road</Text>
          <Text style={styles.eta}>2 min · 800 m</Text>
        </View>
      </View>

      <View style={styles.bottomCard}>
        <View style={styles.addressRow}>
          <View style={styles.dot} />
          <View style={styles.addressInfo}>
            <Text style={styles.label}>Pickup</Text>
            <Text style={styles.address}>{pickup?.address || 'Loading...'}</Text>
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

        <TouchableOpacity style={styles.arrivedButton} onPress={handleArrived}>
          <Text style={styles.arrivedText}>Arrived</Text>
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
  arrivedText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.background,
  },
});