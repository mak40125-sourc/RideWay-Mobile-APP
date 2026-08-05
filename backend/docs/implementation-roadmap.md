# Velos Backend — Implementation Roadmap (Phases 2–7)

Status: DRAFT — engineering execution plan for the next several weeks.
Applies to: the Modular Monolith backend (`backend/`).
Source of truth: `CONTEXT.md` and `docs/matching.md` (read completely).

This document is **planning only**. It contains no code, no implementations, and
no modifications to existing behavior. It decomposes the backend redesign into
small, independently testable phases that may each be compiled, tested, and
deployed on their own. **No Big Bang refactor.**

Every phase is bound by the non-negotiable constraints from `CONTEXT.md`:

- **No API changes** — every existing endpoint keeps its exact method, path,
  request body, and response format.
- **No Redis key changes** — keys like `drivers:online`, `driver:<id>`,
  `ride:request:<id>`, `ride:offers:<id>`, `ride:lock:<id>`, `wallet:<id>`
  are fixed.
- **No DB schema changes** — `supabase_schema.sql` is the schema source of truth.
- **No Socket.IO event changes** — `ride:request`, `ride:accepted`,
  `ride:status_changed`, `ride:cancelled`, `wallet:updated`,
  `wallet:low_balance`.
- **No business-logic semantics changes** — controllers, services, validation,
  and matching rules are preserved.
- **The backend must compile and run after every step.**

---

## Risk Summary

| Phase | Risk | Rationale |
|-------|------|-----------|
| 2. Repository Layer | 🟢 Low | Changes *where* storage calls live, not storage semantics; pure refactor behind wrapping repositories. |
| 3. Matching Module | 🔴 High | Introduces deterministic accept critical-section, timeout/expiry, and offer lifecycle — highest blast radius over ride state. |
| 4. Background Workers | 🟡 Medium | Long-running idempotent loops and reconciliation; risk of scanning/timing bugs, not of breaking API contracts. |
| 5. Internal Event Bus | 🟡 Medium | New cross-module coupling surface; must not change public Socket.IO event payloads. |
| 6. Observability | 🟢 Low | Additive (`/internal/metrics`, logging, counters); does not modify existing endpoints. |
| 7. Testing Strategy | 🟢 Low | Test-only additions; improves confidence across all previous phases. |

Risk legend: 🟢 Low · 🟡 Medium · 🔴 High.

---

## Phase Template

Each phase below follows the same template:

- **Purpose** — why the phase exists.
- **Goals** — measurable outcomes.
- **Affected modules** — which modules change.
- **Files to create** — new files.
- **Files to modify** — existing files (behavior-preserving).
- **Dependencies** — what must already be in place.
- **Risks** — what could go wrong.
- **Rollback strategy** — how to revert if the phase must be undone.
- **Estimated effort** — complexity (S/M/L) + approximate duration (1 engineer
  FTE). Planning estimates, not deadlines.
- **Acceptance criteria** — must be met before the phase is considered done.

---

## Phase 2 — Repository Layer

### Purpose
Introduce the Repository layer as the sole access path to PostgreSQL and Redis,
so that no service or controller touches storage directly. This is a
behavior-preserving refactor that wraps the existing storage clients.

### Goals
- Single ownership of storage access, ready to support the Matching Module.
- No behavioral change; every API returns identical results.
- Services only call repositories.

### Affected modules
`core/database`, `core/redis`, and every feature module that currently touches
storage (`driver`, `ride`, `wallet`).

### Files to create
- `src/core/repositories/ride.repository.js` — ride rows, statuses, state-history
  audit trail, ride queries. Backed by `supabaseAdmin`.
- `src/core/repositories/driver.repository.js` — driver records, durable
  availability config, KYC/wallet-gating reads.
- `src/core/repositories/wallet.repository.js` — balances, transactions,
  commission settlement.
- `src/core/repositories/redis-state.repository.js` — wraps existing
  `core/redis/redis.service.js` (availability index, `driver:<id>` presence,
  ride buffers, offer sets, locks, pub/sub publishes). No new keys.
