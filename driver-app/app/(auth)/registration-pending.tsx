import { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { driverAPI } from '../../services/driverAPI';
import { colors, spacing, fontSize } from '../../constants/theme';

export default function RegistrationPendingScreen() {
  const router = useRouter();
  const { signOut } = useAuth();

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const driver = await driverAPI.getMyProfile();
        if (driver.is_verified) {
          router.replace('/(driver)/home');
        }
      } catch {
        // Stay on pending
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="shield-checkmark-outline" size={64} color={colors.success} />
        </View>
        <Text style={styles.title}>Application Under Review</Text>
        <Text style={styles.subtitle}>
          Your documents and vehicle details have been submitted. We'll notify you once your
          account is approved.
        </Text>
        <TouchableOpacity style={styles.button} onPress={signOut}>
          <Text style={styles.buttonText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F0FDF4',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.md,
    fontFamily: 'NeueMontreal-Bold',
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing.xl,
    fontFamily: 'NeueMontreal-Regular',
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    width: '100%',
  },
  buttonText: {
    color: colors.background,
    fontSize: fontSize.lg,
    fontWeight: '600',
    fontFamily: 'NeueMontreal-Bold',
  },
});
