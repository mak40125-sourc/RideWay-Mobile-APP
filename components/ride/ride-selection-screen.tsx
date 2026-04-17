import { router } from "expo-router";
import { useMemo, useState } from "react";
import { SafeAreaView } from "react-native";

import type { RideEstimate, RideOption } from "../home/types";
import { buildMapRegion } from "../../utils/map-region";
import { serializeRide } from "../../utils/ride-params";
import { calculateRideFare } from "./ride-helpers";
import { RideMap } from "./ride-map";
import { RideOptionsSheet } from "./ride-options-sheet";
import { rideOptions } from "./ride-config";
import { rideStyles as styles } from "./ride-styles";
import { RideTopBar } from "./ride-top-bar";
import type { SelectedRide } from "./ride-types";

type Props = {
  pickup: {
    latitude: number;
    longitude: number;
  };
  dropoff: {
    latitude: number;
    longitude: number;
  };
  estimate: RideEstimate;
};

export function RideSelectionScreen({ pickup, dropoff, estimate }: Props) {
  const [selectedRide, setSelectedRide] = useState<SelectedRide>({
    option: rideOptions[0],
    fare: calculateRideFare(rideOptions[0], estimate.distance, estimate.duration),
    distance: estimate.distance,
    duration: estimate.duration,
    path: estimate.path,
    pickup,
    dropoff,
  });

  const region = useMemo(() => buildMapRegion(pickup, dropoff), [dropoff, pickup]);

  const continueToConfirm = () => {
    router.push({
      pathname: "/confirm",
      params: serializeRide(selectedRide),
    });
  };

  return (
    <SafeAreaView style={styles.screen}>
      <RideMap pickup={pickup} dropoff={dropoff} region={region} routePath={estimate.path} />
      <RideTopBar title="Choose your ride" subtitle="Review the route and lock the best option." badge="Step 2" />
      <RideOptionsSheet
        distance={estimate.distance}
        duration={estimate.duration}
        options={rideOptions}
        selectedOptionLabel={selectedRide.option.label}
        onSelectOption={(option: RideOption, fare) => {
          setSelectedRide({
            option,
            fare,
            distance: estimate.distance,
            duration: estimate.duration,
            path: estimate.path,
            pickup,
            dropoff,
          });
        }}
        onBack={() => router.back()}
        onContinue={continueToConfirm}
      />
    </SafeAreaView>
  );
}
