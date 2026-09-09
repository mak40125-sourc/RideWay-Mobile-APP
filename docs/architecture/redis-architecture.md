# Redis Architecture (`backend/src/core/redis/redis.service.js`)

| Key | Type | Content | TTL | Authoritative? |
|---|---|---|---|---|
| `drivers:online` | GEO | online driver positions | — | Availability index only |
| `driver:<id>` | hash | `{status,rideType,socketId,vehicleNumber,onlineSince}` | — (30s in legacy docs; current code no TTL) | No — repaired from `drivers` row |
| `ride:request:<id>` | hash | `{riderId,pickupLat/Lng,dropLat/Lng,addresses,fare,distance,duration,vehicleType,status=REQUESTED,createdAt}` | 120s (`RIDE_REQUEST_TTL`) | Ephemeral matching scratch |
| `ride:passenger:<id>` | hash | `{name,phone}` book-for-other | 86400s | Convenience only |
| `ride:offers:<id>` | SET | candidate driver ids | 120s | Ephemeral |
| `ride:lock:<id>` | string | holder driverId (`SET NX EX 10`) | 10s (`RIDE_LOCK_TTL`) | Coordination only |
| `wallet:<id>` | string | cached balance JSON | 300s (wallet legacy) | Cache only |

- GEO: `GEOADD drivers:online lng lat id` on location/online; `GEORADIUS … WITHDIST ASC` + pipeline `HGETALL driver:<id>` in `getNearbyDrivers`.
- Pub/sub: `publishNotification(channel,payload)` / `subscribeToNotifications`; channels `ride:notifications`, `ride:status:notifications`, `wallet:notifications`.
- Matching constants (`matching.constants.js`): `RIDE_REQUEST_TTL 120`, `RIDE_LOCK_TTL 10`, `NEARBY_RADIUS 3000m`.

**Redis is NOT authoritative** for ride lifecycle, assignment, terminal state, or recovery. Postgres wins on any disagreement. Redis loss → matching degrades, lifecycle stays correct via RPC row locks. ✅ IMPLEMENTED.
