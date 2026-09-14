# RideWay Backend — CONTEXT

Maintains the single source of truth for the backend project and the ongoing
Modular Monolith refactor. Update this file whenever scope, structure, or
decisions change.

---

## Project Overview

RideWay is an on-demand ride-hailing platform. This directory contains the
**backend** (`backend/`), an Express + Socket.IO API server that provides
ride-matching, driver management, wallet, and realtime ride events a the mobile
apps (rider app + driver app).

Entry point: `backend/src/server.js`
Base URL: `http://localhost:3000/api/v1`

---

## Tech Stack

| Concern | Technology |
|---------|-----------|
| Runtime | Node.js (v24), CommonJS (`require`) |
| API framework | Express 5 |
| Database | Supabase (PostgreSQL + PostGIS) via `@supabase/supabase-js` |
| Realtime (app clients) | Socket.IO v4 (`socket.io`) |
| Inter-process messaging | Redis Pub/Sub (`ioredis`) |
| Geospatial cache | Redis Geo (`GEOADD` / `GEORADIUS`) |
| File uploads | Multer (in-memory) → Supabase Storage |
| Authentication | Supabase Auth (JWT bearer tokens) |
| Routing/fares | OSRM (optional; falls back to client values) |
| Logging | Console (`winston` installed but not configured) |

---

## Architecture Decisions

1. **Modular Monolith.** The codebase is being reorganized from a
   layer-based layout (`routes/`, `controllers/`, `services/`, `config/`) into
   feature-based modules. The runtime stays a single deployable process.
2. **Modules own their vertical slice.** Each module (`driver`, `ride`,
   `matching`, `wallet`, `notification`) contains its own routes, controller,
   and service, and exposes only its public API through a module `index.js`.
3. **`core/` holds cross-cutting infrastructure only.** Config, middleware,
   database, redis, and socket setup live in `core/`. `core/` must not contain
   ride or driver business logic.
4. **`shared/` reserved for generic reusable utilities** (future phases).
5. **Modules import each other only through their `index.js`** (avoid deep
   imports).
6. **Reorganization is behavior-preserving.** The refactor may not change any
   request/response format, database schema, Redis key, Socket.IO event, or
   business logic.

---

## Coding Standards

- CommonJS `require` / `module.exports` (no ES modules).
- Files named `*.js` with a layer suffix convention:
  `*.routes.js`, `*.controller.js`, `*.service.js`, `*.middleware.js`.
- Route handlers live in controllers; database/Redis/3rd-party access lives in
  services.
- Error responses use the shape `{ "error": "Human-readable message" }`.
- Protected routes apply `protect` from `core/middleware/auth.middleware.js`.
- No code comments unless they add context (existing files may already have
  section comments — preserve them).

---

## Folder Structure (current)

```
backend/
├── .env                      # env config (Supabase, Redis, PORT, NODE_ENV, OSRM)
├── package.json              # start / dev scripts
├── supabase_schema.sql       # DB schema, types, functions, RLS, triggers
├── architecture.md           # legacy architecture notes
├── CONTEXT.md                # this file
└── src/
    ├── app.js                # Express app: middleware + route mounting
    ├── server.js             # HTTP bootstrap, socket init, graceful shutdown
    ├── core/                 # cross-cutting infrastructure (no business logic)
    │   ├── database/supabase.js          # supabase + supabaseAdmin clients
    │   ├── logger/logger.js              # winston structured logger + correlation/ALS
    │   ├── middleware/auth.middleware.js # protect() JWT verification
    │   ├── middleware/correlation.middleware.js # x-correlation-id / trace id per request
    │   ├── middleware/upload.middleware.js # multer memory storage config
    │   ├── redis/redis.js                # legacy ioredis client
    │   ├── redis/redis.service.js        # centralized Redis (geo, state, queue, locks, pub/sub)
    │   └── socket/socket.js              # Socket.IO server + auth handshake
    └── modules/             # feature-based modules
        ├── driver/          # index.js, driver.routes/controller/service/repository.js
        ├── ride/            # index.js, ride.routes/controller/service/repository.js
        ├── matching/        # index.js, matching.service/repository.js + pipeline helpers
        ├── wallet/          # index.js, wallet.routes/controller/repository.js
        └── notification/    # index.js, notification.service.js
```

Future (later phases): `shared/`, `workers/`, and modules for `auth`, `rider`,
`maps`, `profile`, `admin`.

---

## Current Phase

**Phase 1: Folder reorganization — COMPLETE**

- Moved layer-based files into feature modules under `modules/` and
  infrastructure into `core/`.
- Added `index.js` public-API files per module.
- Inlined route mounting into `app.js` (replaced `routes/index.js`).
- Fixed all `require` paths; verified `node --check` on every file, server
  boots, `/health` returns 200, and all API routes are mounted.

**Phase 2A: Repository infrastructure — COMPLETE**

- Added module-colocated `*.repository.js` adapters for `driver`, `ride`, and
  `wallet` (see `docs/implementation-roadmap.md` Phase 2).
- Repositories temporarily delegate to existing service logic (or, for wallet,
  hold the storage calls) — no behavior change, no services/controllers touched.
- Repositories exported through each module's `index.js`.
- Phase 2B (not started): migrate persistence from services/controllers into
  repositories and invert the `Service → Repository` dependency.

**Phase 2B: Ride repository migration — COMPLETE**

