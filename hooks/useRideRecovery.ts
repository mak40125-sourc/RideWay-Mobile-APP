import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useAuth } from "../context/auth-context";
import { useRideStore, type RideStatus } from "../context/ride-store";
import { decodeRideLocation, getMyActiveRide, getRide, getRiderActiveRide } from "../services/ride.service";
import { rideLog } from "../utils/ride-request-diagnostics";

const ACTIVE_RIDE_POLL_MS = 5000;
const TERMINAL_STATUSES: ReadonlySet<string> = new Set(["RIDE_COMPLETED", "CANCELLED"]);

async function fetchActiveRide(userId: string) {
  try {
    const ride = await getMyActiveRide();
    if (ride !== undefined) return ride;
  } catch {}
  try {
    return await getRiderActiveRide(userId);
  } catch {
    return null;
  }
}

export function useRideRecovery() {
  const { user } = useAuth();
  const hydrated = useRideStore((s) => s._hasHydrated);
  const statusRef = useRef(useRideStore.getState().status);
  const rideIdRef = useRef(useRideStore.getState().rideId);
  const userRef = useRef(user);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    const unsub = useRideStore.subscribe((state) => {
      statusRef.current = state.status;
      rideIdRef.current = state.rideId;
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user || !hydrated) return;

    let cancelled = false;
    let running = false;

    const recover = async (source: string) => {
      if (running) return;
      running = true;
      const currentUser = userRef.current;
      if (!currentUser) {
        running = false;
        return;
      }
      const prevStatus = statusRef.current;
      const prevRideId = rideIdRef.current;

      // If already in terminal, don't poll unless we suspect completion was missed (prevRideId exists)
      // Allow IDLE to discover existing ride unconditionally.
      if (TERMINAL_STATUSES.has(prevStatus) && !prevRideId) {
        running = false;
        return;
      }

      rideLog("RIDE_RECOVERY_STARTED", { rideId: prevRideId, userId: currentUser.id, previousStatus: prevStatus, source });
      // eslint-disable-next-line no-console
      console.log(`[RIDEWAY-DIAG] RIDE_RECOVERY_STARTED ts=${new Date().toISOString()} rideId=${prevRideId ?? 'null'} userId=${currentUser.id} prevStatus=${prevStatus} source=${source}`);
      try {
        const activeRide = await fetchActiveRide(currentUser.id);
        if (cancelled) {
          running = false;
          return;
        }
        if (!activeRide) {
          rideLog("RIDE_RECOVERY_NOT_FOUND", { rideId: prevRideId, userId: currentUser.id, previousStatus: prevStatus, source });
          // eslint-disable-next-line no-console
          console.log(`[RIDEWAY-DIAG] RIDE_RECOVERY_NOT_FOUND ts=${new Date().toISOString()} rideId=${prevRideId ?? 'null'} status=${prevStatus} -> no hydration`);
          if (prevRideId) {
            try {
              const direct = await getRide(prevRideId);
              if (direct && TERMINAL_STATUSES.has(direct.status)) {
                rideLog("RIDE_RECOVERY_FOUND", { rideId: prevRideId, userId: currentUser.id, previousStatus: prevStatus, serverStatus: direct.status, source: `${source}:direct` });
                if (direct.status === "RIDE_COMPLETED") {
                  useRideStore.getState().setStatus("RIDE_COMPLETED");
                } else if (direct.status === "CANCELLED") {
                  useRideStore.getState().setStatus("CANCELLED");
                }
                rideLog("RIDE_RECOVERY_HYDRATED", { rideId: prevRideId, previousStatus: prevStatus, serverStatus: direct.status, source });
                running = false;
                return;
              }
            } catch {}
          }
          running = false;
          return;
        }

        if (typeof activeRide.id !== "string" || !activeRide.id || !activeRide.status) {
          rideLog("RIDE_RECOVERY_FAILED", { rideId: prevRideId, userId: currentUser.id, previousStatus: prevStatus, reason: "invalid payload", source });
          running = false;
          return;
        }

        // Staleness guard: if we have a local rideId that differs, ignore (stale cross-ride)
        if (prevRideId && activeRide.id !== prevRideId) {
          rideLog("RIDE_RECOVERY_FAILED", { rideId: prevRideId, userId: currentUser.id, previousStatus: prevStatus, activeRideId: activeRide.id, reason: "mismatch", source });
          running = false;
          return;
        }

        rideLog("RIDE_RECOVERY_FOUND", { rideId: activeRide.id, userId: currentUser.id, previousStatus: prevStatus, serverStatus: activeRide.status, source });
        // eslint-disable-next-line no-console
        console.log(`[RIDEWAY-DIAG] RIDE_RECOVERY_FOUND ts=${new Date().toISOString()} rideId=${activeRide.id} serverStatus=${activeRide.status} prev=${prevStatus} source=${source}`);

        const pickup = decodeRideLocation(activeRide.pickup_location);
        const dropoff = decodeRideLocation(activeRide.drop_location);
        useRideStore.getState().hydrateActiveRide({
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
          passengerName: (activeRide as unknown as { passenger_name?: string | null }).passenger_name ?? null,
          passengerPhone: (activeRide as unknown as { passenger_phone?: string | null }).passenger_phone ?? null,
        });
        rideLog("RIDE_RECOVERY_HYDRATED", { rideId: activeRide.id, previousStatus: prevStatus, serverStatus: activeRide.status, pickupDecoded: !!pickup, dropoffDecoded: !!dropoff, hasDriverId: !!activeRide.driver_id, source });
        // eslint-disable-next-line no-console
        console.log(`[RIDEWAY-DIAG] RIDE_RECOVERY_HYDRATED ts=${new Date().toISOString()} rideId=${activeRide.id} from=${prevStatus} to=${activeRide.status} source=${source}`);
      } catch (error) {
        if (!cancelled) {
          rideLog("RIDE_RECOVERY_FAILED", { rideId: prevRideId, userId: currentUser.id, previousStatus: prevStatus, message: error instanceof Error ? error.message : String(error), source });
        }
      } finally {
        running = false;
      }
    };

    void recover("launch");

    const interval = setInterval(() => void recover("poll"), ACTIVE_RIDE_POLL_MS);

    const sub = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") void recover("foreground");
    });

    return () => {
      cancelled = true;
      clearInterval(interval);
      sub.remove();
    };
  }, [user, hydrated]);

  return null;
}
