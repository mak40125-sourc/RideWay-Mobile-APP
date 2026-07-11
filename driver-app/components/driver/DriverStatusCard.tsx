import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDriverStore } from '../../store/driverStore';
import { useWalletStore } from '../../store/walletStore';
import { WALLET_MINIMUM } from '../../constants/wallet';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.9;

interface DriverStatusCardProps {
  onToggle: (online: boolean) => void;
}

export default function DriverStatusCard({ onToggle }: DriverStatusCardProps) {
  const { is_online } = useDriverStore();
  const { balance } = useWalletStore();

  const is_low_balance = balance < WALLET_MINIMUM;
  const can_go_online = !is_low_balance;

  const handlePress = () => {
    if (!can_go_online && !is_online) return;
    onToggle(!is_online);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Driver Status</Text>

      <View style={styles.statusRow}>
        <View style={[styles.statusDot, { backgroundColor: is_online ? '#34C759' : '#8E8E93' }]} />
        <Text style={styles.statusText}>{is_online ? 'Online' : 'Offline'}</Text>
      </View>

      {is_low_balance && !is_online && (
        <View style={styles.lowBalanceRow}>
          <Ionicons name="warning-outline" size={16} color="#EF4444" />
          <Text style={styles.lowBalanceText}>Insufficient wallet balance</Text>
        </View>
      )}

      <TouchableOpacity
        style={[
          styles.button,
          is_online ? styles.buttonOnline : styles.buttonOffline,
          (!can_go_online && !is_online) && styles.buttonDisabled,
        ]}
        onPress={handlePress}
        activeOpacity={0.8}
      >
        <Text style={styles.buttonText}>
          {is_online ? 'Go Offline' : 'Go Online'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: CARD_WIDTH,
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 6,
  },
  title: {
    fontFamily: 'NeueMontreal-Bold',
    fontSize: 20,
    color: '#111111',
    marginBottom: 20,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  statusText: {
    fontFamily: 'NeueMontreal-Bold',
    fontSize: 34,
    color: '#111111',
  },
  lowBalanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 6,
  },
  lowBalanceText: {
    fontFamily: 'NeueMontreal-Regular',
    fontSize: 14,
    color: '#EF4444',
  },
  button: {
    width: '100%',
    height: 68,
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonOffline: {
    backgroundColor: '#1EE751',
  },
  buttonOnline: {
    backgroundColor: '#111111',
  },
  buttonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  buttonText: {
    fontFamily: 'NeueMontreal-Bold',
    fontSize: 28,
    color: '#FFFFFF',
  },
});
