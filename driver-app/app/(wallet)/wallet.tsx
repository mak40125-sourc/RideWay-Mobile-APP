import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useWalletStore } from '../../store/walletStore';
import { useDriverStore } from '../../store/driverStore';
import WalletBalanceCard from '../../components/wallet/WalletBalanceCard';
import TransactionItem from '../../components/wallet/TransactionItem';
import { colors, spacing, borderRadius, fontSize, fontWeight } from '../../constants/theme';
import { WALLET_MINIMUM, RECHARGE_AMOUNTS } from '../../constants/wallet';

export default function WalletScreen() {
  const { balance, transactions } = useWalletStore();
  const { is_online } = useDriverStore();

  const isLowBalance = balance < WALLET_MINIMUM;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Wallet</Text>
      </View>

      <View style={styles.balanceSection}>
        <WalletBalanceCard />
      </View>

      {isLowBalance && (
        <View style={styles.warningBanner}>
          <Text style={styles.warningText}>
            Low balance! Minimum ₹{WALLET_MINIMUM} required to go online.
          </Text>
        </View>
      )}

      <View style={styles.rechargeSection}>
        <Text style={styles.sectionTitle}>Add Money</Text>
        <View style={styles.rechargeOptions}>
          {RECHARGE_AMOUNTS.map((amount) => (
            <TouchableOpacity key={amount} style={styles.rechargeButton}>
              <Text style={styles.rechargeAmount}>₹{amount}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.transactionsSection}>
        <Text style={styles.sectionTitle}>Recent Transactions</Text>
        <FlatList
          data={transactions}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <TransactionItem transaction={item} />}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No transactions yet</Text>
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: spacing.lg,
    paddingTop: spacing.xxl,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  balanceSection: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  warningBanner: {
    backgroundColor: colors.error,
    padding: spacing.sm,
    marginHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.md,
  },
  warningText: {
    color: colors.background,
    fontSize: fontSize.sm,
    textAlign: 'center',
  },
  rechargeSection: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  rechargeOptions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  rechargeButton: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  rechargeAmount: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  transactionsSection: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
  emptyText: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});