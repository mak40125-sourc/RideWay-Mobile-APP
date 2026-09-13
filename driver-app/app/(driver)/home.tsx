import { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, Dimensions, ScrollView, TouchableOpacity } from 'react-native';
import MapView from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useDriverStore } from '../../store/driverStore';
import { locationService } from '../../services/locationService';
import { useRideStore } from '../../store/rideStore';
import { useWalletStore } from '../../store/walletStore';
import { useDriverLocation } from '../../hooks/useDriverLocation';
import { useRideListener } from '../../hooks/useRideListener';
import { useAuth } from '../../contexts/AuthContext';
import { driverAPI } from '../../services/driverAPI';
import DriverStatusCard from '../../components/driver/DriverStatusCard';
import OnlineToggle from '../../components/driver/OnlineToggle';
import EarningsCard from '../../components/driver/EarningsCard';
import RideStatusCard from '../../components/driver/RideStatusCard';
import WalletWarning from '../../components/wallet/WalletWarning';
import MenuButton from '../../components/driver/MenuButton';
import SideMenu from '../../components/driver/SideMenu';
import { RideRequestSheet } from '../../components/driver/ride-request/RideRequestSheet';
import { colors } from '../../constants/theme';
import { WALLET_MINIMUM } from '../../constants/wallet';
import { diagLogger } from '../../utils/diagLog';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const BOTTOM_PANEL_HEIGHT = SCREEN_HEIGHT * 0.35;

function isValidGpsCoords(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    (lat !== 0 || lng !== 0) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
}

