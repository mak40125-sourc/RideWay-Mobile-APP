import { router } from "expo-router";
import { create } from "zustand";
import type { Coordinates, RideOption } from "../components/home/types";
import { requestRide } from "../services/ride.service";
import { rideLog } from "../utils/ride-request-diagnostics";

let requestAttemptCounter = 0;

function isValidCoords(c: Coordinates | null | undefined): c is Coordinates {
  return (
    !!c &&
    Number.isFinite(c.latitude) &&
    Number.isFinite(c.longitude) &&
    (c.latitude !== 0 || c.longitude !== 0)
  );
}

function toFinite(value: number | null | undefined, fallback: number | undefined): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof fallback === "number" && Number.isFinite(fallback)) return fallback;
  return 0;
}

// The backend ride row carries no vehicle-type/option metadata. When a trip is
// rebuilt from the backend after local state loss, a neutral option label keeps
// the Trip shape valid without inventing a specific ride type.
const RECOVERY_RIDE_OPTION: RideOption = {
  label: "Ride",
  description: "",
  baseFare: 0,
  perKm: 0,
  perMin: 0,
  vehicleType: "ride",
};

export type RideStatus =
  | "IDLE"
  | "REQUESTING"
  | "SEARCHING_DRIVER"
  | "DRIVER_ASSIGNED"
  | "DRIVER_ARRIVING"
  | "RIDE_STARTED"
  | "RIDE_COMPLETED"
  | "CANCELLED";

export type DriverInfo = {
  id: string;
  name: string;
  vehicle: string;
  location: Coordinates | null;
  vehicleModel?: string;
  vehiclePlate?: string;
  rating?: number;
  phone?: string;
};

export type Trip = {
  pickup: Coordinates;
  dropoff: Coordinates;
  option: RideOption;
  fare: number;
  distance: number;
  duration: number;
  path: Coordinates[];
  pickupAddress?: string | null;
  dropAddress?: string | null;
  // Passenger identity. For a normal ride both are the rider; for a ride booked
  // for someone else these describe the actual passenger (see requestedBy below).
  requestedBy?: string | null;
  passengerName?: string | null;
  passengerPhone?: string | null;
};

type RideState = {
  trip: Trip | null;

  status: RideStatus;
  rideId: string | null;
  requesting: boolean;
  error: string | null;

  driver: DriverInfo | null;
  driverId: string | null;
};

type RideActions = {
  setTrip: (params: {
    pickup: Coordinates;
    dropoff: Coordinates;
    selectedOption: RideOption;
    fare: number;
    distance: number;
    duration: number;
    path: Coordinates[];
    pickupAddress?: string | null;
    dropAddress?: string | null;
    passengerName?: string | null;
    passengerPhone?: string | null;
  }) => void;
  setSelectedOption: (option: RideOption, fare: number) => void;
  requestRideAction: (userId: string, options?: { navigateToTracking?: boolean }) => Promise<void>;
  setStatus: (status: RideStatus) => void;
  setRideId: (id: string) => void;
  hydrateActiveRide: (params: {
    rideId: string;
    status: RideStatus;
    pickup: Coordinates | null;
    dropoff: Coordinates | null;
    pickupAddress?: string | null;
    dropAddress?: string | null;
    fare?: number | null;
    distance?: number | null;
    duration?: number | null;
    driverId?: string | null;
    passengerName?: string | null;
    passengerPhone?: string | null;
  }) => void;
  updateDriver: (info: Partial<DriverInfo>) => void;
  resetRide: () => void;
};