- `src/core/repositories/matching-state.repository.js` — coordinated
  transactional reads/writes across ride + redis state for a single matching
  decision; owns the accept critical section (Phase 3 consumes this).

### Files to modify
- `src/modules/driver/driver.service.js` — route storage calls through
  `DriverRepository` / `RedisStateRepository`.
- `src/modules/ride/ride.service.js` and `ride.controller.js` — route storage
  calls through `RideRepository` / `MatchingStateRepository`.
- `src/modules/wallet/wallet.controller.js` — route calls through
  `WalletRepository`.

### Migration strategy
Sequential, one independently-testable switch at a time:
1. Create repositories wrapping existing `supabase`/`redis.service`.
2. Switch **Driver** module to repositories → run tests → deploy.
3. Switch **Ride** module → run tests → deploy.
4. Switch **Wallet** module → run tests → deploy.
5. Introduce `MatchingStateRepository` (empty until Phase 3).

The existing backing clients (`core/database/supabase.js`,
`core/redis/redis.service.js`) are **not** refactored here — they are wrapped.

### Dependencies
None beyond current codebase.

### Risks
- A repository returning subtly different data shapes. Mitigated by wrapping
  existing calls verbatim and relying on integration tests to compare outputs.

### Rollback strategy
Per-module reverts: repoint the module's service to inline storage calls. Since
repositories wrap (not replace) the clients, reverting any single module is
independent and low-risk.

### Estimated effort
Small — 3–4 days.

### Acceptance criteria
- All existing endpoints return byte-identical responses.
- No module service calls `supabase`/`redis.service` directly except through a
  repository.
- `node --check` passes; server boots; `/health` returns 200.
- Existing test suites (if any) and manual smoke checks pass.

---

## Phase 3 — Matching Module

### Purpose
Introduce a dedicated Matching Module that owns candidate discovery, ranking,
offer lifecycle, accept serialization, timeout enforcement, and reconciliation —
as specified in `docs/matching.md` §4 and the matching architecture RFC.

### Goals
- Deterministic candidate ranking.
- Atomic, single-winner accept critical section using `ride:lock:<id>`.
- Durable `ASSIGNED` commit in PostgreSQL.
- Offer-window timeout enforcement with durable deadlines.

### Affected modules
`modules/matching` (new), `modules/ride`, `modules/driver`,
`core/repositories`, `core/events` (when available).

### Files to create
- `src/modules/matching/index.js` — public API export (matching routes are added
  later/guarded; this phase is service-layer only).
- `src/modules/matching/matching.service.js` — orchestrates
  request → search → rank → assign → reconcile pipeline.
- `src/modules/matching/ranking.service.js` — deterministic distance / freshness
  / driver-id ordering (no flap between scans).
- `src/modules/matching/offer.service.js` — candidate discovery, offer set
  (`ride:offers:<id>`) creation, broadcast coordination with Notification Module.
- `src/modules/matching/acceptance.service.js` — the atomic accept critical
  section: lock acquire with owner identity, buffer re-read under lock,
  `ASSIGNED` commit, cleanup, lock release.
- `src/modules/matching/timeout.service.js` — offer-window enforcement from
  durable timestamps; idle/extended rides finalized.
- `src/modules/matching/recovery.service.js` — reconcile/re-enter unassigned
  searching rides; converges to durable truth after failures.

### Files to modify
- `src/modules/ride/ride.service.js` — delegate request/accept orchestration to
  the Matching Module's public API.
- `src/core/repositories/matching-state.repository.js` — implement the critical
  section storage operations.
- `src/modules/notification/notification.service.js` — subscribe to Matching
  events and continue emitting the existing Socket.IO events.

### Dependencies
Phase 2 (repositories), especially `MatchingStateRepository`. Potentially
Phase 5 (event bus) for loose coupling; can be done with direct public-API calls
first and re-wired later.

### Risks
- **High.** Accept race correctness, lock-owner semantics, and timeout/expiry
  edge cases affect live rides. Must be additive: existing endpoints keep
  responding; the new matching engine is exercised, then cut over.

