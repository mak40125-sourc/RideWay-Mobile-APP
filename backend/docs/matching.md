# Velos Ride Matching — Architecture (RFC)

Status: DRAFT — source of truth for future matching implementation.
Applies to: the Modular Monolith backend (`backend/`).

This document defines the **next-generation ride dispatch architecture**. It is
architecture only: no JavaScript, no pseudocode, no Express routes, no Redis
commands, no SQL. An implementation team must be able to build the entire
matching engine from this document without further architectural questions.

This design is constrained by the rules in `CONTEXT.md`:

- One Express application, one PostgreSQL database, one Redis instance, one
  Socket.IO server. No microservices, no Kafka, no RabbitMQ.
- **No API changes**, **no Redis key changes**, **no DB schema changes**, **no
  Socket.IO event changes**, **no business-logic semantics changes**.
- Backend must remain a single deployable process.

Wherever this document names a concept that maps onto an existing storage key or
event, it uses the exact existing name so implementation can be behavior-faithful.

---

## 1. Overall Architecture

### 1.1 Mental model

The backend is the **single source of truth** for all ride and driver state.
Apps (rider app and driver app) are thin clients: they issue commands over HTTP
and receive notifications over Socket.IO. They never decide outcomes.

Matching is deterministic given the same inputs and the same durable state. It
is driven by a small set of **workers** that reconcile intent with reality, so
every failure mode converges back to a consistent state.

### 1.2 Components

| Component | Responsibility |
|-----------|----------------|
| HTTP API (Express) | Entry points for app commands: request ride, accept, status update, cancel, going online/offline, location pings. Validates input, delegates to repositories/services. |
| Socket.IO | Delivers **notifications** to connected app clients via rooms (`driver:<id>`, `rider:<id>`). Never stores state, never decides outcomes. |
| Ride Module | Owns the ride vertical slice: ride request creation, ride state transitions, ride queries, ride lifecycle policy. |
| Driver Module | Owns the driver vertical slice: driver profile, driver online/offline state, driver availability, driver queries. |
| Matching Module | Owns the matching vertical slice: candidate discovery, ranking, offer creation, offer acceptance policy, assignment, reconciliation. Depends on Ride + Driver public APIs. |
| Notification Module | Bridges state changes to Socket.IO push events. |
| Wallet Module | Owns wallet balances and transactions (commission deduction on completion). |
| Maps Module | Gross-trip routing/fare estimation via OSRM (optional; falls back to client values). |
| Matching Worker | Long-running job that drives offer dispatch and timeouts. |
| Cleanup Worker | Long-running job that expires stale offers/rides, revokes locks, recollects aborted rides. |
| Heartbeat Worker | Long-running job that tracks driver presence and marks stale drivers unavailable. |
| Repositories | Sole owners of storage access (PostgreSQL + Redis). Services and controllers never touch storage directly. |
| Redis | Fast, ephemeral coordination state: availability index, in-flight matching buffers, locks, pub/sub fan-out, worker-state de-dup. |
| PostgreSQL | Durable source of truth for rides, drivers, wallets, and any event that must survive a restart. |

### 1.3 Responsibility boundaries

- **Ownership:** PostgreSQL owns durable truth. Redis owns *ephemeral, rebuildable
  coordination state*. Socket.IO owns *delivery of notifications only*.
- **Direction of dependency:** HTTP → Controllers → Services → Repositories.
  Controllers contain no business logic. Services contain business rules and call
  repositories. Repositories are the only code touching storage or pub/sub
  primitives.
- **Modules talk through public `index.js` APIs** — never through deep imports.
  The Matching Module builds on the Ride and Driver modules' public APIs.

### 1.4 Why the source of truth is the backend

A ride must survive a driver's app crash, a rider's network drop, or a full
Redis flush. Distributed clients are unreliable by definition. Only a durable,
single-writer system can guarantee that (a) a ride exists, (b) its state is
unambiguous, and (c) every actor observes the same transition. The backend
(backed by PostgreSQL) is that single-writer system.

---

## 2. Ride Lifecycle

### 2.1 Canonical states

The system reasons about one canonical set of states. Persistence maps them onto
existing storage fields without adding schema.

