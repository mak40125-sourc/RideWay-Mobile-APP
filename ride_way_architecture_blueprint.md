# RideWay — Scalable Architecture & Screenflow Blueprint

This document defines the **long‑term scalable architecture** for RideWay including:
- Uber-style screen flow
- Supabase Auth
- Postgres + PostGIS
- Redis caching & realtime
- OSRM routing
- Modular folder structure
- Future developer onboarding


# 1. Product Flow (Uber-style with Rapido simplicity)

## Rider Flow

```
Splash / Auth
      ↓
Home Map Screen
      ↓
Where to?
      ↓
Pickup + Drop Selection
      ↓
Ride Options (Bike / Mini / Shuttle)
      ↓
Confirm Ride
      ↓
Finding Driver
      ↓
Driver Assigned
      ↓
Live Tracking
      ↓
Ride Complete
      ↓
Rating + Wallet Update
```

## Driver Flow

```
Login / KYC
      ↓
Driver Dashboard
      ↓
Go Online Toggle
      ↓
Incoming Ride Request
      ↓
Accept / Reject
      ↓
Navigate to Pickup
      ↓
Ride In Progress
      ↓
Ride Complete
      ↓
Wallet Credit
```

---

# 2. Core Technology Stack

Frontend
- React Native (Expo)
- React Navigation / Expo Router
- Context API (Ride State)

Backend
- Supabase (Auth + Postgres)
- Postgres + PostGIS
- Redis (Realtime + Matching)
- OSRM (Routing + Distance)

Optional API Layer
- Supabase Edge Functions OR Node.js service

---

# 3. Authentication Architecture (Supabase)

Supabase handles:
- Login / Signup
- Session management
- JWT
- Role access

Tables:

profiles
- id (uuid -> auth.users)
- name
- phone
- role (rider | driver | admin)
- created_at

---

# 4. Database Architecture (Postgres + PostGIS)

users / profiles handled via Supabase

Drivers table:
 - id (uuid)
 - user_id (references profiles.id)
 - vehicle_type (enum: bike, mini, sedan, shuttle)
 - vehicle_number (text)
 - is_online (boolean)
 - wallet_balance (numeric)
 - location (geography(point, 4326)) -- Add GiST index for performance
 - last_pings_at (timestamp)

Rides table:
- id
- rider_id
- driver_id
- pickup_location (GEOGRAPHY)
- drop_location (GEOGRAPHY)
- fare
- status
- distance
- duration

Wallet Transactions:
- id
- user_id
- amount
- type (credit/debit)
- ride_id
- created_at

Payments:
- id
- ride_id
- status
- method

---

# 5. PostGIS Usage

Used For:
- Nearby driver search
- Geo indexing
- Matching radius
- Surge zone detection

Example Logic
- Driver location stored as geography point
- Query drivers within 3km radius
- Order by nearest

---

# 6. Redis Architecture (Performance Layer)

Redis Used For:
- Driver live locations
- Active ride state (Distributed Locking)
- Matching queue
- Ride locking
- Rate limiting

Redis Keys

```
driver:location:{id}
driver:online:{id}
ride:active:{id}
matching:queue
user:request:{id}
```

---

# 7. Ride Matching Flow (PostGIS + Redis)

```
User requests ride
      ↓
Create ride (Postgres)
      ↓
Query nearby drivers (PostGIS)
      ↓
Push candidates to Redis queue
      ↓
Send request to drivers
      ↓
First accept wins
      ↓
Lock ride in Redis
      ↓
Persist assignment in Postgres
```

---

# 8. Live Tracking Flow

```
Driver sends location (3s interval)
      ↓
Update Redis location
      ↓
Publish event
      ↓
Rider subscribed
      ↓
Map updates
```

---

# 9. Routing Architecture (OSRM)

Used For:
- Distance calculation
- ETA
- Fare calculation
- Route polyline

Flow:

Pickup + Drop
     ↓
OSRM route request
     ↓
Distance + duration
     ↓
Fare calculation

---

# 10. Fare Calculation Engine

```
Base Fare + (Distance × Per Km) + (Time × Per Min)
```

Vehicle multipliers:
- Bike = 1x
- Mini = 1.5x
- Sedan = 2x
- Shuttle = dynamic

---

# 11. Folder Structure (Frontend)

/app
  /components
  /screens
  /context
  /services
  /utils
  /hooks

Important Screens
- Home
- Search
- Ride
- Tracking
- Wallet
- Profile

---

# 12. Backend Logical Modules

Auth Service (Supabase)
Ride Service
Driver Service
Wallet Service
Matching Service
Notification Service
Routing Service

---

# 13. Ride State Machine

```
IDLE
REQUESTED
SEARCHING_DRIVER
DRIVER_ASSIGNED
DRIVER_ARRIVING
RIDE_STARTED
RIDE_COMPLETED
CANCELLED
```

---

# 14. Scalability Design

Supports:
- City-level launch
- Intercity rides
- Shuttle system
- Multiple vehicle types
- Driver wallet system
- Surge pricing
- Heatmaps

---

# 15. Final Architecture Diagram (Logical)

```
Rider App / Driver App
        ↓
     Supabase Auth
        ↓
     API Layer
        ↓
 ┌───────────────┐
 │ Postgres GIS  │
 │ (rides/users) │
 └───────────────┘
        ↓
 ┌───────────────┐
 │     Redis     │
 │ realtime/cache│
 └───────────────┘
        ↓
       OSRM
```

---

# 16. Future Extensions

- Payments Gateway (Razorpay / Stripe)
- Driver incentives
- Subscription model
- Corporate rides
- Pooling
- Scheduled rides
- Admin dashboard

---

# 17. Developer Onboarding

Steps for new developers:
1. Setup Supabase project
2. Enable PostGIS
3. Setup Redis
4. Run OSRM
5. Install frontend
6. Configure environment variables
7. Start matching service

---

RideWay Architecture Version: 1.0
Designed for long-term scalability