### Rollback strategy
Keep the Matching Module behind a feature toggle; the Ride Module reverts to its
existing inline matching path. Because the module is additive and ride state
remains durable in PostgreSQL, rollback is a toggle flip with no data
migration.

### Estimated effort
Large — 6–9 days (highest risk; include dedicated matching simulation tests).

### Acceptance criteria
- Exactly one winner on concurrent accepts; no duplicate rides.
- `ASSIGNED` writes are committed exactly once (idempotent re-run).
- Timeout/expiry produce deterministic, terminal EXPIRED.
- A backend/Redis restart via the matching path resumes correctly.
- All existing endpoints and Socket.IO events unchanged.

---

## Phase 4 — Background Workers

### Purpose
Move long-running, repeating work out of request handlers into background
workers (as specified in `docs/matching.md` §5/§13), each idempotent and
tick-based.

### Goals
- Offer windows driven by workers, not ad-hoc request timers.
- Stale offers/rides/locks swept deterministically.
- Presence reverted on heartbeat expiry.
- Faults retried with bounded backoff.

### Files to create
- `src/workers/matching.worker.js` — re-scan rides needing broadcast; discover +
  rank + broadcast offers; enforce offer window; re-enter unassigned rides;
  mark EXPIRED at the deterministic deadline.
- `src/workers/cleanup.worker.js` — sweep expired ride buffers/offer sets;
  finalize EXPIRED; orphaned-lock recovery; collect stalled ASSIGNED trips;
  reconcile drift.
- `src/workers/heartbeat.worker.js` — scan presence; revert stale drivers to
  OFFLINE; remove stale geo members.
- `src/workers/analytics.worker.js` — aggregate ride/state metrics for
  observability (never mutates ride state).
- `src/workers/retry.worker.js` — bounded backoff retry of failed operations
  handed off by request handlers/workers.

### Files to modify
- `src/server.js` — start/stop the workers alongside socket init.
- `src/core/repositories/*` — worker storage access.
- `src/core/events/*` (if present) — worker event publishing.

### Dependencies
Phase 2 (repositories). Matching Worker consumes Phase 3 services; sequence
workers first (Matching relies on them), but each worker must itself be
independently testable and gateable.

### Risks
- Worker scanning/timing bugs (double-process, infinite loops). Mitigated by
  idempotency, one-winner-per-ride locks, and tick isolation.

### Rollback strategy
Disable worker startup in `server.js`; the system continues to function on
request-driven paths (degraded) until the fix. High mean-time-to-recover because
matching is already durable.

### Estimated effort
Medium — 4–6 days.

### Acceptance criteria
- Each worker is independently disableable and testable.
- Workers are idempotent across restarts; no double processing.
- Stale offers/rides/locks converge to terminal states within one tick bound.
- Request handlers no longer perform long-running work.

---

## Phase 5 — Internal Event Bus

### Purpose
Provide an in-process event bus so modules publish domain events and subscribe
without direct coupling, formalizing the coordination the Matching/Notification
modules need.

### Goals
- Decouple producers (matching, ride, driver) from consumers (notification,
  wallet settlement, analytics).
- Explicit event catalog and ownership.
- Emits the **same** public Socket.IO events as today; bus is internal only.

### Files to create
- `src/core/events/event-bus.js` — publish/subscribe infrastructure (no
  external broker; the existing Redis pub/sub is used for fan-out between the
  notification bridge and inter-process messaging).
- `src/core/events/events.js` — event catalog/names (internal domain events).

### Event catalog (examples)
- `ride.requested` · `ride.searched` · `ride.offer_sent` · `ride.assigned`
- `ride.arriving` · `ride.started` · `ride.completed` · `ride.cancelled`
- `ride.expired` · `driver.available` · `driver.offline`
Publishers: Matching Module, Ride Module, Driver Module. Subscribers:
Notification Module (→ existing Socket.IO events), Wallet Module (settlement),
Analytics Worker.

### Files to modify
- `src/modules/notification/notification.service.js` — subscribe to internal
  events and emit existing Socket.IO events (payloads unchanged).
- Matching/Ride/Driver services — publish internal events.

### Dependencies
Phase 2/3 (event producers exist).

