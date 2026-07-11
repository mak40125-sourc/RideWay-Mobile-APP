import { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, Dimensions, ScrollView } from 'react-native';
import MapView from 'react-native-maps';
import { useRouter } from 'expo-router';
import { useDriverStore } from '../../store/driverStore';
import { useWalletStore } from '../../store/walletStore';
import { useDriverLocation } from '../../hooks/useDriverLocation';
import { useAuth } from '../../contexts/AuthContext';
import { driverAPI } from '../../services/driverAPI';
import DriverStatusCard from '../../components/driver/DriverStatusCard';
import OnlineToggle from '../../components/driver/OnlineToggle';
import EarningsCard from '../../components/driver/EarningsCard';
import RideStatusCard from '../../components/driver/RideStatusCard';
import WalletWarning from '../../components/wallet/WalletWarning';
import { colors } from '../../constants/theme';
import { WALLET_MINIMUM } from '../../constants/wallet';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const BOTTOM_PANEL_HEIGHT = SCREEN_HEIGHT * 0.35;

export default function DriverHomeScreen() {
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const { driver, is_online, setDriver, setOnline, setStatus } = useDriverStore();
  const { balance } = useWalletStore();
  const { startTracking, stopTracking, isTracking } = useDriverLocation();
  const { user } = useAuth();
  const [fetching, setFetching] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [initialRegion] = useState({
    latitude: 12.9716,
    longitude: 77.5946,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });

  const fetchData = useCallback(() => {
    if (!user) return;
    setFetching(true);
    setFetchError(null);
    driverAPI.getMyProfile()
      .then((profile) => {
        setDriver(profile);
      })
      .catch((err) => {
        if (err instanceof Error && err.message.includes('404')) {
          router.replace('/(auth)/kyc');
          return;
        }
        setFetchError(err instanceof Error ? err.message : 'Failed to load profile');
      })
      .finally(() => {
        setFetching(false);
      });
  }, [user, router, setDriver]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (fetching || !driver) return;
    if (driver.kyc_status !== 'verified' || !driver.is_verified) {
      router.replace('/(auth)/registration-pending');
    }
  }, [fetching, driver, router]);

  useEffect(() => {
    if (is_online && !isTracking) {
      startTracking();
    } else if (!is_online && isTracking) {
      stopTracking();
    }
  }, [is_online, isTracking, startTracking, stopTracking]);

  const handleToggleOnline = useCallback((online: boolean) => {
    setOnline(online);
    setStatus(online ? 'ONLINE_IDLE' : 'OFFLINE');
    if (online) {
      driverAPI.setOnline().catch(() => {});
    } else {
      driverAPI.setOffline().catch(() => {});
    }
  }, [setOnline, setStatus]);

  if (fetching) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (fetchError) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>{fetchError}</Text>
        <Text style={styles.retryText} onPress={fetchData}>Tap to retry</Text>
      </View>
    );
  }

  if (!driver) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (driver.kyc_status === 'verified' && driver.is_verified) {
    return (
      <View style={styles.container}>
        <MapView
          ref={mapRef}
          style={styles.map}
          showsUserLocation
          showsMyLocationButton={false}
          initialRegion={initialRegion}
        />

        <View style={styles.overlayHeader}>
          <OnlineToggle onToggle={handleToggleOnline} />
        </View>

        <View style={styles.bottomPanel}>
          <View style={styles.handle} />
          <ScrollView
            style={styles.panelScroll}
            contentContainerStyle={styles.panelContent}
            showsVerticalScrollIndicator={false}
          >
            <DriverStatusCard onToggle={handleToggleOnline} />
            <View style={styles.midSection}>
              <EarningsCard />
              <RideStatusCard />
              {balance < WALLET_MINIMUM && <WalletWarning balance={balance} />}
            </View>
          </ScrollView>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  overlayHeader: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 10,
  },
  errorText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 8,
    fontFamily: 'NeueMontreal-Regular',
  },
  retryText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '600',
    fontFamily: 'NeueMontreal-Bold',
  },
  bottomPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: BOTTOM_PANEL_HEIGHT,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 10,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  panelScroll: {
    flex: 1,
  },
  panelContent: {
    paddingBottom: 32,
  },
  midSection: {
    marginTop: 16,
    gap: 12,
    paddingHorizontal: 16,
  },
});
