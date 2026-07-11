import { View, Text, StyleSheet, FlatList } from 'react-native';
import { useDriverStore } from '../../store/driverStore';
import { colors, spacing, borderRadius, fontSize, fontWeight } from '../../constants/theme';

// In production: fetch weekly earnings from backend
const weeklyDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function EarningsScreen() {
  const { earnings_today } = useDriverStore();

  const weeklyTotal = 0;
  const averageDaily = 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Earnings</Text>
      </View>

      <View style={styles.todayCard}>
        <Text style={styles.todayLabel}>Today's Earnings</Text>
        <Text style={styles.todayAmount}>₹{earnings_today}</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>This Week</Text>
          <Text style={styles.statValue}>₹{weeklyTotal}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Daily Avg</Text>
          <Text style={styles.statValue}>₹{averageDaily}</Text>
        </View>
      </View>

      <View style={styles.weeklySection}>
        <Text style={styles.sectionTitle}>This Week</Text>
        <View style={styles.weeklyChart}>
          {weeklyDays.map((day, index) => (
            <View key={index} style={styles.barContainer}>
              <View style={styles.bar} />
              <Text style={styles.barLabel}>{day}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: spacing.lg,
    paddingTop: spacing.xxl,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  todayCard: {
    backgroundColor: colors.primary,
    marginHorizontal: spacing.md,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    alignItems: 'center',
  },
  todayLabel: {
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: spacing.xs,
  },
  todayAmount: {
    fontSize: fontSize.xxxl,
    fontWeight: fontWeight.bold,
    color: colors.background,
  },
  statsRow: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.md,
  },
  statItem: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  statValue: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  weeklySection: {
    padding: spacing.md,
    flex: 1,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  weeklyChart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 150,
  },
  barContainer: {
    alignItems: 'center',
    flex: 1,
  },
  bar: {
    width: 30,
    height: 4,
    backgroundColor: colors.accent,
    borderRadius: 4,
    marginBottom: spacing.xs,
  },
  barLabel: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
});