### Risks
- Change of Socket.IO payloads by accident. Mitigated by a contract test asserting
  the exact public event payload shapes are unchanged.

### Rollback strategy
The bus is internal and additive; producers can fall back to direct calls, and
Notification can revert to subscribing to Redis channels directly.

### Estimated effort
Medium — 3–5 days.

### Acceptance criteria
- Internal domain events loosely couple modules.
- Public Socket.IO events and payloads prove unchanged via contract tests.
- Publish/subscribe is graceful under errors.

---

## Phase 6 — Observability

### Purpose
Give operators visibility into matching health, latency, and failure rates.

### Goals
- Structured logging with correlation IDs.
- Metrics counters for performance and failure.
- An additive operational metrics endpoint, health checks.
- Dashboard guidance.

### Files to create
- `src/core/logger/logger.js` — winston (already installed) structured logger
  with correlation-ID support.
- `src/core/metrics/metrics.js` — counters/gauges (request latency, acceptance
  attempts, assignment successes/failures, timeouts, expired rides, worker tick
  durations, heartbeat staleness).
- `src/core/middleware/correlation.middleware.js` — generate/propagate
  correlation IDs across requests and worker ticks.

### Files to modify
- `src/app.js` — mount additive `/internal/metrics` (operational only, not a
  public API contract; non-breaking per `CONTEXT.md`).
- `src/server.js` — expose requested metrics on shutdown; wire logger.
- Services/workers — capture timing and result counters via the metrics module.

### Metrics to track
- **Performance:** request latency percentiles, worker tick durations, matching
  request → assignment latency.
- **Failure:** acceptance failures, lock contentions, timeouts, expired rides,
  reconciliation sweeps, worker errors.

### Dashboard ideas
- Grafana panels: rides requested vs. assigned vs. expired per minute; offer →
  accept latency; worker tick health; Redis presence staleness; error rate by
  correlation.

### Dependencies
Winston already installed; no new third-party required for logs/counters.
(Optional third-party tracing/collector only if dashboards require scraping.)

### Risks
Low. `/internal/metrics` is additive and does not alter existing contracts.

### Rollback strategy
Unmount `/internal/metrics` and gate logger verbosity; no behavior change.

### Estimated effort
Small — 2–3 days.

### Acceptance criteria
- `/internal/metrics` returns counters without affecting existing routes.
- Structured logs carry correlation IDs end-to-end.
- Startup and shutdown logs are emitted with clear worker/metrics status.

---

## Phase 7 — Testing Strategy

### Purpose
Make the redesign verifiable at every phase and overall.

### Goals
- Fast unit coverage of pure logic.
- Integration coverage over real dependencies.
- Failure/recovery/load/chaos coverage for the matching engine.

### Files to create
- `backend/test/unit/**` — ranking, timeout, state-machine, validation.
- `backend/test/integration/**` — API contract tests (request/response locked),
  repository tests against a temporary database/Redis.
- `backend/test/matching/**` — ride-request → assignment simulation, concurrent
  accepts.
- `backend/test/redis/**` — TTL, heartbeat expiry, buffer/offer lifecycle,
  peer deduping, lock semantics in Redis.
- `backend/test/socket/**` — notification delivery and room targeting.
- `backend/test/failure/**` — disconnect, Redis failure, backend crash injection.
- `backend/test/recovery/**` — restart reconciliation, stale-offer/lock cleanup.
- `backend/test/load/**` — throughput/latency soak of matching endpoints.
- `backend/test/chaos/**` — kill/restart Redis and backend during active matching.

### Suggested test framework
Existing project has no test runner; introduce Jest or Vitest (decision left to
implementation) with Supertest for HTTP, `ioredis-mock`/local Redis, and a
Supabase test project.

### Test types
- **Unit** — deterministic logic in isolation.
- **Integration** — controller/service ↔ repository ↔ real storage.
- **Ride matching** — end-to-end deterministic outcomes.
- **Redis** — TTL/heartbeat/lock semantics.
- **Socket** — notification delivery contract.
- **Failure simulation** — disconnect/crash/Redis-down behavior.
- **Recovery** — restart reconciliation.
- **Load** — high concurrency acceptance.
- **Chaos** — forced crashes during active matching (validate no loss/duplicate).

