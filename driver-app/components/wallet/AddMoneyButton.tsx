import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing, borderRadius, fontSize, fontWeight } from '../../constants/theme';

interface AddMoneyButtonProps {
  variant?: 'primary' | 'outline';
}

export default function AddMoneyButton({ variant = 'primary' }: AddMoneyButtonProps) {
  const router = useRouter();

  return (
    <TouchableOpacity
      style={[styles.button, variant === 'outline' && styles.outline]}
      onPress={() => router.push('/(wallet)/recharge')}
    >
      <Text style={[styles.text, variant === 'outline' && styles.outlineText]}>
        + Add Money
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  text: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.background,
  },
  outlineText: {
    color: colors.primary,
  },
});
