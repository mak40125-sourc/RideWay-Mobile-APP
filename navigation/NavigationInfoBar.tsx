import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

type Props = {
  eta: number | null;
  distanceRemaining: number;
  tripState: string;
  onEndTrip?: () => void;
};

export function NavigationInfoBar({ eta, distanceRemaining, tripState, onEndTrip }: Props) {
  const formatEta = (timestamp: number | null): string => {
    if (!timestamp) return "--";
    const minutes = Math.round((timestamp - Date.now()) / 60000);
    if (minutes < 1) return "Now";
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const formatDistance = (meters: number): string => {
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    }
    return `${(meters / 1000).toFixed(1)} km`;
  };

  const stateLabels: Record<string, string> = {
    IDLE: "Waiting",
    TO_PICKUP: "To Pickup",
    ARRIVED_PICKUP: "Arrived",
    TO_DROPOFF: "En Route",
    TRIP_COMPLETED: "Complete",
  };

  return (
    <View style={styles.container}>
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>ETA</Text>
          <Text style={styles.statValue}>{formatEta(eta)}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Distance</Text>
          <Text style={styles.statValue}>{formatDistance(distanceRemaining)}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Status</Text>
          <Text style={styles.statValue}>{stateLabels[tripState] || tripState}</Text>
        </View>
      </View>

      {(tripState === "TO_PICKUP" || tripState === "TO_DROPOFF") && (
        <TouchableOpacity style={styles.actionButton} onPress={onEndTrip}>
          <Text style={styles.actionButtonText}>End Trip</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 12,
  },
  stat: {
    alignItems: "center",
  },
  statLabel: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 2,
    fontWeight: "500",
  },
  statValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1e293b",
  },
  actionButton: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  actionButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});