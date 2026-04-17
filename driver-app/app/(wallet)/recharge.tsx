import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useWalletStore } from '../../store/walletStore';
import { colors, spacing, borderRadius, fontSize, fontWeight } from '../../constants/theme';
import { RECHARGE_AMOUNTS } from '../../constants/wallet';

export default function RechargeScreen() {
  const router = useRouter();
  const { balance, setBalance, addTransaction } = useWalletStore();

  const handleRecharge = (amount: number) => {
    const newBalance = balance + amount;
    setBalance(newBalance);
    addTransaction({
      id: `txn-${Date.now()}`,
      driver_id: 'driver-1',
      type: 'WALLET_RECHARGE',
      amount: amount,
      balance_after: newBalance,
      description: `Wallet recharge - ₹${amount}`,
      created_at: new Date().toISOString(),
    });
    router.back();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Add Money</Text>
        <Text style={styles.subtitle}>Select amount to add to wallet</Text>
      </View>

      <View style={styles.options}>
        {RECHARGE_AMOUNTS.map((amount) => (
          <TouchableOpacity
            key={amount}
            style={styles.option}
            onPress={() => handleRecharge(amount)}
          >
            <Text style={styles.amount}>₹{amount}</Text>
            <Text style={styles.bonus}>Get ₹{amount} balance</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.info}>
        <Text style={styles.infoText}>
          Money added to wallet can be used for ride commissions. Minimum balance of ₹50 required to stay online.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  header: {
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
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
  },
  options: {
    gap: spacing.md,
  },
  option: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  amount: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  bonus: {
    fontSize: fontSize.sm,
    color: colors.success,
  },
  info: {
    marginTop: spacing.xl,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
  },
  infoText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    lineHeight: 20,
  },
});