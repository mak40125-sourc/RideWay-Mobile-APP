# Ride Acceptance — Root Cause Fix & Validation Report

Status: **FIXED and verified end-to-end**
Date: 2026-08-09
Applies to: backend live instance `https://ilsbyhxuvhmwjgkthzas.supabase.co`

Pre-fix state is documented in [`acceptance-evidence-report.md`](acceptance-evidence-report.md)
(verdict **B — FAILED**). This report records the resolution.

---

## 1. Root cause (dev-path A + C, not B)

The live `rides` table was missing exactly three columns that both the canonical
schema and the installed `accept_ride` function require:

| Column     | Canonical (`backend/supabase_schema.sql:75-90`) | Installed function (migration 004) | Live table (probed) |
|------------|--------------------------------------------------|-----------------------------------|---------------------|
| `fare`     | `NUMERIC` (absent)                               | INSERTs it                        | **missing**         |
| `distance` | `NUMERIC` (absent)                               | INSERTs it                        | **missing**         |
| `duration` | `NUMERIC` (absent)                               | INSERTs it                        | **missing**         |
| (all other `rides` columns) | present                              | present                           | present             |

Direct evidence, captured against the **same project the backend connects to**:

```
rpc accept_ride(...)  →  code: "42703"  message: column "fare" of relation "rides" does not exist
```

- **Option A ruled out:** `acceptRoute` reads the function from migration `004`,
  which is correct and matches the canonical contract. The function was NOT stale.
- **Option C confirmed:** the *database* was stale (missing columns).
- Enum `ride_status` confirmed valid on the live instance for all seven statuses
  (`REQUESTED`, `SEARCHING_DRIVER`, `DRIVER_ASSIGNED`, `DRIVER_ARRIVING`,
  `RIDE_STARTED`, `RIDE_COMPLETED`, `CANCELLED`) — no enum repair needed.

## 2. The fix

Pure additive, idempotent table migration — no change to the function, API,
Redis, or socket behavior.

File: `supabase/migrations/005_add_ride_measurement_columns.sql`

```sql
ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS fare NUMERIC,
  ADD COLUMN IF NOT EXISTS distance NUMERIC,
  ADD COLUMN IF NOT EXISTS duration NUMERIC;
```

Rollback (recorded in the migration's comments):

```sql
ALTER TABLE public.rides DROP COLUMN IF EXISTS fare,
                         DROP COLUMN IF EXISTS distance,
                         DROP COLUMN IF EXISTS duration;
```

### Before → after (contract)

| Level | Before | After |
|---|---|---|
| `rides` table | no `fare`/`distance`/`duration` | columns present |
| `accept_ride` RPC | `42703` fare missing → HTTP 400 | inserts OK → HTTP 200 |
| Driver app on accept | never persists; stays on request modal | ride row persisted, driver navigates to pickup |
| `rides` rows | 0 | correctly persisted |

## 3. Verification (real API, live DB + Redis)

Harness: `backend/scripts/validate-ride-acceptance.js` — creates an isolated test
rider/driver, requests a ride through `POST /api/v1/rides/request`, accepts via
`POST /api/v1/rides/{id}/accept`, asserts persistence/cleanup, then deletes the
test data. Result: **20 passed, 0 failed**.

| # | Check | Result |
|---|---|---|
| 1 | ride request via real API (candidate drivers found) | PASS (`201`, `candidateCount=5`) |
| 2 | accept via real API | PASS (`200`) |
| 3 | ride row exists after accept | PASS |
| 4 | status = `DRIVER_ASSIGNED` | PASS |
| 5 | `driver_id` persisted = accepting driver | PASS |
| 6 | `fare`/`distance`/`duration` persisted (no DB error) | PASS |
| 7 | Redis `ride:request:<id>` buffer cleaned | PASS |
| 8 | Redis `ride:offers:<id>` queue cleaned | PASS |
| 9 | Redis `ride:lock:<id>` released | PASS |
| 10 | duplicate accept → 4xx, no re-assign, no extra rows | PASS |
| 11 | invalid `rideId` accept → 4xx | PASS |

## 4. Rollback considerations

- Safe rollback: drop the three columns (SQL above). `accept_ride` will then
  fail again exactly as before (regression to 42703), so the DB stays
  consistent with a pre-fix state — nothing else needs to change to undo.
- The columns are additive and only ever written by `accept_ride`; there is no
  working app data that depends on dropping them.