| State | Meaning | Who transitions | When / Why |
|-------|---------|-----------------|------------|
| REQUESTED | Rider intent received; not yet broadcast. | Ride.Server on `POST /rides/request` | The first thing recorded after input validation. Isolated from the rest of the system so a rider can build a ride before matching begins. |
| SEARCHING | Ride is being broadcast to candidates; awaiting an offer/accept. | Matching.Worker | After candidates are discovered and the offer window opens. This is the "look for a driver" state. |
| OFFER_SENT | The designated candidate pool has received the push for this ride. | Matching.Worker | One step after SEARCHING; semantically "drivers have been told about this ride." Each candidate's *individual* offer record lives in Redis (see §6). |
| ASSIGNED | A single driver is committed to the ride. All other offers are withdrawn. | Matching.Worker on accept (atomic) | Exactly one driver won the accept race; ride is now paired. |
| ARRIVING | Assigned driver is en route to pickup. | Ride.Server via status update | Driver communicates `DRIVER_ARRIVING`. |
| STARTED | Trip in progress (pickup done). | Ride.Server via status update | Driver communicates `RIDE_STARTED`. |
| COMPLETED | Trip finished; terminal success. | Ride.Server via status update / completion | Fare settlement + commission deduction finalize here. |
| CANCELLED | Trip aborted; terminal. | Ride.Server via cancel command, or Cleanup.Worker on timeout/policy | Rider or policy cancelled an un-completed ride. |
| EXPIRED | No driver committed before the offer window closed. | Cleanup.Worker | Terminal; derived when the ride's Redis buffer expires without an ASSIGNED. |

### 2.2 Persistence mapping (no schema change)

Existing DB ride statuses and Redis ride buffers are the transport for these
canonical states:

- `REQUESTED`, `SEARCHING`, `OFFER_SENT` map to the existing `REQUESTED` /
  `SEARCHING_DRIVER` status family and live primarily in the Redis ride buffer
  (`ride:request:<id>`) with the existing 120s TTL.
- `ASSIGNED` maps to `DRIVER_ASSIGNED`.
- `ARRIVING`, `STARTED`, `COMPLETED` map to `DRIVER_ARRIVING`, `RIDE_STARTED`,
  `RIDE_COMPLETED`.
- `CANCELLED` maps to `CANCELLED`.
- `EXPIRED` is **derived**, not stored: when the Redis buffer for a ride TTLs
  out with no `ASSIGNED`, the ride is treated as expired for any late actor.

### 2.3 State-machine rules

- No state may skip a legal predecessor without an explicit compensating action.
- `ASSIGNED` is enterable **only** through the atomic accept critical section
  (§4.5). It is the system's commit point.
- `CANCELLED` is allowed from any non-terminal pre-assignment state
  (`REQUESTED`, `SEARCHING`, `OFFER_SENT`) or post-assignment pre-completion
  (`ASSIGNED`, `ARRIVING`, `STARTED`), subject to policy (rider/driver who-wins).
- `COMPLETED`, `CANCELLED`, `EXPIRED` are terminal. No further transitions.
- The state transition history is an append-only audit trail in PostgreSQL
  (durable), so any actor can reconstruct *why* a ride reached its current
  state.

---

## 3. Driver Lifecycle

### 3.1 Canonical states

| State | Meaning | Where tracked | Transition triggers |
|-------|---------|---------------|---------------------|
| OFFLINE | Driver signed out; not discoverable. | Redis (absence from availability index) + driver config in PostgreSQL. | Explicit offline command, explicit disconnect, or availability expiry. |
| AVAILABLE | Driver online and discoverable for matching. | Redis availability index (`drivers:online`) + `driver:<id>` hash + heartbeat. | Online command; location ping while AVAILABLE. |
| RESERVED | Driver has been pre-paired with an offered ride but has not accepted. When using the announce-then-accept model, offered drivers are airborne, not yet reserved. | Redis per-offer records (`ride:offers:<id>`); a driver may appear in multiple offer sets. | Dedicated offers only. In the broad-cast model this state is short-lived/absent. |
| ON_TRIP | Driver committed to an active ride (from ASSIGNED and across ARRIVING/STARTED). | PostgreSQL ride ownership + Redis driver marker. | On ASSIGNED when `driver_id` is committed. |
| BREAK | Driver intentionally paused; online but not receiving offers. | Redis driver hash flag. | Driver pause command. |

### 3.2 Transition rules

