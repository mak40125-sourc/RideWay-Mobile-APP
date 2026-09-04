# Driver App — OSRM Navigation: Audit & Progress Report

Date: 2026-08-17 (audit) / 2026-08-18 (V1 implementation)
Scope: audit of **OSRM-based routing/navigation** ("like Google Maps" — road
route, turn-by-turn/maneuvers, live ETA) across the driver app, rider app, and
backend, followed by the **V1 driver navigation implementation**.
Status: audit complete; V1 driver OSRM navigation implemented in `driver-app`
(no backend/rider/matching changes).

---

## 1. Headline (what exists today)

- **The driver app has NO OSRM navigation.** None of the driver navigation
  screens (`pickup-navigation`, `drop-navigation`, `ride-progress`) fetch a
  route, draw a route polyline, show maneuvers/turn-by-turn, or re-route. They
  render a Google Map centered on the destination with a marker +
  `showsUserLocation` only.
- **The only OSRM consumer in the whole codebase is the RIDER app** — a single
  trip-estimate call (`services/osrm.ts`) that returns distance/duration/path
  for the pickup→dropoff leg (used for fare + a static polyline). It fetches
  `overview=full` geometry but **no `steps`** (no maneuvers).
- **Backend OSRM is phantom.** `backend/architecture.md` documents
  `osrmService.getRoute(...) → { distance_km, duration_min, fare, polyline, steps }`
  and a `GET /route` endpoint, but no `osrm.service.js` file exists anywhere
  under `backend/src` (confirmed by glob), and
  `backend/docs/implementation-roadmap.md:505` explicitly calls it phantom.
- The planned architecture (`ride_way_architecture_blueprint.md` §9 "Routing
  Architecture (OSRM)", §15 final diagram) intended OSRM for distance, ETA,
  fare and route polyline — only the rider-side estimate was ever built.

---

## 2. Where OSRM is actually used (rider app only)

### `services/osrm.ts` (rider app) — the only real OSRM client

```ts
const OSRM_BASE_URL = "https://router.project-osrm.org";
// GET {base}/route/v1/driving/{pickup.lng},{pickup.lat};{dropoff.lng},{dropoff.lat}
//     ?overview=full&geometries=geojson
```

- Returns `{ distance (km, 1dp), duration (min), path: Coordinates[] }`.
- `path` maps GeoJSON `[lng, lat]` → `{ latitude, longitude }` (correct order).
- Uses the **public** project-osrm.org server; no API key; no timeout/abort;
  throws on non-2xx.
- **No `steps=true`** → no maneuver instructions, no per-leg distances.

### Consumers
- `screens/rider/home-screen.tsx` — estimate for the ride options/fare
  (`estimate.distance`, `estimate.duration`, `estimate.path` → `setTrip`).
- `screens/rider/ride-screen.tsx` — same estimate for the selection screen.
- Polyline rendering reference: `components/Map/RideMap.tsx` and
  `components/ride/ride-map.tsx` render `<Polyline coordinates={routePath} …/>`
  from the OSRM `path`.

This is the pattern a driver-side OSRM navigation would reuse (same request
shape, same geoJSON decode).

---

## 3. Driver navigation screens today (no OSRM)

| Screen | What it renders | Routing? |
|---|---|---|
| `app/(driver)/pickup-navigation.tsx` | Google map centered on pickup + pickup marker + `showsUserLocation`; overlay "Navigate to pickup" | **none** — no polyline, no steps, no follow-camera |
| `app/(driver)/ride-progress.tsx` | Google map centered on pickup; pickup + drop markers | **none** |
| `app/(driver)/drop-navigation.tsx` | Google map centered on drop + drop marker; overlay "Continue to destination" | **none** |

### Distance display today
- `pickup-navigation`: **straight-line (great-circle) haversine** driver→pickup
  from the driver's live GPS (added 2026-08-17; replaces the old mislabeled
  trip-distance "12.1 km away"). This is **air distance**, not road distance,
  and is a stopgap until real OSRM routing exists.
