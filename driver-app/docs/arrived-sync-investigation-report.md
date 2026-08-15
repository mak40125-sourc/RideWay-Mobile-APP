# DRIVER_ARRIVING Synchronization — Investigation Report

- **Date:** 2026-08-11
- **Scope:** Read-only investigation of the Driver App "Arrived" (`DRIVER_ARRIVING`) lifecycle sync.
- **No source code, database, Redis, API contract, or Socket.IO changes were made.**
- **Status:** Investigation complete. No synchronization bug found.

---

## 1. Confirmed synchronization path

The Arrived transition flows through a single backend-confirmed path:

1. Driver presses **Arrived** on `pickup-navigation.tsx`.
2. `handleArrived()` calls `rideAPI.updateRideStatus(rideId, 'DRIVER_ARRIVING')`.
3. `rideAPI.updateRideStatus()` issues `PUT /rides/:rideId/status` with body `{ status: 'DRIVER_ARRIVING' }`.
4. Backend `updateRideStatus` validates the status, then persists `{ status, updated_at }` to the PostgreSQL `rides` table, guarded by `.eq('id', rideId).eq('driver_id', driverId)`.
5. On a successful 200 response the driver UI sets local status `ARRIVED_AT_PICKUP` and navigates to `ride-progress`.
6. The rider app polls `getRiderActiveRide()` every 5 seconds and re-derives its UI from the same backend row.

Because both sides read from the same PostgreSQL row, the accepted ride's `rides.status` is the single source of truth for both apps after acceptance.

---

## 2. Evidence proving backend persistence

- **Endpoint:** `PUT /rides/:rideId/status` (backend/src/modules/ride/ride.routes.js:8) → `rideRepository.updateStatus` (backend/src/modules/ride/ride.repository.js:19).
- The repository performs `supabase.from('rides').update({ status, updated_at: new Date().toISOString() }).eq('id', rideId).eq('driver_id', driverId).select().maybeSingle()`. It returns the updated row, or `null` when the ride is not found / not assigned to the calling driver.
- **Live database evidence (queried during the investigation):**

  ```
  id       1a4305c4-ea77-4dc6-8e8e-7e8ba52dec25
  rider_id 0e136d29-d51e-4f2d-b7fc-2c58cc57b2f3
  driver_id 21297138-0d3e-4e22-8f6e-e11e8a648d48
  status   DRIVER_ARRIVING
  created  2026-08-11T18:43:01.355017Z
  updated  2026-08-11T18:43:13.786Z   (Arrived ~12s after acceptance)
  ```

- `updated_at` was advanced by the status update, proving the transition was written by the `updateStatus` path and not left at the acceptance time.

---

## 3. Evidence proving Driver UI is backend-confirmed

`handleArrived()` in `driver-app/app/(driver)/pickup-navigation.tsx:35-46`:

```ts
const handleArrived = async () => {
  if (!rideId || arriving) return;
  setArriving(true);
  try {
    await rideAPI.updateRideStatus(rideId, 'DRIVER_ARRIVING');
    setStatus('ARRIVED_AT_PICKUP');
    router.push('/(driver)/ride-progress');
  } catch (err: any) {
    Alert.alert('Error', err?.message || 'Failed to update status');
    setArriving(false);
  }
};
```

- Local status is set to `ARRIVED_AT_PICKUP` **only after** the awaited backend PUT resolves successfully.
- A backend failure (400 invalid status, 404 not found / not assigned, network error) throws, the catch block shows an Alert, and the driver stays on the pickup screen with `arriving` reset.
- The driver UI therefore cannot reach the Arrived screen unless the backend has persisted `DRIVER_ARRIVING`. The transition is **not optimistic**.
- The same backend-confirmed pattern is used for `RIDE_STARTED` in `driver-app/app/(driver)/ride-progress.tsx:29-40`.

---

## 4. Evidence proving Rider UI consumes the same backend state

- The rider app polls `getRiderActiveRide(user.id)` every 5 seconds (`components/ride/ride-tracking-screen.tsx:37-64`), then calls `setStatus(activeRide.status)` and records the active ride id.
- The backend `GET /rider/:riderId/active` (backend/src/modules/ride/ride.repository.js:55) queries the PostgreSQL `rides` table for rows in `REQUESTED / SEARCHING_DRIVER / DRIVER_ASSIGNED / DRIVER_ARRIVING / RIDE_STARTED`.
- **Live evidence:** `GET /rider/:riderId/active` for rider `0e136d29-...` returned ride `1a4305c4` with `status: DRIVER_ARRIVING`, matching `GET /rides/:id`.
- Therefore the rider app re-derives its status from the exact same backend row the driver updated; both apps converge on the same `DRIVER_ARRIVING` value within the poll interval.

---

## 5. Why restart/reconciliation does not explain a stale Arrived state

- `current_ride` is persisted via zustand `persist` to AsyncStorage (`driver-app/store/rideStore.ts`).
- `useRideReconciliation` runs on launch and foreground and retries every 20 seconds while a ride is active; it maps backend `DRIVER_ARRIVING` → local `ARRIVED_AT_PICKUP` (`driver-app/hooks/useRideReconciliation.ts`).
- Even if the driver app is killed and reopened, reconciliation re-derives local status from the backend `rides` row, which is `DRIVER_ARRIVING`. The backend remains authoritative.
- A stale local `ARRIVED_AT_PICKUP` cannot survive a restart + reconcile cycle because reconciliation actively overwrites local status from the backend.

---

## 6. Data-model limitations

The following gaps were noted but are **not** synchronization bugs:

- **No `arrived_at` timestamp.** The `rides` table records `updated_at` (the status write time) but has no dedicated `arrived_at` column, so the exact arrival moment cannot be queried independently of the last status write.
- **No persisted driver-location snapshot at arrival.** No latitude/longitude is stored at the moment the driver marks Arrived, so "was the driver actually at the pickup location?" cannot be audited post-hoc from persisted data. This is relevant to the separate location-rendering investigation, not to status synchronization.

---

## 7. Redis-only expired request vs accepted PostgreSQL ride distinction

- The earlier live Redis buffer contained `ride:request:7d8fd82d-fc11-466f-a6ac-618e846e4d21` (a ride request with pickup near `30.7631367, 76.66758`).
- That request was **never accepted** (no `rides` row exists for it) and its Redis request buffer has since **expired / been removed** (120s TTL). During the investigation `ride:request:*`, `ride:offers:*`, and `ride:lock:*` were all empty.
- The current **accepted** ride is `1a4305c4-ea77-4dc6-8e8e-7e8ba52dec25` (`DRIVER_ARRIVING`, persisted in PostgreSQL).
- Redis is used for request buffering/offer dispatch only. After a driver accepts, PostgreSQL is the authoritative ride state. The expired Redis-only request is unrelated to the current accepted ride and cannot affect its status.

---

## Verdict

"DRIVER_ARRIVING synchronization is currently working end-to-end. No synchronization fix is justified by the available evidence."

The next investigation target is the separate pickup/navigation/location-rendering problem: the Driver App's pickup display and in-app navigation appear to render a different/incorrect driver location (e.g., the driver appearing ~12 km from pickup when the live GeoRedis position is ~0.15 m away). That is a display/rendering/measurement concern, distinct from lifecycle status synchronization, and should be investigated separately.