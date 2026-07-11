import { useRideStore } from "../../context/ride-store";
import { RideStateScreen } from "../../components/ride/ride-state-screen";
import { RideTrackingScreen } from "../../components/ride/ride-tracking-screen";

export function RiderTrackingScreen() {
  const trip = useRideStore((s) => s.trip);
  const status = useRideStore((s) => s.status);

  if (!trip || status === "IDLE") {
    return (
      <RideStateScreen
        title="Tracking is not ready"
        description="Confirm a ride first so the tracking step receives the proper rider flow context."
      />
    );
  }

  return <RideTrackingScreen />;
}
