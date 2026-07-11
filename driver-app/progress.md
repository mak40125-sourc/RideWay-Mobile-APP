RideWay Driver App — Progress Summary

Phase 1: Project Foundation (COMPLETED)
Backend migration: All endpoints migrated from pg.Pool to supabaseAdmin. config/db.js deleted, pg removed from package.json. Database RPC functions created: update_driver_location, accept_ride.

Registration flow: End-to-end working — KYC → Vehicle → Home. Auto-approval enabled for dev (KYC auto-verified). Unverified drivers redirected to registration-pending.tsx with polling.

Important details:
- Backend API: http://host:3000/api/v1 (auto-detected by api.ts via Expo host)
- Supabase: ilsbyhxuvhmwjgkthzas.supabase.co
- Wallet: prepaid commission only (no ride fare collection)
- drivers.id has FK → profiles.id (must set id = userId on insert)

Phase 2: Auth & KYC Flow (COMPLETED)
- AuthContext restructured (loading decoupled from network, getSession fires in background)
- Splash screen removed from auth stack (was dead-end)
- Onboarding rebuilt: email+password form with Sign In/Sign Up toggle, loading/error states, redirects to KYC for new users
- KYC screen built: 5-document upload (aadhaar, license, vehicle RC, insurance, profile photo) with Reanimated stagger animations
- ImagePicker integration + driverAPI.uploadDocument + useDriverStore.addKYCDocument
- babel.config.js created with reanimated plugin

Phase 3: Ride Matching System (COMPLETED)

Architecture: Redis-first matching pipeline.
- Ride requests stored in Redis (no DB write until acceptance)
- PostGIS replaced by Redis GEOADD/GEORADIUS for nearby driver discovery
- WebSocket (socket.io) delivers ride requests to drivers in real-time
- PostgreSQL written to only when a driver accepts a ride

Backend:
- Socket.io WebSocket server with JWT auth middleware (config/socket.js)
- Redis-first matching pipeline (services/redis.service.js):
  - Driver location: GEOADD/GEORADIUS (setDriverLocation, getNearbyDrivers)
  - Driver state: HSET/HGETALL (setDriverOnline, setDriverOffline, getDriver)
  - Ride requests: HSET+EXPIRE (createRideRequest, getRideRequest, deleteRideRequest)
  - Driver queue: SADD/SMEMBERS (addDriversToQueue, getQueue, deleteQueue)
  - Distributed lock: SET NX EX (acquireRideLock, releaseRideLock)
  - Pub/sub: PUBLISH/SUBSCRIBE (publishNotification, subscribeToNotifications)
- Notification service bridges Redis pub/sub → socket.io rooms
- accept_ride RPC persists ride to PostgreSQL on acceptance
- updateRideStatus endpoint for lifecycle transitions (DRIVER_ARRIVING, RIDE_STARTED, RIDE_COMPLETED)
- Server creates HTTP server explicitly for socket.io attachment

Frontend (driver-app):
- useWebSocket hook: socket.io-client with JWT auth + auto-reconnect
- useRideListener: WebSocket-based ride request delivery + Supabase Realtime for ride updates
- rideAPI.ts: all direct Supabase calls removed, backend API only
- types/ride.ts: status aligned to backend enum (REQUESTED, DRIVER_ASSIGNED, etc.)
- Ride request modal: calls POST /rides/:id/accept with loading state
- All 5 lifecycle screens wired with real API calls:
  - pickup: PUT /rides/:id/status (DRIVER_ARRIVING)
  - ride-progress: OTP removed, PUT /rides/:id/status (RIDE_STARTED)
  - drop: PUT /rides/:id/status (RIDE_COMPLETED)
  - ride-completed: uses fare from API response

Database:
- Migration 004: accept_ride RPC for Redis-first matching (run in Supabase dashboard)

Redis holds live state:
- drivers:online (GEOADD for locations)
- driver:{id} (HSET for state: status, rideType, socketId)
- ride:request:{id} (HSET with 120s TTL)
- ride:offers:{id} (SET for candidate queue)
- ride:lock:{id} (distributed lock)
- ride:notifications (pub/sub channel)

PostgreSQL holds system of record:
- Drivers, rides (only after acceptance), wallet, payments, ratings

Phase 4: Wallet System (NOT STARTED)
Readiness: ~10%
Wallet store exists with balance/transactions
Backend wallet controller exists (commission deduction)
No recharge flow connected
No commission display on ride completion
Low balance prevention for going online is in place (checked in DriverStatusCard)

Key Decisions Made
Decision        Choice              Reason
Font            NeueMontreal only   User explicit, matches Rider App
Bottom sheet    Custom (no @gorhom) @gorhom conflicts with MapView SurfaceView on Android
Map             react-native-maps   Same as Rider App
State           Zustand (domain) + Context (auth)  Existing pattern
Architecture    Paper (not Fabric)  newArchEnabled: false matches Rider App, avoids Fabric native plugin complexity
Development     Expo Go only (no prebuild)  Prebuild creates local native project that needs Google Maps API key
Ride matching   Redis-first          No DB write until acceptance, GEOADD for driver discovery, socket.io for real-time delivery
