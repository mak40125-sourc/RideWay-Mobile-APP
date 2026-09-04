import { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useDriverStore } from '../../store/driverStore';
import { driverAPI } from '../../services/driverAPI';
import { colors, spacing, borderRadius, fontSize, fontWeight } from '../../constants/theme';

type IconName = keyof typeof Ionicons.glyphMap;

interface SettingsItem {
  label: string;
  icon: IconName;
  route?: string;
}

const SETTINGS_SECTIONS: { section: string; items: SettingsItem[] }[] = [
  {
    section: 'Account',
    items: [
      { label: 'Edit Profile', icon: 'person-outline' as IconName, route: '/(tabs)/profile' },
      { label: 'Change Password', icon: 'lock-closed-outline' as IconName },
      { label: 'Language', icon: 'globe-outline' as IconName },
    ],
  },
  {
    section: 'Preferences',
    items: [
      { label: 'Notifications', icon: 'notifications-outline' as IconName },
      { label: 'Navigation', icon: 'navigate-outline' as IconName },
      { label: 'Auto Accept Rides', icon: 'sync-outline' as IconName },
    ],
  },
  {
    section: 'Support',
    items: [
      { label: 'Help Center', icon: 'help-circle-outline' as IconName },
      { label: 'Report Issue', icon: 'document-text-outline' as IconName },
      { label: 'Terms of Service', icon: 'newspaper-outline' as IconName },
    ],
  },
];

export default function SettingsScreen() {
  const router = useRouter();
  const { user, authUser } = useAuth();
  const { driver, setDriver } = useDriverStore();

  useEffect(() => {
    if (!authUser || driver) return;
    let mounted = true;
    driverAPI.getMyProfile()
      .then((profile) => {
        if (mounted) setDriver(profile);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [authUser, driver, setDriver]);

  const handleItemPress = (item: SettingsItem) => {
    if (item.route) {
      router.push(item.route as any);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Settings</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Driver Details</Text>
        <View style={styles.driverCard}>
          <View style={styles.driverRow}>
            <Ionicons name="person-outline" size={18} color={colors.textMuted} style={styles.driverIcon} />
            <Text style={styles.driverLabel}>Name</Text>
            <Text style={styles.driverValue}>{user?.full_name || '—'}</Text>
          </View>
          <View style={styles.driverRow}>
            <Ionicons name="call-outline" size={18} color={colors.textMuted} style={styles.driverIcon} />
            <Text style={styles.driverLabel}>Phone</Text>
            <Text style={styles.driverValue}>{user?.phone || '—'}</Text>
          </View>
          <View style={styles.driverRow}>
            <Ionicons name="car-outline" size={18} color={colors.textMuted} style={styles.driverIcon} />
            <Text style={styles.driverLabel}>Vehicle Type</Text>
            <Text style={styles.driverValue}>
              {driver?.vehicle_type ? driver.vehicle_type.charAt(0).toUpperCase() + driver.vehicle_type.slice(1) : '—'}
            </Text>
          </View>
          <View style={styles.driverRow}>
            <Ionicons name="car-sport-outline" size={18} color={colors.textMuted} style={styles.driverIcon} />
            <Text style={styles.driverLabel}>Vehicle Number</Text>
            <Text style={styles.driverValue}>{driver?.vehicle_number || '—'}</Text>
          </View>
          {driver?.vehicle_model ? (
            <View style={styles.driverRow}>
              <Ionicons name="construct-outline" size={18} color={colors.textMuted} style={styles.driverIcon} />
              <Text style={styles.driverLabel}>Model</Text>
              <Text style={styles.driverValue}>{driver.vehicle_model}</Text>
            </View>
          ) : null}
          {driver?.vehicle_color ? (
            <View style={styles.driverRow}>
              <Ionicons name="color-palette-outline" size={18} color={colors.textMuted} style={styles.driverIcon} />
              <Text style={styles.driverLabel}>Color</Text>
              <Text style={styles.driverValue}>{driver.vehicle_color}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {SETTINGS_SECTIONS.map((section, sIndex) => (
        <View key={sIndex} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.section}</Text>
          {section.items.map((item, iIndex) => (
            <TouchableOpacity
              key={iIndex}
              style={styles.menuItem}
              onPress={() => handleItemPress(item)}
              activeOpacity={item.route ? 0.6 : 1}
            >
              <Ionicons name={item.icon} size={20} color={colors.text} style={styles.menuIcon} />
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>
      ))}

      <View style={styles.version}>
        <Text style={styles.versionText}>RideWay Driver v1.0.0</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingTop: spacing.xxl,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.xl,
    fontFamily: 'NeueMontreal-Bold',
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
    fontFamily: 'NeueMontreal-Bold',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.xs,
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
  driverCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  driverIcon: {
    marginRight: spacing.md,
  },
  driverLabel: {
    width: 120,
    fontSize: fontSize.md,
    color: colors.textMuted,
    fontFamily: 'NeueMontreal-Regular',
  },
  driverValue: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.text,
    textAlign: 'right',
    fontFamily: 'NeueMontreal-Regular',
  },
  version: {
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  versionText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontFamily: 'NeueMontreal-Regular',
  },
});
