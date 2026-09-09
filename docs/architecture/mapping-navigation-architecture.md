# Mapping & Navigation Architecture

- Map rendering: `react-native-maps` both apps (`RideMap`, driver `MapView`, `NavigationMap`).
- Geocoding: rider `services/places.ts` (`reverseGeocode`); driver `getAddress` lat/lng fallback (no fake 0,0).
- Routing: OSRM public `https://router.project-osrm.org` (`services/osrm.ts` rider estimate; `driver-app/services/osrmNavigation.ts:41-88 fetchNavRoute` with 15s timeout, `overview=full`, GeoJSON decode, `buildNavRoute` + `buildFlattened`).
- Driver nav engine (`hooks/useNavigationEngine.ts`): `startNavigation(destination,key,label)` clears route → `fetching`; position updates via `driverStore.location`; metrics via `snapToFlattenedM` (progress/remaining/ETA); off-route >120m → `requestReroute` (≥15s interval); `applyRoute` writes geometry + metrics; session/request guards prevent stale apply.
- Recovery (`hooks/useNavigationRecovery.ts`): target pickup for ASSIGNED/ARRIVING, drop for STARTED; current GPS (`requestForegroundPermissions` + `getCurrentPosition High`); invalid/denied → `PENDING_GPS` (ride intact); then `startNavigation(target, pickup|drop:<rideId>)`; engine fetches fresh route. Persisted geometry never trusted.
- Camera/markers: `NavigationMap` follows GPS-snapped position; pickup/drop markers from authoritative ride.

✅ IMPLEMENTED. ❓ Offline tiles / background nav unverified.
