import { useLocalSearchParams } from "expo-router";

import { RideConfirmationScreen } from "../../components/ride/ride-confirmation-screen";
import { rideOptions } from "../../components/ride/ride-config";
import { parseRideRoute } from "../../components/ride/ride-helpers";
import { RideStateScreen } from "../../components/ride/ride-state-screen";
import type { SelectedRide } from "../../components/ride/ride-types";
import { parseNumberParam, parseStringParam } from "../../utils/ride-params";
import type { Coordinates } from "../../components/home/types";

export function RiderConfirmScreen() {
  const params = useLocalSearchParams();
  const parsedRoute = parseRideRoute(params);
  const rideLabel = parseStringParam(params.rideLabel);
  const rideDescription = parseStringParam(params.rideDescription);
  const fare = parseNumberParam(params.fare);
  const distance = parseNumberParam(params.distance);
  const duration = parseNumberParam(params.duration);
  const pathParam = parseStringParam(params.path);
  const matchedOption = rideOptions.find((option) => option.label === rideLabel);

  if (!parsedRoute || !matchedOption || fare === null || distance === null || duration === null) {
    return (
      <RideStateScreen
        title="Confirmation details unavailable"
        description="Choose a ride from the ride options screen first so the confirmation step has the right data."
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
    option: {
      ...matchedOption,
      description: rideDescription || matchedOption.description,
    },
    fare,
    distance,
    duration,
    path,
    pickup: parsedRoute.pickup,
    dropoff: parsedRoute.dropoff,
  };

  return <RideConfirmationScreen ride={ride} />;
}
