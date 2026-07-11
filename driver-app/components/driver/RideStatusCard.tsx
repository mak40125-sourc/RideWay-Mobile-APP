import { View, Text, StyleSheet } from 'react-native';
import { useDriverStore } from '../../store/driverStore';
import { colors, spacing, borderRadius, fontSize, fontWeight } from '../../constants/theme';

const STATUS_MESSAGES: Record<string, { message: string; color: string }> = {
  OFFLINE: { message: 'You are offline', color: colors.textMuted },
  ONLINE_IDLE: { message: 'Waiting for ride requests...', color: colors.success },
  REQUEST_RECEIVED: { message: 'New ride request!', color: colors.warning },
  ACCEPTED: { message: 'Heading to pickup', color: colors.accent },
  NAVIGATING_TO_PICKUP: { message: 'Navigating to pickup', color: colors.accent },
  ARRIVED_AT_PICKUP: { message: 'Arrived at pickup', color: colors.success },
  RIDE_STARTED: { message: 'Ride in progress', color: colors.accent },
  NAVIGATING_TO_DROP: { message: 'Navigating to drop', color: colors.accent },
  RIDE_COMPLETED: { message: 'Ride completed', color: colors.success },
};

export default function RideStatusCard() {
  const { status } = useDriverStore();
  const current = STATUS_MESSAGES[status] || STATUS_MESSAGES.OFFLINE;

  return (
    <View style={styles.container}>
      <View style={[styles.dot, { backgroundColor: current.color }]} />
      <Text style={styles.message}>{current.message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.sm,
  },
  message: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.text,
  },
});
