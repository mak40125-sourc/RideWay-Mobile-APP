import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useDriverStore } from '../../store/driverStore';

export default function SplashScreen() {
  const router = useRouter();
  const { driver, is_online } = useDriverStore();

  useEffect(() => {
    const checkAuth = async () => {
      setTimeout(() => {
        if (driver) {
          router.replace('/(driver)/home');
        } else {
          router.replace('/(auth)/login');
        }
      }, 1500);
    };

    checkAuth();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>RideWay</Text>
      <Text style={styles.tagline}>Driver App</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111111',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    fontSize: 48,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 18,
    color: '#9CA3AF',
    marginTop: 8,
  },
});