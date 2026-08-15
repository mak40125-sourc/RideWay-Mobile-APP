# Pickup Coordinate Trace — Investigation Report & Driver-side Fix Draft

Status: INVESTIGATION COMPLETE; EWKB fix APPLIED to the Driver App and verified
(see §7). Navigation issues remain open and untouched (§5).
Scope: Why the Driver App renders `{ latitude: 0, longitude: 0 }` for the
persisted ride's pickup/drop location, and the minimal applied Driver-side fix.

---

## 7. Implementation status & verification results

Applied (Driver App only — backend, DB, Redis, config untouched):

- `driver-app/services/rideAPI.ts` — added `decodeEwkbPoint()` and branched
  `coords()` on string input; invalid geometry now returns `null`.
- `driver-app/types/ride.ts` — `pickup_location` / `drop_location` are now
  `Location | null`.

Verified:

1. **Typecheck** (`npx tsc --noEmit`): no new errors. Baseline-vs-fixed diff
   shows only the pre-existing `api.post` 2-arg error moving line 28 → 49
   (24 added lines). All other errors (`drop_address`, `pickup_address`,
   `RideRequestModal`, `api.post`) are pre-existing and unchanged.
2. **Lint** (`npm run lint`): no new warnings/errors on the changed files.
3. **Decoder + `transformRide` unit tests** against the actual applied source:
   - `POINT(77.5946 12.9716)` EWKB → `{ latitude: 12.9716, longitude: 77.5946 }`
   - `POINT(77.6245 12.9352)` EWKB → `{ latitude: 12.9352, longitude: 77.6245 }`
   - invalid inputs (`undefined`, `null`, `''`, non-hex, short, wrong SRID,
     non-point type, truncated) → `null`, never `{0,0}`
   - full row transform: pickup/drop decode correctly; malformed geometry →
     `null`; GeoJSON/object inputs still work (backward compatible).
4. **Backend response shape** was confirmed read-only against the applied
   schema/contract (`004_accept_ride_rpc.sql:31-32`); the raw Supabase row
   (EWKB hex) is passed through `ride.controller.js` / repositories unchanged.
5. **Device-level E2E steps** (accept flow, reconciliation restart, realtime
   `postgres_changes`, drop leg, malformed-geometry UI, socket regression) were
   NOT executed here — they require a live backend + driver/rider apps on a
   device/emulator. See §6 Verification plan (manual).

---

## 1. Evidence Chain (verified)

| Step | Source | Verified |
|------|--------|----------|
| Rider sends pickup coordinates | Rider app payload | Correct lat/lng numbers |
| Backend normalizes them | `src/modules/matching/matching.service.js:12-21` `normalizeCoords()` | Correct (`lat`/`lng`) |
| Redis representation | `src/core/redis/redis.service.js:104-109`, `createRideRequest` | Correct by code; live keys expired/cleaned |
| DB write | `supabase/migrations/004_accept_ride_rpc.sql:31-32` `ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography` | `X = longitude`, `Y = latitude`, SRID 4326 |
| DB schema | `backend/supabase_schema.sql:79-80` `pickup_location / drop_location GEOGRAPHY(POINT, 4326)` | `POINT(longitude, latitude)`, SRID 4326 |
| PostgREST response | `GET /rides/:id`, `PUT /rides/:id/status`, `POST /rides/:id/accept`, `postgres_changes` — raw row passed through untouched (`ride.controller.js`, `ride.repository.js`, `matching.repository.js`) | `pickup_location` and `drop_location` serialized as **EWKB hex string** |
| Driver app decode | `driver-app/services/rideAPI.ts:6-9` `transformRide()` → `coords()` | Treats string as object → `{ latitude: 0, longitude: 0 }` |

**EWKB format confirmed** (generated sample for `POINT(77.5946 12.9716)` SRID 4326):

```
0101000020e6100000e78c28ed0d6653405396218e75f12940   (50 hex chars = 25 bytes)
││       │       │                        │
││       │       │                        └─ Y = latitude  (8-byte LE double)
││       │       └────────────────────────── X = longitude (8-byte LE double)
││       └────────────────────────────────── SRID = 4326   (4-byte LE, offset 5)
│└────────────────────────────────────────── type = 0x20000001 = Point + SRID flag (offset 1)
└──────────────────────────────────────────── byte order = 0x01 (little-endian)
```

- X = longitude, Y = latitude (WKT `POINT(lon lat)` order).
- SRID = 4326.
- Same layout applies to **both** `pickup_location` and `drop_location` (identical column type).
- The Driver App has **no** WKB/EWKB/GeoJSON decoding dependency
  (`node_modules` scan: no `wkx`, `@turf`, `@terraformer`, `wellknown`, `postgis`, etc.;
  only `@supabase/*`). PostgREST-js does not auto-decode geometry.

