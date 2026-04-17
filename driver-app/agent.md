# Driver App Agent — Architecture & UI Guardrails

Purpose:
This agent enforces **RideWay Driver App architecture and UI consistency**.
All code generation must follow these rules strictly.

---

# 1. App Scope

This agent applies to:

* rideway-driver app only
* Driver navigation
* Driver wallet
* Driver ride flow
* Driver UI screens

Do NOT mix rider logic.

---

# 2. Architecture Rules

Driver App must remain:

* Separate Expo project
* Separate navigation stack
* Shared theme only
* Shared API client allowed
* Separate state management

Never import rider screens.

---

# 3. Driver App Screen Flow

Required Flow:

Splash
→ Login
→ KYC
→ Vehicle Setup
→ Wallet Check
→ Driver Home
→ Online Toggle
→ Ride Request
→ Pickup Navigation
→ Ride In Progress
→ Drop Navigation
→ Ride Completed

No alternate shortcuts allowed.

---

# 4. Navigation Structure

RootStack
├── AuthStack
└── DriverMainStack

DriverMainStack:

* Home
* PickupNavigation
* RideProgress
* DropNavigation
* RideCompleted
* Wallet
* Earnings
* History
* Profile

Navigation must remain stack-based.

---

# 5. UI Philosophy (Driver App)

Driver UI must follow:

* Map-first
* Minimal overlays
* One-action focus
* Large touch targets
* Calm visuals

Driver UI must match rider UI style.

---

# 6. Map Rules

Map must always:

* occupy full screen
* remain mounted
* never reinitialize
* support live GPS updates

Overlays must float above map.

---

# 7. Driver Home UI Layout

Top:
Online Toggle

Card:
Wallet Balance
Today's Earnings

Center:
Map

Bottom:
Idle / Ride state card

No heavy bottom sheet like rider app.

---

# 8. Wallet UI Rules

Wallet must:

* appear on Home
* have dedicated screen
* show balance prominently
* support recharge

Low balance:

* disable online toggle
* show warning

---

# 9. Ride Request UI

Must be:

* Full width overlay
* Large accept button
* Countdown timer
* Pickup + drop info

Auto dismiss after timeout.

---

# 10. Navigation Screen UI

Full screen map only.

Allowed overlays:

* turn instruction
* ETA
* distance
* arrived button
* call rider button

No extra UI allowed.

---

# 11. Typography Rules

Font:
Tex Gyre Heros only

Title:
Bold

Body:
Regular

No font mixing.

---

# 12. Color Rules

Driver app must use:

Primary: #111111
Background: #FFFFFF
Secondary text: #6B7280

No bright colors.

Red allowed only:

* low wallet
* cancel

---

# 13. Spacing Rules

Padding base:
16

Card radius:
20

Button height:
48+

Touch targets:
minimum 44px

---

# 14. Component Folder Rules

Allowed component groups:

components/

* driver/
* wallet/
* ride/
* map/

No mixing with rider components.

---

# 15. Store Rules

Separate stores required:

driverStore
rideStore
walletStore

Never combine.

---

# 16. Performance Rules

Must:

* keep map mounted
* throttle location updates
* use memoized components
* avoid deep re-renders
* keep websocket persistent

---

# 17. Wallet Logic Enforcement

Driver cannot go online if:

wallet_balance < threshold

Agent must enforce:

* UI disabled state
* warning
* recharge flow

---

# 18. Ride State Machine Enforcement

Valid transitions only:

OFFLINE → ONLINE_IDLE
ONLINE_IDLE → REQUEST_RECEIVED
REQUEST_RECEIVED → ACCEPTED
ACCEPTED → NAVIGATING_TO_PICKUP
ARRIVED → RIDE_STARTED
RIDE_STARTED → NAVIGATING_TO_DROP
NAVIGATING_TO_DROP → COMPLETED

No skipping states.

---

# 19. File Naming Rules

Screens:
kebab-case

Components:
PascalCase

Hooks:
useSomething.ts

Stores:
somethingStore.ts

---

# 20. Golden Rules

Driver app must feel:

Fast
Minimal
Map-first
Uber-like
Rapido-lightweight

Avoid:

* complex sheets
* heavy animations
* multiple actions
* cluttered UI

---

End of Driver Agent
