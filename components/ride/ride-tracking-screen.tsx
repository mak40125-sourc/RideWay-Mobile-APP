import { router } from "expo-router";
import { useEffect } from "react";
import { Alert, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "../../context/auth-context";
import { useRideStore } from "../../context/ride-store";
import { buildMapRegion } from "../../utils/map-region";
import { useActiveRideDiscovery } from "../../hooks/useActiveRideDiscovery";
import { RideMap } from "./ride-map";
import { RideStateScreen } from "./ride-state-screen";
import { rideStyles as styles } from "./ride-styles";
import { RIDE_SHEET_BASE_HEIGHT, RideStatusSheet } from "./ride-status-sheet";
import { RideTopBar } from "./ride-top-bar";
import { FlowView } from "../flow/FlowView";
import { rideLog, setDiagnosticScreen } from "../../utils/ride-request-diagnostics";

export function RideTrackingScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const trip = useRideStore((s) => s.trip);
  const status = useRideStore((s) => s.status);
  const rideId = useRideStore((s) => s.rideId);
  const driver = useRideStore((s) => s.driver);
  const resetRide = useRideStore((s) => s.resetRide);

  useEffect(() => {
    setDiagnosticScreen("TRACKING");
    rideLog("RIDE_TRACKING_MOUNTED", { rideId, userId: user?.id ?? null, status });
  }, [rideId, user, status]);

  useActiveRideDiscovery();

  const region = trip ? buildMapRegion(trip.pickup, trip.dropoff) : null;

  if (!trip || !region) {
    return (
      <RideStateScreen
        loading
        title="Looking for your ride"
        description="Restoring your active ride from the server."
      />
    );
  }

  const isSearching = status === "REQUESTING" || status === "SEARCHING_DRIVER";

  const handleCompleteRide = () => {
    rideLog("NAVIGATION", { to: "/complete", reason: "tracking.button", rideId, status });
    router.push("/complete");
  };

  const handleCancelRide = () => {
    Alert.alert("Cancel Ride", "Are you sure you want to cancel this ride?", [
      { text: "No", style: "cancel" },
      {
        text: "Yes, Cancel",
        style: "destructive",
        onPress: async () => {
          rideLog("TRACKING_CANCEL_CONFIRMED", { rideId, userId: user?.id ?? null, status });
          try {
            const { cancelRide } = await import("../../services/ride.service");
            if (user && rideId) {
              await cancelRide(rideId);
            }
            resetRide();
            rideLog("NAVIGATION", { to: "/", reason: "tracking.cancel", rideId, status });
            rideLog("TRACKING_NAVIGATE_TO_HOME", { rideId, userId: user?.id ?? null, via: "cancel" });
            router.replace("/");
          } catch (error) {
            rideLog("TRACKING_CANCEL_FAILED", { rideId, userId: user?.id ?? null, message: error instanceof Error ? error.message : String(error) });
            Alert.alert("Error", error instanceof Error ? error.message : "Failed to cancel ride");
          }
        },
      },
    ]);
  };

  const sheetBottomInset = RIDE_SHEET_BASE_HEIGHT + insets.bottom;

  return (
    <FlowView>
      <View style={styles.screen}>
        <RideMap
          pickup={trip.pickup}
          dropoff={trip.dropoff}
          region={region}
          routePath={trip.path}
          driverLocation={driver?.location ?? null}
          driverLabel={driver?.name}
          edgePaddingBottom={sheetBottomInset}
        />

        {isSearching ? (
          <RideTopBar title="Finding your driver" subtitle="Looking for nearby drivers to accept your ride." />
        ) : null}

        <RideStatusSheet
          status={status}
          trip={trip}
          driver={driver}
          onCancel={handleCancelRide}
          onEndRide={handleCompleteRide}
          onViewSummary={handleCompleteRide}
        />
      </View>
    </FlowView>
  );
}