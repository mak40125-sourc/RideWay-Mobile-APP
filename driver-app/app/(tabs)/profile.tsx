import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useDriverStore } from '../../store/driverStore';
import { colors, spacing, borderRadius, fontSize, fontWeight } from '../../constants/theme';

export default function ProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { driver, logout } = useDriverStore();

  const handleLogout = () => {
    logout();
    router.replace('/(auth)/login');
  };

  const menuItems = [
    { label: 'Settings', icon: 'settings-outline' as const, onPress: () => router.push('/(tabs)/settings') },
    { label: 'Wallet', icon: 'wallet-outline' as const, onPress: () => router.push('/(wallet)/wallet') },
    { label: 'Earnings', icon: 'trending-up-outline' as const, onPress: () => router.push('/(tabs)/earnings') },
    { label: 'Ride History', icon: 'time-outline' as const, onPress: () => router.push('/(tabs)/history') },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.full_name?.charAt(0)?.toUpperCase() || 'D'}
          </Text>
        </View>
        <Text style={styles.name}>{user?.full_name || 'Driver'}</Text>
        <Text style={styles.phone}>{user?.phone || 'Add phone'}</Text>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{'—'}</Text>
            <Text style={styles.statLabel}>Rating</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{'—'}</Text>
            <Text style={styles.statLabel}>Rides</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: driver?.is_verified ? colors.success : colors.warning }]}>
              {driver?.is_verified ? 'OK' : '—'}
            </Text>
            <Text style={styles.statLabel}>KYC</Text>
          </View>
        </View>
      </View>

      <View style={styles.menuSection}>
        {menuItems.map((item, index) => (
          <TouchableOpacity key={index} style={styles.menuItem} onPress={item.onPress}>
            <Ionicons name={item.icon} size={20} color={colors.text} style={styles.menuIcon} />
            <Text style={styles.menuLabel}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: spacing.xxl,
  },
  header: {
    alignItems: 'center',
    padding: spacing.lg,
    paddingTop: spacing.xxl,
    backgroundColor: colors.surface,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatarText: {
    fontSize: fontSize.xxxl,
    fontWeight: fontWeight.bold,
    color: colors.background,
    fontFamily: 'NeueMontreal-Bold',
  },
  name: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.xs,
    fontFamily: 'NeueMontreal-Bold',
  },
  phone: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    fontFamily: 'NeueMontreal-Regular',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stat: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.border,
  },
  statValue: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: 2,
    fontFamily: 'NeueMontreal-Bold',
  },
  statLabel: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontFamily: 'NeueMontreal-Regular',
  },
  menuSection: {
    padding: spacing.md,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  menuIcon: {
    marginRight: spacing.md,
  },
  menuLabel: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.text,
    fontFamily: 'NeueMontreal-Regular',
  },
  logoutButton: {
    marginHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.error,
  },
  logoutText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.error,
    fontFamily: 'NeueMontreal-Bold',
  },
});