### Dependencies
Phases 2–6 must exist to be tested; add tests incrementally per phase.

### Risks
Low. Test-only additions; key risk is slow suites and flaky network-dependent
tests, mitigated by deterministic time/clock injection.

### Rollback strategy
Keep test files out of runtime path; removing them never affects production.

### Estimated effort
Small (per-suite) / Medium (overall) — 4–8 days across phases.

### Acceptance criteria
- All phases covered by the relevant suite levels.
- Matching, recovery, and chaos suites pass deterministically.
- API contract tests remain green across every phase.

---

## Migration Checklist

Each phase is gated: complete and verify before starting the next.

- [ ] **Phase 2 — Repository Layer** complete
- [ ] Tests pass (existing + new contract tests)
- [ ] Merge
- [ ] Deploy
- [ ] Monitor (baseline: no API/behavior regressions)
- [ ] Only then continue to Phase 3
- [ ] **Phase 3 — Matching Module** complete
- [ ] Tests pass (matching simulation + concurrent-accept)
- [ ] Merge
- [ ] Deploy (behind feature toggle)
- [ ] Monitor (assignment correctness, timeouts, expiration)
- [ ] Only then continue to Phase 4
- [ ] **Phase 4 — Background Workers** complete
- [ ] Tests pass (worker idempotency, restart)
- [ ] Merge · Deploy · Monitor
- [ ] Only then continue to Phase 5
- [ ] **Phase 5 — Internal Event Bus** complete
- [ ] Tests pass (contract tests: public Socket.IO payloads unchanged)
- [ ] Merge · Deploy · Monitor
- [ ] Only then continue to Phase 6
- [ ] **Phase 6 — Observability** complete
- [ ] Tests pass (metrics endpoint, correlation logging)
- [ ] Merge · Deploy · Monitor (dashboards live)
- [ ] Only then continue to Phase 7
- [ ] **Phase 7 — Testing Strategy** complete
- [ ] Full suite green (unit/integration/matching/Redis/socket/failure/recovery/load/chaos)
- [ ] Merge · Deploy · Monitor

---

## Critical Path

The required predecessor ordering:

1. **Phase 2 (Repositories)** — must land first; everything reads/writes storage
   through it.
2. **Phase 3 (Matching)** — depends on Phase 2; the core redesign.
3. **Phase 4 (Workers)** — Matching correctness depends on worker-driven
   windows; do after Phase 3.
4. **Phase 5 (Event Bus)** — can be sequenced after Phase 3; decouples
   Producers/Consumers before scaling observability.
5. **Phase 6 (Observability)** — meaningful only once Matching + Workers exist.
6. **Phase 7 (Testing)** — spans all phases, hardening each; final full-suite
   gate before merge-at-scale.

Blocking or deferring any of these does not block starting the *next* independent
item, but the ordering above is the lowest-risk path.

---

## Nice-to-Have Improvements
- `/internal/metrics` Prometheus text format for direct Grafana scraping.
- Optional APM/tracing integration for distributed correlation across worker
  ticks.
- Metrics instrumenting matching latency percentile histograms.

## Future Work
- Scaling matching to multiple instances/workers (requires distributed-lock
  arbitration and sorted-set work queues) — intentionally out of current single-
  instance scope.
- Event sourcing of ride state for deeper audit and replay.
- Real candidate dispatch refinement (proximity bands, surge, multi-vehicle).

## Technical Debt
- Single `.env` at `src/.env` duplicates `backend/.env`; consolidate and remove
  the stale copy.
- Legacy `core/redis/redis.js` client is largely superseded by
  `redis.service.js` and the future repository; retire once repositories are
  stable.
- `architecture.md` documents phantom `src/wallet/` and `osrm.service.js` that
  do not exist; reconcile or retire in favor of `CONTEXT.md`.
- Worker config (tick intervals, offer-window bounds, backoff ceilings) should
  move to `core/config` with env overrides as workers mature.