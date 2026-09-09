# Matching Architecture (`backend/src/modules/matching/`)

Pipeline: `matching.service.createRideRequest` → `candidate-finder` → `candidate-ranker` (identity today) → `offer-dispatcher` → `acceptance-manager`.

```mermaid
sequenceDiagram
  Rider->>API: POST /rides/request (fare/distance/duration client-computed + idempotency key)
  API->>PG: create_ride_idempotent (unique index)
  API->>Redis: HSET ride:request:<id> TTL120
  API->>Redis: GEORADIUS drivers:online 3000m + HGETALL driver:<id>
  API->>API: repair hash + filter vehicle_type
  API->>Redis: SADD ride:offers:<id>
  API->>Redis: PUBLISH ride:notifications
  Redis->>Driver: Socket.IO ride:request (per driver room)
  Driver->>API: POST /rides/:id/accept
  API->>Redis: SET ride:lock:<id> NX EX10
  API->>PG: accept_ride_atomic FOR UPDATE (one winner, 409 other)
  API->>Redis: DEL request+offers+lock
  API->>Rider: ride:status_changed DRIVER_ASSIGNED
```

- Candidate discovery: `getNearbyDrivers(lat,lng,3000)` → repair-at-read `repairDriverMetadata` (UUID-guarded, from `drivers` row) → exact `vehicle_type` match.
- Offer: `addDriversToQueue` + `getRiderName` + `publishNotification` with `expiresAt = now + 120000`.
- Accept races: Redis lock reduces stampede; Postgres `FOR UPDATE` decides; same-driver retry idempotent; different-driver → 409.
- PostGIS `get_nearby_drivers` RPC exists in schema but matching uses Redis GEO in code (discrepancy — see audit).

✅ IMPLEMENTED. ⚠️ Ranker is pass-through; `candidateCount` may be 0 with no retry.