- Migrated **all** Ride persistence into `src/modules/ride/ride.repository.js`:
  Redis (ride request buffer, driver availability, offer queue, lock, pub/sub)
  and Supabase (`rides`, RPC `accept_ride`, rider name lookup).
- `ride.service.js` now contains business logic only and invokes the repository;
  `ride.controller.js` invokes the service — no controller/service touches
  storage directly. Flow: `Controller → Service → Repository → Supabase/Redis`.
- Behaviors preserved exactly (same queries, error messages, lock handling,
  Redis keys, responses). Driver/Wallet modules untouched.

**Phase 2C: Driver repository migration — COMPLETE**

- Migrated **all** Driver persistence into `src/modules/driver/driver.repository.js`:
  Supabase (`drivers`, `profiles`, `driver_documents`, Storage `kyc-documents`)
  and Redis (availability/location/status: `setDriverLocation`,
  `setDriverOnline`, `setDriverOffline`, `getNearbyDrivers`).
- `driver.service.js` now contains business logic only and invokes the
  repository; `driver.controller.js` invokes the service (its direct
  `redisService` calls were moved behind the service). Flow:
  `Controller → Service → Repository → Supabase/Redis`.
- Behaviors preserved exactly (same queries, responses, validation, online/
  offline and location semantics). Ride/Wallet modules untouched.

**Phase 3: Matching module extraction — COMPLETE**

- Created `src/modules/matching/` as a feature module owning the ride-matching
  pipeline: `matching.constants.js`, `matching.repository.js`,
  `candidate-finder.js`, `candidate-ranker.js`, `offer-dispatcher.js`,
  `acceptance-manager.js`, `matching.service.js`, `index.js`.
- Moved all matching persistence out of `ride.repository.js` into
  `matching.repository.js`: Redis (ride request buffer, driver availability,
  offer queue, lock, pub/sub) and Supabase (RPC `accept_ride`, rider name
  lookup). `ride.repository.js` keeps ride lifecycle only (get/status/complete/
  cancel/history).
- `matching.service.js` orchestrates the pipeline (business logic only):
  `createRideRequest` (buffer write → candidate discovery → rank → dispatch
  offers) and `acceptRide` (lock → RPC → cleanup). Helper modules split the
  pipeline: `candidate-finder` (geo + vehicle_type filter),
  `candidate-ranker` (identity today, ranking slot reserved),
  `offer-dispatcher` (queue + pub/sub), `acceptance-manager` (lock + RPC).
- `ride.service.js` keeps ride lifecycle and delegates `createRideRequest` /
  `acceptRide` to `matchingService` through the module `index.js` (no deep
  imports). Controller, routes, API shapes, Redis keys, Socket.IO events, and
  error messages unchanged.
- Flow: `Ride Controller → Ride Service → Matching Service → Repositories →
  Redis/Supabase`. Wallet module untouched.

**Phase 4: Wave dispatch (2-driver waves + 10s individual offers) — COMPLETE**

- Offer policy changed from broadcast-to-all to max-2-driver waves in
  nearest-first order (`wave-dispatcher.js`: `createWaves`/`startWaves`/
  `dispatchWave`/`advanceWaveIfNeeded`/`cancelWaveOffers`). Discovery, radius
  (3000m), vehicle_type filter, ranking (identity), pricing, state machine,
  Redis lock + `accept_ride_atomic` acceptance authority all unchanged.
- Per-driver 10s offer state in Redis (`ride:wave:<id>`, `ride:offer:<id>`,
  same 120s TTL as `ride:request:<id>` which remains the global lifetime).
  Server re-validates offer + buffer on accept; client countdown display-only.
- New `POST /rides/:rideId/reject` (decline = offer inactive, never cancels
  the ride) and `ride:offer_cancelled` socket event to `driver:<id>` rooms;
  `ride:request` still carries the per-wave driver subset. Tests:
  `test/wave-dispatcher.test.js` (10 tests).

---

## Constraints

Applies to the current and all future phases:

- **No API changes** — every endpoint must keep its exact method, path, request
  body, and response format.
- **No Redis key changes** — keys like `drivers:online`, `driver:<id>`,
  `ride:request:<id>`, `ride:offers:<id>`, `ride:lock:<id>`, `wallet:<id>`
  are fixed.
- **No DB schema changes** — `supabase_schema.sql` is the schema source of truth.
- **No Socket.IO event changes** — e.g. `ride:request`, `ride:accepted`,
  `ride:status_changed`, `ride:cancelled`, `wallet:updated`, `wallet:low_balance`.
- **No business logic changes** — controllers, services, validation, and
  matching logic are preserved.
- **No breaking changes** — the backend must compile and run after every step.

---

## Current TODOs

- [ ] Populate remaining module targets as features mature: `auth`, `rider`,
      `maps`, `profile`, `admin`.
- [ ] Create `shared/` for generic reusable utilities (utils, constants,
      validators, helpers) — future phase.
- [ ] Create `workers/` for background workers — future phase.
- [x] Matching module extraction (Phase 3) — COMPLETE.
- [ ] Wallet persistence migration — future phase.
- [ ] Event bus abstraction — future phase.
- [ ] Ride-matching redesign — future phase.
- [x] Ride flow instrumentation — COMPLETE (correlation/trace ids, lifecycle stage
      + failure logs, Redis/socket debug logs; see `docs/ride-flow-investigation.md`).
      Investigation output: `logs/rideway.log`.