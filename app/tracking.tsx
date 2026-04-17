import { useLocalSearchParams } from "expo-router";
import { RideTrackingScreen } from "../components/ride/ride-tracking-screen";
import { deserializeRide } from "../utils/ride-params";

export default function TrackingPage() {
  const params = useLocalSearchParams();
  const ride = deserializeRide(params);

  if (!ride) return null;

  return <RideTrackingScreen ride={ride} />;
}