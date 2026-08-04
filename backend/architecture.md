# RideWay Backend Architecture

This document describes the complete backend flow, every file's responsibility, and how the pieces fit together. Use it as the source of truth for how the backend works.

---

## 1. Technology Stack

| Concern | Technology |
|---------|-----------|
| Language / Runtime | Node.js (v24), CommonJS (`require`) |
| Web framework | Express 5 |
| Database | Supabase (PostgreSQL + PostGIS) via `@supabase/supabase-js` |
| Realtime (app clients) | Socket.IO v4 (`socket.io` server-side) |
| Inter-process messaging | Redis Pub/Sub (`ioredis`) |
| Geospatial cache | Redis Geo (`GEOADD` / `GEORADIUS`) |
| File uploads | Multer (in-memory storage) → Supabase Storage |
| Authentication | Supabase Auth (JWT bearer tokens) |
| Routing/fares | OSRM, optional (falls back to client values) |
| Logging | Console (no logger configured) |

**Entry point:** `backend/src/server.js`

**Base URL:** `http://localhost:3000/api/v1`

---

## 2. Directory Map

```
backend/
├── .env                      # Environment config (Supabase, Redis, port, OSRM)
├── package.json              # Dependencies + scripts (start, dev)
├── supabase_schema.sql       # Full DB schema, types, functions, RLS, triggers
├── scripts/
│   └── test-ride-request.js  # E2E ride-matching smoke test
└── src/
    ├── server.js             # HTTP server bootstrap, socket init, shutdown handlers
    ├── app.js                # Express app, middleware, route mounting, health check
    ├── config/
    │   ├── supabase.js       # Creates supabase (anon) + supabaseAdmin (service role) clients
    │   ├── socket.js         # Socket.IO server, auth middleware, room join by role
    │   └── redis.js          # Legacy Redis client (see note below)
    ├── routes/
    │   ├── index.js          # Mounts drivers, rides, wallet routers under /api/v1
    │   ├── driver.routes.js  # Driver HTTP endpoints
    │   ├── ride.routes.js    # Ride HTTP endpoints
    │   └── wallet.routes.js  # ⚠ STALE — replaced by ../wallet/wallet.routes.js
    ├── controllers/
    │   ├── driver.controller.js  # Driver request handlers
    │   ├── ride.controller.js    # Ride request handlers
    │   └── wallet.controller.js  # ⚠ STALE — replaced by ../wallet/wallet.controller.js
    ├── middleware/
    │   ├── auth.middleware.js    # protect() — verifies Bearer JWT via Supabase
    │   └── upload.middleware.js  # Multer config (memory, jpg/png/webp, 5MB)
    ├── services/
    │   ├── driver.service.js     # Driver DB + document storage access
    │   ├── ride.service.js       # Ride request matching + acceptance logic
    │   ├── redis.service.js      # Centralized Redis (geo, state, queue, locks, pub/sub)
    │   ├── notification.service.js  # Redis→Socket.IO bridge for realtime events
    │   └── osrm.service.js       # Route/fare calculation via OSRM
    └── wallet/                   # ⭐ ACTIVE wallet module
        ├── wallet.routes.js      # Wallet HTTP endpoints (mounted in routes/index.js)
        ├── wallet.controller.js  # Wallet request handlers
        ├── wallet.service.js     # Wallet business logic + Redis cache + pub/sub
        └── wallet.validator.js   # Recharge & transaction query validation
```

> **Stale files:** `src/routes/wallet.routes.js` and `src/controllers/wallet.controller.js` are leftovers from an older wallet design. The routing table (`routes/index.js`) imports the active module from `../wallet/wallet.routes`. The old files are dead code.

---

## 3. Startup Sequence

```
npm start  →  node src/server.js
```

1. `server.js` loads `dotenv` from `../.env`
2. Requires `app.js` (Express app)
3. Create HTTP server: `http.createServer(app)`
4. `initSocket(server)` (`config/socket.js`) — attaches Socket.IO to the HTTP server
5. `initNotificationService()` (`services/notification.service.js`) — subscribes to Redis channels and forwards to Socket.IO
6. `server.listen(PORT)` — `PORT` from env (default 3000)
7. Registers `unhandledRejection` handler (logs + exits) and `SIGTERM` handler (graceful shutdown)

**Startup logs:**
```
Notification service subscribed to ride:notifications and wallet:notifications
Server running on port 3000
Access API at http://localhost:3000/api/v1
Redis (client): connected
Redis (subscriber): connected
```

