import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { useRideStore } from "../context/ride-store";
import { rideLog } from "../utils/ride-request-diagnostics";
import { supabase } from "../lib/supabase";

function getWebSocketUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  const base = configured
    ? configured.replace(/\/$/, "")
    : (() => {
        const host =
          (Constants.expoConfig?.hostUri as string | undefined)?.split(":")[0] ||
          ((Constants as unknown as { expoGoConfig?: { debuggerHost?: string } }).expoGoConfig?.debuggerHost?.split(":")[0] ?? null) ||
          null;
        if (host) return `http://${host}:3000/api/v1`;
        const fb = Platform.OS === "android" ? "10.0.2.2" : "localhost";
        return `http://${fb}:3000/api/v1`;
      })();
  return base.replace(/\/api\/v1$/, "").replace(/^http/, "ws");
}

export function useRiderRideSocket(enabled = true) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let mounted = true;

    const connect = async () => {
      let token: string | null = null;
      try {
        const { data } = await supabase.auth.getSession();
        token = data.session?.access_token ?? null;
      } catch {}
      if (!token) token = await AsyncStorage.getItem("supabase_token");
      if (!token) {
        // eslint-disable-next-line no-console
        console.log(`[RIDEWAY-DIAG] RIDER_SOCKET_NO_TOKEN ts=${new Date().toISOString()}`);
        return;
      }
      const wsUrl = getWebSocketUrl();
      // eslint-disable-next-line no-console
      console.log(`[RIDEWAY-DIAG] RIDER_SOCKET_CONNECTING ts=${new Date().toISOString()} url=${wsUrl}`);
      rideLog("RIDER_SOCKET_CONNECTING", { url: wsUrl });
      const socket = io(wsUrl, {
        auth: { token },
        transports: ["websocket"],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: Infinity,
      });

      socket.on("connect", () => {
        if (!mounted) return;
        // eslint-disable-next-line no-console
        console.log(`[RIDEWAY-DIAG] RIDER_SOCKET_CONNECTED ts=${new Date().toISOString()} sid=${socket.id}`);
        rideLog("RIDER_SOCKET_CONNECTED", { sid: socket.id });
      });

      socket.on("ride:status_changed", (payload: { rideId: string; status: string; ride?: unknown }) => {
        const ts = new Date().toISOString();
        // eslint-disable-next-line no-console
        console.log(`[RIDEWAY-DIAG] RIDER_SOCKET_RIDE_EVENT ts=${ts} event=ride:status_changed rideId=${payload?.rideId} status=${payload?.status}`);
        rideLog("RIDER_SOCKET_RIDE_EVENT", { event: "ride:status_changed", rideId: payload?.rideId, status: payload?.status });
        const currentId = useRideStore.getState().rideId;
        const currentStatus = useRideStore.getState().status;
        if (payload?.rideId !== currentId) {
          // eslint-disable-next-line no-console
          console.log(`[RIDEWAY-DIAG] RIDER_SOCKET_RIDE_EVENT ts=${ts} ignored rideId mismatch current=${currentId} payload=${payload?.rideId}`);
          return;
        }
        // State-safe: never regress from terminal; ignore stale/lower-order events
        const ORDER: Record<string, number> = { REQUESTING: 0, SEARCHING_DRIVER: 1, DRIVER_ASSIGNED: 2, DRIVER_ARRIVING: 3, RIDE_STARTED: 4, RIDE_COMPLETED: 5, CANCELLED: 5 };
        const curOrder = ORDER[currentStatus] ?? -1;
        const incomingOrder = ORDER[payload?.status as string] ?? -1;
        if (curOrder >= 5 && incomingOrder < 5) {
          rideLog("RIDE_STALE_TRANSITION", { rideId: payload?.rideId, currentStatus, incomingStatus: payload?.status, reason: "terminal wins" });
          return;
        }
        if (incomingOrder !== -1 && curOrder !== -1 && incomingOrder < curOrder) {
          rideLog("RIDE_STALE_TRANSITION", { rideId: payload?.rideId, currentStatus, incomingStatus: payload?.status, reason: "stale order" });
          return;
        }
        if (payload?.status === "RIDE_COMPLETED") {
          // eslint-disable-next-line no-console
          console.log(`[RIDEWAY-DIAG] RIDER_RIDE_STATE_UPDATED ts=${new Date().toISOString()} rideId=${payload.rideId} from=${currentStatus} to=RIDE_COMPLETED source=socket`);
          rideLog("RIDER_RIDE_STATE_UPDATED", { rideId: payload.rideId, from: currentStatus, to: "RIDE_COMPLETED", source: "socket" });
          useRideStore.getState().setStatus("RIDE_COMPLETED");
        } else if (payload?.status && ORDER[payload.status] !== undefined) {
          // For non-terminal but authoritative forward progress, hydrate via recovery instead of blind setStatus
          // Rely on useRideRecovery to fetch full ride; socket is acceleration only.
          rideLog("RIDER_SOCKET_FORWARD", { rideId: payload?.rideId, status: payload?.status, from: currentStatus });
        }
      });

      socket.on("disconnect", (reason) => {
        // eslint-disable-next-line no-console
        console.log(`[RIDEWAY-DIAG] RIDER_SOCKET_DISCONNECT ts=${new Date().toISOString()} reason=${reason}`);
        rideLog("RIDER_SOCKET_DISCONNECT", { reason });
      });

      socket.on("connect_error", (err) => {
        // eslint-disable-next-line no-console
        console.log(`[RIDEWAY-DIAG] RIDER_SOCKET_ERROR ts=${new Date().toISOString()} msg=${err.message}`);
        rideLog("RIDER_SOCKET_ERROR", { message: err.message });
      });

      socket.on("reconnect", () => {
        // eslint-disable-next-line no-console
        console.log(`[RIDEWAY-DIAG] RIDER_SOCKET_RECONNECT ts=${new Date().toISOString()} sid=${socket.id}`);
        rideLog("RIDER_SOCKET_RECONNECT", { sid: socket.id });
        rideLog("RIDE_RECONCILIATION_STARTED", { reason: "socket_reconnect", sid: socket.id });
        // Server is authoritative — re-fetch active ride on reconnect rather than trusting missed events.
        void (async () => {
          try {
            const { getMyActiveRide, decodeRideLocation } = await import("../services/ride.service");
            const activeRide = await getMyActiveRide();
            if (activeRide?.id && activeRide?.status) {
              rideLog("RIDE_RECONCILIATION_COMPLETED", { rideId: activeRide.id, serverStatus: activeRide.status, source: "socket_reconnect" });
              const pickup = decodeRideLocation(activeRide.pickup_location);
              const dropoff = decodeRideLocation(activeRide.drop_location);
              useRideStore.getState().hydrateActiveRide({
                rideId: activeRide.id,
                status: activeRide.status as unknown as string as import("../context/ride-store").RideStatus,
                pickup,
                dropoff,
                pickupAddress: activeRide.pickup_address,
                dropAddress: activeRide.drop_address,
                fare: Number(activeRide.fare),
                distance: Number(activeRide.distance),
                duration: Number(activeRide.duration),
                driverId: activeRide.driver_id,
              });
            } else {
              rideLog("RIDE_RECONCILIATION_COMPLETED", { rideId: null, serverStatus: null, source: "socket_reconnect", found: false });
            }
          } catch (err) {
            rideLog("RIDE_RECOVERY_FAILED", { message: err instanceof Error ? err.message : String(err), source: "socket_reconnect" });
          }
        })();
      });

      socketRef.current = socket;
    };

    void connect();
    return () => {
      mounted = false;
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [enabled]);
}
