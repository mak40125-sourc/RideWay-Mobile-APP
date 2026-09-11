import { useEffect, useState } from "react";
import type { Coordinates, RideOption } from "../components/home/types";
import { rideOptions } from "../components/ride/ride-config";
import { calculateRideFare } from "../components/ride/ride-helpers";
import { estimateFare } from "../services/ride.service";

// Backend-authoritative fare estimates for display. Falls back to the legacy
// local formula only when the backend is unreachable, so the UI never blocks
// on pricing. The authoritative fare is always the backend response at booking.
export function useFareEstimates(
  pickup: Coordinates | null,
  dropoff: Coordinates | null,
  distance: number | null,
  duration: number | null
) {
  const [fares, setFares] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    if (!pickup || !dropoff) {
      setFares(null);
      return;
    }
    let active = true;
    (async () => {
      try {
        const quotes = await Promise.all(
          rideOptions.map((o: RideOption) =>
            estimateFare({ pickup, dropoff, vehicleType: o.vehicleType ?? o.label.toLowerCase() })
              .then((q) => ({ label: o.label, fare: q.totalFare }))
              .catch(() => null)
          )
        );
        if (!active) return;
        const map: Record<string, number> = {};
        for (const q of quotes) {
          if (q) map[q.label] = q.fare;
        }
        // Fill any missing option with the legacy local formula as display fallback.
        if (distance !== null && duration !== null) {
          for (const o of rideOptions) {
            if (!(o.label in map)) map[o.label] = calculateRideFare(o, distance, duration);
          }
        }
        setFares(Object.keys(map).length ? map : null);
      } catch {
        if (active) setFares(null);
      }
    })();
    return () => {
      active = false;
    };
  }, [pickup, dropoff, distance, duration]);

  return fares;
}
