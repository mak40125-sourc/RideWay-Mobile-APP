# Driver Flow

`Launch → BOOTSTRAPPING → AUTHENTICATED → persisted hydration → reconcileRideOnce → recoverNavigation → APP_READY → route(home/pickup-navigation/ride-progress/drop-navigation) → KYC gate → online toggle → GPS watch → ride:request → accept → pickup nav → arrived → start → drop nav → complete → ride-completed → earnings/wallet/referral`

- KYC: `registration-pending` until `verified`; docs in `driver_documents` + `driver_kyc_reviews` audit.
- Online: `PUT /drivers/online` (authoritative `drivers` row → Redis hash+GEO); location `PUT /drivers/location` throttled.
- Refer & Earn (`(referral)/earn`): QR of `https://velos.app/r/<code>`, Share, stats (`referred/pending/rewarded/earned`).
- ✅ IMPLEMENTED.