**Express app (`app.js`):**
```js
app.use(cors());            // allow all origins
app.use(express.json());    // parse JSON bodies
app.use('/api/v1', allRoutes);   // mount all routers
app.get('/health', ...)     // health check
```

---

## 4. Configuration Files

### 4.1 `.env` (backend/.env) — ACTIVE
| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Anon/public key (client-side safety) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (server-side admin ops) |
| `REDIS_HOST` | Redis host (default `localhost`) |
| `REDIS_PORT` | Redis port (default `6379`) |
| `PORT` | Express port (default `3000`) |
| `NODE_ENV` | `development` enables dev-mode bypasses (see §9.4) |
| `OSRM_BASE_URL` | OSRM routing server base URL |

> There is a second `backend/src/.env` — it is **stale/duplicated** and not used by `server.js` (which loads `../.env`). Keep them in sync or delete the redundant file.

### 4.2 config/supabase.js
Creates two Supabase clients:
- `supabase` — built with the **anon key** (public client)
- `supabaseAdmin` — built with the **service role key** (bypasses RLS; used for all server-side DB/auth/storage operations)

Throws at startup if `SUPABASE_URL` is missing/placeholder.

### 4.3 config/redis.js — legacy
Creates an `ioredis` client used by older code. It has `lazyConnect`, stops retrying after 3 attempts, and logs a message rather than crashing if Redis is down. **Most new code uses `services/redis.service.js` instead.** This file is largely superseded but kept for compatibility.

### 4.4 config/socket.js
- Creates `Server(httpServer, { cors: '*' })`
- **Auth middleware** (`io.use`): reads `socket.handshake.auth.token`; if missing → `next(new Error('Authentication required'))`; otherwise verifies via `supabaseAdmin.auth.getUser(token)`; on success sets `socket.userId = data.user.id`
- **On connection**: reads `socket.handshake.auth.role` (default `driver`). Joins:
  - `rider:<userId>` if role is `rider`
  - `driver:<userId>` otherwise
- Exposes `initSocket(server)` and `getIO()`

---

## 5. Authentication (middleware/auth.middleware.js)

`protect` is applied to every protected route:

1. Reads `req.headers.authorization`, expects `Bearer <token>`
2. Missing/malformed → `401` `{ message: "No token provided." }`
3. Verifies via `supabaseAdmin.auth.getUser(token)`
4. Invalid/expired → `401` `{ message: "Invalid or expired token." }`
5. On success attaches `req.user = data.user` (Supabase user object with `.id`, `.email`)

> `req.user.id` is the **Supabase auth user UUID**. It is the same value stored as `drivers.user_id` and `profiles.id`. Be careful: `drivers.id` may differ from `drivers.user_id`.

---

## 6. HTTP Routing Table

Mounted in `routes/index.js` under `/api/v1`.

### 6.1 Drivers (`/api/v1/drivers`)
| Method | Path | Handler | Notes |
|--------|------|---------|-------|
| GET | `/me` | `driverController.getMyProfile` | Current driver profile |
| POST | `/register` | `driverController.register` | Create driver record |
| POST | `/upload-document` | `driverController.uploadDoc` | Multipart `document` file + `document_type` |
| PUT | `/location` | `driverController.updateLocation` | Store live GPS in Redis geo |
| PUT | `/online` | `driverController.setOnline` | Go online (KYC + balance gates) |
| PUT | `/offline` | `driverController.setOnline` | Same handler with `isOnline: false` |
| PUT | `/vehicle` | `driverController.updateVehicle` | Update vehicle info |
| GET | `/nearby` | `driverController.getNearbyDrivers` | Query online drivers near a point |

All protected via `protect`.

### 6.2 Rides (`/api/v1/rides`)
| Method | Path | Handler | Notes |
|--------|------|---------|-------|
| POST | `/request` | `rideController.requestRide` | Rider requests a ride (Redis + notify) |
| POST | `/:rideId/accept` | `rideController.acceptRide` | Driver accepts (distributed lock) |
| PUT | `/:rideId/status` | `rideController.updateRideStatus` | Driver updates status |
| GET | `/:rideId` | `rideController.getRide` | Ride detail |
| POST | `/:rideId/complete` | `rideController.completeRide` | Complete + deduct 10% commission |
| POST | `/:rideId/cancel` | `rideController.cancelRide` | Cancel (driver-side) |
| GET | `/route` | `rideController.getRoute` | OSRM route/fare (query params) |
| GET | `/rider/:riderId/active` | `rideController.getRiderActiveRide` | Rider's current active ride |

All protected via `protect`.

