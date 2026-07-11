import { router } from "expo-router";
import { create } from "zustand";
import type { Coordinates, RideOption } from "../components/home/types";
import { requestRide } from "../services/ride.service";

export type RideStatus =
  | "IDLE"
  | "REQUESTING"
  | "SEARCHING_DRIVER"
  | "DRIVER_ASSIGNED"
  | "DRIVER_ARRIVING"
  | "RIDE_STARTED"
  | "RIDE_COMPLETED"
  | "CANCELLED";

type DriverInfo = {
  id: string;
  name: string;
  vehicle: string;
  location: Coordinates | null;
};

type Trip = {
  pickup: Coordinates;
  dropoff: Coordinates;
  option: RideOption;
  fare: number;
  distance: number;
  duration: number;
  path: Coordinates[];
};

type RideState = {
  trip: Trip | null;

  status: RideStatus;
  rideId: string | null;
  requesting: boolean;
  error: string | null;

  driver: DriverInfo | null;
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
  }) => void;
  setSelectedOption: (option: RideOption, fare: number) => void;
  requestRideAction: (userId: string) => Promise<void>;
  setStatus: (status: RideStatus) => void;
  setRideId: (id: string) => void;
  simulateDriverAssignment: () => void;
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

  setTrip: (params) =>
    set({
      trip: {
        pickup: params.pickup,
        dropoff: params.dropoff,
        option: params.selectedOption,
        fare: params.fare,
        distance: params.distance,
        duration: params.duration,
        path: params.path,
      },
      status: "IDLE",
      error: null,
    }),

  setSelectedOption: (option, fare) =>
    set((state) => ({
      trip: state.trip
        ? { ...state.trip, option, fare }
        : null,
    })),

  requestRideAction: async (userId) => {
    const state = get();
    if (!state.trip) {
      set({ error: "Trip details are incomplete" });
      return;
    }

    const { pickup, dropoff, option, fare, distance, duration, path } = state.trip;

    set({ requesting: true, status: "REQUESTING", error: null });

    try {
      const result = await requestRide({
        riderId: userId,
        pickup,
        dropoff,
        fare,
        distance,
        duration,
        vehicleType: option.label.toLowerCase(),
      });

      set({
        rideId: result.ride.id,
        status: "SEARCHING_DRIVER",
        requesting: false,
      });

      router.push("/tracking");
    } catch (error) {
      set({
        status: "IDLE",
        requesting: false,
        error: error instanceof Error ? error.message : "Could not request ride.",
      });
    }
  },

  setStatus: (status) => set({ status }),

  setRideId: (id) => set({ rideId: id }),

  simulateDriverAssignment: () => {
    set({
      status: "DRIVER_ASSIGNED",
      driver: {
        id: "dev-driver-1",
        name: "Rahul",
        vehicle: "KA-01-AB-1234",
        location: null,
      },
    });

    setTimeout(() => {
      set((state) => {
        if (state.status === "DRIVER_ASSIGNED") {
          return { status: "DRIVER_ARRIVING" };
        }
        return {};
      });
    }, 6000);

    setTimeout(() => {
      set((state) => {
        if (state.status === "DRIVER_ARRIVING") {
          return { status: "RIDE_STARTED" };
        }
        return {};
      });
    }, 12000);

    setTimeout(() => {
      set((state) => {
        if (state.status === "RIDE_STARTED") {
          return { status: "RIDE_COMPLETED" };
        }
        return {};
      });
    }, 25000);
  },

  updateDriver: (info) =>
    set((state) => ({
      driver: state.driver ? { ...state.driver, ...info } : (info as DriverInfo),
    })),

  resetRide: () =>
    set({
      trip: null,
      status: "IDLE",
      rideId: null,
      requesting: false,
      error: null,
      driver: null,
    }),
}));
