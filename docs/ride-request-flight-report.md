# Ride Request Flight — Investigation Report

**Mission:** Determine why the rider sometimes returns to the previous screen
after requesting a ride.
**Scope:** Audit + instrumentation only. No UI redesign, no navigation refactor.
**Method:** Instrument the booking flow with a structured diagnostic tracer,
then read the trace and the surrounding code to locate the flight that aborts.

**Status:** The follow-ups from the original audit were implemented in a "flight
fixer" pass — see §6. In particular, the demo-driver simulation (3.2) no longer
exists in code, and acceptance discovery now polls on the home screen (§2).
A second read-only regression audit confirmed the then-first divergence: a failing
`POST /rides/request` reset the store to `IDLE` (§7). That §8 fix is now **applied**
(transient failures keep the searching flow alive with an inline retry).

---

## 1. What was instrumented

A dev-only tracer was added at `utils/ride-request-diagnostics.ts`. It is a
no-op in production. Every log line carries:
`ts`, `event`, `rideId`, `user`, `screen`, `network`, `platform`.

Events emitted in the log stream (tagged `[RIDEFLOW]` and `[HTTPFLOW]`):

| Layer | Events |
|-------|--------|
| HTTP (`services/api.ts`) | `HTTP_REQUEST_START`, `HTTP_RESPONSE`, `HTTP_NETWORK_ERROR`, `HTTP_ERROR` (status/body) |
| Ride API (`services/ride.service.ts`) | `API_REQUEST_RIDE_START`, `API_REQUEST_RIDE_SUCCESS`, `API_REQUEST_RIDE_FAIL` |
| Store transitions (`context/ride-store.ts`) | `RIDE_REQUEST_STARTED`, `RIDE_RESPONSE_RECEIVED`, `RIDE_ID_RECEIVED`, `RIDE_NAVIGATING_TO_TRACKING`, `RIDE_NAVIGATION_DEFERRED`, `RIDE_REQUEST_FAILED`, `RIDE_STATUS_CHANGED` (every state change), `RIDE_RESET` |
| Discovery (`hooks/useActiveRideDiscovery.ts`) | `DISCOVERY_ACTIVE_RIDE`, `DISCOVERY_NO_ACTIVE_RIDE`, `DISCOVERY_POLL_FAILED` |
| Home (`screens/rider/home-screen.tsx`) | `RIDE_BUTTON_PRESSED`, `RIDE_BUTTON_PRESSED_GUARDED`, `HOME_NAVIGATE_TO_TRACKING`, `HOME_RIDE_CANCELLED` |
| Tracking (rider) | `TRACKING_STATE_SCREEN` (`screens/rider/tracking-screen.tsx`); `RIDE_TRACKING_MOUNTED`, `TRACKING_CANCEL_CONFIRMED`, `TRACKING_NAVIGATE_TO_HOME`, `TRACKING_CANCEL_FAILED` (`components/ride/ride-tracking-screen.tsx`) |
| Global (`app/_layout.tsx`) | `SCREEN_CHANGED` (every route change), `UNHANDLED_EXCEPTION` |

To reproduce: run the app in Expo dev, press **Book**, and filter the Metro
console for `[RIDEFLOW]` (ride lifecycle) and `[HTTPFLOW]` (request outcomes).

---

## 2. The booking flow as coded (current)

```
Bottom sheet → handleRequestRide
   └─ setTrip(...)
   └─ requestRideAction(user, { navigateToTracking: false })      [RIDE_REQUEST_STARTED]
        ├─ POST /rides/request                                     [HTTP_*]
        ├─ success ── RIDE_ID_RECEIVED + status SEARCHING_DRIVER   [RIDE_NAVIGATION_DEFERRED]
        │              (no navigation happens here — deferred)
        └─ error ───── RIDE_REQUEST_FAILED + status IDLE           (rider stays on Home)

Waiting on Home: useActiveRideDiscovery() polls GET /rides/rider/:riderId/active
every 5s while status is REQUESTING/SEARCHING_DRIVER and pathname === "/"
   ├─ DISCOVERY_NO_ACTIVE_RIDE ─ no store write (keeps searching)
   ├─ DISCOVERY_ACTIVE_RIDE ─ setStatus(backend status) + setRideId (only when truthy)
   │      └─ first DRIVER_ASSIGNED ─── home effect HOME_NAVIGATE_TO_TRACKING → router.push("/tracking")
   └─ DISCOVERY_POLL_FAILED ─ no store write (retried next tick)

On /tracking: the same hook is the only poller (no inline interval any more).
```