- A driver goes **AVAILABLE** only when online with a verified profile and valid
  wallet balance (per existing policy). The maintenance workers and the online
  command enforce the same gate, so a stale entry cannot be resurrected wrongly.
- A driver in **ON_TRIP** must not receive new offers.
- A driver may be **RESERVED** for zero or, in the broad-cast model, multiple
  rides while **AVAILABLE**; assignment is single.
- Any **availability entry older than the heartbeat window** with no recent ping
  is reverted to **OFFLINE** by the Heartbeat/Cleanup workers — the durable DB
  driver config decides whether the driver may come back later.
- **Driver online state is also mirrored durably** so that on backend restart the
  system knows which drivers *should* be online and re-seeds their availability
  (§10).

---

## 4. Matching Flow

### 4.1 High-level pipeline

```
Ride Request → Validate → Durable Persist → Candidate Discovery
    → Ranking → Offer (broadcast) → Offer Window (timer)
    → Accept (atomic) → Assignment → Notify both parties
    → Arrival → Completion (settle)
```

### 4.2 Ride request

1. Rider sends a request over HTTP.
2. Ride Module validates input (pickup, dropoff, vehicle type, fare inputs).
3. The ride is written to PostgreSQL first (durable intent, state
   `REQUESTED`). Only after a successful durable write does matching begin.
4. The ride enters Redis state as `REQUESTED`/`SEARCHING` with the existing
   `ride:request:<id>` key and the existing 120s TTL, beginning the offer window.

### 4.3 Candidate discovery

- Coordinates come from the request; the Maps Module may enrich distance/fare via
  OSRM but must not be a hard dependency (falls back to client values).
- The Matching Worker queries the availability index (`drivers:online` via the
  existing geo structure) for nearby **AVAILABLE** drivers of the requested
  vehicle type, excluding any in **ON_TRIP** or **BREAK**.
- Discovery is best-effort and repeatable; the worker may re-run discovery within
  the offer window to fill the candidate pool (candidate churn recovery).

### 4.4 Ranking

- Candidates are ranked deterministically: primary key is **distance** to pickup;
  secondary keys are **availability freshness** (recent heartbeat) and a stable
  **driver id** tie-breaker so ordering does not flap between scans.
- Ranking does not depend on wall-clock time or connection state of the client
  (a driver's socket being down does not change their rank — it changes whether
  they can act, which is handled by timeouts).

### 4.5 Offer and the atomic accept critical section

- The ranked candidate list is written to the offer set `ride:offers:<id>`
  (existing key) alongside the ride buffer.
- The Matching Worker broadcasts `ride:request` to the candidate driver sockets
  via Socket.IO (Notification Module), on the existing event.
- **The accept is serialized by a lock.** Accept uses an atomic "set if not
  exists and holds owner identity" primitive on the existing `ride:lock:<id>`
  key. Exactly one accept wins; losers are told the ride is already claimed.
- On a successful lock acquisition, the worker:
  1. Re-reads the ride buffer under the lock (does it still exist? still not
     ASSIGNED? still within TTL?).
  2. Atomically transitions the ride to **ASSIGNED** in PostgreSQL with the
     winning `driver_id`.
  3. Deletes the Redis ride buffer and offer set, and commits the lock release.
- Step 2 is the commit point. Everything before it can be rolled back; after it,
  assignment is durable and both parties are notified (`ride:accepted` to the
  rider room, withdrawal to all other candidates).

### 4.6 Arrival and completion

- The assigned driver reports `DRIVER_ARRIVING`, then `RIDE_STARTED`, then
  `RIDE_COMPLETED` via status updates against their own `driver_id`.
- On completion, the Wallet Module deducts commission (existing policy) and the
  ride is settled. State becomes **COMPLETED**.
- Status updates are validated against the owning `driver_id` so no other driver
  can mutate the trip.

---

## 5. Matching Worker

### 5.1 Responsibilities

- Drive the per-ride offer window: discover, rank, broadcast, and then enforce
  timeouts.
- Isolate each ride's lifecycle from the request handler so HTTP quickness is not
  coupled to matching progress.
- Reconcile Redis coordination state so stale offers/rides converge to a terminal
  state.
- If a single backend instance, own all matching work on fixed ticks; if the
  design later uses multiple workers on the same instance, use distributed locks
  to guarantee one winner per ride.

