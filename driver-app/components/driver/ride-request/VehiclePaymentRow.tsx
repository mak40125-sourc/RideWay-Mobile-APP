import { View, Text, StyleSheet } from 'react-native';
import { velosColors, fontFamily } from '../../../constants/theme';

type Props = {
  /** Canonical ride type the driver was matched on ('bike' | 'mini' | 'sedan' | 'shuttle'). */
  vehicleType?: string | null;
  /** Payment method from ride state — badge is omitted entirely when unknown. */
  paymentMethod?: string | null;
};

const VEHICLE_LABELS: Record<string, string> = {
  bike: 'Velos Bike',
  mini: 'Velos Mini',
  sedan: 'Velos Comfort',
  shuttle: 'Velos Shuttle',
};

// Vehicle + payment strip. Passenger count and payment method are not part of
// the current offer payload; each element renders only from real data.
export const VehiclePaymentRow = ({ vehicleType, paymentMethod }: Props) => {
  const label = vehicleType ? VEHICLE_LABELS[vehicleType] : undefined;
  if (!label && !paymentMethod) return null;

  return (
    <View style={styles.row}>
      {label ? (
        <View style={styles.vehicle}>
          <Text style={styles.vehicleTitle} numberOfLines={1} maxFontSizeMultiplier={1.3}>
            {label}
          </Text>
        </View>
      ) : (
        <View />
      )}
      {paymentMethod ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText} maxFontSizeMultiplier={1.2}>
            {String(paymentMethod).toUpperCase()}
          </Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  vehicle: {
    flexShrink: 1,
  },
  vehicleTitle: {
    fontSize: 14,
    lineHeight: 19,
    fontFamily: fontFamily.semibold,
    color: velosColors.navy,
  },
  badge: {
    backgroundColor: velosColors.mintSoft,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: {
    fontSize: 11,
    letterSpacing: 0.6,
    fontFamily: fontFamily.bold,
    color: velosColors.green,
  },
});
