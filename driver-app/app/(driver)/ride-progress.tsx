import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useRouter } from 'expo-router';
import { useDriverStore } from '../../store/driverStore';
import { useRideStore } from '../../store/rideStore';
import { colors, spacing, borderRadius, fontSize, fontWeight } from '../../constants/theme';

const { width, height } = Dimensions.get('window');

export default function RideProgressScreen() {
  const router = useRouter();
  const { setStatus } = useDriverStore();
  const { current_ride } = useRideStore();
  const [otp, setOtp] = useState('');

  const pickup = current_ride?.pickup_location;
  const drop = current_ride?.drop_location;

  const handleStartRide = () => {
    setStatus('RIDE_STARTED');
    router.push('/(driver)/drop-navigation');
  };

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        showsUserLocation
        initialRegion={{
          latitude: pickup?.latitude || 12.9716,
          longitude: pickup?.longitude || 77.5946,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }}
      >
        {pickup && <Marker coordinate={pickup} title="Pickup" />}
        {drop && <Marker coordinate={drop} title="Drop" />}
      </MapView>

      <View style={styles.bottomCard}>
        <Text style={styles.title}>Rider has boarded</Text>
        
        <View style={styles.otpContainer}>
          <Text style={styles.otpLabel}>Enter OTP to start ride</Text>
          <View style={styles.otpInputs}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={styles.otpBox}>
                <Text style={styles.otpText}>{otp[i] || ''}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.info}>
          <Text style={styles.infoLabel}>Trip to</Text>
          <Text style={styles.infoAddress}>{drop?.address || 'Loading...'}</Text>
        </View>

        <TouchableOpacity 
          style={[styles.startButton, otp.length < 4 && styles.buttonDisabled]} 
          onPress={handleStartRide}
          disabled={otp.length < 4}
        >
          <Text style={styles.startText}>Start Ride</Text>
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
  map: {
    width: width,
    height: height,
  },
  bottomCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.background,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  otpContainer: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  otpLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  otpInputs: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  otpBox: {
    width: 50,
    height: 50,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  otpText: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  info: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  infoLabel: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  infoAddress: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.text,
  },
  startButton: {
    backgroundColor: colors.success,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  startText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.background,
  },
});