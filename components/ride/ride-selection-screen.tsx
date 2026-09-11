import { router } from "expo-router";
import { useMemo } from "react";
import { SafeAreaView } from "react-native";

import type { RideEstimate, RideOption } from "../home/types";
import { useRideStore } from "../../context/ride-store";
import { useFareEstimates } from "../../hooks/useFareEstimates";
import { buildMapRegion } from "../../utils/map-region";
import { calculateRideFare } from "./ride-helpers";
import { RideMap } from "./ride-map";
import { RideOptionsSheet } from "./ride-options-sheet";
import { rideOptions } from "./ride-config";
import { rideStyles as styles } from "./ride-styles";
import { RideTopBar } from "./ride-top-bar";
import { FlowView } from "../flow/FlowView";

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
  const setTrip = useRideStore((s) => s.setTrip);
  const setSelectedOption = useRideStore((s) => s.setSelectedOption);
  const selectedOptionLabel = useRideStore((s) => s.trip?.option?.label ?? null);

  const region = useMemo(() => buildMapRegion(pickup, dropoff), [dropoff, pickup]);
  const fares = useFareEstimates(pickup, dropoff, estimate.distance, estimate.duration);

  const continueToConfirm = () => {
    const state = useRideStore.getState();
    const option = state.trip?.option || rideOptions[0];
    // Display hint only; backend recomputes the authoritative fare at booking.
    const fare = fares?.[option.label] ?? calculateRideFare(option, estimate.distance, estimate.duration);
    setTrip({
      pickup,
      dropoff,
      selectedOption: option,
      fare,
      distance: estimate.distance,
      duration: estimate.duration,
      path: estimate.path,
    });
    router.push("/confirm");
  };

  return (
    <FlowView>
      <SafeAreaView style={styles.screen}>
        <RideMap pickup={pickup} dropoff={dropoff} region={region} routePath={estimate.path} />
        <RideTopBar title="Choose your ride" subtitle="Select a ride type that suits your trip." />
        <RideOptionsSheet
          distance={estimate.distance}
          duration={estimate.duration}
          fares={fares}
          options={rideOptions}
          selectedOptionLabel={selectedOptionLabel}
          onSelectOption={(option: RideOption, fare) => {
            setSelectedOption(option, fare);
          }}
          onBack={() => router.back()}
          onContinue={continueToConfirm}
        />
      </SafeAreaView>
    </FlowView>
  );
}
