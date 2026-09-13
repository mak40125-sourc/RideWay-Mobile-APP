import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Alert, ActivityIndicator } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useDriverStore } from '../../store/driverStore';
import { useRideStore } from '../../store/rideStore';
import { rideAPI } from '../../services/rideAPI';
import { velosColors, fontFamily } from '../../constants/theme';

const { width, height } = Dimensions.get('window');

function getCoords(loc: any) {
  if (loc?.latitude != null) return { latitude: loc.latitude, longitude: loc.longitude };
  if (loc?.lat != null) return { latitude: loc.lat, longitude: loc.lng };
  return null;
}

function addressOf(loc: any, fallbackAddress?: string | null): string {
  if (loc?.address) return loc.address;
  if (fallbackAddress) return fallbackAddress;
  const coords = getCoords(loc);
  if (!coords) return 'Location unavailable';
  return `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`;
}

export default function RideProgressScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { setStatus } = useDriverStore();
  const { current_ride } = useRideStore();
  const [starting, setStarting] = useState(false);

  const pickup = current_ride?.pickup_location;
  const drop = current_ride?.drop_location;
  const dropAddress = addressOf(drop, current_ride?.drop_address);
  const pickupAddress = addressOf(pickup, current_ride?.pickup_address);
  const rideId = current_ride?.id;
  const pickupCoords = getCoords(pickup);
  const dropCoords = getCoords(drop);
  const mapFocus = pickupCoords ?? dropCoords;

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
      {mapFocus ? (
        <MapView
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          showsUserLocation
          showsMyLocationButton={false}
          showsCompass={false}
          initialRegion={{
            latitude: mapFocus.latitude,
            longitude: mapFocus.longitude,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          }}
        >
          {pickupCoords && <Marker coordinate={pickupCoords} title="Pickup" pinColor={velosColors.green} />}
          {dropCoords && <Marker coordinate={dropCoords} title="Drop" pinColor={velosColors.dropOrange} />}
        </MapView>
      ) : (
        <View style={styles.map} />
      )}

      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20) + 12 }]}>
        <View style={styles.handle} />

        <Text style={styles.kicker}>RIDER ON BOARD</Text>
        <Text style={styles.title}>Ready to start?</Text>
        <Text style={styles.subtitle}>Confirm the rider is settled and begin the trip to the destination.</Text>

        <View style={styles.routeRow}>
          <View style={styles.markerColumn}>
            <View style={[styles.dot, { backgroundColor: velosColors.green }]} />
            <View style={styles.connector} />
            <View style={[styles.dot, { backgroundColor: velosColors.dropOrange }]} />
          </View>
          <View style={styles.stops}>
            <View style={styles.stop}>
              <Text style={styles.stopLabel}>PICKUP</Text>
              <Text style={styles.stopTitle} numberOfLines={1}>{pickupAddress}</Text>
            </View>
            <View style={styles.stop}>
              <Text style={styles.stopLabel}>DROP-OFF</Text>
              <Text style={styles.stopTitle} numberOfLines={1}>{dropAddress}</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, starting && styles.buttonDisabled]}
          onPress={handleStartRide}
          disabled={starting}
          activeOpacity={0.88}
        >
          {starting ? (
            <ActivityIndicator color={velosColors.white} />
          ) : (
            <>
              <Text style={styles.primaryButtonText}>Start ride</Text>
              <Ionicons name="arrow-forward" size={18} color={velosColors.white} style={styles.btnIcon} />
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.hint}>You are at the pickup location</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: velosColors.white,
  },
  map: {
    width,
    height,
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: velosColors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: velosColors.borderSoft,
    borderBottomWidth: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    shadowColor: '#0F1D2A',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 12,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: velosColors.borderSoft,
    alignSelf: 'center',
    marginBottom: 16,
  },
  kicker: {
    fontSize: 10,
    letterSpacing: 1.4,
    fontFamily: fontFamily.semibold,
    color: velosColors.mutedText,
    marginBottom: 6,
  },
  title: {
    fontSize: 26,
    lineHeight: 32,
    fontFamily: fontFamily.bold,
    color: velosColors.navy,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fontFamily.regular,
    color: velosColors.mutedText,
  },
  routeRow: {
    flexDirection: 'row',
    marginTop: 20,
    marginBottom: 22,
  },
  markerColumn: {
    width: 20,
    alignItems: 'center',
    paddingTop: 2,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  connector: {
    width: 1.5,
    flex: 1,
    minHeight: 28,
    marginVertical: 6,
    backgroundColor: velosColors.borderSoft,
    borderRadius: 1,
  },
  stops: {
    flex: 1,
    marginLeft: 12,
    gap: 18,
  },
  stop: {
    gap: 3,
  },
  stopLabel: {
    fontSize: 10,
    letterSpacing: 1.2,
    fontFamily: fontFamily.semibold,
    color: velosColors.mutedText,
  },
  stopTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontFamily: fontFamily.semibold,
    color: velosColors.navy,
  },
  primaryButton: {
    height: 56,
    borderRadius: 16,
    backgroundColor: velosColors.green,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    fontSize: 16,
    fontFamily: fontFamily.semibold,
    color: velosColors.white,
    letterSpacing: 0.2,
  },
  btnIcon: {
    marginLeft: 2,
  },
  hint: {
    marginTop: 12,
    textAlign: 'center',
    fontSize: 12,
    fontFamily: fontFamily.regular,
    color: velosColors.mutedText,
  },
});
