# Ride Flow Stabilization — Backend Instrumentation & Runbook

**Mission:** Identify the exact failure point behind (1) rider "returns to
previous screen" after requesting a ride, and (2) driver "never receives the
ride request."
**Scope:** Instrumentation + correlation-id tracing only. No architecture
refactor, no matching redesign, no API/Socket.IO/Redis-key/DB changes, no
business-logic changes.

This document is the backend-side companion to `../ride-request-flight-report.md`
(which covers the rider app). This one covers the **backend** (this directory).

---

## 1. What was added

| File | Purpose |
|------|---------|
| `src/core/logger/logger.js` | Winston structured logger (console + rolling `logs/rideway.log`), `AsyncLocalStorage` correlation context, `stage()` trace helper. |
| `src/core/middleware/correlation.middleware.js` | Generates/propagates correlation id per HTTP request, echoes it as `x-correlation-id`, seeds it into ALS. |
| `src/app.js` | Mounts the correlation middleware + stage-1 `http_request_received` logging. |
| `src/modules/matching/matching.service.js` | Stage logs 2–8 (ride created → offer generated) and the `no eligible candidates` diagnostic. |
| `src/modules/matching/offer-dispatcher.js` | Adds `correlationId` to the internal Redis `ride:notifications` payload; logs rider-name lookup failures. |
| `src/modules/matching/acceptance-manager.js` | Stage logs 11–12, lock acquire/release, and structured failure logs. |
| `src/core/redis/redis.service.js` | Redis connect/ready/disconnect/error, publish success/failure (with subscriber count), subscribe success/failure, lock acquire/contended/release, ride-buffer set/missing/deleted with TTL. |
| `src/core/socket/socket.js` | Socket connect / disconnect(reason) / room join / room leave logs. |
| `src/modules/notification/notification.service.js` | Strips `correlationId` before the Socket.IO emit (payload unchanged) and logs each `ride:request` emit per driver. |
| `src/modules/ride/ride.service.js` | Stage-15 `ride_completed` / `ride_cancelled` logs. |

No API endpoint, Socket.IO event name or payload, Redis key, or business rule
was changed. The `correlationId` field added to the Redis message is stripped in
`notification.service.js` before the public `ride:request` Socket.IO event is
emitted, so app-facing payloads are byte-identical.

---

## 2. Correlation ID (trace id)

- **Source:** incoming `x-correlation-id` header, or generated `rid_<uuid>`.
- **Echo:** the response header `x-correlation-id` returns whichever was used,
  so a ride id can be joined to its HTTP request and vice versa.
- **Flow:** set in `AsyncLocalStorage` by the middleware, so every downstream log
  in the request chain (controller → service → repository → Redis) inherits it
  automatically — no signature changes.
- **Crossing the pub/sub boundary:** the matching service puts `correlationId`
  into the Redis `ride:notifications` message; the notification service reads it
  to tag the socket-side logs, keeping one trace id across both halves.

---

## 3. Lifecycle stages traced

Every ride log line carries `type: "stage"` (or `"failure"`), `correlationId`,
`rideId`, `driverId` (when present), `stage` (ordinal), `stageName`, and
`elapsedMs`.

| # | stageName | Where logged |
|---|-----------|--------------|
| 1 | http_request_received | `app.js` middleware (method, path) |
| 2 | ride_created | `matching.service.js` (riderId, pickup, dropoff, vehicleType) |
| 3 | ride_persisted | `matching.service.js` |
| 4 | matching_started | `matching.service.js` |
| 5 | driver_search_started | `matching.service.js` |
| 6 | nearby_drivers_found | `matching.service.js` (candidateCount, candidateIds) |
| 7 | candidate_ranking_completed | `matching.service.js` (rankedCount) |
| 8 | offer_generated | `matching.service.js` (or warn `no eligible candidates` when 0) |
| 9 | socket event emitted | `notification.service.js` (`ride:request_emitted`, per driver, room) |
| 10 | redis event published | `redis.service.js` (`publish_success` with subscriber count) |
| 11 | driver_accepted / lock_acquired | `acceptance-manager.js` |
| 12 | assignment_completed / cleanup_completed | `acceptance-manager.js` |
| 13 | rider notified | *(no backend path exists — see §6, finding R1)* |
| 14 | driver notified | `notification.service.js` per candidate driver |
| 15 | ride_completed / ride_cancelled | `ride.service.js` |