**Flow that corrupts `current_ride`:**
`acceptRide` → `rideAPI.acceptRide()` → `transformRide(raw)` (EWKB string) →
`setCurrentRide(ride)` (`app/(modals)/ride-request.tsx:38`) → persisted by
`rideStore` (`store/rideStore.ts:40`, `partialize` keeps `current_ride`).
`getRideDetails` (reconciliation, `hooks/useRideReconciliation.ts:112,140`) and
`subscribeToRideUpdates` (`hooks/useRideListener.ts:41-43`) follow the same path.

`pickup-navigation.tsx` looks correct only while `current_request.pickup` is
present (`app/(driver)/pickup-navigation.tsx:31` — the offer payload
`{ lat, lng, address }` from `offer-dispatcher.js:22` is correct). Once
`current_request` is unavailable and `current_ride.pickup_location` (the
persisted, corrupted `{0,0}`) is used, the marker/map jump to (0,0).
`drop-navigation.tsx` always uses the persisted `current_ride.drop_location`
(`app/(driver)/drop-navigation.tsx:24`), so it is affected from the start.

---

## 2. Root cause

`transformRide()` in `driver-app/services/rideAPI.ts:6-9` decodes
`pickup_location` / `drop_location` with `coords()`, which reads object fields
(`coordinates`, `latitude`, `longitude`) and falls back to `0`; when PostgREST
returns the PostGIS `GEOGRAPHY(POINT, 4326)` column as an **EWKB hex string**
(`0101000020E6100000…`), none of those fields exist, so every coordinate is
silently normalized to `{ latitude: 0, longitude: 0 }` and that corrupted value
is persisted as `current_ride` — the map then renders (0,0) once the ephemeral
`socket current_request.pickup` (correct `{lat, lng}` offer coordinates) is no
longer available.

---

## 3. Proposed fix (DRAFT — NOT APPLIED)

**File:** `driver-app/services/rideAPI.ts`
**Function:** `transformRide()` and its inline `coords()` helper, plus one small
module-level decoder `decodeEwkbPoint()`.
**Also:** `driver-app/types/ride.ts` — `pickup_location` / `drop_location`
become `Location | null` so an undecodable geometry is an explicit
invalid/missing result that callers can handle (no silent `{0,0}`).

No new dependency. Uses `DataView`/`Uint8Array` (available in React Native's
JS runtime; no `Buffer` required). No GIS abstraction, no refactor of the rest
of `transformRide()`.

### BEFORE

```
transformRide() receives EWKB string
  → loc?.coordinates?.[1]  = undefined
  → loc?.latitude          = undefined
  → ?? 0                   = 0
  → { latitude: 0, longitude: 0 }
```

### AFTER

```
EWKB string
  → decodeEwkbPoint()
  → X = longitude  (bytes 9..16, LE double)
  → Y = latitude   (bytes 17..24, LE double)
  → { latitude: Y, longitude: X }
```

Malformed/undecodable input returns `null` (explicit missing location).
No `{0,0}`, no geographic fallback.

### Code diff

```diff
--- a/driver-app/services/rideAPI.ts
+++ b/driver-app/services/rideAPI.ts
@@ -1,11 +1,34 @@
 import { api } from './api';
 import { supabase } from '../lib/supabase';
-import type { Ride, RideStatus } from '../types/ride';
+import type { Location, Ride, RideStatus } from '../types/ride';
+
+// PostgREST serializes PostGIS geography/geometry columns as EWKB hex.
+// 2D Point with SRID (25 bytes, little-endian):
+//   byteOrder(1) | type(4) | srid(4) | x(8) | y(8)
+// WKT order is POINT(longitude latitude), so x = longitude, y = latitude.
+function decodeEwkbPoint(hex: string): Location | null {
+  if (typeof hex !== 'string' || !/^[0-9a-fA-F]+$/.test(hex)) return null;
+  const bytes = new Uint8Array(hex.length / 2);
+  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
+  if (bytes.length !== 25 || bytes[0] !== 1) return null; // little-endian only
+  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.length);
+  if (view.getUint32(1, true) !== 0x20000001) return null; // Point + SRID-present flag
+  if (view.getUint32(5, true) !== 4326) return null;        // this app is always SRID 4326
+  return { latitude: view.getFloat64(17, true), longitude: view.getFloat64(9, true) };
+}
 
 function transformRide(raw: any): Ride {
-  const coords = (loc: any) => ({
-    latitude: loc?.coordinates?.[1] ?? loc?.latitude ?? 0,
-    longitude: loc?.coordinates?.[0] ?? loc?.longitude ?? 0,
-  });
+  const coords = (loc: any): Location | null => {
+    if (typeof loc === 'string') return decodeEwkbPoint(loc);
+    if (loc?.coordinates?.[1] != null && loc?.coordinates?.[0] != null) {
+      return { latitude: loc.coordinates[1], longitude: loc.coordinates[0] };
+    }
+    if (loc?.latitude != null && loc?.longitude != null) {
+      return { latitude: loc.latitude, longitude: loc.longitude };
+    }
+    return null; // explicit invalid/missing — caller must handle, never {0,0}
+  };
```

