import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useDriverStore } from '../../store/driverStore';
import { useWalletStore } from '../../store/walletStore';
import { colors, spacing, borderRadius, fontSize, fontWeight } from '../../constants/theme';
import { WALLET_MINIMUM } from '../../constants/wallet';

interface OnlineToggleProps {
  onToggle: (online: boolean) => void;
}

export default function OnlineToggle({ onToggle }: OnlineToggleProps) {
  const { is_online, driver } = useDriverStore();
  const { balance } = useWalletStore();
  const router = useRouter();

  const is_low_balance = balance < WALLET_MINIMUM;
  const can_go_online = driver?.kyc_status === 'APPROVED' && 
                        driver?.vehicle_status === 'APPROVED' && 
                        !is_low_balance;

  const handleToggle = () => {
    if (!can_go_online && !is_online) {
      if (is_low_balance) {
        router.push('/(wallet)/wallet');
      }
      return;
    }
    onToggle(!is_online);
  };

  return (
    <View style={styles.container}>
      <View style={styles.statusContainer}>
        <View style={[styles.statusDot, is_online ? styles.onlineDot : styles.offlineDot]} />
        <Text style={styles.statusText}>
          {is_online ? 'Online' : 'Offline'}
        </Text>
      </View>
      
      <TouchableOpacity 
        style={[
          styles.toggleButton,
          is_online ? styles.toggleOn : styles.toggleOff,
          !can_go_online && !is_online && styles.toggleDisabled,
        ]} 
        onPress={handleToggle}
      >
        <View style={[styles.toggleThumb, is_online && styles.toggleThumbOn]} />
      </TouchableOpacity>

      {is_low_balance && !is_online && (
        <Text style={styles.warningText}>Low balance - Recharge to go online</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: spacing.sm,
  },
  onlineDot: {
    backgroundColor: colors.success,
  },
  offlineDot: {
    backgroundColor: colors.textMuted,
  },
  statusText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.text,
  },
  toggleButton: {
    width: 50,
    height: 30,
    borderRadius: 15,
    padding: 2,
    justifyContent: 'center',
  },
  toggleOff: {
    backgroundColor: colors.border,
  },
  toggleOn: {
    backgroundColor: colors.success,
  },
  toggleDisabled: {
    backgroundColor: colors.error,
  },
  toggleThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.background,
  },
  toggleThumbOn: {
    alignSelf: 'flex-end',
  },
  warningText: {
    fontSize: fontSize.xs,
    color: colors.error,
    position: 'absolute',
    bottom: -20,
    left: 0,
  },
});