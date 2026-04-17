import { useLocalSearchParams } from "expo-router";

import { RideStateScreen } from "../../components/ride/ride-state-screen";
import { RideTrackingScreen } from "../../components/ride/ride-tracking-screen";
import { rideOptions } from "../../components/ride/ride-config";
import { parseRideRoute } from "../../components/ride/ride-helpers";
import type { SelectedRide } from "../../components/ride/ride-types";
import { parseNumberParam, parseStringParam } from "../../utils/ride-params";
import type { Coordinates } from "../../components/home/types";

export function RiderTrackingScreen() {
  const params = useLocalSearchParams();
  const parsedRoute = parseRideRoute(params);
  const rideLabel = parseStringParam(params.rideLabel);
  const fare = parseNumberParam(params.fare);
  const duration = parseNumberParam(params.duration);
  const distance = parseNumberParam(params.distance) ?? 0;
  const pathParam = parseStringParam(params.path);
  const matchedOption = rideOptions.find((option) => option.label === rideLabel);

  if (!parsedRoute || !matchedOption || fare === null || duration === null) {
    return (
      <RideStateScreen
        title="Tracking is not ready"
        description="Confirm a ride first so the tracking step receives the proper rider flow context."
      />
    );
  }

  let path: Coordinates[] = [parsedRoute.pickup, parsedRoute.dropoff];

  try {
    const parsedPath = JSON.parse(pathParam) as Coordinates[];

    if (Array.isArray(parsedPath) && parsedPath.length > 1) {
      path = parsedPath;
    }
  } catch {}

  const ride: SelectedRide = {
    option: matchedOption,
    fare,
    duration,
    distance,
    path,
    pickup: parsedRoute.pickup,
    dropoff: parsedRoute.dropoff,
  };

  return <RideTrackingScreen ride={ride} />;
}
