import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, fontSize, fontWeight } from '../../constants/theme';

type IconName = keyof typeof Ionicons.glyphMap;

const SETTINGS_SECTIONS = [
  {
    section: 'Account',
    items: [
      { label: 'Edit Profile', icon: 'person-outline' as IconName },
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
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Settings</Text>

      {SETTINGS_SECTIONS.map((section, sIndex) => (
        <View key={sIndex} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.section}</Text>
          {section.items.map((item, iIndex) => (
            <TouchableOpacity key={iIndex} style={styles.menuItem}>
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
