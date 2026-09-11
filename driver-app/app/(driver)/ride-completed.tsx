import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useDriverStore } from '../../store/driverStore';
import { useRideStore } from '../../store/rideStore';
import { colors, spacing, borderRadius, fontSize, fontFamily } from '../../constants/theme';

export default function RideCompletedScreen() {
  const router = useRouter();
  const { setStatus, earnings_today, setEarningsToday } = useDriverStore();
  const { current_ride, clearRide } = useRideStore();

  // Display-only: fare comes from the backend-authoritative ride row.
  // No commission model exists server-side today (commission = 0 by policy);
  // earnings_today is a local display accumulator, not a ledger balance.
  const fare = current_ride?.fare || 0;
  const commission = 0;
  const earnings = fare;

  const handleDone = () => {
    const ts = new Date().toISOString();
     
    console.log(`[RIDEWAY-DIAG] DRIVER_RIDE_STATE_UPDATED ts=${ts} rideId=${current_ride?.id ?? 'null'} status=RIDE_COMPLETED->ONLINE_IDLE`);
     
    console.log(`[RIDEWAY-DIAG] RIDER_ACTIVE_RIDE_CLEARED ts=${ts} rideId=${current_ride?.id ?? 'null'} reason=driver_done`);
    setStatus('ONLINE_IDLE');
    setEarningsToday(earnings_today + earnings);
    clearRide();
    router.replace('/(driver)/home');
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="checkmark" size={40} color={colors.background} />
        </View>

        <Text style={styles.title}>Ride Completed!</Text>
        <Text style={styles.subtitle}>Great job! Here&apos;s your summary</Text>

        <View style={styles.summaryCard}>
          <View style={styles.row}>
            <Text style={styles.label}>Trip Fare</Text>
            <Text style={styles.value}>₹{fare}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Commission</Text>
            <Text style={styles.deduction}>- ₹{commission}</Text>
          </View>
          <View style={[styles.row, styles.totalRow]}>
            <Text style={styles.totalLabel}>Your Earnings</Text>
            <Text style={styles.totalValue}>₹{earnings}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.button} onPress={handleDone}>
          <Text style={styles.buttonText}>Done</Text>
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
  content: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.success,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: fontSize.xxl,
    fontFamily: fontFamily.bold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.regular,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  label: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.regular,
    color: colors.textSecondary,
  },
  value: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.medium,
    color: colors.text,
  },
  deduction: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.medium,
    color: colors.error,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    marginBottom: 0,
  },
  totalLabel: {
    fontSize: fontSize.lg,
    fontFamily: fontFamily.semibold,
    color: colors.text,
  },
  totalValue: {
    fontSize: fontSize.lg,
    fontFamily: fontFamily.bold,
    color: colors.success,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: fontSize.lg,
    fontFamily: fontFamily.semibold,
    color: colors.background,
  },
});