- `drop-navigation`: shows `current_ride.distance · duration` = the **full trip
  totals** (pickup→dropoff), not the remaining road distance from the driver's
  live position.
- No ETA to pickup, no route polyline, no maneuver instructions, no re-route.

Backend evidence: `backend/docs/pickup-coordinate-trace.md` §5.1 — "Missing
actual route/polyline — neither navigation screen fetches or draws a real
route; the map shows a marker + initial region only." §5.2–5.5 document the
distance-semantics confusion, camera behavior (no fit-to-route / no follow),
hard-coded fallback coordinates, and the drop-navigation trip-total issue.

---

## 4. Backend routing plans vs reality

| Source | Claimed | Reality |
|---|---|---|
| `backend/architecture.md` §7.3 | `osrmService.getRoute(pickup, dropoff) → { distance_km, duration_min, fare, polyline, steps }`; falls back to client values | `osrm.service.js` does **not exist**; ride controller stores client-supplied `distance`/`duration`/`fare` |
| `backend/architecture.md` routing table | `GET /route` → `rideController.getRoute` (OSRM route/fare) | endpoint **not implemented** (phantom) |
| `backend/CONTEXT.md`, `backend/docs/matching.md` | OSRM optional; matching must not depend on it | correct — nothing depends on OSRM |
| `backend/docs/implementation-roadmap.md:505` | flags `osrm.service.js` as phantom | confirmed |
| `ride_way_architecture_blueprint.md` §9/§15 | OSRM for distance/ETA/fare/polyline | only rider-side estimate built |

So: **no server-side routing, no fare-from-OSRM.** The rider app does OSRM
directly to the public server; the driver app does nothing.

---

## 5. Progress history (OSRM-navigation related)

1. **Rider trip estimate via OSRM (implemented, Phase 1 rider app).**
   `services/osrm.ts` + estimate-driven fare (`components/home/types` →
   `RideEstimate`), route polyline rendered in `RideMap`. This is the only
   working OSRM integration and the reference implementation for a driver-side
   port. It returns geometry but **no `steps`**.

2. **Driver distance evidence report (2026-08-10,
   `driver-app/docs/driver-distance-evidence-report.md`).** Proved the pickup
   screen's "~12.1 km" was the rider trip distance mislabeled as proximity
   (real driver→pickup was ~0.15 m via Redis georadius). Coordinates verified
   correct at every boundary (no lat/lng swap).

3. **Pickup-distance fix (2026-08-17, this session).**
   `driver-app/app/(driver)/pickup-navigation.tsx` now computes a
   **straight-line** driver→pickup distance (haversine) and shows the trip
   distance separately. This is a **stopgap** — it is great-circle distance,
   not OSRM road routing, and there is still no route polyline/maneuvers/ETA.

4. **Navigation-issue inventory (backend/docs/pickup-coordinate-trace.md §5).**
   Documented the missing route/polyline, the distance-semantics issue, camera
   behavior, fallback coordinates, and drop-navigation trip totals. None fixed
   except the pickup straight-line distance.

5. **DRIVER_ARRIVING sync investigation (2026-08-11).** Unrelated to OSRM but
   part of the navigation stack's status flow; verified the Arrived transition
   is backend-confirmed and works end-to-end.

---

## 6. Design proposal: OSRM-based driver navigation "like Google Maps"

**Implemented (V1, 2026-08-18)** in `driver-app`. Files added/changed:

- `types/navigation.ts` — OSRM/nav types (Coordinate, OsrmStep/Leg/Route/Response,
  ManeuverInstruction/Icon, NavStep, FlattenedRoute, NavRoute).
- `services/osrmNavigation.ts` — OSRM client (`fetchNavRoute`: origin = driver's
  **current GPS** → destination, `steps=true&overview=full&geometries=geojson&alternatives=false`,
  15 s abort timeout, `EXPO_PUBLIC_OSRM_BASE_URL` fallback to public server),
  geoJSON decode (`[lng,lat]` → `{latitude,longitude}`), `haversineM`,
  `snapToFlattenedM` (planar projection over precomputed cumulative meters),
  `buildFlattened`, `buildManeuverInstruction` (turn/continue/roundabout/…),
  `maneuverIcon` (arrow-up rotated ±40/±90/±135/180; roundabout circle; arrive
  pin), `formatDistanceM`.
