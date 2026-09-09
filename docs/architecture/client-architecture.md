# Client Architecture

## Rider app (repo root, `rideway-rider`)

- Framework: Expo ~54.0.33, RN 0.81.5, React 19.1.0, expo-router ~6.0.23 (`package.json:21,28,37`).
- Navigation: expo-router Stack (`app/_layout.tsx:108-122`): index/ride/confirm/tracking/complete + profile screens.
- State: Zustand `context/ride-store.ts` (`RideStatus IDLE|REQUESTING|SEARCHING_DRIVER|DRIVER_ASSIGNED|DRIVER_ARRIVING|RIDE_STARTED|RIDE_COMPLETED|CANCELLED:48-56`), `persist rider-ride-storage` partialize trip/status/rideId/driverId/driver (`357-365`); `store/homeStore` GPS/pickup/destination/estimate (non-persisted).
- API: `services/api.ts` (Supabase session token → `Authorization`, `x-idempotency-key:111`), `services/ride.service.ts:97-143` (`POST /rides/request`, `GET /rides/:id`, `POST complete/cancel`, `GET /rides/rider/:id/active`, `GET /rides/rider/active`).
- Auth: `context/auth-context.tsx` (`getSession` + `onAuthStateChange → applySession:97-129`, token mirror `setAuthToken`, profile dedup per user+token `24-57`).
- Realtime: `hooks/useRiderRideSocket.ts` (`io(auth.token):49-55`, `ride:status_changed:64-98` with rideId-mismatch ignore, terminal-wins/stale-order guard, reconnect → `getMyActiveRide+hydrate:112-145`).
- Recovery: `hooks/useRideRecovery.ts` (launch + 5s poll + foreground, `getMyActiveRide→getRiderActiveRide:11-21`, `hydrateActiveRide:118-131`) + `hooks/useActiveRideDiscovery.ts` (tracking/home polling, mismatch guard).
- Location/maps: `expo-location`, `react-native-maps`, `services/osrm.ts:15-42` routing, `utils/map-region.ts`.
- Referral: `hooks/useReferralAttribution.ts` (expo-linking `/r/VEL-XXXXX`, AsyncStorage `velos_pending_referral_code`, `POST /referrals/apply` after auth).

## Driver app (`driver-app/`)

- Same Expo/RN versions; + `react-native-qrcode-svg@6.3.22`, `react-native-svg@15.12.1` (`package.json:42,46`).
- Navigation: expo-router groups `(auth)/(driver)/(tabs)/(wallet)/(referral)/(modals)` (`app/_layout.tsx:46-55`).
- Startup gate: `contexts/AuthContext.tsx:7` tri-state `BOOTSTRAPPING|AUTHENTICATED|UNAUTHENTICATED` (`getSession` + `INITIAL_SESSION` first-wins:96-133); `store/startupStore.ts:3-13` phases to `APP_READY`; `_layout.tsx:34-64` splash hides only when `fonts && (UNAUTH || AUTH+appReady)`; `StartupGate` renders recovering screen while `AUTH && !appReady`; `app/index.tsx:6-8` returns null during BOOTSTRAPPING.
- Stores: `rideStore ride-storage` persists only `current_ride:40`; `driverStore driver-storage` persists driver/status/location/is_online/earnings/kyc:57-66; `navigationStore:69` plain `create` — **not persisted** (by design).
- Startup orchestration: `hooks/useDriverStartup.ts:62-79` `reconcileRideOnce('startup') → recoverNavigationFromRide → markAppReady → router.replace` to `home/pickup-navigation/ride-progress/drop-navigation` (`targetRouteForRide:12-23`); foreground re-reconcile.
- Recovery: `services/rideRecoveryService.ts:47` `reconcileRideOnce(source, authUserId)` (in-flight mutex, `GET /rides/driver/active:60`, direct `getRideDetails` fallback, network-failure retains local, `stopNavigation` on clear); `hooks/useRideReconciliation.ts` polls 20s after APP_READY; `hooks/useNavigationRecovery.ts` GPS-first (`requestForegroundPermissions→getCurrentPosition High:75-102`, `PENDING_GPS` on deny/invalid, no 0,0) then `startNavigation(coords, pickup|drop:<rideId>)`.
- Status bar: `components/driver/RideStatusCard.tsx:22-29` shows `Recovering ride…` when `!appReady && activeStatus && UNRESOLVED`.
- Sockets: `hooks/useWebSocket.ts` (`ride:request:45`, reconnect → `reconcileRideOnce` after APP_READY:81-115); `hooks/useRideListener.ts` gates requests on `ONLINE_IDLE` + resubscribes per `current_ride.id`.
- Referral UI: `app/(referral)/earn.tsx` + `components/referral/ReferralQR.tsx` (local QR of `https://velos.app/r/<code>`), `services/referralAPI.ts`.

## Status

- ✅ Auth tri-state + startup gate + ride-before-nav + GPS-first nav recovery.
- ✅ Minimal persist (ride snapshot only) + authoritative active endpoints.
