# Rider Flow

`App launch → AuthProvider restore → bootstrapLocation → Home (map+sheet) → pickup/destination → getRouteEstimate → calculateRideFare → confirm → requestRideAction → /tracking (SEARCHING) → poll+socket → DRIVER_ASSIGNED/ARRIVING/STARTED → complete → receipt/history`

- Fare: client `ride-helpers.calculateRideFare(base+km*perKm+min*perMin)` per `ride-config` (Dash 42/12/2, Comfort 64/15/3, Mega 88/18/4, Bike 26/8/1); OSRM distance/duration; backend persists verbatim — client authoritative (risk, see audit).
- Errors: retryable (network/5xx) stays SEARCHING with inline error; 4xx → IDLE.
- Referral: link `/r/VEL-XXXXX` → `useReferralAttribution` → AsyncStorage → `POST /referrals/apply` post-auth; optional "Referred by a Velos driver" (no discount).
- ✅ IMPLEMENTED.
