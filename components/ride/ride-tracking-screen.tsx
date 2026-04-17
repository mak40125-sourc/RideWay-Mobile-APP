import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";

import { useAuth } from "../../context/auth-context";
import { buildMapRegion } from "../../utils/map-region";
import { serializeRide } from "../../utils/ride-params";
import { RideMap } from "./ride-map";
import { rideStyles as styles } from "./ride-styles";
import { RideTopBar } from "./ride-top-bar";
import type { SelectedRide } from "./ride-types";

type Props = {
  ride: SelectedRide;
};

export function RideTrackingScreen({ ride }: Props) {
  const { user } = useAuth();
  const [rideStatus, setRideStatus] = useState<string>("SEARCHING_DRIVER");
  const [loadingStatus, setLoadingStatus] = useState(false);
  const region = buildMapRegion(ride.pickup, ride.dropoff);

  // Poll ride status from backend every 5 seconds
  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    const pollStatus = async () => {
      setLoadingStatus(true);
      try {
        const { getRiderActiveRide } = await import("../../services/ride.service");
        const activeRide = await getRiderActiveRide(user.id);
        if (!cancelled && activeRide) {
          setRideStatus(activeRide.status);
        }
      } catch {
        // silently fail - keep current status
      } finally {
        if (!cancelled) {
          setLoadingStatus(false);
        }
      }
    };

    void pollStatus();
    const interval = setInterval(pollStatus, 5000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user]);

  const handleCompleteRide = () => {
    router.push({
      pathname: "/complete",
      params: serializeRide(ride),
    });
  };

  const handleCancelRide = async () => {
    Alert.alert("Cancel Ride", "Are you sure you want to cancel this ride?", [
      { text: "No", style: "cancel" },
      {
        text: "Yes, Cancel",
        style: "destructive",
        onPress: async () => {
          try {
            const { cancelRide, getRiderActiveRide } = await import("../../services/ride.service");
            if (user) {
              const activeRide = await getRiderActiveRide(user.id);
              if (activeRide) {
                await cancelRide(activeRide.id);
              }
            }
            router.push("/");
          } catch (error) {
            Alert.alert("Error", error instanceof Error ? error.message : "Failed to cancel ride");
          }
        },
      },
    ]);
  };

  const statusMessages: Record<string, { title: string; subtitle: string }> = {
    REQUESTED: { title: "Finding your driver", subtitle: "Looking for nearby drivers to accept your ride." },
    SEARCHING_DRIVER: { title: "Finding your driver", subtitle: "Looking for nearby drivers to accept your ride." },
    DRIVER_ASSIGNED: { title: "Driver assigned!", subtitle: `Your ${ride.option.label} is on the way to pickup.` },
    DRIVER_ARRIVING: { title: "Driver arriving", subtitle: "Your driver is almost here." },
    RIDE_STARTED: { title: "Ride in progress", subtitle: "Enjoy your trip!" },
    RIDE_COMPLETED: { title: "Ride complete", subtitle: "Thanks for riding with RideWay!" },
  };

  const statusInfo = statusMessages[rideStatus] || {
    title: "Tracking your ride",
    subtitle: "Your trip is now live in the rider flow.",
  };

  return (
    <View style={styles.screen}>
      <RideMap pickup={ride.pickup} dropoff={ride.dropoff} region={region} routePath={ride.path} showDriverMotion />
      <RideTopBar title={statusInfo.title} subtitle={statusInfo.subtitle} badge="Step 4" />

      <View style={styles.compactCard}>
        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>Driver status</Text>
          <Text style={styles.sectionTitle}>
            {rideStatus === "DRIVER_ASSIGNED" || rideStatus === "DRIVER_ARRIVING" || rideStatus === "RIDE_STARTED"
              ? `Driver assigned for ${ride.option.label}`
              : rideStatus === "RIDE_COMPLETED"
              ? "Trip completed"
              : `Searching for ${ride.option.label}`}
          </Text>
          <Text style={styles.sectionText}>
            {rideStatus === "RIDE_COMPLETED"
              ? "You have reached your destination."
              : "The car marker now glides along the route so the map feels alive while the driver heads to pickup."}
          </Text>
        </View>

        <View style={styles.compactStatsRow}>
          <View style={styles.compactStat}>
            <Text style={styles.sectionLabel}>Fare</Text>
            <Text style={styles.compactStatValue}>Rs {ride.fare}</Text>
          </View>
          <View style={styles.compactStat}>
            <Text style={styles.sectionLabel}>Status</Text>
            <Text style={styles.compactStatValue}>
              {loadingStatus ? "..." : rideStatus.replace(/_/g, " ")}
            </Text>
          </View>
        </View>

        {rideStatus !== "RIDE_COMPLETED" && (
          <>
            <Pressable
              style={styles.primaryButton}
              onPress={handleCompleteRide}>
              <Text style={styles.primaryButtonText}>Complete ride flow</Text>
            </Pressable>

            <Pressable onPress={handleCancelRide}>
              <Text style={[styles.back, { color: "#dc2626" }]}>Cancel this ride</Text>
            </Pressable>
          </>
        )}

        {rideStatus === "RIDE_COMPLETED" && (
          <Pressable
            style={styles.primaryButton}
            onPress={() => router.push("/")}>
            <Text style={styles.primaryButtonText}>Back to home</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
