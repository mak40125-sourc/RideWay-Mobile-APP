import { useRideStore } from "../../context/ride-store";
import { RideConfirmationScreen } from "../../components/ride/ride-confirmation-screen";
import { RideStateScreen } from "../../components/ride/ride-state-screen";

export function RiderConfirmScreen() {
  const trip = useRideStore((s) => s.trip);

  if (!trip) {
    return (
      <RideStateScreen
        title="Confirmation details unavailable"
        description="Choose a ride from the home screen first so the confirmation step has the right data."
      />
    );
  }

  return <RideConfirmationScreen />;
}
