import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useRideStore } from '../../store/rideStore';
import { useDriverStore } from '../../store/driverStore';
import { rideAPI } from '../../services/rideAPI';
import { colors, spacing, borderRadius, fontSize, fontWeight } from '../../constants/theme';

export default function RideRequestModal() {
  const router = useRouter();
  const { current_request, clearRide } = useRideStore();
  const { setStatus, setDriver } = useDriverStore();
  const [timeLeft, setTimeLeft] = useState(15);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleReject();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleAccept = async () => {
    if (!current_request || accepting) return;
    setAccepting(true);
    try {
      const ride = await rideAPI.acceptRide(current_request.rideId);
      useRideStore.getState().setCurrentRide(ride);
      setStatus('NAVIGATING_TO_PICKUP');
      router.back();
      router.push('/(driver)/pickup-navigation');
    } catch (err) {
      setAccepting(false);
    }
  };

  const handleReject = () => {
    clearRide();
    router.back();
  };

  if (!current_request) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>No ride request</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.timer}>{timeLeft}s</Text>
        <Text style={styles.title}>New Ride Request</Text>

        <View style={styles.locationSection}>
          <View style={styles.locationRow}>
            <View style={styles.greenDot} />
            <View>
              <Text style={styles.locationLabel}>Pickup</Text>
              <Text style={styles.locationAddress}>
                {current_request.pickup.address || `${current_request.pickup.lat.toFixed(4)}, ${current_request.pickup.lng.toFixed(4)}`}
              </Text>
            </View>
          </View>
          <View style={styles.locationRow}>
            <View style={styles.redDot} />
            <View>
              <Text style={styles.locationLabel}>Drop</Text>
              <Text style={styles.locationAddress}>
                {current_request.dropoff.address || `${current_request.dropoff.lat.toFixed(4)}, ${current_request.dropoff.lng.toFixed(4)}`}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Distance</Text>
            <Text style={styles.infoValue}>{current_request.distance} km</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Fare</Text>
            <Text style={styles.infoValue}>₹{current_request.fare}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Rider</Text>
            <Text style={styles.infoValue}>{current_request.riderName}</Text>
          </View>
        </View>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.rejectBtn}
            onPress={handleReject}
            disabled={accepting}
          >
            <Text style={styles.rejectText}>Reject</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.acceptBtn, accepting && styles.buttonDisabled]}
            onPress={handleAccept}
            disabled={accepting}
          >
            {accepting ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text style={styles.acceptText}>Accept</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  content: {
    backgroundColor: colors.background,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  timer: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.warning,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  locationSection: {
    marginBottom: spacing.lg,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  greenDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.success,
    marginTop: 4,
    marginRight: spacing.md,
  },
  redDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.error,
    marginTop: 4,
    marginRight: spacing.md,
  },
  locationLabel: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginBottom: 2,
  },
  locationAddress: {
    fontSize: fontSize.md,
    color: colors.text,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  infoItem: {
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  infoValue: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  rejectBtn: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  rejectText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.error,
  },
  acceptBtn: {
    flex: 1,
    backgroundColor: colors.success,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  acceptText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.background,
  },
  emptyText: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    textAlign: 'center',
    padding: spacing.xl,
  },
});
