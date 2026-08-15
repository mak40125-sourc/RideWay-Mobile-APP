# Ride Delivery — Investigation Report

Date: 2026-08-13
Scope: root-cause investigation and minimal fixes for two confirmed backend
ride-delivery failures. Backend-only; no API contract, DB schema, Redis key,
Socket.IO event, or ride-state semantics were changed.

Failure evidence (per-dev description):
- **Problem 1**: `candidateCount` intermittently `0` while a driver is online
  and nearby — matching returns no candidate.
- **Problem 2**: `ride:request` offer emitted into a Socket.IO room with no
  connected socket — socket disconnected at 19:48:40, candidate found at
  19:49:04, offer emitted at 19:49:05 into an empty room; no driver received it.

---

## Root cause — Problem 1 (`candidateCount=0`)

Redis availability state is **split across two independent writes**:

- `PUT /drivers/location` → `setDriverLocation` → `GEOADD drivers:online`
  (membership / discoverability). No hash write.
- `PUT /drivers/online` → `setDriverOnline` → writes `driver:<id>` hash
  (`status`, `rideType`, `socketId`, `vehicleNumber`, `onlineSince`). No GEO
  write.

`getNearbyDrivers` (`core/redis/redis.service.js`) enriches each GEO result with
`vehicle_type` = the hash's `rideType`, and `candidate-finder.js` filters on
`d.vehicle_type === vehicleType`. Therefore **a GEO member without a hash (or
with empty `rideType`) is silently excluded** → `candidateCount=0` even though
the driver is online and within radius.

How this happens for a real driver (driver-app, `home.tsx`): toggling online sets
`is_online` optimistically, starts location tracking (`GEOADD`) immediately, and
fires `driverAPI.setOnline(...)` **fire-and-forget with no retry**. If that call
is slow or fails, the driver stays in `drivers:online` with no hash until the
next manual offline/online toggle.

Live proof at investigation time: `drivers:online` contained members
`3632550301921397` and `3632550301922450` that have **no `driver:<id>` hash and
no row in `drivers`** — they return `vehicle_type: null` and are silently
dropped by the filter (same failure class as a real driver with a missing hash).

## Root cause — Problem 2 (offer into empty room)

`socket.js` joins `driver:<userId>` on connect and only logs on disconnect; it
never writes or clears any Redis state. `notification.service.js` then emitted
`io.to('driver:<id>').emit('ride:request', rideInfo)` for every candidate and
logged `ride:request_emitted` **unconditionally** — an empty room makes the emit
a silent no-op, so the log was a false success.

Live proof: both real driver hashes contained `socketId: ""`, and no backend code
reads `socketId` anywhere. The only connectivity signal is Socket.IO room
membership, which was never consulted before emitting.

The 19:48:40 → 19:49:04 → 19:49:05 sequence is exactly this: the driver remained
Redis-online after socket drop (by design), was found as a candidate (`rideType`
present), and the offer was emitted into the vacated room.

---

## Fixes (minimal, backend-only)

Design constraints honored: preserve online-state semantics (Redis online toggle
is the source of truth; socket is not), keep the GEO radius and vehicle_type
filters, never fabricate eligibility, no API/schema/Redis-key/Socket.IO-event
changes, no false delivery claims.

### 1. `src/modules/driver/driver.repository.js` — `ensureDriverHashMetadata`
Repairs the availability-state split at its source. On every
`PUT /drivers/location`, if the `driver:<id>` hash (or its `rideType`) is
missing, restore it from the authoritative `drivers` row
(`vehicle_type`, `vehicle_number`). A GEO member is already discoverable by
location; this only lets the existing filter see authoritative metadata — it
cannot add a driver that was not already in the radius set. Non-UUID members are
never treated as eligible, and DB lookup failures are logged and swallowed so
location updates never 500.

### 2. `src/modules/driver/driver.service.js` — `updateLocation`
Invokes `ensureDriverHashMetadata` after `setDriverLocation`.

### 3. `src/modules/matching/candidate-finder.js` — per-attempt diagnostics
`findCandidates(pickup, vehicleType, rideId)` now logs `candidate_discovery` per
attempt: correlationId, rideId, pickup lat/lng, radius, requested vehicle type,
raw GEO count, per-driver snapshot (`driverId`, `distance_meters`,
`vehicle_type`, `status`, `hashExists`, `onlineSince`), excluded entries with
reason (`hash_metadata_missing` | `vehicle_type_mismatch`), and final
`candidateCount`.

### 4. `src/modules/matching/matching.repository.js` — `getDriver`
Passthrough to `redisService.getDriver` for the diagnostics snapshots.

### 5. `src/modules/matching/matching.service.js`
Passes `rideId` into `findCandidates`.

### 6. `src/modules/notification/notification.service.js` — deliverability
Before emitting to `driver:<id>`, check `io.of('/').adapter.rooms.get(room)`. If
empty → log `ride:offer_undeliverable` (`reason: no_connected_socket`) and skip;
otherwise emit and log `ride:request_emitted` exactly as before. No Redis
online-state change, no TTL/acceptance semantic change, no false success log.

---

## Verification

- `node --check` passes on all six changed files.
- Module-level tests against live Redis/Supabase:
  - `getNearbyDrivers` returns real drivers with correct `vehicle_type`.
  - `ensureDriverHashMetadata` no-ops when hash metadata exists.
  - Missing-hash restore pulls `rideType` from the `drivers` table and rewrites
    the hash (`driver_hash_metadata_restored`); reversible test confirmed the
    real driver's hash was restored byte-for-byte to its prior state (no
    mutation leaked).
  - Non-UUID orphan member → `null` (no crash, no fake eligibility).
  - `findCandidates` emits the full `candidate_discovery` snapshot; mini pickup
    yields `candidateCount=1` (mini driver) with the bike driver logged as
    excluded (`vehicle_type_mismatch`).
- Backend boot against live Redis: both clients ready, `subscribe_success
  ride:notifications`, `GET /health` → `200 RideWay Backend is Online`.
- Live Problem-2 check against the running server: a published test offer for a
  no-socket room produced `ride:offer_undeliverable` (`no_connected_socket`) and
  **no** `ride:request_emitted`.

## Residual / operational notes (not changed)

- `socketId` in the `driver:<id>` hash is a dead field (written, never read).
- Stale/orphaned `drivers:online` members (e.g. non-UUID entries) can be purged
  operationally; they are now surfaced by `candidate_discovery` when inside the
  search radius.
- No project unit-test suite exists (`backend/package.json` has `start`/`dev`
  only); verification is by syntax check, live-API module tests, boot, and the
  per-attempt diagnostics above.