export default function DriverHomeScreen() {
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const { driver, is_online, setDriver, setOnline, setStatus, logout, location: driverLocation } = useDriverStore();
  const { balance } = useWalletStore();
  const { startTracking, stopTracking, isTracking } = useDriverLocation();
  const { user, authUser, authState, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const [fetching, setFetching] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const contentOffset = useSharedValue(0);
  // Map boot region: valid persisted driver location only (fast initial
  // position while waiting for fresh GPS). Never a fabricated city.
  // May be null when no valid location exists yet — the camera is then
  // positioned once the first valid fix arrives (see auto-center effect).
  const [bootRegion] = useState(() => {
    const loc = useDriverStore.getState().location;
    if (loc && isValidGpsCoords(loc.latitude, loc.longitude)) {
      return {
        latitude: loc.latitude,
        longitude: loc.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };
    }
    return null;
  });
  const mountTimeRef = useRef(Date.now());
  const didAutoCenterRef = useRef(false);

  const fetchData = useCallback(() => {
    if (authState === 'BOOTSTRAPPING') return;
    if (!authUser) {
      if (authState === 'UNAUTHENTICATED') {
        router.replace('/(auth)/login');
      }
      return;
    }
    setFetching(true);
    setFetchError(null);
    diagLogger.log('PROFILE_FETCH_START');
    driverAPI.getMyProfile()
      .then((profile) => {
        setDriver(profile);
        diagLogger.log('PROFILE_FETCH_OK');
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        diagLogger.log('PROFILE_FETCH_ERROR', msg);
        if (msg.includes('404')) {
          router.replace('/(auth)/kyc');
          return;
        }
        setFetchError(msg);
      })
      .finally(() => {
        setFetching(false);
      });
  }, [authUser, authState, router, setDriver]);

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

  // Concern A: one-shot startup GPS for map initialization.
  // Runs on mount independently of is_online. Continuous watch tracking
  // when online (above) is a separate concern and is left unchanged.
  useEffect(() => {
    let cancelled = false;
    diagLogger.log('HOME_LOCATION_STARTUP_BEGIN');
    void (async () => {
      try {
        if (!(await locationService.isServiceEnabled())) {
          diagLogger.log('HOME_LOCATION_STARTUP_SERVICES_DISABLED');
          return;
        }
        if (cancelled) return;
        const granted = await locationService.requestPermissions();
        if (cancelled) return;
        if (!granted) {
          diagLogger.log('HOME_LOCATION_STARTUP_PERMISSION_DENIED');
          return;
        }
        const pos = await locationService.getCurrentPosition();
        if (cancelled) return;
        const { latitude, longitude } = pos.coords;
        if (!isValidGpsCoords(latitude, longitude)) {
          diagLogger.log('HOME_LOCATION_STARTUP_GPS_INVALID');
          return;
        }
        useDriverStore.getState().setLocation({
          latitude,
          longitude,
          accuracy: pos.coords.accuracy ?? 0,
          timestamp: Date.now(),
          heading: pos.coords.heading != null && pos.coords.heading >= 0 ? pos.coords.heading : undefined,
        });
        diagLogger.log('HOME_LOCATION_STARTUP_GPS_READY', `lat=${latitude.toFixed(5)} lng=${longitude.toFixed(5)}`);
      } catch (e) {
        if (!cancelled) {
          diagLogger.log('HOME_LOCATION_STARTUP_ERROR', e instanceof Error ? e.message : String(e));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // initialRegion is mount-time only, so a GPS fix arriving after mount
  // needs one explicit camera move. This runs at most once: online watch
  // updates must never fight the camera.
  useEffect(() => {
    if (didAutoCenterRef.current) return;
    if (!driverLocation || !isValidGpsCoords(driverLocation.latitude, driverLocation.longitude)) return;
    // Map already booted on the persisted fix; wait for a fresh fix.
    if (bootRegion && driverLocation.timestamp <= mountTimeRef.current) return;
    didAutoCenterRef.current = true;
    mapRef.current?.animateToRegion(
      {
        latitude: driverLocation.latitude,
        longitude: driverLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      },
      800
    );
    diagLogger.log('HOME_MAP_AUTO_CENTER', `lat=${driverLocation.latitude.toFixed(5)} lng=${driverLocation.longitude.toFixed(5)}`);
  }, [driverLocation, bootRegion]);

  useRideListener();

  const current_request = useRideStore((s) => s.current_request);

  const handleToggleOnline = useCallback((online: boolean) => {
    setOnline(online);
    setStatus(online ? 'ONLINE_IDLE' : 'OFFLINE');
    diagLogger.log('ONLINE_TOGGLE', online ? 'going-online' : 'going-offline');
    if (online) {
      driverAPI.setOnline(driver?.vehicle_type, driver?.vehicle_number)
        .then(() => diagLogger.log('ONLINE_ACK', `rideType=${driver?.vehicle_type} vehicle=${driver?.vehicle_number}`))
        .catch((e) => diagLogger.log('ONLINE_API_ERROR', e instanceof Error ? e.message : String(e)));
    } else {
      driverAPI.setOffline()
        .then(() => diagLogger.log('OFFLINE_ACK'))
        .catch((e) => diagLogger.log('OFFLINE_API_ERROR', e instanceof Error ? e.message : String(e)));
    }
  }, [setOnline, setStatus, driver?.vehicle_type, driver?.vehicle_number]);

  const handleMenuToggle = useCallback(() => {
    setIsMenuOpen((prev) => !prev);
  }, []);

  const handleMenuClose = useCallback(() => {
    setIsMenuOpen(false);
  }, []);

  const handleMenuNavigate = useCallback((route: string) => {
    setIsMenuOpen(false);
    setTimeout(() => router.push(route as any), 350);
  }, [router]);

  const handleLogout = useCallback(() => {
    setIsMenuOpen(false);
    setTimeout(() => {
      void (async () => {
        if (is_online) {
          await driverAPI.setOffline().catch(() => {});
        }
        await signOut();
        logout();
        useRideStore.getState().clearRide();
        router.replace('/(auth)/login');
      })();
    }, 350);
  }, [signOut, logout, router, is_online]);

  const contentAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: contentOffset.value }],
  }));

  const handleRecenter = useCallback(async () => {
    try {
      let lat: number;
      let lng: number;
      const stored = useDriverStore.getState().location;
      if (stored && isValidGpsCoords(stored.latitude, stored.longitude)) {
        lat = stored.latitude;
        lng = stored.longitude;
      } else {
        // Retry live GPS (covers permission-denied-then-granted and
        // temporarily-unavailable cases).
        const pos = await locationService.getCurrentPosition();
        if (!isValidGpsCoords(pos.coords.latitude, pos.coords.longitude)) return;
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
        useDriverStore.getState().setLocation({
          latitude: lat,
          longitude: lng,
          accuracy: pos.coords.accuracy ?? 0,
          timestamp: Date.now(),
          heading: pos.coords.heading != null && pos.coords.heading >= 0 ? pos.coords.heading : undefined,
        });
      }
      didAutoCenterRef.current = true;
      mapRef.current?.animateToRegion({
        latitude: lat,
        longitude: lng,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 500);
    } catch (e) {
      diagLogger.log('HOME_RECENTER_ERROR', e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    contentOffset.value = withTiming(isMenuOpen ? 60 : 0, {
      duration: 350,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
    });
  }, [isMenuOpen, contentOffset]);

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
        <Animated.View style={[StyleSheet.absoluteFill, contentAnimatedStyle]}>
          <MapView
            ref={mapRef}
            style={styles.map}
            showsUserLocation
            showsMyLocationButton={false}
            mapPadding={{ top: insets.top, right: 0, bottom: 0, left: 0 }}
            initialRegion={bootRegion ?? undefined}
          />

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
                {balance < WALLET_MINIMUM && <WalletWarning balance={balance} />}
              </View>
            </ScrollView>
          </View>
        </Animated.View>

        <View style={[styles.onlineToggleContainer, { top: insets.top + 16 }]}>
          <OnlineToggle onToggle={handleToggleOnline} />
        </View>

        <View style={[styles.statusCardWrapper, { top: insets.top + 80 }]}>
          <RideStatusCard />
        </View>

        <MenuButton onPress={handleMenuToggle} />
        <SideMenu
          isOpen={isMenuOpen}
          onClose={handleMenuClose}
          onNavigate={handleMenuNavigate}
          onLogout={handleLogout}
          driverName={user?.full_name}
        />

        <TouchableOpacity
          style={[styles.recenterButton, { bottom: BOTTOM_PANEL_HEIGHT + 20 }]}
          onPress={handleRecenter}
          activeOpacity={0.7}
        >
          <Ionicons name="locate-outline" size={22} color="#111111" />
        </TouchableOpacity>

        {current_request ? <RideRequestSheet key={current_request.rideId} request={current_request} /> : null}
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
  onlineToggleContainer: {
    position: 'absolute',
    right: 20,
    zIndex: 10,
  },
  recenterButton: {
    position: 'absolute',
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
    zIndex: 10,
  },
  statusCardWrapper: {
    position: 'absolute',
    left: 20,
    right: 20,
    zIndex: 9,
    alignItems: 'center',
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