### 5.2 Polling frequency

- Worker ticks are **high frequency for liveness** (e.g. seconds) and driven by a
  fixed interval, not by ad-hoc timers per ride.
- Each tick is idempotent: it scans for rides that (a) need (re)broadcast, or
  (b) have outlived their offer window, and acts only on those.

### 5.3 Failure recovery

- Ticks are stateless with respect to in-memory progress; recovery seeks durable
  state, not memory.
- If a tick crashes midway, the next tick re-scans from PostgreSQL/Redis and
  converges. No tick depends on the previous tick's memory.

### 5.4 Timeout handling

- Each ride has a fixed offer window (the existing 120s Redis TTL is the upper
  bound).
- When the window elapses with no **ASSIGNED**:
  - The ride is marked **EXPIRED** (by the Cleanup Worker on the TTL expiry, or
    by the Matching Worker at the deterministic deadline).
  - The rider is notified that no driver was found.
  - All candidate offers are withdrawn.
- **Deadline is computed from a durable timestamp**, not the TTL alone, so a
  Redis flush or restart cannot silently extend or retract the window.

### 5.5 Retry logic

- **Faults → retry with backoff.** TypeError/storage failures retry up to a bound,
  then escalate to the ridden-trip recovery (Cleanup Worker).
- **Deterministic timeouts → no blind retry.** A ride that is genuinely expired
  is not retried for matching; a *re-request* creates a new ride.

---

## 6. Redis Responsibilities

Redis is the **ephemeral coordination layer**. It is intentionally *not* the
source of truth; everything in Redis can be rebuilt from PostgreSQL.

| Concern | Storage | Notes |
|---------|---------|-------|
| Driver availability index | `drivers:online` (existing geo set) | POSIX/geo membership; rebuilt on restart from durable driver config + heartbeats. |
| Driver live state (status, rideType, vehicle, onlineSince, lastSeen) | `driver:<id>` (existing hash) | Ephemeral presence; expiry implies OFFLINE. |
| Ride in-flight buffer | `ride:request:<id>` (existing hash) | Non-terminal matching state; 120s TTL. |
| Offer (candidate) set | `ride:offers:<id>` (existing set) | Candidate driver pool for a ride; TTL with the ride buffer. |
| Distributed accept lock | `ride:lock:<id>` (existing string) | Serializes the accept; owner identity stored; 10s TTL. |
| Pub/sub fan-out | existing `ride:notifications` channel | Broadcasts matching/settlement events to the Notification Module. |

### 6.1 TTL strategy

- Every ride-lifetime key shares one deadline, derived from the durable ride
  timestamp, so no key outlives the window on its own.
- Lock TTL is short (10s) and always released explicitly; expiry is only a safety
  net. Owner identity must be checked before any release to avoid releasing
  another actor's lock (guard against a slow previous owner).

### 6.2 Heartbeat strategy

- Online drivers refresh `lastSeen` (and geo membership) via location pings.
- The Heartbeat Worker marks any `driver:<id>` with `lastSeen` older than the
  window as offline: it removes it from `drivers:online` and the hash.
- Heartbeat freshness is a **liveness signal only**; durable driver identity
  remains in PostgreSQL.

### 6.3 Recovery after restart

- At startup the backend reads durable "should be online" driver config from
  PostgreSQL and re-seeds Redis availability for those drivers (subject to the
  heartbeat window — a driver not seen in too long stays offline until it pings
  again).
- Ride buffers, offer sets, and locks are **not** reconstructed from memory;
  they are rebuilt by the Matching/Cleanup workers from the durable `SEARCHING`
  state (see §10).

---

## 7. PostgreSQL Responsibilities

PostgreSQL is the **source of truth**. It owns:

- **Ride rows** and ride state, the assigning `driver_id`, timestamps, fares,
  route references, and an append-only state-history audit trail.
- **Driver records** and durable availability config (whether a driver *may* be
  online, a verified profile, wallet-eligibility gating).
- **Wallet** balances and transactions (all financial truth).
- Anything that must survive a backend restart, a Redis flush, or a client
  reconnect.

### 7.1 What must never be stored in Redis long-term

- A ride's authoritative status after **ASSIGNED** — the commit point lives in
  PostgreSQL.
