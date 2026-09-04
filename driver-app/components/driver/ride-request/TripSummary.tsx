import { View, Text, StyleSheet } from 'react-native';
import { velosColors, fontFamily } from '../../../constants/theme';

type Props = {
  fare: number;
  distance: number;
  duration: number;
};

const formatKm = (distance: number): string => {
  if (!Number.isFinite(distance) || distance <= 0) return '—';
  const rounded = Math.round(distance * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)} km`;
};

const formatMinutes = (duration: number): string => {
  if (!Number.isFinite(duration) || duration <= 0) return '—';
  return `${Math.round(duration)} min`;
};

const formatFare = (fare: number): string =>
  Number.isFinite(fare) && fare > 0 ? `₹${Math.round(fare)}` : '—';

// Soft inset summary strip: earnings / distance / trip time. All values come
// from the backend ride offer — the UI never calculates fare or distance.
export const TripSummary = ({ fare, distance, duration }: Props) => {
  const columns = [
    { label: 'EST. EARNINGS', value: formatFare(fare), sub: 'TrueEarn' },
    { label: 'DISTANCE', value: formatKm(distance), sub: 'pickup → drop' },
    { label: 'TRIP TIME', value: formatMinutes(duration), sub: 'to destination' },
  ];

  return (
    <View style={styles.strip}>
      {columns.map((col, i) => (
        <View key={col.label} style={styles.columnWrap}>
          {i > 0 && <View style={styles.divider} />}
          <View style={styles.column}>
            <Text style={styles.label}>{col.label}</Text>
            <Text style={styles.value} maxFontSizeMultiplier={1.25}>
              {col.value}
            </Text>
            <Text style={styles.sub}>{col.sub}</Text>
          </View>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    backgroundColor: velosColors.bgTint,
    borderRadius: 18,
    paddingVertical: 16,
  },
  columnWrap: {
    flex: 1,
    flexDirection: 'row',
  },
  column: {
    flex: 1,
    alignItems: 'center',
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: velosColors.borderSoft,
  },
  label: {
    fontSize: 10,
    letterSpacing: 0.9,
    fontFamily: fontFamily.medium,
    color: velosColors.mutedText,
  },
  value: {
    marginTop: 7,
    fontSize: 21,
    lineHeight: 25,
    fontFamily: fontFamily.bold,
    color: velosColors.navy,
  },
  sub: {
    marginTop: 3,
    fontSize: 11,
    fontFamily: fontFamily.medium,
    color: velosColors.green,
  },
});
