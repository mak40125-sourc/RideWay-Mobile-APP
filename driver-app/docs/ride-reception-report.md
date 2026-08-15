# Velos Driver App — Ride Reception Investigation Report

## 1. Instrumentation added

A central diagnostic logger now records every lifecycle event with a consistent
metadata envelope: **driverId, socketId, timestamp, current screen (route), and
network state**. Every log line is also emitted to Metro under the tag
`[RIDEWAY-DIAG]` and persisted to `AsyncStorage` (`rideway.diag.v1`, ring of 500).

| Instrumented file | Events emitted |
|---|---|
| `app/_layout.tsx` | `APP_LAUNCH`, `NAVIGATE` (per route change via `usePathname`) |
| `contexts/AuthContext.tsx` | `AUTH_RESTORE_ATTEMPT`, `AUTH_STATE_CHANGE`, `AUTH_SESSION`, `AUTH_SIGNED_OUT` |
| `hooks/useWebSocket.ts` | `SOCKET_CONNECTING`, `SOCKET_CONNECTED`, `SOCKET_EVENT_RIDE_REQUEST`, `SOCKET_DISCONNECT`, `SOCKET_ERROR`, `SOCKET_RECONNECT_ATTEMPT`, `SOCKET_RECONNECTED`, `SOCKET_NO_TOKEN` |
| `hooks/useRideListener.ts` | `RIDE_REQUEST_RENDER`, `RIDE_REQUEST_DROPPED`, `RIDE_UPDATE_EVENT`, `RIDE_SUB_UNSUB` |
| `hooks/useDriverLocation.ts` | `LOCATION_TRACK_START`, `LOCATION_UPDATE`, `LOCATION_API_ERROR`, `LOCATION_TRACK_ERROR`, `LOCATION_TRACK_STOP`, `LOCATION_PERMISSION_DENIED` |
| `app/(driver)/home.tsx` | `PROFILE_FETCH_START_OK_ERROR`, `ONLINE_TOGGLE`, `ONLINE_ACK`, `ONLINE_API_ERROR`, `OFFLINE_ACK`, `OFFLINE_API_ERROR` |
| `app/(modals)/ride-request.tsx` | `RIDE_REQUEST_RENDERED`, `RIDE_ACCEPT_PRESS`, `RIDE_ACCEPT_OK`, `RIDE_ACCEPT_ERROR`, `RIDE_REJECT` |
| `utils/diagLog.ts` | core logger (also exposes `snapshot()`, `dump()`, `clear()`) |

Helper methods on the logger: `snapshot()`, `dump()` (formatted text), `clear()`.

## 2. How to determine if the driver app received the ride request

Grep the Metro log / persisted snapshot for the ride’s `rideId` and walk this path:

```
RIDE_REQUEST_RENDER                                  ← modal opened (app received + gate passed)
RIDE_REQUEST_DROPPED                                 ← event ARRIVED but gated (see detail)
RIDE_ACCEPT_PRESS → RIDE_ACCEPT_OK | RIDE_ACCEPT_ERROR ← user action + backend accept result
```

### Interpretation matrix

| If the log contains … | Meaning |
|---|---|
| `SOCKET_CONNECTED` with `sid=<id>` at/before ride time | socket was up → delivery possible |
| `SOCKET_EVENT_RIDE_REQUEST` with your `rideId` then `RIDE_REQUEST_RENDERED` | **App received and displayed the request.** ✅ |
| `SOCKET_EVENT_RIDE_REQUEST` but then `RIDE_REQUEST_DROPPED` | App received it, but the gate `is_online && status==='ONLINE_IDLE' && driver` failed. Inspect `detail` for `online/status/driver`. |
| `SOCKET_EVENT_RIDE_REQUEST` but **no** `RIDE_REQUEST_*` | `useRideListener` gate dropped it silently (see code) or navigation raced. |
| **No** `SOCKET_EVENT_RIDE_REQUEST` for that ride | The event never reached the app’s socket handler. Root cause is upstream: socket never connected, wrong room, or backend never emitted (needs rider-side verification). |
| `SOCKET_ERROR` / `SOCKET_DISCONNECT` before the ride | Socket was down when the request fired → not delivered at that moment, connection drop. |
| `ONLINE_TOGGLE going-online` but **no** `ONLINE_ACK` or `ONLINE_API_ERROR` | Driver was never registered online server-side → never a candidate. |
| `LOCATION_UPDATE` absent | Driver not in the geosest via Redis → `getNearbyDrivers` returns nothing → backend never emits. |

## 4. How to collect the data

1. Reload the driver app in Expo Go (a fresh start so `.env`/code changes take effect).
2. Go online (toggle) and watch console for `ONLINE_ACK` and a few `LOCATION_UPDATE`.
3. Fire a **Dash** ride from the rider app near the driver.
4. From the device, dump the persisted log (via `diagLogger.dump()` console command in the terminal/Metro) OR copy the `[RIDEWAY-DIAG]` lines from Metro.
5. Match the rider’s `rideId` across the timeline.

## 5. Pre-verified backend status (this session)

- Backend matching pipeline confirmed working end-to-end: a test socket **did receive**
  `ride:request` when the driver is in the geosest with a matching `rideType`.
- Driver was present in Redis `drivers:online` as `mini` and returned as a candidate.
- **Rider app was pointing at a dead IP** (`EXPO_PUBLIC_API_BASE_URL`), now fixed to
  `10.11.203.124:3000`.
- **Vehicle-type mismatch**: rider options (`Dash/Comfort/Mega/Bike`) did not map to the
  backend `vehicle_type` enum (`bike/mini/sedan/shuttle`). Now mapped so **Dash** → `mini`.

## 6. Conclusion (to be confirmed by a run)

The backend already delivers ride requests successfully to a connected, online,
in-range driver. The two previously blocking rider-side defects (wrong API IP and
vehicle-type mismatch) have been corrected. Run the capture in §4; if a **Dash**
request yields `SOCKET_EVENT_RIDE_REQUEST → RIDE_REQUEST_RENDERED`, we have full
round-trip confirmation that the driver received the request.