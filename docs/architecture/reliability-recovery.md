# Reliability & Recovery

```mermaid
flowchart TB
  Auth[Auth restore\nBOOTPSTRAPPING→AUTH/UNAUTH] --> Persist[Persisted hydration\n_hasHydrated]
  Persist --> Active[GET /rides/.../active\nby identity]
  Active -->|found| Hydrate[Hydrate ride +\nderive driver status]
  Active -->|null| Clear[Clear stale ride/nav\nonly on explicit null]
  Active -->|network fail| Keep[Retain local + FAILED\nretry]
  Hydrate --> Nav[Current GPS →\nstartNavigation]
  Nav --> Ready[APP_READY\nsingle route]
```

- Rider: `persist rider-ride-storage` + `useRideRecovery` (launch/5s/foreground) + socket reconnect hydrate; mismatch guard; no IDLE reset on transient fail.
- Driver: startup gate (`StartupGate`), `reconcileRideOnce` (identity, in-flight mutex), `recoverNavigationFromRide` (GPS-first), `RideStatusCard` recovering state, single `router.replace`.
- Idempotency: `create_ride_idempotent` (unique index), `accept_ride_atomic`, `transition_ride_status` (same-status no-op, `COALESCE` timestamps, `version+1`), referral `try_reward_referral` (unique qualifying ride).
- Redis down / backend restart: lifecycle still correct via Postgres; matching pauses; sockets reconnect → reconcile.

✅ IMPLEMENTED. See `flows/failure-recovery-flow.md`.