> Order matters: `GET /route` and `GET /rider/:riderId/active` are declared **after** `GET /:rideId` so express routes the static paths correctly.

### 6.3 Wallet (`/api/v1/wallet`) — ACTIVE module
| Method | Path | Handler | Notes |
|--------|------|---------|-------|
| GET | `/` | `walletController.getWallet` | Balance + minimum balance |
| GET | `/transactions` | `walletController.getTransactions` | Paginated list, optional type filter |
| POST | `/recharge` | `walletController.recharge` | Add funds (max ₹100k) |
| GET | `/minimum-balance` | `walletController.getMinimumBalance` | Returns ₹50 |

All protected via `protect`.

**Error response format across all routes:**
```json
{ "error": "Human-readable message" }
```

---

## 7. Request → Handler Flow (with examples)

### 7.1 Driver goes online

```
PUT /api/v1/drivers/online
Authorization: Bearer <jwt>
Body: { "isOnline": true, "rideType": "bike", "vehicle_number": "..." , "location": {...} }
```

1. `protect` verifies JWT → `req.user.id`
2. `setOnline` reads body
3. **If `NODE_ENV === 'development'`** → calls `redisService.setDriverOnline(userId, {...})` directly (skips all gates + DB lookup). Returns success.
4. **Otherwise (production):**
   - Look up driver row by `user_id` (id, wallet_balance, minimum_balance, kyc_status, is_verified)
   - Not found → `404`
   - If online: require `kyc_status === 'verified' && is_verified` → else `403 "KYC not verified"`
   - Require `wallet_balance >= minimum_balance` → else `403 "Insufficient wallet balance"`
   - `redisService.setDriverOnline(userId, { rideType, vehicleNumber, latitude, longitude })`
5. Returns `200 { message }`

**Under the hood (`redis.service.setDriverOnline`):**
- Requires `driverId`, `latitude`, `longitude`, `rideType` — else throws
- Writes hash `driver:<id>` with status=ONLINE, rideType, vehicleNumber, onlineSince, lastSeen
- Writes `driver:meta:<id>` hash (persists rideType/vehicleNumber)
- `GEOADD drivers:online <lng> <lat> <driverId>`
- Sets 30s TTL on `driver:<id>`

**Going offline** → `setDriverOffline` deletes `driver:<id>`, `driver:meta:<id>`, and `ZREM drivers:online <id>`.

### 7.2 Driver updates location (GPS ping)

```
PUT /api/v1/drivers/location
Body: { "location": { "latitude": 12.97, "longitude": 77.59 } }
```

- Validates latitude/longitude are numbers → else `400`
- `redisService.setDriverLocation(userId, lat, lng)`
- `GEOADD drivers:online <lng> <lat> <id>` (refreshes position in the geo set)
- If `driver:<id>` has no `rideType` yet, try to backfill from `driver:meta:<id>`
- Refreshes `lastSeen` and 30s TTL
- Returns `200 { message: "Location updated" }`

### 7.3 Rider requests a ride

```
POST /api/v1/rides/request
Body: {
  "riderId": "...",
  "pickup": { "lat": 12.97, "lng": 77.59, "address": "MG Road" },
  "dropoff": { "lat": 12.93, "lng": 77.62, "address": "Koramangala" },
  "vehicleType": "bike"
}
```

1. `requestRide` normalizes coords
2. **Route/fare resolution:**
   - Calls `osrmService.getRoute(pickup, dropoff)` → `{ distance_km, duration_min, fare, polyline, steps }`
   - If OSRM fails → logs warning, falls back to client-provided `fare`/`distance`/`duration` (or 0)
3. `rideService.createRideRequest(riderId, pickup, dropoff, fare, distance, duration, vehicleType)`:
   - Generates `rideId = crypto.randomUUID()`
   - `redisService.createRideRequest(rideId, {...})` → writes hash `ride:request:<id>` with all fields, TTL 120s, status REQUESTED
   - `redisService.getNearbyDrivers(pickup.lat, pickup.lng, 3000)` → online drivers within 3km (via `GEORADIUS` + pipeline `HGETALL driver:<id>`)
   - Filters candidates to those matching `vehicle_type`
   - Pushes candidate ids into a Redis set `ride:offers:<id>` (queue)
   - Fetches rider name from `profiles`
   - `redisService.publishNotification('ride:notifications', { rideId, pickup, dropoff, fare, distance, duration, riderName, candidateDriverIds })`
4. Returns `201 { ride: { id: rideId }, candidateCount }`

### 7.4 Driver accepts a ride

```
POST /api/v1/rides/:rideId/accept
```

