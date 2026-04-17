import { View, Text, StyleSheet } from 'react-native';
import { useWalletStore } from '../../store/walletStore';
import { useDriverStore } from '../../store/driverStore';
import { colors, spacing, borderRadius, fontSize, fontWeight } from '../../constants/theme';

export default function EarningsCard() {
  const { balance } = useWalletStore();
  const { earnings_today } = useDriverStore();

  return (
    <View style={styles.container}>
      <View style={styles.balanceSection}>
        <Text style={styles.label}>Wallet Balance</Text>
        <Text style={styles.balance}>₹{balance.toFixed(2)}</Text>
      </View>
      
      <View style={styles.divider} />
      
      <View style={styles.earningsSection}>
        <Text style={styles.label}>Today's Earnings</Text>
        <Text style={styles.earnings}>₹{earnings_today.toFixed(2)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  balanceSection: {
    flex: 1,
  },
  earningsSection: {
    flex: 1,
    alignItems: 'flex-end',
  },
  divider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: spacing.md,
  },
  label: {
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: spacing.xs,
  },
  balance: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.background,
  },
  earnings: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.background,
  },
});