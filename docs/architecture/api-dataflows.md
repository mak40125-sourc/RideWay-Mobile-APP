# API & Data Flows (business-critical)

Auth: all below `protect` (Bearer → `req.user`) except `/health`, `/r/:code`.

- `POST /api/v1/rides/request {riderId?,pickup,dropoff,fare,distance,duration,vehicleType,…}` + `x-idempotency-key` → 201 (new) / 200 `x-idempotency-hit` (retry). Side: PG idempotent row + Redis buffer + GEO match + offers + pub/sub. Fail: 4xx validation, 5xx retryable.
- `POST /api/v1/rides/:id/accept` (driver) → 200 ride / 404 unavailable / 409 assigned-or-stale. Side: Redis lock → `accept_ride_atomic` → DEL scratch → `ride:status_changed`.
- `PUT /api/v1/rides/:id/status {DRIVER_ARRIVING|RIDE_STARTED|RIDE_COMPLETED}` → RPC `FOR UPDATE`, idempotent, 409 invalid, 403 not-owner. Emits event.
- `POST /:id/complete` → same as RIDE_COMPLETED + referral hook. `POST /:id/cancel` (rider|driver role resolved) → CANCELLED.
- `GET /rides/rider/active|/driver/active` → latest fresh active row or null. Never mutates.
- `PUT /drivers/location|/online|/offline`, `GET /drivers/nearby|/me`; `GET /wallet/:userId/{balance,transactions}`; referral `GET /code|stats|history|/` + `POST /apply`; dashboard `GET /stats|rides|drivers…`, `POST …/kyc/review` (`x-dashboard-key`).

Data-flow example (accept): `Driver → POST → controller → matchingService.acceptRide → acceptance-manager (lock+buffer check) → matching.repository (accept_ride_atomic) → PG row DRIVER_ASSIGNED → DEL Redis → socket emit → rider hydrate`.