Backend truth: `POST /rides/request` only writes a Redis buffer.
Driver acceptance runs the `accept_ride` RPC (`004_accept_ride_rpc.sql`), which
creates the `rides` row with `status='DRIVER_ASSIGNED'`, `driver_id`, `rider_id`,
`updated_at`. `GET /rides/rider/:riderId/active` returns that row, and the
discovery hook stores only that backend-reported status — it never invents
`DRIVER_ASSIGNED` locally.

---

## 3. Root causes originally found (why the rider leaves the searching flow)

### 3.1 API failure resets to IDLE — **CONFIRMED as the regression verdict (see §7)**
`requestRideAction` (`context/ride-store.ts:138-146`) is the only gate into the
searching flow. On **any** error (`api.ts` throws on: network/offline, HTTP
non-2xx, timeout) the `catch` resets:

```
status: "IDLE", requesting: false, error: reason
```

The rider is silently dumped back to the ride-options pane. Because the request
is legitimate, **sometimes work and sometimes don't** (backend down, device not
on same LAN, intermittent 5xx), the behavior is exactly the intermittent
"returns to previous screen after booking" reported.

### 3.2 Demo-driver simulation — **RESOLVED (removed from code)**
The original audit found a hardcoded `simulateDriverAssignment()` (fake driver
`dev-driver-1`/`Rahul`) that advanced `SEARCHING_DRIVER` → `DRIVER_ASSIGNED`.
It no longer exists anywhere in the codebase (`RIDE_SIM_START`,
`simulateDriverAssignment`, `HOME_SCHEDULING_SIM` match only this document).
The advance is now real: the backend `accept_ride` RPC creates the row and the
discovery hook picks it up on the next poll.

### 3.3 Polling only on the tracking screen → acceptance deadlock — **RESOLVED**
The old tracking screen was the only poller (`getRiderActiveRide` every 5s), but
it only mounted *after* navigating to `/tracking`, and navigation only happened
once the store was `DRIVER_ASSIGNED`. Nothing on HOME polled the backend, so an
accepted ride was never discovered — the UI stayed in "Finding your driver"
forever. Fix: discovery moved into the shared `useActiveRideDiscovery()` hook,
enabled on HOME while `/` + `REQUESTING`/`SEARCHING_DRIVER`, and used on
`/tracking` as the single poll source. Because the hook only writes
backend-reported status (never invents one), it cannot churn a state backwards
without backend truth.

### 3.4 Rules-of-Hooks violation in RideTrackingScreen — **RESOLVED**
The old poll/simulation `useEffect` sat after an early `return null`
(`if (!trip || !region) return null`), a rules-of-hooks violation that could
throw "Rendered more hooks than during the previous render." The inline effect
is gone; `useActiveRideDiscovery()` is now called at line 29, before the early
return (line 33) — no conditional hooks, no lint error.

### 3.5 Legacy placeholder instead of the searching surface — **PARTIAL (pre-existing surface)**
`screens/rider/tracking-screen.tsx` still returns the old `RideStateScreen`
("Tracking is not ready") when `!trip || status === "IDLE"`. This is now only
reachable as a fallback: the searching flow lives on the home bottom sheet, and
`/tracking` is entered after `DRIVER_ASSIGNED`.

---

## 4. Recommended way to confirm live

Look for the first line in the stream (per booking attempt):

- `RIDE_REQUEST_FAILED { reason }` immediately after `HTTP_ERROR` /
  `HTTP_NETWORK_ERROR` → confirms 3.1/§7 (API reset to IDLE, rider returns to
  the options pane).
- `DISCOVERY_ACTIVE_RIDE { status }` with `status=DRIVER_ASSIGNED` followed by
  `HOME_NAVIGATE_TO_TRACKING` → confirms §2 (acceptance discovered on Home).
- `SCREEN_CHANGED HOME`/`SCREEN_CHANGED TRACKING` with no matching
  `RIDE_REQUEST_FAILED` but a `UNHANDLED_EXCEPTION` → render tear-down/bounce.

---

## 5. Original follow-ups — status

- Advance the ride on the **real** request outcome instead of a simulation.
  → DONE (simulation removed; discovery reads the backend row).
