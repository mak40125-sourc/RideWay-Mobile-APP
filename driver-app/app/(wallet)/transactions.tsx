import { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useWalletStore } from '../../store/walletStore';
import TransactionItem from '../../components/wallet/TransactionItem';
import { colors, spacing, borderRadius, fontSize, fontWeight } from '../../constants/theme';
import type { TransactionType } from '../../types/wallet';

const FILTERS: { label: string; value: TransactionType | 'ALL' }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Commission', value: 'COMMISSION_DEBIT' },
  { label: 'Recharge', value: 'WALLET_RECHARGE' },
  { label: 'Incentive', value: 'INCENTIVE_CREDIT' },
];

export default function TransactionsScreen() {
  const { transactions } = useWalletStore();
  const [activeFilter, setActiveFilter] = useState<TransactionType | 'ALL'>('ALL');

  const filtered = activeFilter === 'ALL'
    ? transactions
    : transactions.filter((t) => t.type === activeFilter);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>All Transactions</Text>
      </View>

      <View style={styles.filters}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.value}
            style={[styles.filterBtn, activeFilter === f.value && styles.filterBtnActive]}
            onPress={() => setActiveFilter(f.value)}
          >
            <Text style={[styles.filterText, activeFilter === f.value && styles.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <TransactionItem transaction={item} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No transactions found</Text>
          </View>
        }
      />
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
  filters: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  filterBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
  },
  filterBtnActive: {
    backgroundColor: colors.primary,
  },
  filterText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  filterTextActive: {
    color: colors.background,
    fontWeight: fontWeight.semibold,
  },
  list: {
    paddingHorizontal: spacing.md,
  },
  empty: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyText: {
    fontSize: fontSize.md,
    color: colors.textMuted,
  },
});
