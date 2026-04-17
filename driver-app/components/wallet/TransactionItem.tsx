import { View, Text, StyleSheet } from 'react-native';
import type { WalletTransaction } from '../../types/wallet';
import { colors, spacing, fontSize, fontWeight } from '../../constants/theme';

interface TransactionItemProps {
  transaction: WalletTransaction;
}

export default function TransactionItem({ transaction }: TransactionItemProps) {
  const isDebit = transaction.type === 'COMMISSION_DEBIT';

  return (
    <View style={styles.container}>
      <View style={styles.left}>
        <Text style={styles.description}>{transaction.description}</Text>
        <Text style={styles.date}>
          {new Date(transaction.created_at).toLocaleDateString()}
        </Text>
      </View>
      <Text style={[styles.amount, isDebit ? styles.debit : styles.credit]}>
        {isDebit ? '-' : '+'}₹{Math.abs(transaction.amount)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  left: {
    flex: 1,
  },
  description: {
    fontSize: fontSize.md,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  date: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  amount: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
  },
  debit: {
    color: colors.error,
  },
  credit: {
    color: colors.success,
  },
});