1. `acceptRide` reads `rideId` param + `req.user.id` as driverId
2. `rideService.acceptRide(rideId, driverId)`:
   - `redisService.acquireRideLock(rideId, driverId, 10)` — `SET ride:lock:<id> <driverId> EX 10 NX`
   - Lock not acquired → throw `"Ride already accepted by another driver."`
   - `redisService.getRideRequest(rideId)` — read hashed ride request; if gone → release lock, throw `"Ride request expired or no longer available."`
   - **Dev mode:** build a fake ride object (Dev Driver) — no DB write
   - **Production:** `supabaseAdmin.rpc('accept_ride', {...})` — SQL function persists ride, sets DRIVER_ASSIGNED
   - Cleanup: `deleteRideRequest`, `deleteQueue`, `releaseRideLock`
3. Back in controller: `getIO()` → `io.to('rider:<rider_id>').emit('ride:accepted', { rideId, driverId, status, driver })`
4. Returns `200` with the ride object

### 7.5 Driver updates status

```
PUT /api/v1/rides/:rideId/status
Body: { "status": "DRIVER_ARRIVING" }
```

- Allowed: `DRIVER_ARRIVING`, `RIDE_STARTED`, `RIDE_COMPLETED` — else `400`
- `UPDATE rides SET status=..., updated_at=NOW() WHERE id=:rideId AND driver_id=:userId` (note: uses auth user id)
- Not matched → `404`
- Emits `ride:status_changed` to `rider:<rider_id>`
- Returns `200` ride

### 7.6 Driver completes a ride (with commission)

```
POST /api/v1/rides/:rideId/complete
```

1. Look up `drivers.id` by `drivers.user_id = req.user.id` — **important**: this differs from auth user id
2. `UPDATE rides SET status='RIDE_COMPLETED' WHERE id=:rideId AND driver_id=:driver.id`
3. Compute `commission = round(fare * 0.10, 2)`
4. `walletService.deductCommission(driver.id, commission, rideId)` (see §8)
5. Returns `200 { ride, commission, wallet_balance }`

### 7.7 Get nearby drivers (rider uses to map)

```
GET /api/v1/drivers/nearby?lat=12.97&lng=77.59&radius=3000
```
- `redisService.getNearbyDrivers(lat, lng, radius)`:
  - `GEORADIUS drivers:online <lng> <lat> <radius> m WITHDIST ASC`
  - Batch `HGETALL driver:<id>` via pipeline
  - Maps to `{ driver_id, user_id, distance_meters, vehicle_type, status }`
- Returns array

---

## 8. Wallet Module (`src/wallet/`)

### 8.1 wallet.service.js (business logic)
- `getWallet(driverId)` — RPC `get_wallet_balance`, caches in Redis (`wallet:<id>`, TTL 300s)
- `recharge(driverId, amount, paymentReference)` — RPC `recharge_wallet`, updates cache, publishes `wallet:notifications`
- `deductCommission(driverId, amount, rideId)` — RPC `deduct_commission`, updates cache, publishes, and publishes **low-balance** notification if `balance_after < minimum_balance`
- `getTransactions(driverId, { limit, offset, type })` — RPC `get_wallet_transactions`, normalizes numeric amounts
- `getMinimumBalance()` — hardcoded `50`
- Private: `_getCached`, `_setCache`, `_publishUpdate`, `_publishLowBalance` (rescinds failures silently)

**RPC calls (defined in `supabase_schema.sql` migrations):**
- `get_wallet_balance(p_driver_id)`
- `recharge_wallet(p_driver_id, p_amount, p_payment_reference)`
- `deduct_commission(p_driver_id, p_amount, p_ride_id)`
- `get_wallet_transactions(p_driver_id, p_limit, p_offset, p_txn_type)`

### 8.2 wallet.controller.js
- `getWallet` → 500 on error
- `getTransactions` — clamps limit to 1–100, offset ≥ 0, validates `type` against allowed set
- `recharge` — validates `amount` positive, `<= 100000`; calls service
- `getMinimumBalance` → `{ minimum_balance }`

### 8.3 wallet.validator.js
- `validateRecharge(body)` — amount required/number/>0/≤100000, payment_reference must be string
- `validateTransactionsQuery(query)` — limit 1–100, offset ≥ 0, type in allowed set

> Note: validators exist but aren't wired into the routes/controllers as middleware — validation is done inline in the controller. They're reference helpers.

---

## 9. Cross-Cutting Behaviors

