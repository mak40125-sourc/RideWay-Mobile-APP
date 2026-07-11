RideWay Driver App — Progress Summary
Phase 1: Project Foundation
Backend migration: All endpoints migrated from pg.Pool to supabaseAdmin. config/db.js deleted, pg removed from package.json. Database RPC functions created: update_driver_location, create_ride_request, accept_ride, get_balance.

Registration flow: End-to-end working — KYC → Vehicle → Home. Auto-approval enabled for dev (KYC auto-verified). Unverified drivers redirected to registration-pending.tsx with polling.

Important details:

Backend API: http://10.29.87.124:3000/api/v1 (IP changes on DHCP lease — update .env)
Supabase: ilsbyhxuvhmwjgkthzas.supabase.co
Wallet: prepaid commission only (no ride fare collection)
drivers.id has FK → profiles.id (must set id = userId on insert)
Phase 2: Home Screen Restructure (IN PROGRESS)
Goal
Replace absolute-positioned floating components with a bottom panel + minimal overlay header using @gorhom/bottom-sheet (v5.2.14 installed).

What was done
Created components/driver/DriverStatusCard.tsx — spec-compliant card:
90% screen width, white bg, radius 24, shadow (y=6 blur=20 opacity 10%)
Title "Driver Status" — NeueMontreal-Bold 20
12x12 status dot (#8E8E93 / #1EE751) + status text 34 Bold
Full-width button: h=68, radius=34, 28 Bold
Offline → green (#1EE751) "Go Online"; Online → dark "Go Offline"
Shows "Insufficient wallet balance" warning when low balance
Slimmed OnlineToggle.tsx to just the toggle switch (52x32 pill, no text/warnings)
Added BottomSheetModalProvider to _layout.tsx
Current state
home.tsx has MapView (first sibling, absoluteFill) + small overlay header (OnlineToggle) + plain View bottom panel (35% screen height)
Map NOT showing on Android — root cause identified: npx expo prebuild --clean created a local android/ native project that lacks the Google Maps API key. Expo Go (without prebuild) provides the key automatically.
Fix: delete android/ directory. Already done. Need to test with npx expo start --clear (Expo Go).
What's pending
Test map after deleting android directory — start with npx expo start --clear
If map works, re-add drag-to-expand for bottom panel (via PanResponder, no third-party native views)
Replace the static bottom panel with a proper draggable bottom sheet (custom, not @gorhom — conflicts with MapView SurfaceView)
Expand snap to 45%/85% for Earnings/RideStatus/Wallet content
Phase 3: Ride Matching System (NOT STARTED)
Readiness: ~20%
Key blockers:

Missing create_ride_request and accept_ride RPC functions in Supabase schema
No realtime push mechanism (WebSocket/SSE) to deliver ride requests to drivers
rideAPI.ts bypasses backend — writes directly to Supabase
Ride status types misaligned between frontend (PENDING/ACCEPTED) and backend (REQUESTED/DRIVER_ASSIGNED)
subscribeToRideRequests subscribes to non-existent ride_requests table
OTP input in ride-progress.tsx non-interactive (no TextInput)
No API calls in any lifecycle screen (accept, start, complete rides)
Minimum work needed
Create create_ride_request + accept_ride PostgreSQL functions in Supabase
Build realtime notification mechanism (e.g., backend inserts into ride_notifications table → Supabase Realtime picks it up)
Align frontend/backend status types
Fix rideAPI.ts to call backend API instead of direct Supabase writes
Wire ride request modal to call API on accept/reject
Make OTP input functional
Phase 4: Wallet System (NOT STARTED)
Readiness: ~10%
Wallet store exists with balance/transactions
Backend wallet controller exists (commission deduction)
No recharge flow connected
No commission display on ride completion
Low balance prevention for going online is in place (checked in DriverStatusCard)
Key Decisions Made
Decision	Choice	Reason
Font	NeueMontreal only	User explicit, matches Rider App
Bottom sheet	Custom (no @gorhom)	@gorhom conflicts with MapView SurfaceView on Android
Map	react-native-maps	Same as Rider App
State	Zustand (domain) + Context (auth)	Existing pattern
Architecture	Paper (not Fabric)	newArchEnabled: false matches Rider App, avoids Fabric native plugin complexity
Development	Expo Go only (no prebuild)	Prebuild creates local native project that needs Google Maps API key