export const useRideStore = create<RideState & RideActions>((set, get) => ({
  trip: null,

  status: "IDLE",
  rideId: null,
  requesting: false,
  error: null,

  driver: null,
  driverId: null,

  setTrip: (params) => {
    const prev = get().status;
    if (prev === "REQUESTING" || prev === "SEARCHING_DRIVER" || prev === "DRIVER_ASSIGNED") {
      rideLog("STATE_RESET", { from: prev, to: "IDLE", reason: "setTrip", rideId: get().rideId });
    }
    set({
      trip: {
        pickup: params.pickup,
        dropoff: params.dropoff,
        option: params.selectedOption,
        fare: params.fare,
        distance: params.distance,
        duration: params.duration,
        path: params.path,
        pickupAddress: params.pickupAddress ?? null,
        dropAddress: params.dropAddress ?? null,
        passengerName: params.passengerName ?? null,
        passengerPhone: params.passengerPhone ?? null,
      },
      status: "IDLE",
      error: null,
      driverId: null,
    });
  },

  setSelectedOption: (option, fare) =>
    set((state) => ({
      trip: state.trip
        ? { ...state.trip, option, fare }
        : null,
    })),

  requestRideAction: async (userId, options) => {
    const { navigateToTracking = true } = options ?? {};
    const attempt = ++requestAttemptCounter;
    const traceId = `req-${Date.now().toString(36)}-${attempt}`;
    const state = get();
    rideLog("REQUEST_ACTION_ENTERED", { userId, attempt, traceId, hasTrip: !!state.trip, navigateToTracking });
    if (!state.trip) {
      const msg = "Trip details are incomplete";
      set({ error: msg });
      rideLog("RIDE_REJECTED_NO_TRIP", { userId, attempt, traceId });
      return;
    }

    const { pickup, dropoff, option, fare, distance, duration, path, passengerName, passengerPhone } = state.trip;

    rideLog("RIDE_REQUEST_STARTED", { userId, navigateToTracking, vehicleType: option.vehicleType ?? option.label.toLowerCase(), attempt, traceId });
    set({ requesting: true, status: "REQUESTING", error: null });
    rideLog("REQUEST_STATE_SET", { userId, attempt, traceId, status: "REQUESTING", from: state.status, requesting: true });
    rideLog("RIDE_STATUS_CHANGED", { userId, status: "REQUESTING", from: state.status, attempt, traceId });

    try {
      const result = await requestRide({
        riderId: userId,
        pickup,
        dropoff,
        fare,
        distance,
        duration,
        vehicleType: option.vehicleType ?? option.label.toLowerCase(),
        passengerName: passengerName ?? undefined,
        passengerPhone: passengerPhone ?? undefined,
      }, { traceId, attempt });

      rideLog("RIDE_RESPONSE_RECEIVED", { userId, rideId: result.rideId, candidateCount: result.candidateCount, attempt, traceId });
      rideLog("RIDE_ID_RECEIVED", { userId, rideId: result.rideId, attempt, traceId });

      set({
        rideId: result.rideId,
        status: "SEARCHING_DRIVER",
        requesting: false,
      });
      rideLog("REQUEST_ACTION_SUCCESS", { userId, attempt, traceId, rideId: result.rideId, status: "SEARCHING_DRIVER", requesting: false, tripPresent: !!get().trip });
      rideLog("RIDE_STATUS_CHANGED", { userId, rideId: result.rideId, status: "SEARCHING_DRIVER", from: "REQUESTING", attempt, traceId });

      if (navigateToTracking) {
        rideLog("NAVIGATION", { to: "/tracking", reason: "requestRideAction.success", userId, rideId: result.rideId, attempt, traceId });
        rideLog("RIDE_NAVIGATING_TO_TRACKING", { userId, rideId: result.rideId, via: "store" });
        router.push("/tracking");
      } else {
        rideLog("RIDE_NAVIGATION_DEFERRED", { userId, rideId: result.rideId, via: "store", attempt, traceId });
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Could not request ride.";
      const statusCode = error instanceof Error && "status" in error ? (error as Error & { status?: number }).status : undefined;
      const category = statusCode === undefined ? "network" : statusCode >= 500 ? "5xx" : "4xx";
      const retryable = statusCode === undefined || statusCode >= 500;
      rideLog("RIDE_REQUEST_FAILED", { userId, reason, statusCode, category, retryable, attempt, traceId, rideId: get().rideId, currentRideStatus: get().status, requesting: get().requesting });
      if (retryable) {
        // Transient request failure (network/offline or server 5xx): keep the
        // searching flow alive so the rider is not dumped back to the options
        // pane. The discovery hook keeps polling for a real backend ride and
        // the booking pane shows an inline error with a retry action.
        set({
          status: "SEARCHING_DRIVER",
          requesting: false,
          error: reason,
        });
        rideLog("RIDE_STATUS_CHANGED", { userId, rideId: get().rideId, status: "SEARCHING_DRIVER", from: get().status, reason, source: "requestRideAction.retryable", attempt, traceId });
      } else {
        // Terminal failure (client 4xx): retrying won't help, return to the
        // options pane with the error surfaced.
        rideLog("STATE_RESET", { from: get().status, to: "IDLE", reason: "requestRideAction-terminal-4xx", rideId: get().rideId, attempt, traceId });
        set({
          status: "IDLE",
          requesting: false,
          error: reason,
        });
        rideLog("RIDE_STATUS_CHANGED", { userId, rideId: get().rideId, status: "IDLE", from: get().status, reason, source: "requestRideAction.terminal", attempt, traceId });
      }
      rideLog("REQUEST_ACTION_FAILURE", { userId, attempt, traceId, reason, statusCode, category, retryable, rideId: get().rideId, status: get().status, requesting: get().requesting, tripPresent: !!get().trip });
    }
  },

  setStatus: (status) => {
    const prev = get().status;
    const ts = new Date().toISOString();
    // eslint-disable-next-line no-console
    console.log(`[RIDEWAY-DIAG] RIDER_RIDE_STATE_UPDATED ts=${ts} rideId=${get().rideId ?? 'null'} from=${prev} to=${status}`);
    if (status === "IDLE" && (prev === "REQUESTING" || prev === "SEARCHING_DRIVER" || prev === "DRIVER_ASSIGNED")) {
      rideLog("STATE_RESET", { from: prev, to: "IDLE", reason: "setStatus", rideId: get().rideId });
    }
    set({ status });
    if (prev !== status) {
      rideLog("RIDE_STATUS_CHANGED", { rideId: get().rideId, status, from: prev, source: "setStatus" });
    }
  },

  setRideId: (id) => set({ rideId: id }),

  hydrateActiveRide: (params) => {
    const ts = new Date().toISOString();
    const prev = get().status;
    // eslint-disable-next-line no-console
    console.log(`[RIDEWAY-DIAG] RIDER_RIDE_STATE_UPDATED ts=${ts} rideId=${params.rideId} from=${prev} to=${params.status} pickup=${!!params.pickup} dropoff=${!!params.dropoff}`);
    return set((state) => {
      const local = state.trip;

      let pickup: Coordinates | null = null;
      if (isValidCoords(params.pickup)) pickup = params.pickup;
      else if (isValidCoords(local?.pickup)) pickup = local!.pickup;

      let dropoff: Coordinates | null = null;
      if (isValidCoords(params.dropoff)) dropoff = params.dropoff;
      else if (isValidCoords(local?.dropoff)) dropoff = local!.dropoff;

      const trip =
        pickup && dropoff
          ? {
              pickup,
              dropoff,
              option: local?.option ?? RECOVERY_RIDE_OPTION,
              fare: toFinite(params.fare, local?.fare),
              distance: toFinite(params.distance, local?.distance),
              duration: toFinite(params.duration, local?.duration),
              path: local?.path ?? [],
              pickupAddress: params.pickupAddress ?? null,
              dropAddress: params.dropAddress ?? null,
              passengerName: params.passengerName ?? null,
              passengerPhone: params.passengerPhone ?? null,
            }
          : state.trip;

      return {
        rideId: params.rideId,
        status: params.status,
        trip,
        driverId: params.driverId ?? state.driverId,
        requesting: false,
        error: null,
      };
    });
  },

  updateDriver: (info) =>
    set((state) => ({
      driver: state.driver ? { ...state.driver, ...info } : (info as DriverInfo),
    })),

  resetRide: () => {
    const prev = get().status;
    const ts = new Date().toISOString();
    // eslint-disable-next-line no-console
    console.log(`[RIDEWAY-DIAG] RIDER_ACTIVE_RIDE_CLEARED ts=${ts} rideId=${get().rideId ?? 'null'} from=${prev} to=IDLE reason=resetRide`);
    rideLog("STATE_RESET", { from: prev, to: "IDLE", reason: "resetRide", rideId: get().rideId });
    rideLog("RIDE_RESET", { rideId: get().rideId });
    set({
      trip: null,
      status: "IDLE",
      rideId: null,
      requesting: false,
      error: null,
      driver: null,
      driverId: null,
    });
  },
}));
