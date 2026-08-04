import { View, Text, StyleSheet } from 'react-native';
import { useDriverStore } from '../../store/driverStore';

const STATUS_MESSAGES: Record<string, { message: string; color: string }> = {
  OFFLINE: { message: 'You are offline', color: '#9CA3AF' },
  ONLINE_IDLE: { message: 'Waiting for ride requests...', color: '#10B981' },
  REQUEST_RECEIVED: { message: 'New ride request!', color: '#F59E0B' },
  ACCEPTED: { message: 'Heading to pickup', color: '#111111' },
  NAVIGATING_TO_PICKUP: { message: 'Navigating to pickup', color: '#111111' },
  ARRIVED_AT_PICKUP: { message: 'Arrived at pickup', color: '#10B981' },
  RIDE_STARTED: { message: 'Ride in progress', color: '#111111' },
  NAVIGATING_TO_DROP: { message: 'Navigating to drop', color: '#111111' },
  RIDE_COMPLETED: { message: 'Ride completed', color: '#10B981' },
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
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  message: {
    fontFamily: 'GeneralSans-Medium',
    fontSize: 16,
    color: '#111111',
  },
});
