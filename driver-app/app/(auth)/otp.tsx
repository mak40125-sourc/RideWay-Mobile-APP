import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useDriverStore } from '../../store/driverStore';
import { colors, spacing, borderRadius, fontSize, fontWeight } from '../../constants/theme';

export default function OTPScreen() {
  const router = useRouter();
  const { setDriver } = useDriverStore();
  const [otp, setOtp] = useState('');
  const [timer, setTimer] = useState(30);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleVerify = () => {
    if (otp.length === 4) {
      const mockDriver = {
        id: 'driver-1',
        phone: '+919999999999',
        name: 'Test Driver',
        kyc_status: 'APPROVED' as const,
        vehicle_status: 'APPROVED' as const,
        is_online: false,
        rating: 4.8,
        total_rides: 150,
        created_at: new Date().toISOString(),
      };
      setDriver(mockDriver);
      router.replace('/(driver)/home');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Verify OTP</Text>
        <Text style={styles.subtitle}>Enter the 4-digit code sent to your phone</Text>

        <View style={styles.otpContainer}>
          {[0, 1, 2, 3].map((index) => (
            <TextInput
              key={index}
              style={styles.otpInput}
              placeholder="0"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              maxLength={1}
              value={otp[index] || ''}
              onChangeText={(text) => {
                const newOtp = otp.split('');
                newOtp[index] = text;
                setOtp(newOtp.join(''));
              }}
            />
          ))}
        </View>

        <TouchableOpacity style={[styles.button, otp.length < 4 && styles.buttonDisabled]} onPress={handleVerify} disabled={otp.length < 4}>
          <Text style={styles.buttonText}>Verify</Text>
        </TouchableOpacity>

        {timer > 0 ? (
          <Text style={styles.resendText}>Resend in {timer}s</Text>
        ) : (
          <TouchableOpacity onPress={() => setTimer(30)}>
            <Text style={styles.resendLink}>Resend OTP</Text>
          </TouchableOpacity>
        )}
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
  title: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  otpInput: {
    width: 60,
    height: 60,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    textAlign: 'center',
    color: colors.text,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: colors.background,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
  },
  resendText: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  resendLink: {
    fontSize: fontSize.md,
    color: colors.accent,
    textAlign: 'center',
    marginTop: spacing.lg,
    fontWeight: fontWeight.medium,
  },
});