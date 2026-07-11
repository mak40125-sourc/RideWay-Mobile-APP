import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, fontSize, fontWeight } from '../../constants/theme';
import { WALLET_MINIMUM } from '../../constants/wallet';

export default function LowBalanceModal() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="wallet-outline" size={32} color={colors.warning} />
        </View>
        <Text style={styles.title}>Low Balance</Text>
        <Text style={styles.subtitle}>
          Your wallet balance is below the minimum of ₹{WALLET_MINIMUM}.{'\n'}
          Please recharge to continue accepting rides.
        </Text>
        <TouchableOpacity
          style={styles.rechargeBtn}
          onPress={() => {
            router.back();
            router.push('/(wallet)/recharge');
          }}
        >
          <Text style={styles.rechargeText}>Recharge Now</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.dismissBtn} onPress={() => router.back()}>
          <Text style={styles.dismissText}>Later</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: spacing.lg,
  },
  content: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    width: '100%',
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.warning + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.sm,
    fontFamily: 'NeueMontreal-Bold',
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xl,
    fontFamily: 'NeueMontreal-Regular',
  },
  rechargeBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    width: '100%',
    marginBottom: spacing.sm,
  },
  rechargeText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.background,
    fontFamily: 'NeueMontreal-Bold',
  },
  dismissBtn: {
    paddingVertical: spacing.sm,
  },
  dismissText: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    fontFamily: 'NeueMontreal-Regular',
  },
});