- Fix the `pickup.lat` vs `latitude` mismatch.
  → DONE (`normalizeCoords` in `backend/src/modules/matching/matching.service.js`
  accepts `{ lat, lng }` or `{ latitude, longitude }`; this fixed a known
  `ERR value is not a valid float` 500 that fed 3.1).
- Subscribe rider to `ride:accepted` / `ride:status_changed` realtime events.
  → NOT DONE — discovery still polls REST at 5s. Socket subscription is
  optional; polling already removes the deadlock.
- On request failure show an inline retry/error instead of resetting to `IDLE`.
  → DONE (§8: retryable failures keep `SEARCHING_DRIVER` + inline retry; only
  terminal 4xx resets, and the error is surfaced).
- Move the tracking `useEffect` above the early `return null`.
  → DONE (superseded by §2's hook-on-home + hook-on-tracking design).

Remove the tracer and all `rideLog(` / `setDiagnosticScreen(` /
`setDiagnosticNetwork(` calls before production (they are no-ops in prod
builds already).

---

## 6. Flight fixer (what was implemented after the audit)

- New `hooks/useActiveRideDiscovery.ts`: 5s poll of
  `getRiderActiveRide`; writes `setStatus(activeRide.status)` + `setRideId`
  only when the backend returns a ride; null/404/network error → log + no write;
  `cancelled` closure guard drops stale responses; auto-disabled on
  `RIDE_COMPLETED`/`CANCELLED` and when there is no user.
- `screens/rider/home-screen.tsx`: enabled at line 82 while
  `pathname === "/"` and status is `REQUESTING`/`SEARCHING_DRIVER`;
  the existing effect (lines 218-225) then pushes `/tracking` on the first
  `DRIVER_ASSIGNED`.
- `components/ride/ride-tracking-screen.tsx`: inline 5s poll removed; the hook
  call (line 29) now sits before the early `return null` (line 33).

---

## 7. Regression re-audit — VERDICT (read-only, unprompted code changes)

Second investigation question: what is the **first** state transition that ejects
a searching rider back to the ride-options / home UI?

**Verdict: A/D (shared, one mechanism).**
File: `context/ride-store.ts`, `requestRideAction` catch block (lines 138-146).

- Description: the `catch` of `POST /rides/request` resets the store to `IDLE`
  on any thrown error (A: backend request failure, D: error handler resets
  state — same code path).
- After the reset, `components/BottomSheet/BottomSheetContent.tsx:120`
  (`showDestOptions = ... status !== SEARCHING_DRIVER && !== DRIVER_ASSIGNED`)
  recomputes true and flips `phase` back to "options" (lines 144-150), so the
  rider sees the ride options again.
- Timeline of one occurrence:
  `POST → REQUESTING → SEARCHING_DRIVER → poll(null) [no write] → catch → IDLE
  → options pane`. No navigation is involved (state → IDLE drives the UI).
- Ruled out: navigation (only automatic route change is the gated
  `/tracking` push; `router.back`/`replace` only on explicit cancel/complete);
  simulation (does not exist in code — §3.2); polling (null/404 never writes;
  cancel flag prevents stale overwrite).
- Secondary hazard: the Find Ride button is not disabled while `requesting`, so
  a double-tap can issue a second POST and overwrite `rideId`.

---

## 8. Regression fix — APPLIED

- `services/api.ts`: non-2xx responses now attach the HTTP `status` to the
  thrown error (`error.status`), so callers can classify failures. Network
  failures keep their existing message with no `status`.
- `context/ride-store.ts` (`requestRideAction` catch): failures are partitioned —
  **retryable** (network/offline, or HTTP 5xx) now keep `SEARCHING_DRIVER` with
  `requesting: false` and `error` set, so the rider is NOT dumped back to the
  options pane; the discovery hook keeps polling for a real backend ride.
  **Terminal** HTTP 4xx still reset to `IDLE` (retrying won't help), with the
  error surfaced in the options pane.
- `components/BottomSheet/BottomSheetContent.tsx`: the booking pane now shows
  the error in a red banner plus a **Try again** button (re-invokes the request);
  the options pane shows the error text under Find Ride on terminal failure; the
  Find Ride button is disabled (greyed) while `requesting`.
- `screens/rider/home-screen.tsx` (`handleRequestRide`): early-returns while
  `requesting` to prevent a double-tap issuing a second `POST /rides/request`
  that could overwrite `rideId`.

Verification: `npx tsc --noEmit` clean for the rider app (the only errors are
pre-existing `driver-app` ones); `npm run lint` — only the 5 pre-existing
warnings remain.