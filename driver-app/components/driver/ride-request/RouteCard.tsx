import { View, Text, StyleSheet } from 'react-native';
import { velosColors, fontFamily } from '../../../constants/theme';

export type RoutePoint = {
  lat: number;
  lng: number;
  address: string;
};

type Props = {
  pickup: RoutePoint;
  dropoff: RoutePoint;
};

// Splits "Elante Mall, Industrial Area Phase I" into title + supporting line.
// Falls back to coordinates when no address text exists.
const splitAddress = (point: RoutePoint): { title: string; sub: string | null } => {
  const address = (point.address || '').trim();
  if (!address) {
    return { title: `${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}`, sub: null };
  }
  const splitAt = address.indexOf(', ');
  if (splitAt === -1) return { title: address, sub: null };
  return { title: address.slice(0, splitAt), sub: address.slice(splitAt + 2) };
};

const Marker = ({ color }: { color: string }) => <View style={[styles.dot, { backgroundColor: color }]} />;

export const RouteCard = ({ pickup, dropoff }: Props) => {
  const from = splitAddress(pickup);
  const to = splitAddress(dropoff);

  return (
    <View style={styles.route}>
      <View style={styles.markerColumn}>
        <Marker color={velosColors.green} />
        <View style={styles.connector} />
        <Marker color={velosColors.dropOrange} />
      </View>

      <View style={styles.stops}>
        <View style={styles.stop}>
          <Text style={styles.stopLabel}>PICKUP</Text>
          <Text style={styles.stopTitle} numberOfLines={1} maxFontSizeMultiplier={1.3}>
            {from.title}
          </Text>
          {from.sub ? (
            <Text style={styles.stopSub} numberOfLines={1} maxFontSizeMultiplier={1.3}>
              {from.sub}
            </Text>
          ) : null}
        </View>

        <View style={styles.stop}>
          <Text style={styles.stopLabel}>DROP</Text>
          <Text style={styles.stopTitle} numberOfLines={1} maxFontSizeMultiplier={1.3}>
            {to.title}
          </Text>
          {to.sub ? (
            <Text style={styles.stopSub} numberOfLines={1} maxFontSizeMultiplier={1.3}>
              {to.sub}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  route: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingVertical: 4,
  },
  markerColumn: {
    width: 24,
    alignItems: 'center',
  },
  dot: {
    width: 11,
    height: 11,
    borderRadius: 6,
  },
  connector: {
    flex: 1,
    width: 1.5,
    minHeight: 26,
    marginVertical: 5,
    borderRadius: 1,
    backgroundColor: velosColors.borderSoft,
  },
  stops: {
    flex: 1,
    marginLeft: 14,
    justifyContent: 'space-between',
    gap: 22,
  },
  stop: {
    gap: 2,
  },
  stopLabel: {
    fontSize: 10,
    letterSpacing: 1.2,
    fontFamily: fontFamily.semibold,
    color: velosColors.mutedText,
  },
  stopTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontFamily: fontFamily.semibold,
    color: velosColors.navy,
  },
  stopSub: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fontFamily.regular,
    color: velosColors.mutedText,
  },
});
