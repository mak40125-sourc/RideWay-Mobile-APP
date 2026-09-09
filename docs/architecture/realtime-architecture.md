# Realtime Architecture

- Transport: Socket.IO 4 server (`core/socket/socket.js`), `socket.io-client` 4.8.3 both apps.
- Auth: handshake `auth.token` → `supabaseAdmin.auth.getUser` → `socket.userId`; missing/invalid → reject. Rooms: every socket joins `driver:<userId>` + `rider:<userId>`.
- Driver socket (`driver-app/hooks/useWebSocket.ts`): `ride:request` → gated on `ONLINE_IDLE`; `reconnect` → `reconcileRideOnce` (after APP_READY). Token from AsyncStorage `supabase_token`.
- Rider socket (`hooks/useRiderRideSocket.ts`): `ride:status_changed` with rideId-mismatch ignore, terminal-wins + stale-order guard; `reconnect` → `getMyActiveRide` hydrate.
- Backend produces: `notification.service.js` (`ride:notifications` → `ride:request` per candidate driver room) and `ride.service.js` (`ride:status_changed {rideId,status,ride}` to `rider:<rider>`; also `driver:<driver>` on generic transitions).
- Driver supplements with Supabase Realtime `rideAPI.subscribeToRideUpdates` (per-ride `UPDATE` channel, stale-order guard; resubscribes per `current_ride.id`).

| Event | Producer | Transport | Consumer | State change |
|---|---|---|---|---|
| `ride:request` | `offer-dispatcher` → Redis → `notification.service` | Socket.IO → `driver:<id>` | driver-app `useWebSocket` | `current_request` (if ONLINE_IDLE) |
| `ride:status_changed` | `ride.service` after DB commit | Socket.IO → `rider:<id>` (+driver) | rider `useRiderRideSocket` / driver socket | acceleration only; authoritative hydrate via active endpoints |
| postgres `UPDATE rides` | Supabase | Supabase Realtime channel `ride-<id>` | driver `useRideListener` | `setCurrentRide` if not stale |

Reconnect/disconnect/duplicate/out-of-order: always reconcile via `GET /rides/{rider,driver}/active`; never regress terminal. ✅ IMPLEMENTED.
