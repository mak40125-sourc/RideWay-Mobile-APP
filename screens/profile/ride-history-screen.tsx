import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { SubScreen } from "../../components/profile/SubScreen";
import { useAuth } from "../../context/auth-context";
import { getRiderRideHistory, type Ride } from "../../services/ride.service";

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function statusLabel(status: string): string {
  return status === "RIDE_COMPLETED" ? "Completed" : "Cancelled";
}

export function RideHistoryScreen() {
  const { authUser } = useAuth();
  const [rides, setRides] = useState<Ride[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    if (!authUser) return;

    getRiderRideHistory(authUser.id)
      .then((data) => {
        if (mounted) setRides(data);
      })
      .catch((err) => {
        if (mounted) setError((err as Error).message || "Could not load ride history.");
      });

    return () => {
      mounted = false;
    };
  }, [authUser]);

  return (
    <SubScreen title="Ride History">
      {rides === null && !error ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#111111" />
        </View>
      ) : null}

      {error ? (
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>Couldn&apos;t load rides</Text>
          <Text style={styles.emptySubtitle}>{error}</Text>
        </View>
      ) : null}

      {rides !== null && rides.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>No rides yet</Text>
          <Text style={styles.emptySubtitle}>
            Your completed and cancelled rides will appear here.
          </Text>
        </View>
      ) : null}

      {rides !== null && rides.length > 0
        ? rides.map((ride) => (
            <View key={ride.id} style={styles.row}>
              <View style={styles.iconBox}>
                <Ionicons name="time-outline" size={20} color="#6B7280" />
              </View>
              <View style={styles.texts}>
                <Text style={styles.title} numberOfLines={2}>
                  {ride.pickup_address || "Pickup"} {"\u2192"} {ride.drop_address || "Drop"}
                </Text>
                <Text style={styles.subtitle}>
                  {formatDate(ride.created_at)}
                  {ride.fare ? `  \u00b7  Rs ${ride.fare}` : ""}
                </Text>
              </View>
              <View style={styles.pill}>
                <Text style={styles.pillText}>{statusLabel(ride.status)}</Text>
              </View>
            </View>
          ))
        : null}
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  centered: {
    alignItems: "center",
    paddingTop: 48,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    color: "#111111",
    fontSize: 18,
    fontFamily: "GeneralSans-Regular",
    fontWeight: "600",
    textAlign: "center",
  },
  emptySubtitle: {
    color: "#6B7280",
    fontSize: 14,
    fontFamily: "GeneralSans-Regular",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 60,
    paddingVertical: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#F5F5F5",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  texts: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 16,
    fontFamily: "GeneralSans-Regular",
    fontWeight: "500",
    color: "#111111",
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "GeneralSans-Regular",
    color: "#6B7280",
    marginTop: 2,
  },
  pill: {
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  pillText: {
    fontSize: 13,
    fontFamily: "GeneralSans-Regular",
    fontWeight: "500",
    color: "#111111",
  },
});
