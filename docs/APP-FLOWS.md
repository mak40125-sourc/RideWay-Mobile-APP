# Veylos — Application Flows (entry point)

## Rider journey

Launch → auth restore (`context/auth-context`) → permissions/GPS (`store/homeStore.bootstrapLocation`) → Home → pickup/destination → estimate (OSRM) → fare (`ride-helpers.calculateRideFare`) → confirm → `requestRideAction` (`POST /rides/request` + idempotency key) → SEARCHING → polling (`useActiveRideDiscovery` 5s) + socket `ride:status_changed` → tracking → completed → history. Alternate: network fail keeps SEARCHING with inline error; 4xx returns IDLE.

## Driver journey

Launch → `BOOTSTRAPPING` → session restore → AUTHENTICATED → persisted hydration → `reconcileRideOnce('startup')` (`GET /rides/driver/active`) → `recoverNavigationFromRide` (current GPS → `startNavigation`) → `APP_READY` → single `router.replace` to home / pickup-navigation / ride-progress / drop-navigation. Online → `PUT /drivers/online` → GPS watch (`useDriverLocation`) → `ride:request` socket → accept (`POST /rides/:id/accept`) → navigate pickup → arrived (`PUT …/status DRIVER_ARRIVING`) → start (`RIDE_STARTED`) → navigate drop → complete (`RIDE_COMPLETED`) → earnings/wallet. See `flows/driver-flow.md`.

## Dashboard journey

Login (dashboard key) → Overview (stats) → Rides (list/drawer/timeline) → Drivers (list/drawer) → KYC review (`POST …/kyc/review`) → Operations (map + tables, partly mock). See `flows/dashboard-flow.md`.

## Ride lifecycle

`REQUESTED → SEARCHING_DRIVER → DRIVER_ASSIGNED → DRIVER_ARRIVING → RIDE_STARTED → RIDE_COMPLETED`, with `CANCELLED` from any pre-trip state. All mutations via `transition_ride_status (FOR UPDATE)`, idempotent same-status, terminal immutable. See `flows/ride-lifecycle.md`.

## Failure/recovery

Crash/kill/storage-loss/network-loss/socket-drop → auth first → active-ride endpoint → hydrate → reconstruct nav from current GPS (never 0,0). Duplicate create/accept/completion safe via unique index + RPC. See `flows/failure-recovery-flow.md` and `architecture/reliability-recovery.md`.