- Financial records, commission, balances.
- Driver identity and KYC/wallet eligibility.
- Completed trip history and the audit trail.

Redis holds only *recoverable, short-lived, per-flight coordination state*.

---

## 8. Socket.IO Responsibilities

**Socket.IO is notification only. It is never the source of truth.**

- Socket.IO delivers events (e.g. `ride:request`, `ride:accepted`,
  `ride:status_changed`, `ride:cancelled`) to app clients by room
  (`driver:<id>`, `rider:<id>`).
- Socket.IO does **not** store ride or driver state, does not decide who wins an
  accept, and its connection state is not used to derive business truth.

### 8.1 Why

- A socket can disconnect at any moment; deriving truth from connection state
  makes the system non-deterministic and un-recoverable.
- State that depends on a live socket cannot be reconstructed after a restart
  and cannot be replayed to a reconnecting client.
- Role: Socket.IO is the **delivery mechanism**; Redis pub/sub + PostgreSQL are
  the **authority**. The Notification Module subscribes to authoritative events
  and pushes them; it never originates a business decision.

---

## 9. Failure Scenarios

| Scenario | Expected behavior |
|----------|-------------------|
| **Driver disconnect** | Presence expires via heartbeat → driver becomes OFFLINE/removed from availability. Any in-progress *offers* are unaffected (they time out). An *ASSIGNED* ride is NOT un-assigned by disconnection; the driver reconnects and the ride resumes. |
| **Rider disconnect** | The ride remains in durable state. If not yet ASSIGNED and the window elapses, it EXPIRES. If ASSIGNED before the rider goes offline, the ride continues; the rider reconnects and receives status via a state-sync on connect. |
| **Redis restart** | Coordination state is rebuilt from PostgreSQL (§10). Rides in `SEARCHING` resume; no ride is lost or wrongly completed because Redis never held authoritative assignment. |
| **Backend restart** | Matching/Cleanup/Heartbeat workers re-seed and reconcile from PostgreSQL (§10). `SEARCHING` rides resume; stale offers/locks are swept. |
| **Driver app crash** | Same as disconnect: presence expiry. Open offers time out for them; an ASSIGNED ride stays theirs and resumes on reconnect. |
| **Rider app crash** | Durable ride persists; on reconnect the app pulls current ride state; worker expiry/timeout rules still apply. |
| **Offer expires** | Worker marks ride EXPIRED if not ASSIGNED, withdraws offers, notifies rider. Candidate drivers are released. |
| **Two drivers accept simultaneously** | The lock serializes them. Exactly one acquires and commits ASSIGNED. The other receives "already claimed". No duplicate rides. |
| **Driver loses internet** | Position pings stop → heartbeat expiry → OFFLINE. If mid-trip, the ride is preserved; reassignment/abandon policy applies (a never-completed ASSIGNED ride that stalls is escalated to the Cleanup Worker). |
| **Backend crashes during assignment** | The accept is built to be re-runnable: the durable assignment in PostgreSQL is only written once (idempotent). If crash occurs before the write, the winner loses the lock and the ride returns to SEARCHING for the next tick; if after the write, the ride is ASSIGNED and reconciliation confirms it. No partial/duplicate assignment. |

Every scenario converges to a state that is *either* in PostgreSQL or directed by
a worker toward it — never a state that existed only in one client's memory.

---

## 10. Recovery Strategy

1. **On boot**, the backend:
   - Reconnects Redis and re-initializes pub/sub.
   - Re-seeds driver availability from durable DB config (subject to heartbeat
     window).
   - Restarts the Matching, Cleanup, and Heartbeat workers.
2. **Resume searching rides**: The Matching Worker re-scans PostgreSQL for any
   ride still in a matching (`REQUESTED`/`SEARCHING`/`OFFER_SENT`) state and
   re-creates its Redis buffer/offer set, re-opening a bounded offer window based
   on the durable deadline — never extending it indefinitely.
3. **Clean stale offers**: The Cleanup Worker removes offer sets and ride buffers
   whose durable deadline has passed. Expired/never-assigned rides are finalized
   as **EXPIRED** and the rider is notified once.
4. **Recover locks**: Locks are ephemeral and identify their owner. On restart
   the Cleanup Worker treats orphaned locks (whose owning actor is gone) as
   releasable after age, and any ride that is `SEARCHING` with a stale lock is
   re-entered for matching. Since ASSIGNMENT is durable in PostgreSQL, a real
   assignment is never undone by a stale lock cleanup.
