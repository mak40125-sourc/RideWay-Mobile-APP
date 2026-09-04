import { View, Text, StyleSheet } from 'react-native';
import { velosColors, fontFamily } from '../../../constants/theme';

type Props = {
  riderName: string;
  passengerName?: string | null;
  passengerPhone?: string | null;
};

// Rider/passenger identity row. For a normal ride this shows the booking rider.
// When the ride was booked for someone else, it surfaces the actual passenger's
// name and phone (the booking account and passenger are distinct concepts).
export const RiderCard = ({ riderName, passengerName, passengerPhone }: Props) => {
  const displayName = passengerName?.trim() || riderName || 'Rider';
  const isOther = !!passengerName?.trim();
  const initial = (displayName || '').trim().charAt(0).toUpperCase() || 'R';

  return (
    <View style={styles.row}>
      <View style={styles.avatar}>
        <Text style={styles.avatarInitial} maxFontSizeMultiplier={1.2}>
          {initial}
        </Text>
      </View>
      <View style={styles.meta}>
        <Text style={styles.name} numberOfLines={1} maxFontSizeMultiplier={1.3}>
          {displayName}
        </Text>
        {isOther ? (
          <Text style={styles.sub} numberOfLines={1} maxFontSizeMultiplier={1.2}>
            Riding: {passengerName?.trim()}
            {passengerPhone?.trim() ? ` · ${passengerPhone.trim()}` : ''}
          </Text>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 2,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: velosColors.mintSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 16,
    fontFamily: fontFamily.semibold,
    color: velosColors.green,
  },
  meta: {
    flexShrink: 1,
  },
  name: {
    fontSize: 15,
    lineHeight: 20,
    fontFamily: fontFamily.semibold,
    color: velosColors.navy,
  },
  sub: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fontFamily.regular,
    color: velosColors.mutedText,
    marginTop: 2,
  },
});
