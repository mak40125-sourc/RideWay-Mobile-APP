# RideWay Driver App Architecture

---

# 1. App Overview

RideWay Driver is a **separate mobile app** from Rider App.

Purpose:

* Accept ride requests
* Navigate to pickup & drop
* Track earnings
* Manage prepaid commission wallet
* Control availability

Architecture Goals:

* Uber/Rapido-like experience
* Real-time ride dispatch
* Lightweight & fast
* Map-first UI
* Wallet-based commission system

---

# 2. High Level Driver Flow

App Launch
→ Splash
→ Login / Signup
→ KYC Check
→ Vehicle Setup
→ Wallet Check
→ Driver Home (Offline)
→ Toggle Online
→ Receive Ride Request
→ Accept Ride
→ Navigate to Pickup
→ Arrived
→ Start Ride
→ Navigate to Drop
→ End Ride
→ Commission Deducted
→ Back to Online Idle

---

# 3. Ride State Machine

OFFLINE
↓
ONLINE_IDLE
↓
REQUEST_RECEIVED
↓
ACCEPTED
↓
NAVIGATING_TO_PICKUP
↓
ARRIVED_AT_PICKUP
↓
RIDE_STARTED
↓
NAVIGATING_TO_DROP
↓
RIDE_COMPLETED
↓
ONLINE_IDLE

---

# 4. Navigation Structure

RootStack
│
├── AuthStack
│   ├── SplashScreen
│   ├── LoginScreen
│   ├── OTPScreen
│   ├── DriverOnboardingScreen
│   ├── KYCUploadScreen
│   └── VehicleDetailsScreen
│
└── DriverMainStack
├── DriverHomeScreen
├── PickupNavigationScreen
├── RideInProgressScreen
├── DropNavigationScreen
├── RideCompletedScreen
└── BottomTabs
├── EarningsScreen
├── WalletScreen
├── RideHistoryScreen
├── ProfileScreen

---

# 5. Driver Home Screen (Map First)

Components:

* Full screen map
* Online / Offline toggle
* Wallet balance card
* Today's earnings
* Ride request popup overlay
* GPS accuracy indicator
* Center map FAB

State:

* driver_status
* driver_location
* wallet_balance
* current_ride
* earnings_today

---

# 6. Ride Request Modal

Overlay popup (Uber style)

Contents:

* Pickup distance
* Drop distance
* Estimated fare
* Rider rating
* Accept button
* Reject button
* Countdown timer (10s)

Behavior:
Auto reject if timeout expires

---

# 7. Navigation Screen (Driver)

Full-screen turn-by-turn navigation:

* Route polyline
* Next turn instruction
* ETA
* Distance remaining
* Call rider button
* Cancel ride button
* Arrived button

Navigation replaces home map when active.

---

# 8. Driver Wallet System

Wallet Purpose:

* Commission deduction
* Recharge balance
* Incentives
* Adjustments

Important:
RideWay does NOT hold ride money — only commission deducted.

---

# 9. Wallet Logic

Example:

Ride Fare: ₹200
Commission: ₹20

Wallet:
₹120 → ₹100

If wallet below threshold:
Driver cannot go online

Minimum Wallet Balance:
₹50 (configurable)

---

# 10. Wallet UI

Wallet visible in:

* Driver Home Screen
* Wallet Screen
* Ride Completed Screen
* Low balance warning

Wallet Screen:

* Balance header
* Add money button
* Transaction list
* Filters (Debit/Credit)
* Commission info

Transaction Types:

* Commission Debit
* Wallet Recharge
* Incentive Credit
* Adjustment
* Refund

---

# 11. Low Balance Behavior

If wallet < threshold:

* Show red wallet badge
* Disable online toggle
* Show "Recharge to go online"
* Open recharge flow

---

# 12. Driver Real-time Requirements

Driver app must support:

* Live GPS tracking (2 sec interval)
* Ride request push (Supabase realtime / websocket)
* Ride status sync
* Wallet update push
* Navigation updates

---

# 13. Driver Online Conditions

Driver can go online only if:

* KYC approved
* Vehicle approved
* Wallet balance sufficient
* Location permission granted
* GPS accuracy good

---

# 14. Driver App Folder Structure

rideway-driver/
│
├── app/
│   ├── (auth)/
│   │   ├── splash.tsx
│   │   ├── login.tsx
│   │   ├── otp.tsx
│   │   ├── onboarding.tsx
│   │   ├── kyc.tsx
│   │   └── vehicle.tsx
│   │
│   ├── (driver)/
│   │   ├── home.tsx
│   │   ├── pickup-navigation.tsx
│   │   ├── ride-progress.tsx
│   │   ├── drop-navigation.tsx
│   │   └── ride-completed.tsx
│   │
│   ├── (wallet)/
│   │   ├── wallet.tsx
│   │   ├── recharge.tsx
│   │   └── transactions.tsx
│   │
│   ├── (tabs)/
│   │   ├── earnings.tsx
│   │   ├── history.tsx
│   │   ├── profile.tsx
│   │   └── settings.tsx
│   │
│   └── modals/
│       ├── ride-request.tsx
│       └── low-balance.tsx
│
├── components/
│   ├── driver/
│   │   ├── OnlineToggle.tsx
│   │   ├── EarningsCard.tsx
│   │   ├── RideStatusCard.tsx
│   │
│   ├── wallet/
│   │   ├── WalletBalanceCard.tsx
│   │   ├── TransactionItem.tsx
│   │   ├── WalletWarning.tsx
│   │   └── AddMoneyButton.tsx
│   │
│   ├── ride/
│   └── map/
│
├── hooks/
│   ├── useDriverLocation.ts
│   ├── useRideListener.ts
│   ├── useDriverStatus.ts
│   ├── useWallet.ts
│
├── services/
│   ├── driverAPI.ts
│   ├── rideAPI.ts
│   ├── walletAPI.ts
│   ├── locationService.ts
│   └── paymentService.ts
│
├── store/
│   ├── driverStore.ts
│   ├── rideStore.ts
│   ├── walletStore.ts
│
├── constants/
│   ├── commission.ts
│   └── wallet.ts
│
├── types/
│   ├── driver.ts
│   ├── ride.ts
│   ├── wallet.ts
│   └── transaction.ts
│
└── theme/
└── shared with rider

---

# 15. Driver Stores

driverStore:

* driver_status
* location
* online_state
* vehicle_info

rideStore:

* ride_id
* ride_status
* pickup
* drop
* fare

walletStore:

* balance
* transactions
* low_balance_flag
* recharge_loading

---

# 16. Backend Services Used

Driver App connects to:

* Supabase Auth
* Supabase Realtime
* NodeJS Gateway
* Redis (driver availability)
* Valhalla routing server
* Payment verification service

---

# 17. Performance Rules

* Keep map mounted
* Throttle location updates
* Use background GPS
* Persistent websocket
* Preload navigation screen
* Avoid full rerenders

---

# 18. Future Enhancements

* Auto accept rides
* Surge heatmap
* Voice navigation
* Floating mini navigation
* Driver incentives
* Scheduled rides
* Driver level system

---
