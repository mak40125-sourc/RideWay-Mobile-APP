# Ride State Synchronization — Investigation

Read-only analysis of why the rider and driver apps display contradictory
ride states ("Navigate to pickup / Arrived / Pickup = Loading..." vs
"Rider has boarded / Start Ride / Trip to = Loading..."), and why the ride
option icons do not render. No code was changed.

---

## 1. Canonical source of truth

**`public.rides.status` in PostgreSQL** is the only persisted ride state.
Enum (`backend/supabase_schema.sql:9`):

```
IDLE, REQUESTED, SEARCHING_DRIVER, DRIVER_ASSIGNED,
DRIVER_ARRIVING, RIDE_STARTED, RIDE_COMPLETED, CANCELLED
```

Important nuance: the matching pipeline never writes `REQUESTED` /
`SEARCHING_DRIVER` to the database. `matching.service.createRideRequest`
(`backend/src/modules/matching/matching.service.js:23`) writes only a Redis
buffer (`ride:request:<id>`, status `REQUESTED`, with TTL) and dispatches
offers. **A `rides` row is created only at driver acceptance**, by the
`accept_ride` RPC (`supabase/migrations/004_accept_ride_rpc.sql:38`), with
status `DRIVER_ASSIGNED`.

Consequence: while a ride is searching, `getRiderActiveRide`
(`ride.repository.js:55`) returns `null` — there is no row yet.

## 2. Which actor writes each state

| State | Writer | Trigger |
|-------|--------|---------|
| REQUESTED (Redis only) | `redis.service.createRideRequest` | `POST /rides/request` |
| DRIVER_ASSIGNED | `accept_ride` RPC | `POST /rides/:id/accept` |
| DRIVER_ARRIVING | `ride.repository.updateStatus` | `PUT /rides/:id/status` (whitelist: `DRIVER_ARRIVING`, `RIDE_STARTED`, `RIDE_COMPLETED`) |
| RIDE_STARTED | `ride.repository.updateStatus` | `PUT /rides/:id/status` |
| RIDE_COMPLETED | `ride.repository.completeRide` | `POST /rides/:id/complete` |
| CANCELLED | `ride.repository.cancelRide` | `POST /rides/:id/cancel` |

Redis scratch state: `ride:request:<id>`, `ride:offers:<id>`, `ride:lock:<id>`,
`drivers:online`, `driver:<id>`. The request buffer and queue are deleted after
accept (`acceptance-manager.js:71-73`). Redis is therefore **not** a second
source of truth once a ride is accepted — it holds nothing after acceptance.

## 3. Realtime / event paths

- **Backend → driver (Socket.IO):** only `ride:request`, published by
  `notification.service.js` (Redis pub/sub `ride:notifications` → emit to room
  `driver:<userId>`). There are **no** `ride:accepted`, `ride:status_changed`,
  or `ride:cancelled` emits anywhere, and no rider room exists
  (`socket.js` joins every socket to `driver:<userId>`).
- **Driver app:** after accept it also subscribes to **Supabase Realtime**
  (`rideAPI.subscribeToRideUpdates`, `driver-app/services/rideAPI.ts:46`) on
  `rides` UPDATE — this is the only push channel for status changes.
- **Rider app:** no socket, no realtime. It polls `getRiderActiveRide` every 5s
  (`components/ride/ride-tracking-screen.tsx:59`).

## 4. There are THREE independent state machines

1. **Backend canonical:** `DRIVER_ASSIGNED → DRIVER_ARRIVING → RIDE_STARTED → RIDE_COMPLETED` (+ `CANCELLED`).
2. **Driver app local `DriverStatus`** (`driver-app/hooks/useDriverStatus.ts:6`),
   persisted to AsyncStorage: `OFFLINE → ONLINE_IDLE → REQUEST_RECEIVED → ACCEPTED → NAVIGATING_TO_PICKUP → ARRIVED_AT_PICKUP → RIDE_STARTED → NAVIGATING_TO_DROP → RIDE_COMPLETED`.
   Driven entirely by the driver's button presses and **never re-synced from the
   backend on launch**.
3. **Rider app local status** (`context/ride-store.ts`): set to `SEARCHING_DRIVER`
   at request time, then overwritten by the poll *only when* `getRiderActiveRide`
   returns a row.