5. **Replay to reconnecting clients**: On connect, the client may request current
   state; the backend returns durable state, so a reconnected app converges to
   truth even if it missed a live push.

The invariant under recovery: **no client state is required to converge**; every
reconstructable artifact derives from PostgreSQL.

---

## 11. Repository Responsibilities

The Repository layer (a future phase per `CONTEXT.md`) is the **only** owner of
storage access. It is introduced in this design so that services never touch
PostgreSQL or Redis directly.

| Repository | Data owned | Storage |
|------------|------------|---------|
| Ride Repository | Ride rows, ride states, state-history audit trail, ride queries. | PostgreSQL |
| Driver Repository | Driver records, durable availability config, KYC/wallet-gating reads. | PostgreSQL |
| Redis State Repository | Availability index, `driver:<id>` presence, ride buffers, offer sets, locks, pub/sub publishes. | Redis |
| Matching State Repository | Orchestrates coordinated reads/writes across ride + driver state for a single matching decision; enforces the accept critical section. | PostgreSQL + Redis (transactional intent) |
| Wallet Repository | Balances, transactions, commission deductions. | PostgreSQL |

Rule: a repository is the sole path to storage for its domain. Services call
repositories; repositories never contain business rules beyond data-shape
integrity.

---

## 12. Module Responsibilities

| Module | Single responsibility |
|--------|-----------------------|
| Ride Module | Own the ride lifecycle: request intake, state transitions, ride queries, assignment commit, settlement. Exposes `requestRide`, `accept`, `updateStatus`, `complete`, `cancel`, `getRide`. |
| Driver Module | Own driver data and availability: profile, online/offline, presence, location, gating. Exposes driver commands and queries. |
| Matching Module | Own matching: candidate discovery, ranking, offer window, accept serialization, reconciliation, timeout policy. Consumes Ride + Driver public APIs. |
| Notification Module | Own push delivery: subscribes to authoritative state events and emits Socket.IO notifications. No business decisions. |
| Wallet Module | Own balances, transactions, commission settlement on completion. |
| Maps Module | Own routing/fare estimation (OSRM) with graceful fallback. None of matching depends on it being available. |

Cross-cutting: `core/` owns shared infrastructure (database, redis, socket,
middleware). Bootstrapping workers is orchestrated at the application level, not
inside any single feature module.

---

## 13. Workers

Every worker is long-running, idempotent, and re-scans durable state each tick so
no per-tick memory is required.

| Worker | Responsibilities (no implementation) |
|--------|---------------------------------------|
| Matching Worker | Re-scan rides needing broadcast; discover + rank + broadcast offers; enforce the offer window; re-enter unassigned searching rides after failures; update ride to EX PIRED at the deterministic deadline. |
| Cleanup Worker | Sweep expired ride buffers/offer sets; finalize EXPIRED; orphaned-lock recovery; collect and finalize stalled ASSIGNED trips (runaway completion); backfill/reconcile any ride/state drift. |
| Heartbeat Worker | Scan presence (`drivers:online`, `driver:<id>` lastSeen); revert stale drivers to OFFLINE; remove stale geo members. |
| Analytics Worker | (optional, future) Aggregate ride/state/decision events into counters for observability; never mutates ride state. |

---

## 14. Sequence Diagrams

### 14.1 Ride request

```
Rider App        HTTP(S)         Ride Module        Matching Worker        Redis          PostgreSQL
   │   POST /rides/request  │         │                  │                │                 │
   │──────────────▶│         │         │                  │                │                 │
   │                │ validate │         │                  │                │                 │
   │                │──────────────────────▶ insert ride (REQUESTED) │                 │
   │                │◀────────────────────────────────────────────────────────│
   │                │   enqueue ride id  │                 │                │                 │
   │◀── ride id/candidateCount ───────────────────────────────────────────────│
   │                │         │              (tick) discover+rank candidates   │
   │                │         │──────────────── form     write ride buffer      │▶  Redis
   │                │         │────────────────           write offer set       │▶  Redis
```

### 14.2 Driver accept

