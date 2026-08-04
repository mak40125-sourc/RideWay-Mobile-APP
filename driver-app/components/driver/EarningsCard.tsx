import { View, Text, StyleSheet } from 'react-native';
import { useWalletStore } from '../../store/walletStore';
import { useDriverStore } from '../../store/driverStore';

export default function EarningsCard() {
  const { balance } = useWalletStore();
  const { earnings_today } = useDriverStore();

  return (
    <View style={styles.container}>
      <View style={styles.column}>
        <Text style={styles.label}>Wallet Balance</Text>
        <Text style={styles.amount}>₹{balance.toFixed(2)}</Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.column}>
        <Text style={styles.label}>Today's Earnings</Text>
        <Text style={styles.amount}>₹{earnings_today.toFixed(2)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#111111',
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 20,
    minHeight: 88,
    alignItems: 'center',
  },
  column: {
    flex: 1,
    alignItems: 'center',
  },
  divider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: 24,
    alignSelf: 'stretch',
  },
  label: {
    fontFamily: 'GeneralSans-Medium',
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 8,
  },
  amount: {
    fontFamily: 'GeneralSans-Bold',
    fontSize: 30,
    color: '#FFFFFF',
  },
});