---

## 4. Failure logs

Any failure logs with `type: "failure"` (warn/error) and includes, when known:
`correlationId`, `rideId`, `driverId`, `rideState`, `driverState`, `error`,
`stack`, `elapsedMs`, plus the failing stage id. Failures currently emitted:

- **Stage 8 — `no eligible candidates`** (warn): candidateCount = 0 → no offer,
  no publish, no socket emit. Prime suspect for "driver never receives."
- **Stage 11 — `lock_acquire` (warn)**: `Ride already accepted by another driver.`
- **Stage 11 — `ride_buffer_read` (error)**: buffer expired/missing →
  `Ride request expired or no longer available.`
- **Stage 12 — `assignment_persist` (error)**: RPC failed →
  `Failed to persist ride acceptance.`
- Redis events (`publish_failure`, `subscribe_failure`, `unavailable`,
  `disconnected`) and socket events (`disconnected`) are also emitted, tagged
  `type: "redis"` / `type: "socket"`.

---

## 5. Runbook — "Why did ride XXXXX fail?" in under one minute

```powershell
# From backend/
Select-String -Path logs\rideway.log -Pattern 'XXXXX' | ForEach-Object { $_.Line }
```

Or, if you have the correlation id instead:

```powershell
Select-String -Path logs\rideway.log -Pattern 'rid_<uuid>' | ForEach-Object { $_.Line }
```

Read the stages top to bottom. The trace ends at one of these:

| Last stage seen | Meaning |
|-----------------|---------|
| Stops after 1 | Request never reached the ride path (auth 401, body validation, 500 before matching). |
| Stops at 3 | Redis write of the ride buffer failed → `publish`/`error`/`unavailable` logs precede it → **Redis**. |
| Stops at 6 with `candidateCount: 0` | No matching-geo / vehicle_type driver in range → **Driver availability** (Redis geo/hash). |
| Stops at 8 (warn) | Eligible candidates = 0 → no offer ever emitted → **Driver availability / matching discovery**. |
| Has 10 `publish_success` but **no** 9 socket log | Published but not delivered → **Redis subscriber / socket** failure. |
| Has 9 socket logs but driver got nothing | Driver socket not in room / not connected → **Socket** (see §6, finding S1). |
| Stops at 11/12 (failure) | Accept race (lock), buffer expiry, or RPC failure → **Redis / Database**. |
| No 13 after 12 | Assignment persisted but **no rider notification path exists** → **Rider state / notification gap** (see R1). |

---

## 6. Findings from code + current logs (evidence, to confirm live)

- **S1 — Every socket joins `driver:<id>`.** `socket.js` joins *all* connected
  users into `driver:<userId>` and logs "Driver connected". A rider's socket is
  also placed in a driver-named room; there is no `rider:<id>` room. Driver
  notification works only if the candidate's socket is alive in that exact room.
  The new connect/disconnect/room logs make a missing candidate immediately
  visible.
- **R1 — No rider notification path.** After assignment, nothing emits to the
  rider (no rider room, no `ride:accepted` fan-out in this codebase). The rider
  app only polls REST, so it advances via its own polling/simulation — matching
  the findings in `../ride-request-flight-report.md`. Stage 13 is intentionally
  absent; a gap this instrumentation exposes rather than hides.
- **R2 — vehicle_type matching is fragile.** `getNearbyDrivers` returns
  `vehicle_type: state.rideType || null`; a driver hash missing `rideType` is
  silently excluded, reducing `candidateCount`. Logged at stage 6 for diagnosis.
- **Redis is the single point of failure for the request path.** The captured
  boot logs (Redis not running locally) already show the exact signature:
  `redis event:"error"` → `event:"disconnected"` → `event:"unavailable"` →
  `subscribe_failure (Connection is closed)`. With a live Redis, `publish_success`
  + subscriber count will confirm the fan-out.

---

## 7. To fully answer the mission after capturing real traffic

1. Record one failing ride from the app (note its `x-correlation-id` from the
   rider request response, or grep the log by ride id).
2. Run the §5 runbook.
3. The trace's terminal stage identifies the failing layer: HTTP / Matching /
   Redis / Socket.IO / Database / Driver availability / Rider state / Driver
   state — without guessing.

Do not remove the tracer until root causes for both reported symptoms are fixed
and re-verified.