### 9.1 Realtime push (recent additions in `ride.controller.js`)
After accept/status/complete/cancel operations, the controller emits directly to Socket.IO rooms:
- `ride:accepted` → `rider:<rider_id>`
- `ride:status_changed` → `rider:<rider_id>`
- `ride:cancelled` → `rider:<rider_id>`

### 9.2 notification.service.js — Redis → Socket.IO bridge
`initNotificationService()` subscribes to Redis channels and forwards to players:
- `ride:notifications` → emits `ride:request` to each `driver:<candidateDriverId>` room
- `ride:status:notifications` → emits `ride:status_changed` to `rider:<riderId>`
- `wallet:notifications` → emits the event `type` (e.g., `wallet:updated`, `wallet:low_balance`) to `driver:<driverId>`

`shutdownNotificationService()` calls `redisService.shutdown()`.

### 9.3 Real-time event inventory
| Event | Direction | Payload |
|-------|-----------|---------|
| `ride:request` | → drivers | `{ rideId, pickup, dropoff, fare, distance, duration, riderName }` |
| `ride:accepted` | → rider | `{ rideId, driverId, status, driver }` |
| `ride:status_changed` | → rider | `{ rideId, status, updatedAt }` |
| `ride:cancelled` | → rider | `{ rideId, reason }` |
| `wallet:updated` | → driver | `{ balance, minimum_balance, timestamp }` |
| `wallet:low_balance` | → driver | `{ balance, minimum_balance, timestamp }` |

### 9.4 Development-mode bypasses
Because `$env:NODE_ENV` is typically `development` in `backend/.env`, several production checks are **skipped**:
- `driver.setOnline` skips KYC/wallet validation and DB lookup
- `ride.acceptRide` skips the `accept_ride` RPC and returns a fake ride ("Dev Driver")
- `redis.service.setDriverOnline` still requires lat/lng/rideType and will throw if missing

> In production, set `NODE_ENV=production` so these validations run.

### 9.5 Ride status lifecycle
```
REQUESTED → DRIVER_ASSIGNED → DRIVER_ARRIVING → RIDE_STARTED → RIDE_COMPLETED
                                                    ↘ CANCELLED
```
- Initial state written to Redis is `REQUESTED`
- `accept_ride` RPC sets `DRIVER_ASSIGNED`
- Driver updates to `DRIVER_ARRIVING` / `RIDE_STARTED` / `RIDE_COMPLETED`
- `completeRide` also sets `RIDE_COMPLETED`
- `cancelRide` sets `CANCELLED`

### 9.6 Redis key layout
| Key | Type | Purpose | TTL |
|-----|------|---------|-----|
| `drivers:online` | geo set | Online driver positions | — |
| `driver:<id>` | hash | Live driver state (status, rideType, socketId, vehicleNumber, onlineSince, lastSeen) | 30s |
| `driver:meta:<id>` | hash | Persistent vehicle metadata | — |
| `ride:request:<id>` | hash | In-flight ride request | 120s |
| `ride:offers:<id>` | set | Candidate driver ids for a ride | 120s |
| `ride:lock:<id>` | string | Distributed lock (accept race) | 10s |
| `wallet:<id>` | string | Cached wallet balance JSON | 300s |

### 9.7 Shutdown & error handling
- `unhandledRejection` → log + `process.exit(1)`
- `SIGTERM` → `shutdownNotificationService()` then `server.close()` → exit 0
- Redis failures are **non-fatal**; clients log a message and the server continues (see `redis.service` `retryStrategy` stopping after 3 attempts)

---

## 10. Key Gotchas

1. **`req.user.id` vs driver record `id`**: In `completeRide`, the controller looks up `drivers.id` by `drivers.user_id = req.user.id` before matching `driver_id`. In other handlers (e.g. `updateRideStatus`), it matches `driver_id = req.user.id` directly — **inconsistent**. Use the users' actual driver record `id` for ride ownership.
2. **Two wallet implementations**: active module is `src/wallet/`; `src/routes/wallet.routes.js` + `src/controllers/wallet.controller.js` are stale.
3. **Two `.env` files**: `backend/.env` (used) and `backend/src/.env` (stale duplicate).
4. **Dev-mode skips important checks** — ensure `NODE_ENV` is correct before deploying.
5. **OSRM optional**: if OSRM is unreachable, fare/distance fall back to client values or 0; the client should not assume a fare was calculated server-side.
6. **Frontend WebSocket before login**: the rider app's `RootNavigator` calls a socket hook unconditionally; if no/expired token exists in AsyncStorage, the backend rejects with `Authentication required`. The frontend should gate socket connection on an authenticated session (the driver app already does via a token check).