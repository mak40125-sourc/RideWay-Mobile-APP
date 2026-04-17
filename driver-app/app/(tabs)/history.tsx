import { View, Text, FlatList, StyleSheet } from 'react-native';
import { colors, spacing, borderRadius, fontSize, fontWeight } from '../../constants/theme';

const mockRideHistory = [
  { id: '1', date: 'Today', pickup: 'MG Road', drop: 'Koramangala', fare: 180, status: 'Completed' },
  { id: '2', date: 'Today', pickup: 'Indiranagar', drop: 'Whitefield', fare: 250, status: 'Completed' },
  { id: '3', date: 'Yesterday', pickup: 'HSR Layout', drop: 'Marathahalli', fare: 145, status: 'Completed' },
  { id: '4', date: 'Yesterday', pickup: 'Electronic City', drop: 'Banashankari', fare: 320, status: 'Completed' },
  { id: '5', date: 'Mar 15', pickup: 'Jayanagar', drop: 'M.G. Road', fare: 190, status: 'Completed' },
];

export default function HistoryScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Ride History</Text>
      </View>

      <FlatList
        data={mockRideHistory}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.rideCard}>
            <View style={styles.rideHeader}>
              <Text style={styles.rideDate}>{item.date}</Text>
              <Text style={styles.rideStatus}>{item.status}</Text>
            </View>
            <View style={styles.rideRoute}>
              <View style={styles.routePoint}>
                <View style={styles.dot} />
                <Text style={styles.routeText}>{item.pickup}</Text>
              </View>
              <View style={styles.routePoint}>
                <View style={[styles.dot, styles.dotDrop]} />
                <Text style={styles.routeText}>{item.drop}</Text>
              </View>
            </View>
            <View style={styles.rideFooter}>
              <Text style={styles.fareLabel}>Fare</Text>
              <Text style={styles.fareAmount}>₹{item.fare}</Text>
            </View>
          </View>
        )}
      />
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
  list: {
    padding: spacing.md,
  },
  rideCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  rideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  rideDate: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  rideStatus: {
    fontSize: fontSize.sm,
    color: colors.success,
    fontWeight: fontWeight.medium,
  },
  rideRoute: {
    marginBottom: spacing.md,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
    marginRight: spacing.sm,
  },
  dotDrop: {
    backgroundColor: colors.error,
  },
  routeText: {
    fontSize: fontSize.md,
    color: colors.text,
  },
  rideFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  fareLabel: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  fareAmount: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
});