import type { Coordinates } from "../components/home/types";
import { api } from "../services/api";
import { rideLog } from "../utils/ride-request-diagnostics";

export type RideRequestPayload = {
  riderId: string;
  pickup: Coordinates;
  dropoff: Coordinates;
  fare: number;
  distance: number;
  duration: number;
  vehicleType: string;
  // Optional passenger identity for rides booked for someone else. Omitted for
  // a normal ride where the rider is also the passenger.
  passengerName?: string;
  passengerPhone?: string;
};

// PostgREST serializes PostGIS geography columns as EWKB hex strings
// (e.g. `0101000020E6100000...`), but the same field may also arrive as a
// GeoJSON-style object (`{ coordinates: [lng, lat] }`) or `{ lat, lng }`.
// The type reflects the real possible shapes rather than one invented shape.
export type RideLocation =
  | string
  | { coordinates?: [number, number] }
  | { latitude?: number; longitude?: number }
  | null;

export type Ride = {
  id: string;
  rider_id: string;
  driver_id: string | null;
  pickup_location: RideLocation;
  drop_location: RideLocation;
  pickup_address: string | null;
  drop_address: string | null;
  fare: number;
  distance: number;
  duration: number;
  status: string;
  created_at: string;
  updated_at: string;
  // Passenger identity for rides booked on behalf of someone else. May be
  // absent for normal rides or when the source backend predates this field.
  passenger_name?: string | null;
  passenger_phone?: string | null;
};

// EWKB 2D Point with SRID (25 bytes, little-endian):
//   byteOrder(1) | type(4) | srid(4) | x(8) | y(8)
// WKT order is POINT(longitude latitude), so x = longitude, y = latitude.
export function decodeEwkbPoint(hex: string): Coordinates | null {
  if (typeof hex !== "string" || !/^[0-9a-fA-F]+$/.test(hex)) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  if (bytes.length !== 25 || bytes[0] !== 1) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.length);
  if (view.getUint32(1, true) !== 0x20000001) return null;
  if (view.getUint32(5, true) !== 4326) return null;
  return { latitude: view.getFloat64(17, true), longitude: view.getFloat64(9, true) };
}

// Accepts EWKB hex, GeoJSON-style `{ coordinates: [lng, lat] }`, or
// `{ latitude, longitude }` / `{ lat, lng }`. Malformed input returns null —
// never `{ latitude: 0, longitude: 0 }`.
export function decodeRideLocation(loc: unknown): Coordinates | null {
  if (typeof loc === "string") return decodeEwkbPoint(loc);
  if (loc && typeof loc === "object") {
    const obj = loc as {
      coordinates?: unknown;
      latitude?: unknown;
      longitude?: unknown;
      lat?: unknown;
      lng?: unknown;
    };
    if (Array.isArray(obj.coordinates) && obj.coordinates.length >= 2) {
      const longitude = Number(obj.coordinates[0]);
      const latitude = Number(obj.coordinates[1]);
      if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
        return { latitude, longitude };
      }
    }
    const latitude = Number(obj.latitude ?? obj.lat);
    const longitude = Number(obj.longitude ?? obj.lng);
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      return { latitude, longitude };
    }
  }
  return null;
}

export type RideRequestResult = {
  rideId: string;
  candidateCount: number;
};

export async function requestRide(
  payload: RideRequestPayload,
  trace?: { traceId?: string; attempt?: number }
): Promise<RideRequestResult> {
  rideLog("API_REQUEST_RIDE_START", { userId: payload.riderId, traceId: trace?.traceId, attempt: trace?.attempt });
  try {
    const result = await api.post<{ data: RideRequestResult; status: number }>("/rides/request", payload, {
      withStatus: true,
      traceId: trace?.traceId,
      attempt: trace?.attempt,
    });
    // Real backend ride request: the rideId shown is always the one the
    // backend returned — the app never generates a rideId locally.
    rideLog("REAL_RIDE_REQUEST", { userId: payload.riderId, rideId: result.data.rideId, httpStatus: result.status, traceId: trace?.traceId, attempt: trace?.attempt });
    rideLog("API_REQUEST_RIDE_SUCCESS", { userId: payload.riderId, rideId: result.data.rideId, candidateCount: result.data.candidateCount, traceId: trace?.traceId, attempt: trace?.attempt });
    return result.data;
  } catch (error) {
    rideLog("API_REQUEST_RIDE_FAIL", {
      userId: payload.riderId,
      message: error instanceof Error ? error.message : String(error),
      traceId: trace?.traceId,
      attempt: trace?.attempt,
    });
    throw error;
  }
}

export async function getRide(rideId: string): Promise<Ride> {
  return api.get<Ride>(`/rides/${rideId}`);
}

export async function completeRide(rideId: string): Promise<Ride> {
  return api.post<Ride>(`/rides/${rideId}/complete`, {});
}

export async function cancelRide(rideId: string): Promise<Ride> {
  return api.post<Ride>(`/rides/${rideId}/cancel`, {});
}

export async function getRiderActiveRide(riderId: string): Promise<Ride | null> {
  return api.get<Ride | null>(`/rides/rider/${riderId}/active`);
}

export async function getMyActiveRide(): Promise<Ride | null> {
  return api.get<Ride | null>(`/rides/rider/active`);
}

export async function getRiderRideHistory(riderId: string): Promise<Ride[]> {
  return api.get<Ride[]>(`/rides/rider/${riderId}/history`);
}