- `store/navigationStore.ts` — Zustand nav engine: status
  (`idle|fetching|active|error`), step index, distance-to-maneuver, remaining
  distance/duration (scaled by route ratio), route progress, off-route detection
  (>120 m), reroute throttle (min 15 s interval), straight-line fallback
  (≈8.33 m/s) while no route exists. Metrics recomputed on GPS update and on
  route apply.
- `hooks/useNavigationEngine.ts` — consumes the existing `useDriverLocation`
  feed (no second GPS watcher), start/stop keyed by destination key, initial
  route fetch + 8 s retry throttle, auto-reroute from current GPS on
  deviation.
- `components/navigation/NavigationMap.tsx` — follow-the-driver camera
  (center offset ~400 m ahead, pitch 50, zoom 16, heading), white-cased blue
  route polyline, custom driver marker, destination pin, pan-to-unfollow +
  recenter button.
- `components/navigation/ManeuverCard.tsx` — dark top card: icon +
  distance-to-maneuver left; "Turn right onto **Main Road**" + "Then ← next
  maneuver" right; reanimated FadeInDown per step; "Preparing route…"/error
  states.
- `components/navigation/TripPanel.tsx` — bottom dark panel: ETA min / Remaining
  km / Arrival HH:MM, route progress bar, off-route/"Rerouting…" banner,
  destination address, action + optional cancel.
- `components/navigation/NavigationScreen.tsx` — composes map + card + panel;
  `useIsFocused()` gating; engine stop on unmount.
- `app/(driver)/pickup-navigation.tsx` / `drop-navigation.tsx` — rewritten to
  render NavigationScreen (Arrived → `DRIVER_ARRIVING` → ride-progress;
  Complete Ride → `RIDE_COMPLETED` → ride-completed). The stopgap haversine and
  trip-total displays are removed — road distance/ETA now come from the OSRM
  leg.
- `types/driver.ts` + `hooks/useDriverLocation.ts` — `DriverLocation.heading`
  captured from the GPS (guarded ≥0).

Deliberately **not** in V1 (spec): lane guidance, traffic, voice, alternate
routes, speed limits, map matching, backend `GET /route` / `osrm.service.js`.


### 6.1 Route fetching
- Add a driver-side route call (mirror `services/osrm.ts`), requesting
  `steps=true&overview=full&geometries=geojson` from the OSRM server for the
  relevant leg:
  - `pickup-navigation`: driver's **live GPS → pickup** (recomputed as the
    driver moves).
  - `drop-navigation`: driver's **live GPS → dropoff** (recomputed).
- Response needed: `distance`, `duration`, `geometry` polyline, and **`steps`**
  (each step: maneuver type/`bearing_after`, road name, distance, duration,
  location) for the turn-by-turn banner.
- Road distance/ETA should come from the OSRM `routes[0]` totals, not from the
  stored `ride.distance`/`duration` (trip totals are irrelevant once the
  driver is moving).

### 6.2 Rendering
- Draw the OSRM polyline on `react-native-maps` (`<Polyline coordinates={path}/>`),
  reusing the rider app's geoJSON decode (`services/ride.service.ts` /
  `services/osrm.ts` already do this).
- Camera: replace `initialRegion` with a follow-the-driver camera
  (`fitToCoordinates` / animated region on each GPS update), and re-fit when the
  route changes.

### 6.3 Turn-by-turn UI (Google-Maps-like)
- Instruction banner on the navigation screens: current step's maneuver icon
  (turn left/right, keep straight, etc.) + road name + distance to next
  maneuver.
- Live position tracking: subscribe to the GPS watch already running
  (`useDriverLocation`), snap progress to the polyline, show remaining
  distance/ETA to the pickup (or drop).
- Re-route when the driver deviates from the polyline beyond a threshold.