```diff
--- a/driver-app/types/ride.ts
+++ b/driver-app/types/ride.ts
@@ -19,8 +19,8 @@ export interface Ride {
   rider_id: string;
   driver_id: string | null;
   status: RideStatus;
-  pickup_location: Location;
-  drop_location: Location;
+  pickup_location: Location | null;
+  drop_location: Location | null;
   fare: number;
   distance: number;
   duration: number;
```

Decoder output verified against a real PostGIS-shaped EWKB string
(`POINT(77.5946 12.9716)` → `0101000020e6100000e78c28ed0d6653405396218e75f12940`):
returns `{ latitude: 12.9716, longitude: 77.5946 }`. Rejects `undefined`,
`null`, non-hex, short buffers, wrong SRID → `null`.

Callers already null-tolerant:
- `app/(driver)/pickup-navigation.tsx:31` `ride?.pickup_location`
- `app/(driver)/drop-navigation.tsx:24` `current_ride?.drop_location`

(Their `getCoords()` fallbacks are a *separate* navigation issue — see §5.
They are intentionally NOT part of this patch.)

---

## 4. Why the fix is safe

- It preserves the PostGIS/WKT axis order: the decoder reads the stored double
  at byte offset 9 as `longitude` and the double at byte offset 17 as
  `latitude`, matching `ST_SetSRID(ST_MakePoint(lng, lat), 4326)` exactly as
  written in `004_accept_ride_rpc.sql:31-32`.
- Object/GeoJSON handling (`{coordinates:[lng,lat]}`, `{latitude,longitude}`)
  is retained unchanged for backward compatibility with the socket offer and
  any already-normalized payloads.
- A strict 25-byte EWKB Point with the SRID-present flag (`0x20000001`) and
  SRID 4326 is the only accepted input; any other shape returns `null`.
- No `{0,0}` fallback anywhere in the patch, and no geographic default
  coordinates (e.g. `12.9716,77.5946` / `12.9352,77.6245`) are introduced for
  ride locations. Undecodable geometry surfaces as an explicit missing location.
- Change is confined to one decoder function + the `coords` branch; no API,
  Redis key, DB schema, or Socket.IO event changes.

---

## 5. Separate navigation issues (documented, NOT fixed here)

1. **Missing actual route/polyline** — neither navigation screen fetches or
   draws a real route; the map shows a marker + initial region only.
2. **Incorrect distance semantics** — `current_request.distance` is the **trip**
   distance (pickup → dropoff), but `pickup-navigation.tsx:72` presents it as
   "`X` km away" (driver → pickup). This is the "12.1 km away" issue. Requires a
   separate navigation/distance fix (compute driver→pickup, or show trip
   distance with correct labeling).
3. **Camera behavior** — `initialRegion` snaps to the pickup point; no
   fit-to-route, no follow-current-location camera, no update when the marker
   would be corrected after the decoder patch.
4. **Fallback coordinates** — `pickup-navigation.tsx:16`
   `{ latitude: 12.9716, longitude: 77.5946 }` and `drop-navigation.tsx:15`
   `{ latitude: 12.9352, longitude: 77.6245 }` are hard-coded and unsafe as
   ride locations; they mask decode/absence failures. Must be removed once
   missing-location handling exists.
5. **`drop-navigation` distance/duration** — `current_ride?.distance` /
   `current_ride?.duration` are trip totals, shown after pickup without
   re-calculating remaining leg (same root semantic confusion as #2).

---

## 6. Verification plan (read-only / manual — after patch is eventually applied)

1. **Backend response shape (read-only):** start backend, driver app, place a
   ride. Capture `GET /api/v1/rides/:id` and the `accept`/status responses.
   Confirm `pickup_location` / `drop_location` are EWKB hex strings starting
   `0101000020E6100000` (length 50).
2. **Decoder unit check:** with a known EWKB hex
   (`0101000020e6100000e78c28ed0d6653405396218e75f12940`), confirm output is
   `{ latitude: 12.9716, longitude: 77.5946 }`; confirm garbage/short/null
   inputs return `null`, never `{0,0}`.
3. **Accept flow:** accept a ride; confirm `current_ride.pickup_location` /
   `drop_location` in the persisted store contain real coordinates and the map
   marker lands on the rider's actual pickup point, not (0,0).
4. **Reconciliation:** kill and relaunch the app mid-ride (restart clears
   `current_request`); confirm pickup-navigation still renders correct pickup
   from persisted `current_ride`.
5. **Realtime:** trigger a status update (`DRIVER_ARRIVING` → `RIDE_STARTED`)
   and confirm `postgres_changes` payloads decode to correct coordinates.
6. **Drop leg:** confirm `drop-navigation` marker is at the true dropoff.
7. **Malformed-geometry path:** with a null/missing `pickup_location`, confirm
   screens handle a missing location explicitly (no 0,0 marker, no
   Bengaluru-default marker).
8. **Regression:** confirm socket offer `current_request.pickup` behavior is
   unchanged (still correct lat/lng while present).