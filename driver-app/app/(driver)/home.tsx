import { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions, TouchableOpacity, Text } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useDriverStore } from '../../store/driverStore';
import { useWalletStore } from '../../store/walletStore';
import { useRideStore } from '../../store/rideStore';
import { useDriverLocation } from '../../hooks/useDriverLocation';
import OnlineToggle from '../../components/driver/OnlineToggle';
import EarningsCard from '../../components/driver/EarningsCard';
import RideRequestModal from '../../components/ride/RideRequestModal';
import { colors, spacing } from '../../constants/theme';

const { width, height } = Dimensions.get('window');

export default function DriverHomeScreen() {
  const mapRef = useRef<MapView>(null);
  const { is_online, setOnline, status, setStatus, driver } = useDriverStore();
  const { balance } = useWalletStore();
  const { current_request, setCurrentRequest, clearRide } = useRideStore();
  const { startTracking, stopTracking, isTracking } = useDriverLocation();

  const [showRequest, setShowRequest] = useState(false);

  useEffect(() => {
    if (is_online && !isTracking) {
      startTracking();
    } else if (!is_online && isTracking) {
      stopTracking();
    }
  }, [is_online]);

  const handleToggleOnline = (online: boolean) => {
    setOnline(online);
    setStatus(online ? 'ONLINE_IDLE' : 'OFFLINE');
  };

  const handleAcceptRide = () => {
    setStatus('ACCEPTED');
    setShowRequest(false);
  };

  const handleRejectRide = () => {
    clearRide();
    setShowRequest(false);
  };

  useEffect(() => {
    if (is_online && Math.random() > 0.7) {
      setTimeout(() => {
        setCurrentRequest({
          id: 'req-1',
          pickup: { latitude: 12.9716, longitude: 77.5946, address: 'MG Road, Bangalore' },
          drop: { latitude: 12.9352, longitude: 77.6245, address: 'Koramangala, Bangalore' },
          estimated_fare: 180,
          distance_km: 5.2,
          rider_name: 'John Doe',
          rider_rating: 4.8,
          expires_at: Date.now() + 10000,
        });
        setShowRequest(true);
      }, 3000);
    }
  }, [is_online]);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        showsUserLocation
        showsMyLocationButton={false}
        initialRegion={{
          latitude: 12.9716,
          longitude: 77.5946,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      />

      <View style={styles.topSection}>
        <OnlineToggle onToggle={handleToggleOnline} />
        <EarningsCard />
      </View>

      {is_online && status === 'ONLINE_IDLE' && (
        <View style={styles.idleCard}>
          <Text style={styles.idleText}>Waiting for ride requests...</Text>
        </View>
      )}

      {showRequest && current_request && (
        <RideRequestModal
          request={current_request}
          onAccept={handleAcceptRide}
          onReject={handleRejectRide}
        />
      )}
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
    position: 'absolute',
    top: 0,
    left: 0,
  },
  topSection: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  idleCard: {
    position: 'absolute',
    bottom: 100,
    left: spacing.md,
    right: spacing.md,
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  idleText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
});