## 5. Why the screens show contradictory states

First, both observed screens belong to the **driver app** — the strings
"Rider has boarded" / "Start Ride" exist only in
`driver-app/app/(driver)/ride-progress.tsx` and "Navigate to pickup" / "Arrived"
only in `driver-app/app/(driver)/pickup-navigation.tsx` (verified by grep; the
rider app's tracking screen has no such text). The mismatch is therefore two
driver-app views at different stages of the **local** machine, not a literal
rider-vs-driver disagreement.

Root cause — no backend → local reconciliation:

- The driver's **screen** is chosen by the persisted local `DriverStatus`,
  not by `rides.status`.
- `pickup-navigation` renders when local status is `NAVIGATING_TO_PICKUP`
  (immediately after accept, `ride-request.tsx:39-41`). Pressing **Arrived**
  (`pickup-navigation.tsx:35-46`) calls `updateRideStatus(..., 'DRIVER_ARRIVING')`,
  then `setStatus('ARRIVED_AT_PICKUP')` and pushes `ride-progress`.
- If the app is relaunched, or a second driver device signs in, the persisted
  `DriverStatus` is restored from AsyncStorage (e.g. `NAVIGATING_TO_PICKUP`
  from before Arrived was pressed) while the backend ride is already
  `DRIVER_ARRIVING`. Nothing ever re-derives the local status from the backend,
  so the two diverge permanently.

**"Pickup = Loading..."** (`pickup-navigation.tsx:19-21`):
`getAddress` returns `loc.address || 'Loading...'`. The socket payload sends
`address: pickup.address || ''` (`offer-dispatcher.js:22`), and the DB stores
`pickup_address` (possibly empty), so `address` is `''` → `'Loading...'`.
The request modal handles this with a lat/lng fallback
(`ride-request.tsx:80`), but `pickup-navigation` has no fallback — a UI bug.

**"Trip to = Loading..."** (`ride-progress.tsx:27`):
`dropAddress = current_ride?.drop_location?.address || current_ride?.pickup_address || 'Loading...'`.
`transformRide` (`driver-app/services/rideAPI.ts:5-24`) maps `drop_location` to
`{ latitude, longitude }` **only** — it never sets `.address`, and never maps
`pickup_address`. So this field is **always** `'Loading...'` regardless of data —
a UI bug.

## 6. Ride option icons

`RIDE_ICON_ASSETS` (`components/ride/ride-config.ts:14-20`) requires
`../../assets/images/Dash.jpg.png`, `Sedan.png`, `MEGA CAB ICON.png`,
`BIKE ICON.png`, `AUTO LOGO.png`. All five files exist at the repo root
`assets/images/` (verified on disk, sizes 24.5–567 KB), and the require path
resolves correctly from `components/ride/`. Both consumers
(`BottomSheetContent.tsx:457`, `ride-options-sheet.tsx:53`) render the image
when the source is truthy.

The static code is therefore correct — the missing icons point to a **stale
Metro/Expo bundle** (the PNGs were added to disk after the last bundle). Fix:
restart the dev server with a cache clear (`npx expo start -c`). A hard `require`
failure would crash the bundle, so a silent absence indicates a stale bundle,
not a code path.

## 7. Findings summary

| # | Finding | Severity |
|---|---------|----------|
| 1 | No `rides` row exists during SEARCHING_DRIVER; rider poll returns null until accept | Info (by design, but see 4) |
| 2 | Driver app screen is driven by persisted local `DriverStatus`; never reconciled with `rides.status` on launch | High — root cause of contradictory screens |
| 3 | `updateRideStatus` whitelist has no `DRIVER_ARRIVED` / `RIDER_BOARDED`; driver local machine uses `ARRIVED_AT_PICKUP` — names don't map | Info |
| 4 | Backend emits no status-change events; driver relies on Supabase Realtime, rider on 5s polling | Info |
| 5 | `pickup-navigation` address lacks the lat/lng fallback the request modal has | Low — UI |
| 6 | `transformRide` drops `.address` / `pickup_address` → "Trip to" always "Loading..." | Low — UI |
| 7 | Icons: code + assets are correct; likely stale Metro bundle | Low — ops |