```
Driver App        HTTP(S)        Ride Module / Matching         Redis (lock)          PostgreSQL
   │ POST /rides/:id/accept     │            │                      │                     │
   │──────────────▶│            │            │   acquire lock (owner=driver)               │
   │                │──────────────────────────────▶ SET lock (EX 10 NX)                    │
   │                │◀─────────────────────────────── ok/claimed                             │
   │                │       (winner) read buffer + verify SEARCHING & in-window               │
   │                │       atomic: transition ride → ASSIGNED (driver_id=X)             │
   │                │────────────────────────────────────────────────────────────▶      write
   │                │◀─────────────────────────────────────────────── assigned ok         │
   │                │       delete buffer, delete offers, release lock                     │
   │◀── ride (200) ────────────────│            │                      │                    │
```

### 14.3 Ride cancel

```
Rider App     HTTP(S)      Ride Module      Notification      PostgreSQL     Redis
   │ cancel │      │            │                 │              │           │
   │───────▶│      │            │                 │              │           │
   │        │      │ validate + policy           │              │           │
   │        │      │────────────────────────────────────────────▶ update CANCELLED
   │        │      │────────────────────────────────────────────▶ clear offer set / buffer
   │        │      │  emit ride:cancelled (rider:<id>)           │
   │        │◀─────│            │                 │              │           │
   │        │      │  notify assigned driver if any               │           │
   │◀─ 200 ─│      │            │                 │              │           │
```

### 14.4 Ride completion

```
Driver App     HTTP(S)      Ride Module       Wallet Module      PostgreSQL     Redis
   │ complete │      │            │                 │              │            │
   │─────────▶│      │            │                 │              │            │
   │          │      │ validate owner (driver_id)  │              │            │
   │          │      │───────────────────────────────────────────▶ set RIDE_COMPLETED
   │          │      │                 deduct commission           │            │
   │          │      │──────────────────▶                         │▶ wallet txn │
   │          │      │  emit ride:status_changed / settle notice   │            │
   │◀─ 200 ───│      │            │                 │              │            │
```

### 14.5 Driver disconnect

```
Driver App        Socket.IO       Heartbeat Worker        Redis            PostgreSQL
   │ disconnect │        │                │                │                 │
   │───────────▶│        │                │                │                 │
   │            │        │  (tick) lastSeen expired        │                 │
   │            │        │─────────────────────────────────▶ remove from availability
   │            │        │                                  │  hash/geo cleared
   │            │        │  (if ASSIGNED ride exists for this driver)          │
   │            │        │──────────────────────────────────────────────────▶ preserve ride
   │   (reconnect, state-sync)                                                │
```

### 14.6 Backend restart

```
Backend                PostgreSQL            Redis              Matching/Cleanup Workers
   │ start │               │                  │                       │
   │       │── re-seed available drivers ────▶│                       │
   │       │── re-init pub/sub ──────────────▶│                       │
   │       │               │                  │   (tick) scan SEARCHING rides
   │       │◀── read SEARCHING rides ───────────────────────────────────│
   │       │               │                  │── rebuild buffers/sets ─▶│
   │       │── read orphaned locks ─────────▶│── sweep stale ──────────▶│
   │       │               │                  │   resume/expire deterministically
```

---

## 15. Architecture Principles (non-negotiable)

1. **The backend owns ride state.** Clients request and observe; they never own
   or decide state.
2. **Apps never own business state.** App memory is a cache, never an authority.
3. **Socket.IO sends notifications only.** It never stores state or decides
   outcomes.
4. **Matching is deterministic.** Given identical durable inputs, matching
   reaches the same outcome; ranking and deadlines are stable.
5. **Services never bypass repositories.** Repository is the sole path to
   storage.
6. **Controllers never contain business logic.** They parse, validate shape,
   call services, respond.
7. **Workers own long-running jobs.** Request handlers do not run offer windows
   or cleanup; workers do, idempotently.
8. **Modules communicate through public APIs (index.js).** No deep imports.
9. **Redis is ephemeral and rebuildable.** Nothing authoritative lives only in
   Redis.
10. **The accept is a single critical section.** Serialized by a lock whose
    owner is verified; the durable `ASSIGNED` write is the commit point.
11. **Every failure converges to durable truth.** No corrective action may
    depend on in-memory state that does not survive a restart.
12. **Idempotency everywhere.** Workers, retries, and accept re-runs never double
    commit.