import { router } from "expo-router";

import { useRideStore } from "../../context/ride-store";
import { RideCompleteScreen } from "../../components/ride/ride-complete-screen";
import { RideStateScreen } from "../../components/ride/ride-state-screen";
import { rideLog } from "../../utils/ride-request-diagnostics";

export function RiderCompleteScreen() {
  const trip = useRideStore((s) => s.trip);
  const resetRide = useRideStore((s) => s.resetRide);

  if (!trip) {
    return (
      <RideStateScreen
        title="Ride summary is unavailable"
        description="Finish the rider flow from tracking so the complete screen gets the correct trip data."
      />
    );
  }

  const handleReturnHome = () => {
    const rideId = useRideStore.getState().rideId;
    rideLog("NAVIGATION", { to: "/", reason: "complete.return-home", rideId });
    resetRide();
    router.replace("/");
  };

  return <RideCompleteScreen onReturnHome={handleReturnHome} />;
}