### 6.4 Where it plugs in
- Reuse the same OSRM client + decode as the rider app (either share
  `services/osrm.ts` or add an identical `driver-app/services/osrm.ts`).
- Replace the stopgap haversine in `pickup-navigation.tsx` and the
  trip-total display in `drop-navigation.tsx` with OSRM leg results.
- Server-side OSRM (`GET /route`, `osrm.service.js`) can be built later if a
  self-hosted OSRM server or fare-from-OSRM is desired; the driver app can call
  OSRM directly in the meantime (exactly as the rider app does today).

---

## 7. Gaps & prerequisites (in priority order)

1. **Driver app: no OSRM call at all.** Add route fetch for
   pickup/drop legs with `steps=true`.
2. **No steps/maneuver decoding.** Need to decode OSRM `steps` (maneuver type,
   modifier, name, distance) — none exists anywhere in the repo today.
3. **No route polyline on driver maps.** Add `<Polyline>` to
   `pickup-navigation` / `drop-navigation`.
4. **No follow-camera / re-route.** `initialRegion` only; no camera tracking of
   the live GPS, no off-path detection.
5. **Straight-line haversine is a stopgap** (air distance); road distance/ETA
   must come from OSRM once wired.
6. **OSRM server choice.** Currently public `router.project-osrm.org` (no key,
   rate-limited, no abort timeout in `services/osrm.ts`). For production,
   consider self-hosting OSRM or adding a backend proxy (`GET /route`) with a
   timeout/fallback to client values (matching the documented architecture).
7. **Backend phantom OSRM.** `architecture.md` claims `GET /route` +
   `osrm.service.js`; either implement them or update the docs to match reality.

---

## 8. Verification / next steps

- V1 verification run 2026-08-18: `npx tsc --noEmit` in `driver-app` — no new
  errors (only pre-existing `components/ride/RideRequestModal.tsx` and
  `services/rideAPI.ts:56` type errors). `npx eslint` on all changed/new files —
  clean. Full `npm run lint` — only pre-existing warnings/errors (auth screens,
  unescaped entities, `home.tsx` rule definition).
- Manual test still to run on device/emulator: accept → pickup-navigation shows
  live OSRM polyline + steps + road ETA from the driver's GPS → Arrived →
  drop-navigation shows the driver→dropoff OSRM route → Complete.
- Keep the rider trip estimate unchanged; only the driver legs were added.

---

## 9. Files involved (OSRM navigation scope)

| App | File | Role |
|---|---|---|
| Rider | `services/osrm.ts` | the only rider OSRM client (trip estimate; reference pattern) |
| Rider | `components/Map/RideMap.tsx`, `components/ride/ride-map.tsx` | route polyline rendering (reference) |
| Driver | `services/osrmNavigation.ts` | V1 OSRM navigation client (route + steps + maneuvers) |
| Driver | `store/navigationStore.ts` | V1 navigation engine state (off-route/reroute/fallback) |
| Driver | `hooks/useNavigationEngine.ts` | V1 GPS → engine wiring (feed, fetch, reroute) |
| Driver | `components/navigation/*` | V1 map / maneuver card / trip panel / screen |
| Driver | `app/(driver)/pickup-navigation.tsx` | driver→pickup OSRM leg (V1, rewritten) |
| Driver | `app/(driver)/drop-navigation.tsx` | driver→dropoff OSRM leg (V1, rewritten) |
| Driver | `app/(driver)/ride-progress.tsx` | still no routing (unchanged; next candidate) |
| Driver | `hooks/useDriverLocation.ts` | live GPS feed incl. `heading` (V1 extension) |
| Backend | (phantom) `osrm.service.js`, `GET /route` | documented but not implemented (V2 candidate) |

Related reports: `docs/driver-distance-evidence-report.md`,
`backend/docs/pickup-coordinate-trace.md` (§5 navigation issues),
`backend/architecture.md` (§7.3, routing table),
`backend/docs/implementation-roadmap.md` (phantom OSRM),
`ride_way_architecture_blueprint.md` (§9 Routing Architecture, §15).