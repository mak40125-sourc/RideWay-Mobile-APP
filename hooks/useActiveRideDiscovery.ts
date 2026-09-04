import { useEffect } from "react";

import { useAuth } from "../context/auth-context";
import { useRideStore, type RideStatus } from "../context/ride-store";
import { decodeRideLocation, getRide, getRiderActiveRide } from "../services/ride.service";
import { rideLog } from "../utils/ride-request-diagnostics";

const ACTIVE_RIDE_POLL_MS = 5000;

/**
 * Reconciles the ride store with the backend's active ride for the current
 * rider. Unlike the previous setup (where polling only lived on the tracking
 * screen), this hook can be mounted from any screen, so an accepted ride can
 * be discovered while the rider is still in SEARCHING_DRIVER — without needing
 * the tracking screen to already be mounted.
 *
 * The backend is authoritative. When the polled active ride matches the ride
 * currently booked in the store, the store's status, rideId, trip (pickup /
 * dropoff / fare / distance / duration / addresses) and driver_id are all
 * hydrated from the response.
 *
 * When no local booking exists (`rideId` is null — e.g. the app was reloaded
 * mid-ride), the backend's active ride is still adopted so the rider can
 * recover the accepted ride. A local `rideId` only acts as a staleness guard
 * when it is set: a polled ride whose id differs from a local booking id is
 * ignored (stale cross-ride data).
 *
 * This hook never invents DRIVER_ASSIGNED and never uses a timer-based fake
 * driver. The only transition into DRIVER_ASSIGNED comes from the backend
 * active-ride response. When the backend is unavailable or reports no matching
 * active ride, the store is left untouched.
 */
export function useActiveRideDiscovery(enabled = true) {
  const { user } = useAuth();
  const status = useRideStore((s) => s.status);
  const rideId = useRideStore((s) => s.rideId);
  const hydrateActiveRide = useRideStore((s) => s.hydrateActiveRide);

  useEffect(() => {
    if (!enabled || !user || status === "RIDE_COMPLETED" || status === "CANCELLED") return;

    let cancelled = false;

    const pollStatus = async () => {
      try {
        const ts = new Date().toISOString();
        // eslint-disable-next-line no-console
        console.log(`[RIDEWAY-DIAG] RIDER_POLL ts=${ts} rideId=${rideId ?? 'null'} userId=${user.id} status=${status} endpoint=GET:/rides/rider/:riderId/active`);
        const activeRide = await getRiderActiveRide(user.id);
        if (cancelled || !activeRide) {
          if (!cancelled) {
            rideLog("DISCOVERY_NO_ACTIVE_RIDE", { rideId, userId: user.id, status });
            // eslint-disable-next-line no-console
            console.log(`[RIDEWAY-DIAG] RIDER_POLL_NO_ACTIVE ts=${new Date().toISOString()} rideId=${rideId ?? 'null'} status=${status} -> attempting recovery fetch`);
            // Recovery: if we have a local rideId but active poll returned null (RIDE_COMPLETED filtered),
            // fetch the specific ride to detect completion missed due to disconnect.
            if (rideId) {
              try {
                const direct = await getRide(rideId);
                if (direct && direct.status === "RIDE_COMPLETED") {
                  // eslint-disable-next-line no-console
                  console.log(`[RIDEWAY-DIAG] RIDER_RIDE_STATE_UPDATED ts=${new Date().toISOString()} rideId=${rideId} from=${status} to=RIDE_COMPLETED source=recovery_poll`);
                  rideLog("RIDER_SOCKET_RIDE_EVENT", { event: "ride:status_changed", rideId, status: "RIDE_COMPLETED", source: "recovery_poll" });
                  rideLog("RIDER_RIDE_STATE_UPDATED", { rideId, from: status, to: "RIDE_COMPLETED", source: "recovery_poll" });
                  useRideStore.getState().setStatus("RIDE_COMPLETED");
                  // eslint-disable-next-line no-console
                  console.log(`[RIDEWAY-DIAG] RIDER_ACTIVE_RIDE_CLEARED ts=${new Date().toISOString()} rideId=${rideId} source=completion via=recovery_poll`);
                  return;
                }
              } catch {
                // ignore recovery fetch errors
              }
            }
            // eslint-disable-next-line no-console
            console.log(`[RIDEWAY-DIAG] RIDER_RIDE_STATE_UPDATED ts=${new Date().toISOString()} rideId=${rideId ?? 'null'} activeRide=null status=${status} -> no_hydration (RIDE_COMPLETED filtered)`);
            // eslint-disable-next-line no-console
            console.log(`[RIDEWAY-DIAG] RIDER_SOCKET_RIDE_EVENT ts=${new Date().toISOString()} event=NONE rideId=${rideId ?? 'null'} note=no_socket_on_completion`);
          }
          return;
        }

        if (typeof activeRide.id !== "string" || !activeRide.id || !activeRide.status) {
          rideLog("DISCOVERY_ACTIVE_RIDE_INVALID", {
            rideId,
            userId: user.id,
            status,
            activeRideId: activeRide.id,
          });
          return;
        }

        if (rideId && activeRide.id !== rideId) {
          rideLog("DISCOVERY_ACTIVE_RIDE_MISMATCH", {
            rideId,
            userId: user.id,
            status,
            activeRideId: activeRide.id,
            activeRideStatus: activeRide.status,
          });
          return;
        }

        const pickup = decodeRideLocation(activeRide.pickup_location);
        const dropoff = decodeRideLocation(activeRide.drop_location);

        rideLog("DISCOVERY_ACTIVE_RIDE", {
          rideId,
          userId: user.id,
          status,
          activeRideStatus: activeRide.status,
        });
        // eslint-disable-next-line no-console
        console.log(`[RIDEWAY-DIAG] RIDER_SOCKET_RIDE_EVENT ts=${new Date().toISOString()} event=poll activeRideStatus=${activeRide.status} rideId=${activeRide.id}`);
        // eslint-disable-next-line no-console
        console.log(`[RIDEWAY-DIAG] RIDER_RIDE_STATE_UPDATED ts=${new Date().toISOString()} rideId=${activeRide.id} from=${status} to=${activeRide.status}`);

        hydrateActiveRide({
          rideId: activeRide.id,
          status: activeRide.status as RideStatus,
          pickup,
          dropoff,
          pickupAddress: activeRide.pickup_address,
          dropAddress: activeRide.drop_address,
          fare: Number(activeRide.fare),
          distance: Number(activeRide.distance),
          duration: Number(activeRide.duration),
          driverId: activeRide.driver_id,
        });

        rideLog("DISCOVERY_ACTIVE_RIDE_HYDRATED", {
          rideId: activeRide.id,
          userId: user.id,
          status,
          activeRideStatus: activeRide.status,
          pickupDecoded: !!pickup,
          dropoffDecoded: !!dropoff,
          hasDriverId: !!activeRide.driver_id,
        });
      } catch (error) {
        if (!cancelled) {
          rideLog("DISCOVERY_POLL_FAILED", {
            rideId,
            userId: user.id,
            status,
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
    };

    void pollStatus();
    const interval = setInterval(pollStatus, ACTIVE_RIDE_POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [enabled, user, status, rideId, hydrateActiveRide]);
}
