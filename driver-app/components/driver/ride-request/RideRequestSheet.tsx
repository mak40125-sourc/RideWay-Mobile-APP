import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RideRequest } from '../../../types/ride';
import { useRideStore } from '../../../store/rideStore';
import { useDriverStore } from '../../../store/driverStore';
import { rideAPI } from '../../../services/rideAPI';
import { diagLogger } from '../../../utils/diagLog';
import { velosColors, fontFamily } from '../../../constants/theme';
import { CountdownRing } from './CountdownRing';
import { TripSummary } from './TripSummary';
import { RouteCard } from './RouteCard';
import { RiderCard } from './RiderCard';
import { VehiclePaymentRow } from './VehiclePaymentRow';

// Mirrors the backend ride:request Redis TTL; only used when the connected
// backend predates the expiresAt payload field.
const FALLBACK_OFFER_WINDOW_MS = 120_000;
const URGENT_THRESHOLD_S = 10;

const ENTER_MS = 340;
const CONTENT_ENTER_MS = 280;
const EXIT_MS = 260;
const INITIAL_OFFSET = 900;

type Props = { request: RideRequest };

/**
 * Floating ride-request surface presented over the persistent driver map.
 * Consumes the live socket offer object; acceptance/dejection flow through the
 * existing rideAPI + rideStore lifecycle — no second lifecycle exists here.
 */
