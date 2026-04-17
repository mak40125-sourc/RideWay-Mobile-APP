import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import type { RideRequest } from '../../types/ride';
import { colors, spacing, borderRadius, fontSize, fontWeight } from '../../constants/theme';

interface RideRequestModalProps {
  request: RideRequest;
  onAccept: () => void;
  onReject: () => void;
}

export default function RideRequestModal({ request, onAccept, onReject }: RideRequestModalProps) {
  const [timeLeft, setTimeLeft] = useState(10);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onReject();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Modal visible transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.timer}>{timeLeft}s</Text>
            <Text style={styles.title}>New Ride Request</Text>
          </View>

          <View style={styles.rideInfo}>
            <View style={styles.locationRow}>
              <View style={styles.dot} />
              <View style={styles.locationText}>
                <Text style={styles.label}>Pickup</Text>
                <Text style={styles.address}>{request.pickup.address}</Text>
              </View>
            </View>
            <View style={styles.locationRow}>
              <View style={[styles.dot, styles.dotDrop]} />
              <View style={styles.locationText}>
                <Text style={styles.label}>Drop</Text>
                <Text style={styles.address}>{request.drop.address}</Text>
              </View>
            </View>
          </View>

          <View style={styles.fareRow}>
            <View style={styles.fareItem}>
              <Text style={styles.fareLabel}>Distance</Text>
              <Text style={styles.fareValue}>{request.distance_km} km</Text>
            </View>
            <View style={styles.fareItem}>
              <Text style={styles.fareLabel}>Estimated Fare</Text>
              <Text style={styles.fareValue}>₹{request.estimated_fare}</Text>
            </View>
            <View style={styles.fareItem}>
              <Text style={styles.fareLabel}>Rider Rating</Text>
              <Text style={styles.fareValue}>⭐ {request.rider_rating}</Text>
            </View>
          </View>

          <View style={styles.riderInfo}>
            <Text style={styles.riderName}>{request.rider_name}</Text>
          </View>

          <View style={styles.buttons}>
            <TouchableOpacity style={styles.rejectButton} onPress={onReject}>
              <Text style={styles.rejectText}>Reject</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.acceptButton} onPress={onAccept}>
              <Text style={styles.acceptText}>Accept</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: colors.background,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  timer: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.warning,
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  rideInfo: {
    marginBottom: spacing.lg,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.success,
    marginTop: 4,
    marginRight: spacing.md,
  },
  dotDrop: {
    backgroundColor: colors.error,
  },
  locationText: {
    flex: 1,
  },
  label: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginBottom: 2,
  },
  address: {
    fontSize: fontSize.md,
    color: colors.text,
  },
  fareRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  fareItem: {
    alignItems: 'center',
  },
  fareLabel: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  fareValue: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  riderInfo: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  riderName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.text,
  },
  buttons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  rejectButton: {
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
  acceptButton: {
    flex: 1,
    backgroundColor: colors.success,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  acceptText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.background,
  },
});