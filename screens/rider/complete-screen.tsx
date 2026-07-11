import { router } from "expo-router";

import { useRideStore } from "../../context/ride-store";
import { RideCompleteScreen } from "../../components/ride/ride-complete-screen";
import { RideStateScreen } from "../../components/ride/ride-state-screen";

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
    resetRide();
    router.replace("/");
  };

  return <RideCompleteScreen onReturnHome={handleReturnHome} />;
}
