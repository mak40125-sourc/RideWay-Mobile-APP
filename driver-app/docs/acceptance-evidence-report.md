# Driver App — Ride Acceptance Evidence Report

Date of capture: 2026-08-08 (UTC)
Source backend PID: 1068 (module-based layout under `backend/src/modules/`)

This report is evidence-only. **No code was modified** during the investigation.
All runtime facts below were captured read-only from the live Supabase instance
and Redis; app-side steps are mapped from the current source (marked `[CODE]`).

---

## Headline verdict

**B — FAILED.** The backend acceptance request failed. It never returned success,
and no ride row was ever persisted.

- Direct evidence of the failure: the live `accept_ride` RPC raises
  ```
  code: "42703"
  message: column "fare" of relation "rides" does not exist
  ```
- Corroborating state: the `rides` table has **0 rows** — no acceptance has ever
  persisted.
- Options A (succeeded), C (timed out), D (succeeded but app failed to update)
  are all ruled out: D requires a persisted ride; A requires success; C would be
  a client/network timeout, but the server answered (via the failing RPC).

---

## 2. Evidence captured (live system)

### 2.1 Supabase `rides` table
- Query `SELECT * FROM rides LIMIT 1` → **empty array** (table empty).
- Query `SELECT * FROM rides ORDER BY created_at DESC LIMIT 15` → **empty array**.
- `SELECT id FROM rides` after the RPC probe → **count 0**.

### 2.2 Direct `accept_ride` RPC invocation (service-role)
Probe passed the same shape of arguments the repository uses:

```
rpc accept_ride(p_ride_id, p_rider_id, p_driver_id, p_pickup_lat, p_pickup_lng,
                p_drop_lat, p_drop_lng, p_fare, p_distance, p_duration,
                p_pickup_address, p_drop_address)
→ error: { code: "42703", message: 'column "fare" of relation "rides" does not exist' }
→ data: null
```

This proves the function cannot execute against the live table: the live
`rides` table does not have a `fare` column, but the function's INSERT
references `fare`.

### 2.3 Redis matching state (at capture time)
- `ride:request:*` → `[]`
- `ride:offers:*` → `[]`
- `ride:lock:*` → `[]`
- `driver:21297138-…-e11e8a648d48` →
  `{ status: "ONLINE", rideType: "mini", vehicleNumber: "CH 01 BE 0506" }`

Interpretation (state, not cause): the ride request buffer is empty because the
failure path never deletes the request‑buffer/queues on a failed accept — they
expire via their 120s TTL. The driver is still marked ONLINE in Redis; no
driver-state transition occurred.

### 2.4 Driver-app runtime logs
- `metro.log` contains no `[RIDEWAY-DIAG]` entries for this attempt (the device
  was not attached to a Metro session writing to this log). App-side timestamps
  below are therefore **inferred from code flow**, not observed.

---

## 3. Trace of one acceptance attempt (endpoints per the current code)

| # | Step | Evidence |
|---|---|---|
| 1 | `ride:request` received | [CODE] emitted by offer-dispatcher to `io.to('driver:<userId>')`; confirmed delivered in prior end-to-end test. |
| 2 | Accept button pressed | [CODE] `handleAccept()` in `app/(modals)/ride-request.tsx` fires only when `current_request` present. |
| 3 | accept request started | [CODE] `await rideAPI.acceptRide(current_request.rideId)`; guard sets `accepting=true`. |
| 4 | exact endpoint called | [CODE] `api.post('/rides/{rideId}/accept')` → base `EXPO_PUBLIC_API_BASE_URL=http://10.11.203.124:3000/api/v1` ⇒ `POST http://10.11.203.124:3000/api/v1/rides/{rideId}/accept` (Bearer). |
| 5 | rideId used | [CODE] `current_request.rideId` (Socket payload). Backend route `POST /:rideId/accept` (`modules/ride/ride.routes.js`). |
| 6 | HTTP status received | **400** ([CODE] controller `acceptRide` → `catch → res.status(400).json({ error })`). |
| 7 | Response body | **`{"error":"Failed to persist ride acceptance."}`** ([CODE] repository → `rpc` error → returns `null` → `acceptance-manager` throws that exact message). Underlying cause verified directly: RPC `42703 column "fare" … does not exist`. |
| 8 | Driver store/state transition | [CODE] **NO transition.** `setStatus('NAVIGATING_TO_PICKUP')` and `setCurrentRide(ride)` are only run after the awaited `acceptRide` resolves; the thrown error aborts them. `accepting` is reset to `false`. |
| 9 | Navigation event | [CODE] **None** — `router.back()` then `router.push('/(driver)/pickup-navigation')` never execute on failure. |
| 10 | Error / exception | [CODE] Driver side: `Error('Failed to persist ride acceptance.')` (from `services/api.ts` non-ok path). Server side: `accept_ride` → `42703` → repository swallows to `null` → acceptance-manager throws. |
| 11 | Request card removed | [CODE] **No** — only `clearRide()` (reject/time-out) clears `current_request`; a failed accept leaves the card up. The modal also auto-rejects at `timeLeft < =0`. |
| 12 | Driver enters assigned screen | [CODE] **No** — the app never reaches `/(driver)/pickup-navigation`. |

---

## 4. Why the rider-visible "Driver … arriving" note is not corroborated

The `rides` table holds **0 rows**, so there is no persisted ride row that any
backend consumer (including the rider app’s Supabase realtime listener) could
have read to show an "arriving" driver. Any rider-visible state cannot be
accounted for by the backend `rides` table as of capture time. This is recorded
as an unexplained discrepancy, not explained causally.

---

## 5. Conclusion

- The backend acceptance request **B. failed**.
- The failure is a live-schema/function mismatch: `rides` is missing the `fare`
  column that the installed `accept_ride` function inserts, so acceptance never
  persists (HTTP 400, rides remains empty).
- Because the app navigates to `pickup-navigation` only on success, the Driver
  App cannot reflect the ride and never enters the assigned/active ride screen.