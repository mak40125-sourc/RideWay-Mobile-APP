# Documentation Audit

## Inspected

Repo root, `driver-app/`, `backend/src/{app,server,modules/*,core/*}`, `supabase/migrations/001-006`, `backend/supabase/migrations/006-007`, `backend/supabase_schema.sql`, `backend/CONTEXT.md`, `architecture.md`, `velos-dashboard/src/{app,lib,features}`, both `package.json`, rider `context/*,hooks/*,services/*`, driver `contexts/*,store/*,hooks/*,services/*,components/{driver,navigation,referral}`, `app.json` both apps, `backend/test/*.test.js`.

## Documented

System/client/backend/database/redis/realtime/matching/navigation/reliability, ride lifecycle, matching/rider/driver/dashboard/auth/failure flows, wallet/referral/KYC/pricing, API + data flows, diagrams (12 required: system, client/backend, lifecycle, booking, matching, realtime, rider/driver recovery, auth, online/location, DB relations, navigation).

## Discrepancies (implementation wins)

1. PostGIS `get_nearby_drivers` exists in schema but matching uses Redis GEO (`candidate-finder.js`).
2. Docs reference backend `GET /route` OSRM; absent from `ride.routes.js` — only client OSRM real.
3. `PUT /drivers/offline` routes to `setOnline` handler (works via flag, misleading name).
4. Referral spec planned `transaction_type=referral_reward`; code inserts `credit` (`007` adds enum value but RPC uses `credit`).
5. `CONTEXT.md` says winston "not configured"; code configures winston with correlation/ALS.
6. Legacy `architecture.md` dev-mode bypasses ("Dev Driver" fake accept) not present in current `acceptance-manager.js`.
7. Dashboard operations map uses `mockOperations.ts` (not live).

## Unknowns

Live DB migration state (006/007), production `velos.app` DNS/app-links, dashboard auth provisioning, background location behavior, push notifications (none found).

## Gaps / risks

Client-authoritative fare; wallet write API absent (only referral path credits); no rate limiting found; Redis unauthenticated localhost default; no Dockerfile; `driver:<id>` hash TTL removed (stale GEO possible, mitigated by repair-at-read).
