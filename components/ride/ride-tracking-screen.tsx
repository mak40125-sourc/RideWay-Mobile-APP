import { router } from "expo-router";
import { useEffect } from "react";
import { Alert, Pressable, Text, View } from "react-native";

import { useAuth } from "../../context/auth-context";
import { useRideStore, type RideStatus } from "../../context/ride-store";
import { buildMapRegion } from "../../utils/map-region";
import { DriverMatchingView } from "./driver-matching-view";
import { RideMap } from "./ride-map";
import { rideStyles as styles } from "./ride-styles";
import { RideTopBar } from "./ride-top-bar";

export function RideTrackingScreen() {
  const { user } = useAuth();
  const trip = useRideStore((s) => s.trip);
  const status = useRideStore((s) => s.status);
  const setStatus = useRideStore((s) => s.setStatus);
  const rideId = useRideStore((s) => s.rideId);
  const setRideId = useRideStore((s) => s.setRideId);
  const resetRide = useRideStore((s) => s.resetRide);
  const simulateDriverAssignment = useRideStore((s) => s.simulateDriverAssignment);

  const region = trip ? buildMapRegion(trip.pickup, trip.dropoff) : null;

  if (!trip || !region) return null;

  const hasDriver = status === "DRIVER_ASSIGNED" || status === "DRIVER_ARRIVING" || status === "RIDE_STARTED";

  const handleCompleteRide = () => {
    router.push("/complete");
  };

  const handleCancelRide = () => {
    Alert.alert("Cancel Ride", "Are you sure you want to cancel this ride?", [
      { text: "No", style: "cancel" },
      {
        text: "Yes, Cancel",
        style: "destructive",
        onPress: async () => {
          try {
            const { cancelRide } = await import("../../services/ride.service");
            if (user && rideId) {
              await cancelRide(rideId);
            }
            resetRide();
            router.replace("/");
          } catch (error) {
            Alert.alert("Error", error instanceof Error ? error.message : "Failed to cancel ride");
          }
        },
      },
    ]);
  };

  const statusMessages: Record<string, { title: string; subtitle: string }> = {
    DRIVER_ASSIGNED: { title: "Driver assigned!", subtitle: `Your ${trip.option.label} is on the way to pickup.` },
    DRIVER_ARRIVING: { title: "Driver arriving", subtitle: "Your driver is almost here." },
    RIDE_STARTED: { title: "Ride in progress", subtitle: "Enjoy your trip!" },
    RIDE_COMPLETED: { title: "Ride complete", subtitle: "Thanks for riding with RideWay!" },
  };

  const statusInfo = statusMessages[status] || {
    title: "Tracking your ride",
    subtitle: "Follow your trip in real time.",
  };

  useEffect(() => {
    if (!user || status === "RIDE_COMPLETED" || status === "CANCELLED") return;

    let cancelled = false;
    let hasRealDriver = false;

    const pollStatus = async () => {
      try {
        const { getRiderActiveRide } = await import("../../services/ride.service");
        const activeRide = await getRiderActiveRide(user.id);
        if (!cancelled && activeRide) {
          hasRealDriver = true;
          setStatus(activeRide.status as RideStatus);
          if (!rideId) setRideId(activeRide.id);
        }
      } catch {
        // backend not available — will use simulation fallback
      }
    };

    void pollStatus();
    const interval = setInterval(pollStatus, 5000);

    const simulationTimer = setTimeout(() => {
      if (!cancelled && !hasRealDriver && (status === "SEARCHING_DRIVER" || status === "REQUESTING")) {
        simulateDriverAssignment();
      }
    }, 8000);

    return () => {
      cancelled = true;
      clearInterval(interval);
      clearTimeout(simulationTimer);
    };
  }, [user, status, rideId, setStatus, setRideId, simulateDriverAssignment]);

  const isSearching = status === "REQUESTING" || status === "SEARCHING_DRIVER";

  return (
    <View style={styles.screen}>
      <RideMap pickup={trip.pickup} dropoff={trip.dropoff} region={region} routePath={trip.path} showDriverMotion />

      {isSearching ? (
        <>
          <RideTopBar title="Finding your driver" subtitle="Looking for nearby drivers to accept your ride." />
          <DriverMatchingView
            vehicleLabel={trip.option.label}
            fare={trip.fare}
            onCancel={handleCancelRide}
          />
        </>
      ) : (
        <>
          <RideTopBar title={statusInfo.title} subtitle={statusInfo.subtitle} />

          <View style={styles.compactCard}>
            <View style={styles.sectionCard}>
              <Text style={styles.sectionLabel}>Driver status</Text>
              <Text style={styles.sectionTitle}>
                {hasDriver
                  ? `Driver assigned for ${trip.option.label}`
                  : status === "RIDE_COMPLETED"
                  ? "Trip completed"
                  : `Searching for ${trip.option.label}`}
              </Text>
              <Text style={styles.sectionText}>
                {status === "RIDE_COMPLETED"
                  ? "You have reached your destination."
                  : "Your driver is on the way to your pickup location."}
              </Text>
            </View>

            <View style={styles.compactStatsRow}>
              <View style={styles.compactStat}>
                <Text style={styles.sectionLabel}>Fare</Text>
                <Text style={styles.compactStatValue}>Rs {trip.fare}</Text>
              </View>
              <View style={styles.compactStat}>
                <Text style={styles.sectionLabel}>Status</Text>
                <Text style={styles.compactStatValue}>{status.replace(/_/g, " ")}</Text>
              </View>
            </View>

            {status === "RIDE_STARTED" && (
              <Pressable
                style={styles.primaryButton}
                onPress={handleCompleteRide}>
                <Text style={styles.primaryButtonText}>End ride</Text>
              </Pressable>
            )}

            {status !== "RIDE_COMPLETED" && status !== "RIDE_STARTED" && (
              <Pressable onPress={handleCancelRide}>
                <Text style={[styles.back, { color: "#dc2626" }]}>Cancel this ride</Text>
              </Pressable>
            )}

            {status === "RIDE_COMPLETED" && (
              <Pressable
                style={styles.primaryButton}
                onPress={handleCompleteRide}>
                <Text style={styles.primaryButtonText}>View trip summary</Text>
              </Pressable>
            )}
          </View>
        </>
      )}
    </View>
  );
}
