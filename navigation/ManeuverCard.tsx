import { MaterialCommunityIcons } from "@expo/vector-icons";
import { View, Text, StyleSheet } from "react-native";

import type { Maneuver } from "./navigationState";

type Props = {
  maneuver: Maneuver | null;
  distance: number;
};

const MANEUVER_ICONS: Record<string, string> = {
  turn: "turn-right",
  depart: "departure",
  arrive: "arrival",
  merge: "swap-horizontal",
  fork: "source-branch",
  "end of road": "road-variant",
  continue: "arrow-up",
  roundabout: "rotate-right",
};

export function ManeuverCard({ maneuver, distance }: Props) {
  if (!maneuver) {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.instructionText}>Preparing navigation...</Text>
        </View>
      </View>
    );
  }

  const iconName = MANEUVER_ICONS[maneuver.type] || "arrow-up";
  const formattedDistance = formatDistance(maneuver.distance);
  const modifier = maneuver.modifier ? `${maneuver.modifier} ` : "";

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <MaterialCommunityIcons name={iconName as any} size={28} color="#fff" />
      </View>
      <View style={styles.content}>
        <Text style={styles.instructionText}>
          {modifier}{maneuver.instruction}
        </Text>
        <Text style={styles.secondaryText}>
          {formattedDistance} • {maneuver.street}
        </Text>
      </View>
      <View style={styles.distanceContainer}>
        <Text style={styles.distanceValue}>{Math.round(distance / 60)}</Text>
        <Text style={styles.distanceUnit}>min</Text>
      </View>
    </View>
  );
}

function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e293b",
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#3b82f6",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  instructionText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 2,
  },
  secondaryText: {
    fontSize: 13,
    color: "#94a3b8",
  },
  distanceContainer: {
    alignItems: "center",
    marginLeft: 8,
  },
  distanceValue: {
    fontSize: 24,
    fontWeight: "700",
    color: "#f59e0b",
  },
  distanceUnit: {
    fontSize: 11,
    color: "#94a3b8",
    textTransform: "uppercase",
  },
});