import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useNavigationStore } from '../../store/navigationStore';
import { formatDistanceM } from '../../services/osrmNavigation';
import { fontFamily } from '../../constants/theme';

const ACCENT = '#3B82F6';

export default function ManeuverCard() {
  const status = useNavigationStore((s) => s.status);
  const currentStepIndex = useNavigationStore((s) => s.currentStepIndex);
  const steps = useNavigationStore((s) => s.route?.steps);
  const distanceToManeuverM = useNavigationStore((s) => s.distanceToManeuverM);
  const isRerouting = useNavigationStore((s) => s.isRerouting);

  if (status === 'error' && !steps) {
    return (
      <View style={styles.card}>
        <View style={styles.iconCircle}>
          <Ionicons name="cloud-offline-outline" size={22} color="#FFFFFF" />
        </View>
        <View style={styles.info}>
          <Text style={styles.primary}>Routing unavailable</Text>
          <Text style={styles.secondary}>Retrying…</Text>
        </View>
      </View>
    );
  }

  const step = steps?.[currentStepIndex];

  if (!step) {
    const preparing = status === 'fetching' || isRerouting;
    return (
      <View style={styles.card}>
        <View style={styles.iconCircle}>
          <Ionicons name="navigate-outline" size={22} color="#FFFFFF" />
        </View>
        <View style={styles.info}>
          <Text style={styles.primary}>
            {preparing ? 'Preparing route…' : 'Waiting for location…'}
          </Text>
          {isRerouting ? <Text style={styles.secondary}>Rerouting…</Text> : null}
        </View>
      </View>
    );
  }

  const { instruction } = step;
  const icon = instruction.icon;
  const next = steps[currentStepIndex + 1];
  const distanceText = formatDistanceM(distanceToManeuverM);

  const instructionText = instruction.roadName
    ? `${instruction.primary}${instruction.connector ? ` ${instruction.connector}` : ''}`
    : instruction.primary;

  const nextText = next
    ? `${next.instruction.primary}${next.instruction.connector ? ` ${next.instruction.connector}` : ''}${next.instruction.roadName ? ` ${next.instruction.roadName}` : ''}`
    : 'arrive at your destination';

  return (
    <Animated.View entering={FadeInDown.duration(300)} key={currentStepIndex} style={styles.card}>
      <View style={styles.left}>
        <View style={styles.iconCircle}>
          <Ionicons
            name={icon.name}
            size={26}
            color="#FFFFFF"
            style={{ transform: [{ rotate: `${icon.rotation}deg` }] }}
          />
        </View>
        <Text style={styles.distance}>{distanceText}</Text>
      </View>

      <View style={styles.info}>
        <Text style={styles.primary}>
          {instructionText}
          {instruction.roadName ? (
            <Text style={styles.roadName}> {instruction.roadName}</Text>
          ) : null}
        </Text>

        {next ? (
          <Text style={styles.secondary}>
            Then {nextText}
          </Text>
        ) : (
          <Text style={styles.secondary}>Then arrive at your destination</Text>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    top: 56,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(20, 22, 26, 0.92)',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  left: {
    alignItems: 'center',
    marginRight: 16,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  distance: {
    color: '#F5F6F8',
    fontSize: 13,
    fontFamily: fontFamily.semibold,
  },
  info: {
    flex: 1,
  },
  primary: {
    color: '#F5F6F8',
    fontSize: 17,
    lineHeight: 22,
    fontFamily: fontFamily.semibold,
  },
  roadName: {
    color: '#FFFFFF',
    fontFamily: fontFamily.bold,
  },
  secondary: {
    color: '#B6BBC4',
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fontFamily.regular,
    marginTop: 4,
  },
});
