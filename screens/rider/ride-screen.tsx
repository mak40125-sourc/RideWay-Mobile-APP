import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";

import type { RideEstimate } from "../../components/home/types";
import { RideSelectionScreen } from "../../components/ride/ride-selection-screen";
import { RideStateScreen } from "../../components/ride/ride-state-screen";
import { parseRideRoute } from "../../components/ride/ride-helpers";
import { getRouteEstimate } from "../../services/osrm";

export function RiderRideScreen() {
  const params = useLocalSearchParams();
  const parsedRoute = parseRideRoute(params);
  const [estimate, setEstimate] = useState<RideEstimate | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const fetchRoute = async () => {
      if (!parsedRoute) {
        setLoading(false);
        return;
      }

      try {
        const nextEstimate = await getRouteEstimate(parsedRoute.pickup, parsedRoute.dropoff);

        if (active) {
          setEstimate(nextEstimate);
        }
      } catch {
        if (active) {
          setEstimate(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    fetchRoute();

    return () => {
      active = false;
    };
  }, [parsedRoute]);

  if (loading) {
    return (
      <RideStateScreen
        loading
        title="Preparing ride options"
        description="We&apos;re preparing route guidance and vehicle fares for this trip."
      />
    );
  }

  if (!parsedRoute || !estimate) {
    return (
      <RideStateScreen
        title="Trip details are missing"
        description="Start from the home screen so we can continue the rider flow in the right order."
      />
    );
  }

  return (
    <RideSelectionScreen
      pickup={parsedRoute.pickup}
      dropoff={parsedRoute.dropoff}
      estimate={estimate}
    />
  );
}
