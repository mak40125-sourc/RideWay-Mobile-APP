import { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, Dimensions, ScrollView } from 'react-native';
import MapView from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { useDriverStore } from '../../store/driverStore';
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
import { colors } from '../../constants/theme';
import { WALLET_MINIMUM } from '../../constants/wallet';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const BOTTOM_PANEL_HEIGHT = SCREEN_HEIGHT * 0.35;

export default function DriverHomeScreen() {
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const { driver, is_online, setDriver, setOnline, setStatus, logout } = useDriverStore();
  const { balance } = useWalletStore();
  const { startTracking, stopTracking, isTracking } = useDriverLocation();
  const { user, authUser } = useAuth();
  const insets = useSafeAreaInsets();
  const [fetching, setFetching] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const contentOffset = useSharedValue(0);
  const [initialRegion] = useState({
    latitude: 12.9716,
    longitude: 77.5946,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });

  const fetchData = useCallback(() => {
    if (!authUser) {
      router.replace('/(auth)/login');
      return;
    }
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
  }, [authUser, router, setDriver]);

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

  useRideListener({
    onRequest: () => {
      router.push('/(modals)/ride-request');
    },
  });

  const handleToggleOnline = useCallback((online: boolean) => {
    setOnline(online);
    setStatus(online ? 'ONLINE_IDLE' : 'OFFLINE');
    if (online) {
      driverAPI.setOnline().catch(() => {});
    } else {
      driverAPI.setOffline().catch(() => {});
    }
  }, [setOnline, setStatus]);

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
      logout();
      router.replace('/(auth)/login');
    }, 350);
  }, [logout, router]);

  const contentAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: contentOffset.value }],
  }));

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
            showsMyLocationButton={true}
            mapPadding={{ top: insets.top, right: 0, bottom: 0, left: 0 }}
            initialRegion={initialRegion}
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
                <RideStatusCard />
                {balance < WALLET_MINIMUM && <WalletWarning balance={balance} />}
              </View>
            </ScrollView>
          </View>
        </Animated.View>

        <View style={[styles.onlineToggleContainer, { top: insets.top + 16 }]}>
          <OnlineToggle onToggle={handleToggleOnline} />
        </View>

        <MenuButton onPress={handleMenuToggle} />
        <SideMenu
          isOpen={isMenuOpen}
          onClose={handleMenuClose}
          onNavigate={handleMenuNavigate}
          onLogout={handleLogout}
          driverName={user?.full_name}
        />
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
