# Driver Distance — Evidence Report

Date: 2026-08-10
Scope: read-only trace of one real online driver through the location/matching
pipeline. No code was modified. Coordinates were captured from the live Redis
instance (`localhost:6379`) and the live Supabase ride-request buffer.

---

## 0. Verdict (headline)

**There is no coordinate discrepancy. Every coordinate boundary is correct, and
no lat/lng swap exists anywhere.**

The "approximately 12.1 km" the flow reports is **not a driver distance**. It is
the **trip distance** (`distance` field, pickup → dropoff, computed by OSRM in
the Rider App = **12.4 km** in the live ride request) that the **Driver App**
renders as a proximity:

- `driver-app/app/(driver)/pickup-navigation.tsx:72` — `{current_request?.distance} km away`
- `driver-app/app/(modals)/ride-request.tsx:98` — `Distance` `{current_request.distance} km`
- `driver-app/components/ride/RideRequestModal.tsx:58` — `Distance` `{request.distance_km} km` (stale props shape)

The actual distance from the driver to the pickup, computed by Redis GEO against
the live coordinates, is **0.15 metres**.

---

## 1. Trace (live data)

Live ride request `ride:request:7d8fd82d-fc11-466f-a6ac-618e846e4d21`
(pickup near rider's phone; driver `21297138-…-e11e8a648d48` / CH 01 BE 0506):

| # | Step | Result |
|---|------|--------|
| 1 | Driver App GPS | `latitude`/`longitude` numbers from `expo-location` (code: `driver-app/hooks/useDriverLocation.ts`) — not directly observable without a device; the stored GEO point equals what the app sent (see #4). |
| 2 | PUT /drivers/location | Body `{ location: { latitude, longitude, accuracy, timestamp } }` (code: `driverAPI.updateLocation` → `api.put('/drivers/location', { location })`). Sent as **lat/lng**. |
| 3 | Backend receives coords | `driver.controller.js` requires `typeof latitude === 'number' && typeof longitude === 'number'`, passes through unchanged (lat/lng). |
| 4 | Redis GEO `drivers:online` | `redisService.setDriverLocation` → `geoadd('drivers:online', longitude, latitude, driverId)` — **correct lng,lat member ordering**. `GEOPOS` confirms stored = lng `76.66757851839066`, lat `30.763136353582674`. |
| 5 | `driver:{driverId}` hash | **Stores no coordinates.** Fields present: `status`, `rideType`, `socketId`, `vehicleNumber`, `onlineSince`. |
| 6 | `getNearbyDrivers` | `georadius('drivers:online', longitude, latitude, radius, 'm', 'WITHDIST', 'ASC')` — center is the **pickup**; lng/lat swap correct. |
| 7 | Distance used by matching | `distance_meters` from Redis `WITHDIST` → for driver `21297138`: **0.1468 m** from the live pickup center. |
| 8 | Rider pickup coords | From ride-request buffer: `pickupLat "30.7631367"`, `pickupLng "76.66758"`. |
| 9 | Final calculated distance | Redis: **0.15 m**; independent haversine: **0.12 m** (≈ the same point). The "12.1/12.4 km" value is the **trip `distance` field**, not this. |

---

## 2. Coordinate comparison table

| Source | Latitude | Longitude | Timestamp (UTC) |
|---|---|---|---|
| Driver GPS (app, implied) | 30.7631363 | 76.6675785 | last sync unknown* |
| PUT /drivers/location (body shape, code) | `number` latitude | `number` longitude | — |
| Redis GEO `drivers:online` (GEOPOS) | 30.763136353582674 | 76.66757851839066 | onlineSince 2026-08-10T18:04:23.191Z |
| `driver:{id}` hash | *(no coords)* | *(no coords)* | onlineSince 2026-08-10T18:04:23.191Z |
| `getNearbyDrivers` (georadius, from pickup) | — | — | distance_meters = **0.1468** |
| Rider pickup (ride-request buffer) | 30.7631367 | 76.66758 | createdAt 2026-08-10T18:10:00.985Z |

\* No per-driver GPS timestamp is persisted; see §5.

### Per-coordinate type/finiteness (all boundaries)
- Driver GPS: `latitude` number, `longitude` number — finite (app native).
- HTTP body: both `number` (controller rejects otherwise → 400).
- Redis GEO: `GEOPOS` returns strings → parsed as floats; both finite; values
  plausible (lat 30.76 in range, lng 76.66 in range).
- Ride buffer: `pickupLat`/`pickupLng` stored as strings, converted with `Number()`
  in `matching.service.normalizeCoords` → finite.

---

## 3. Coordinate ordering — explicit documentation

| Boundary | Input order | Where swapped | Result |
|---|---|---|---|
| expo-location → app state | `latitude`, `longitude` | — | lat/lng |
| App → `PUT /drivers/location` | `latitude`, `longitude` | — | lat/lng |
| Controller → service → repository | `latitude`, `longitude` | — | lat/lng |
| `setDriverLocation` → `geoadd` | `(longitude, latitude, member)` | **swap lng,lat — CORRECT** | Redis GEO order |
| `getNearbyDrivers` → `georadius` | `(longitude, latitude, …)` | **swap lng,lat — CORRECT** | Redis GEO order |
| Ride request buffer → matching | `pickupLat`, `pickupLng` | — | lat/lng |

No boundary ever feeds lat as lng or lng as lat. The independent geohash score
decode of one member reproduces the GEOPOS longitude exactly.

---

## 4. Where the "~12.1 km" number comes from (root cause)

1. Rider App computes a route estimate via OSRM; `estimate.distance` = the
   **trip distance** (live value **12.4 km**, pickup → dropoff).
2. Rider App sends it as `distance` in `POST /rides/request`
   (`context/ride-store.ts` → `services/ride.service.ts`).
3. Backend stores it and echoes it in the socket offer
   (`offer-dispatcher.js` → message `distance`).
4. Driver App stores it as `current_request.distance` and renders it as a
   **proximity** in `pickup-navigation.tsx:72` → "**12.4 km away**", and as
   "Distance" in the request modal.

**First wrong boundary:** the Driver App UI labeling `current_request.distance`
(trip distance) as `"… km away"`. The coordinates never become wrong; the label
presents a trip-length as a driver-to-pickup distance.

`GET /drivers/nearby` and the matching candidate distance (`distance_meters`,
Redis georadius) are **correct**: 0.15 m from the pickup.

---

## 5. Stale-location check

| Question | Answer |
|---|---|
| Driver last GPS update timestamp | **Not persisted anywhere.** Redis stores only `onlineSince` (status toggle time), not the last coordinate update time. |
| PUT /drivers/location timestamp | Sent in the body as `timestamp` but **discarded** — backend ignores it and stores no location timestamp. |
| Redis GEO update timestamp | Not stored (Redis GEO keeps no per-member timestamp). |
| Is the driver location stale? | Location freshness **cannot be proven** from storage. The real driver's `onlineSince` = 2026-08-10T18:04:23Z (~7 min before capture) and its GEO point sits exactly at the pickup — consistent with being current. |
| Multiple driver location records? | `drivers:online` has 6 members: 2 real (`21297138` mini/CH 01 BE 0506, `0e136d29` bike/PB04Y5288) + **4 orphaned test drivers** (`VA-TEST-01`, ~46 h old) left in Redis by an earlier validation harness. |
| `drivers:online` vs `driver:{id}` coords differ? | Cannot differ: `driver:{id}` contains **no coordinates**. |
| Other stale keys | `driver:meta:<id>` ×2 exist but no current backend/app code reads or writes them (leftover from an older version) — not a coordinate source. |

---

## 6. Conclusion

- Coordinates are **correct end-to-end**; ordering is correct at every boundary.
- The reported "12.1 km away" is the **trip distance (12.4 km live)** displayed
  by the Driver App as a proximity.
- Independent Redis computation of the actual driver→pickup distance: **0.15 m**.
- Side findings (operational, not the cause): 4 orphaned `VA-TEST-01` drivers
  pollute `drivers:online`; no GPS-`timestamp` persistence exists.

## 7. Files involved

- `driver-app/app/(driver)/pickup-navigation.tsx:72` — "… km away" (mislabel).
- `driver-app/app/(modals)/ride-request.tsx:98`, `driver-app/components/ride/RideRequestModal.tsx:58` — "Distance" (trip distance).
- `driver-app/hooks/useDriverLocation.ts` — GPS → PUT /drivers/location.
- `backend/src/modules/driver/driver.controller.js:3-18` — validation/passthrough.
- `backend/src/core/redis/redis.service.js:39-76` — geoadd/georadius (correct).
- `backend/src/modules/matching/candidate-finder.js:7-12` — pickup-center search.
- `backend/src/modules/matching/offer-dispatcher.js:19-31` — echoes trip `distance`.

## 8. Recommended minimal fix (NOT implemented, per instruction)

- **Rider/Drop "km away" label:** in `pickup-navigation.tsx` (and the request
  modals) label the value as **trip distance** ("Trip distance" / "Trip 12.4 km"),
  or compute the real driver→pickup distance from the driver's own GPS vs the
  offer's `pickup.lat/lng`. (Driver-app UI; no backend change.)
- **Optional ops cleanup:** purge the 4 orphaned `VA-TEST-01` entries from
  `drivers:online` and `driver:*`, and add a location `timestamp` to the driver
  hash (or Redis GEO `ZADD ... STORE`/`ZSET` metadata) so staleness becomes
  measurable.

No matching logic, Rider App, Driver App logic, or distance formula was changed.