export const RideRequestSheet = ({ request }: Props) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const setStatus = useDriverStore((s) => s.setStatus);
  const isOnline = useDriverStore((s) => s.is_online);
  const driverVehicleType = useDriverStore((s) => s.driver?.vehicle_type ?? null);

  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const acceptingRef = useRef(false);
  const settledRef = useRef(false);
  const exitingRef = useRef(false);

  const translateY = useSharedValue(INITIAL_OFFSET);
  const contentIn = useSharedValue(0);

  const expiryMs = useMemo(
    () =>
      typeof request.expiresAt === 'number' && request.expiresAt > Date.now()
        ? request.expiresAt
        : Date.now() + FALLBACK_OFFER_WINDOW_MS,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [request.rideId]
  );

  const computeSecondsLeft = useCallback(
    () => Math.ceil((expiryMs - Date.now()) / 1000),
    [expiryMs]
  );

  const [secondsLeft, setSecondsLeft] = useState(computeSecondsLeft);

  // ── Entrance (Flow Motion): sheet rises from bottom, content follows ──
  useEffect(() => {
    translateY.value = withTiming(0, { duration: ENTER_MS, easing: Easing.out(Easing.cubic) });
    contentIn.value = withDelay(
      60,
      withTiming(1, { duration: CONTENT_ENTER_MS, easing: Easing.out(Easing.cubic) })
    );
  }, [translateY, contentIn]);

  const commitDismiss = useCallback(() => {
    // Clear only the ephemeral offer; current_ride recovery cache is untouched.
    useRideStore.getState().setCurrentRequest(null);
  }, []);

  const beginExit = useCallback(() => {
    if (exitingRef.current) return;
    exitingRef.current = true;
    setAccepting(false);
    translateY.value = withTiming(
      INITIAL_OFFSET,
      { duration: EXIT_MS, easing: Easing.in(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(commitDismiss)();
      }
    );
  }, [commitDismiss, translateY]);

  // ── Offer countdown against the authoritative backend deadline ──
  useEffect(() => {
    diagLogger.log('RIDE_REQUEST_RENDERED', `rideId=${request.rideId} fare=${request.fare} dist=${request.distance}`);
    const id = setInterval(() => {
      if (settledRef.current || exitingRef.current) return;
      const left = computeSecondsLeft();
      setSecondsLeft(left);
      if (left <= 0) {
        settledRef.current = true;
        diagLogger.log('RIDE_OFFER_EXPIRED', `rideId=${request.rideId}`);
        beginExit();
      }
    }, 300);
    return () => clearInterval(id);
  }, [computeSecondsLeft, beginExit, request.rideId, request.fare, request.distance]);

  // A driver who goes offline while reviewing loses the offer quietly.
  useEffect(() => {
    if (!isOnline && !settledRef.current && !exitingRef.current) {
      settledRef.current = true;
      diagLogger.log('RIDE_REQUEST_DISMISSED', `rideId=${request.rideId} reason=went-offline`);
      beginExit();
    }
  }, [isOnline, beginExit, request.rideId]);

  const handleDecline = useCallback(() => {
    if (settledRef.current || acceptingRef.current || exitingRef.current) return;
    settledRef.current = true;
    diagLogger.log('RIDE_DECLINE', `rideId=${request.rideId}`);
    beginExit();
  }, [beginExit, request.rideId]);

  const handleAccept = useCallback(async () => {
    if (acceptingRef.current || settledRef.current || exitingRef.current) return;
    acceptingRef.current = true;
    setAccepting(true);
    setAcceptError(null);
    diagLogger.log('RIDE_ACCEPT_PRESS', `rideId=${request.rideId}`);

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    try {
      const ride = await rideAPI.acceptRide(request.rideId);
      settledRef.current = true;
      diagLogger.log('RIDE_ACCEPT_OK', `rideId=${request.rideId} driverId=${ride.driver_id}`);
      useRideStore.getState().setCurrentRide(ride);
      setStatus('NAVIGATING_TO_PICKUP');
      // current_request is intentionally kept: pickup-navigation reads the
      // offer's pickup address as its fallback data source.
      router.push('/(driver)/pickup-navigation');
    } catch (err) {
      const status = (err as Error & { status?: number }).status;
      const message = err instanceof Error ? err.message : String(err);
      diagLogger.log('RIDE_ACCEPT_ERROR', `rideId=${request.rideId} status=${status} ${message}`);

      if (
        status === 400 ||
        status === 409 ||
        /already|no longer|assigned|accepted|taken/i.test(message)
      ) {
        // The ride found another driver — dismiss without blaming the network.
        settledRef.current = true;
        diagLogger.log('RIDE_TAKEN', `rideId=${request.rideId}`);
        beginExit();
      } else {
        acceptingRef.current = false;
        setAccepting(false);
        setAcceptError('Could not reach Velos. Check your connection and try again.');
      }
    }
  }, [beginExit, request.rideId, router, setStatus]);

  const urgent = secondsLeft <= URGENT_THRESHOLD_S;

  const sheetAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const contentAnimStyle = useAnimatedStyle(() => ({
    opacity: contentIn.value,
    transform: [
      { translateY: interpolate(contentIn.value, [0, 1], [14, 0], 'clamp') },
    ],
  }));

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {/* Subdued focus layer — map stays visible beneath */}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.scrim]} />

      <View pointerEvents="none" style={[styles.topBar, { top: insets.top + 12 }]}>
        <Text style={styles.brand} maxFontSizeMultiplier={1.2}>
          VELOS
        </Text>
        <View style={styles.statusChip}>
          <View style={[styles.statusDot, !isOnline && styles.statusDotOff]} />
          <Text style={[styles.statusText, !isOnline && styles.statusTextOff]} maxFontSizeMultiplier={1.2}>
            {isOnline ? 'Online' : 'Offline'}
          </Text>
        </View>
      </View>

      <Animated.View
        style={[
          styles.sheet,
          { bottom: Math.max(insets.bottom, 10) + 10 },
          sheetAnimStyle,
        ]}
      >
        <View style={styles.handle} />

        <Animated.View style={contentAnimStyle}>
          <ScrollView
            bounces={false}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.requestHeader}>
              <View style={styles.badge}>
                <Text style={styles.badgeText} maxFontSizeMultiplier={1.2}>
                  NEW RIDE REQUEST
                </Text>
              </View>
              <CountdownRing secondsLeft={secondsLeft} urgent={urgent} />
            </View>

            <Text style={styles.title} maxFontSizeMultiplier={1.25}>
              New ride nearby
            </Text>
            <Text style={styles.subtitle}>Review the trip and accept when ready</Text>

            <View style={styles.summaryWrap}>
              <TripSummary fare={request.fare} distance={request.distance} duration={request.duration} />
            </View>

            <RouteCard pickup={request.pickup} dropoff={request.dropoff} />

            <View style={styles.riderBand}>
              <RiderCard
                riderName={request.riderName}
                passengerName={request.passengerName}
                passengerPhone={request.passengerPhone}
              />
            </View>

            <VehiclePaymentRow vehicleType={driverVehicleType} />
          </ScrollView>
        </Animated.View>

        {acceptError ? <Text style={styles.errorText}>{acceptError}</Text> : null}

        <View style={[styles.actions, { paddingBottom: 4 }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Decline ride"
            onPress={handleDecline}
            disabled={accepting}
            style={({ pressed }) => [styles.declineBtn, pressed && styles.pressed]}
          >
            <Text style={styles.declineText}>DECLINE</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Accept ride"
            onPress={handleAccept}
            disabled={accepting}
            style={({ pressed }) => [
              styles.acceptBtn,
              pressed && !accepting && styles.pressed,
              accepting && styles.btnBusy,
            ]}
          >
            {accepting ? (
              <ActivityIndicator color={velosColors.white} size="small" />
            ) : (
              <Text style={styles.acceptText}>ACCEPT RIDE</Text>
            )}
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  scrim: {
    backgroundColor: 'rgba(15, 29, 42, 0.14)',
  },
  topBar: {
    position: 'absolute',
    left: 24,
    right: 96,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {
    fontSize: 15,
    letterSpacing: 4,
    fontFamily: fontFamily.semibold,
    color: velosColors.navy,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: velosColors.mintSoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: velosColors.green,
  },
  statusDotOff: {
    backgroundColor: velosColors.mutedText,
  },
  statusText: {
    fontSize: 12,
    fontFamily: fontFamily.medium,
    color: velosColors.green,
  },
  statusTextOff: {
    color: velosColors.mutedText,
  },
  sheet: {
    position: 'absolute',
    left: 16,
    right: 16,
    maxHeight: '80%',
    backgroundColor: velosColors.white,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: velosColors.borderSoft,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: velosColors.borderSoft,
    marginTop: 4,
    marginBottom: 14,
  },
  scrollContent: {
    paddingBottom: 6,
  },
  requestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badge: {
    backgroundColor: velosColors.mintSoft,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: {
    fontSize: 10,
    letterSpacing: 1.2,
    fontFamily: fontFamily.bold,
    color: velosColors.green,
  },
  title: {
    marginTop: 16,
    fontSize: 24,
    lineHeight: 30,
    fontFamily: fontFamily.bold,
    color: velosColors.navy,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fontFamily.regular,
    color: velosColors.mutedText,
  },
  summaryWrap: {
    marginTop: 18,
  },
  riderBand: {
    marginTop: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: velosColors.borderSoft,
  },
  errorText: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fontFamily.medium,
    color: '#EF4444',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 14,
  },
  pressed: {
    opacity: 0.88,
  },
  btnBusy: {
    opacity: 0.85,
  },
  declineBtn: {
    flex: 35,
    minHeight: 54,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: velosColors.borderSoft,
    backgroundColor: velosColors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineText: {
    fontSize: 13,
    letterSpacing: 0.8,
    fontFamily: fontFamily.semibold,
    color: velosColors.navy,
  },
  acceptBtn: {
    flex: 65,
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: velosColors.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptText: {
    fontSize: 15,
    letterSpacing: 0.5,
    fontFamily: fontFamily.semibold,
    color: velosColors.white,
  },
});
