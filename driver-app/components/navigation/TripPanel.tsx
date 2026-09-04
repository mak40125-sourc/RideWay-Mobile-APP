import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigationStore } from '../../store/navigationStore';
import { formatDistanceM } from '../../services/osrmNavigation';
import { fontFamily } from '../../constants/theme';

const ACCENT = '#3B82F6';

interface TripPanelProps {
  destinationLabel: string;
  actionLabel: string;
  actionLoading?: boolean;
  onAction: () => void;
  onCancel?: () => void;
  cancelLabel?: string;
  cancelDisabled?: boolean;
  statusText?: string;
}

export default function TripPanel({
  destinationLabel,
  actionLabel,
  actionLoading,
  onAction,
  onCancel,
  cancelLabel = 'Cancel',
  cancelDisabled,
  statusText,
}: TripPanelProps) {
  const remainingDistanceM = useNavigationStore((s) => s.remainingDistanceM);
  const remainingDurationS = useNavigationStore((s) => s.remainingDurationS);
  const routeProgress = useNavigationStore((s) => s.routeProgress);
  const isOffRoute = useNavigationStore((s) => s.isOffRoute);
  const isRerouting = useNavigationStore((s) => s.isRerouting);

  const etaMin = Math.max(1, Math.round(remainingDurationS / 60));
  const etaLabel = etaMin < 60 ? `${etaMin} min` : `${Math.floor(etaMin / 60)} h ${etaMin % 60} min`;

  const arrival = new Date(Date.now() + remainingDurationS * 1000);
  const arrivalLabel = arrival.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const progress = Math.min(1, Math.max(0, routeProgress));

  return (
    <View style={styles.panel}>
      {isOffRoute || isRerouting ? (
        <View style={styles.banner}>
          <Ionicons name="warning-outline" size={16} color="#FFFFFF" />
          <Text style={styles.bannerText}>
            {isRerouting ? 'Rerouting…' : 'You seem off route'}
          </Text>
        </View>
      ) : null}

      <View style={styles.metrics}>
        <View style={styles.metric}>
          <Text style={styles.metricValue}>{etaLabel}</Text>
          <Text style={styles.metricLabel}>ETA</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metric}>
          <Text style={styles.metricValue}>{formatDistanceM(remainingDistanceM)}</Text>
          <Text style={styles.metricLabel}>Remaining</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metric}>
          <Text style={styles.metricValue}>{arrivalLabel}</Text>
          <Text style={styles.metricLabel}>Arrival</Text>
        </View>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      <View style={styles.addressRow}>
        <Ionicons name="location" size={18} color={ACCENT} />
        <Text style={styles.address} numberOfLines={2}>
          {destinationLabel}
        </Text>
      </View>

      {statusText ? <Text style={styles.statusText}>{statusText}</Text> : null}

      <View style={styles.actions}>
        {onCancel ? (
          <TouchableOpacity
            style={[styles.cancelButton, cancelDisabled && styles.disabled]}
            onPress={onCancel}
            disabled={cancelDisabled}
          >
            <Text style={styles.cancelText}>{cancelLabel}</Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          style={[styles.actionButton, actionLoading && styles.disabled]}
          onPress={onAction}
          disabled={actionLoading}
        >
          <Text style={styles.actionText}>{actionLoading ? 'Updating…' : actionLabel}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(20, 22, 26, 0.96)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
    borderRadius: 10,
    paddingVertical: 8,
    marginBottom: 12,
    gap: 6,
  },
  bannerText: {
    color: '#FCA5A5',
    fontSize: 13,
    fontFamily: fontFamily.semibold,
  },
  metrics: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  metric: {
    flex: 1,
    alignItems: 'center',
  },
  metricValue: {
    color: '#F5F6F8',
    fontSize: 20,
    fontFamily: fontFamily.bold,
  },
  metricLabel: {
    color: '#B6BBC4',
    fontSize: 11,
    letterSpacing: 0.6,
    fontFamily: fontFamily.medium,
    marginTop: 2,
  },
  metricDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: ACCENT,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 8,
  },
  address: {
    flex: 1,
    color: '#D1D5DB',
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fontFamily.regular,
  },
  statusText: {
    color: '#9CA3AF',
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fontFamily.regular,
    textAlign: 'center',
    marginBottom: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    width: 96,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelText: {
    color: '#D1D5DB',
    fontSize: 15,
    fontFamily: fontFamily.semibold,
  },
  actionButton: {
    flex: 1,
    backgroundColor: ACCENT,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: fontFamily.bold,
  },
  disabled: {
    opacity: 0.5,
  },
});
