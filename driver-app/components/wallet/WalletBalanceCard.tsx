import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useWalletStore } from '../../store/walletStore';
import { useDriverStore } from '../../store/driverStore';
import { colors, spacing, borderRadius, fontSize, fontWeight } from '../../constants/theme';

export default function WalletBalanceCard() {
  const { balance } = useWalletStore();
  const { is_online } = useDriverStore();

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.label}>Wallet Balance</Text>
        <Text style={styles.balance}>₹{balance.toFixed(2)}</Text>
        {is_online && <Text style={styles.hint}>Tap to view details</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
  },
  content: {
    alignItems: 'center',
  },
  label: {
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: spacing.xs,
  },
  balance: {
    fontSize: fontSize.xxxl,
    fontWeight: fontWeight.bold,
    color: colors.background,
  },
  hint: {
    fontSize: fontSize.xs,
    color: 'rgba(255,255,255,0.5)',
    marginTop: spacing.xs,
  },
});