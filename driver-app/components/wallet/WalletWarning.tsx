import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing, borderRadius, fontSize, fontWeight } from '../../constants/theme';
import { WALLET_MINIMUM } from '../../constants/wallet';

interface WalletWarningProps {
  balance: number;
}

export default function WalletWarning({ balance }: WalletWarningProps) {
  const router = useRouter();

  if (balance >= WALLET_MINIMUM) return null;

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.textSection}>
          <View>
            <Text style={styles.title}>Low Balance</Text>
            <Text style={styles.subtitle}>
              Minimum ₹{WALLET_MINIMUM} required to go online
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.rechargeBtn}
          onPress={() => router.push('/(wallet)/recharge')}
        >
          <Text style={styles.rechargeText}>Recharge</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.error + '10',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.error + '30',
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  textSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  title: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.error,
  },
  subtitle: {
    fontSize: fontSize.sm,
    color: colors.error,
    opacity: 0.8,
  },
  rechargeBtn: {
    backgroundColor: colors.error,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  rechargeText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.background,
  },
});
