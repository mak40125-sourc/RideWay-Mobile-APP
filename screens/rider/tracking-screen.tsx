import { RideTrackingScreen } from "../../components/ride/ride-tracking-screen";
import { setDiagnosticScreen } from "../../utils/ride-request-diagnostics";

export function RiderTrackingScreen() {
  setDiagnosticScreen("TRACKING");

  return <RideTrackingScreen />;
}