# Progress — Rider App Refinement

## Font Switch: NeueMontreal → GeneralSans

| Status | File | Change |
|--------|------|--------|
| ✓ | `assets/fonts/` | Copied `GeneralSans-{Regular,Bold,Italic,BoldItalic}.otf` from `driver-app/assets/fonts/` |
| ✓ | `app/_layout.tsx` | Updated `useFonts` keys from `NeueMontreal-*` to `GeneralSans-*` |
| ✓ | Rider `.tsx` files (10 files) | Replaced all `"NeueMontreal-*"` → `"GeneralSans-*"` (~100 occurrences) |

**Font files affected (rider app only):**
- `app/_layout.tsx`
- `screens/rider/home-screen.tsx`
- `components/BottomSheet/BottomSheetContent.tsx`
- `components/SearchBar.tsx`
- `components/PickupCard.tsx`
- `components/Header.tsx`
- `components/ride/ride-styles.ts`
- `components/ride/driver-matching-view.tsx`
- `components/profile/profile-creation-screen.tsx`
- `components/auth/login-screen.tsx`

## Home Screen — Flow Motion Redesign

### New Foundation Files

| Status | File | Purpose |
|--------|------|---------|
| ✓ | `constants/home-theme.ts` | Design tokens: 4 font sizes (32/24/16/13), colors, spacing (8pt grid), sheet shadow |
| ✓ | `components/BottomSheet/AnimatedSection.tsx` | Reanimated wrapper — content morphs with `translateY(±24→0)`, 300ms `easeOutCubic` |

### Component Rewrites

| Status | File | Key Changes |
|--------|------|-------------|
| ✓ | `screens/rider/home-screen.tsx` | Snap points `["20%","78%","92%"]`; floating sheet (`mx:20`, `mb:16`, `radius:32`); removed `<Header>`; all inline → `StyleSheet.create`; added `useEffect` watchers for `rideStore.status` → auto-push `/tracking` on `DRIVER_ASSIGNED` + dev simulation after 4s; `effectivePickupCoords` from `selectedPickup` or GPS |
| ✓ | `components/BottomSheet/BottomSheetContent.tsx` | State machine with 4 states (IDLE → RESULTS → OPTIONS → BOOKING); `AnimatedSection` wrapping conditional content; pickup search mode; recent places section; avatar removed → moved to map overlay |
| ✓ | `components/SearchBar.tsx` | Accepts optional `value`/`onChangeText`/`placeholder` props (defaults to store); 58px height, 18px radius, leading icon, shadow |
| ✓ | `components/PickupCard.tsx` | Interactive 56dp row: `📍` icon, pickup name, "Tap to change pickup" hint, "Edit" label; press feedback: `scale: 0.98` + background darken; no opacity, no ripple |
| ✓ | `components/BottomSheet/BottomSheetHandle.tsx` | `marginTop: 10, marginBottom: 6` |

### Store Changes

| Status | File | Change |
|--------|------|--------|
| ✓ | `context/ride-store.ts` | `requestRideAction(userId, options?)` — added optional `navigateToTracking` param (default `true`, backward-compatible); fixed `vehicleType` field (`option.vehicleType ?? option.label.toLowerCase()`) |
| ✓ | `store/homeStore.ts` | Added pickup search state: `searchMode`, `pickupQuery`, `pickupResults`, `isSearchingPickup`, `selectedPickup` + setters |

### Sheet State Machine

```
COLLAPSED (index 0, 20%)
  ├─ Avatar (on map, top-right)
  ├─ "Where to?" heading (28px)
  ├─ SearchBar (58px, destination)
  ├─ PickupCard (interactive, tappable → pickup search)
  └─ Recent Places (static: Home, Work, ISBT Sector 43)

  On tap PickupCard → sheet stays, content transforms to pickup mode
  │
  ▼
PICKUP SEARCH (in-sheet)
  ├─ "Pickup location" heading (24px)
  ├─ SearchBar (pickup query)
  ├─ "📍 Current Location" (always first option)
  └─ Pickup search results (staggered, reuses searchDestinations API)

  On select pickup → return to destination mode with selectedPickup set
  │
  ▼
DESTINATION MODE
  ├─ On type ≥3 chars → results cascade up (25ms stagger)
  ├─ On select destination → estimate loads
  ├─ Ride option cards stagger in (40ms delay, scale 0.98→1)
  ├─ "Find Ride" button
  │
  On tap Find Ride →
  ▼
BOOKING (in-sheet)
  ├─ "Finding your {vehicle}" with fare display
  ├─ Cancel button
  └─ On DRIVER_ASSIGNED → push /tracking
```

## Pickup Section Refinement

| Feature | Status |
|---------|--------|
| Interactive pickup row (56dp, scale 0.98 feedback, icon, label, hint) | ✓ |
| Pickup search mode reusing destination search infrastructure | ✓ |
| "Current Location" option always available in pickup search | ✓ |
| Custom pickup selection via search results | ✓ |
| Route estimate updates when pickup changes (`effectivePickupCoords`) | ✓ |
| Recent Places section (Home, Work, ISBT Sector 43) | ✓ |
| Avatar moved from sheet content to map overlay (top-right, `insets.top + 16`) | ✓ |
| "Where to?" heading reduced from 32px → 28px | ✓ |

## Animation Specs

| Element | Trigger | Duration | Easing | Stagger | Transform |
|---------|---------|----------|--------|---------|-----------|
| Section swap | state change | 300ms | easeOutCubic | — | translateY |
| Search results | appear | 280ms | easeOutCubic | 25ms | translateY(24→0) |
| Ride cards | appear | 300ms | easeOutCubic | 40ms | translateY(20→0), scale(0.98→1) |
| PickupCard press | touch | 200ms | spring | — | scale(1→0.98) |
| Button press | touch | 200ms | spring | — | scale(1→0.97) |

## Known Issues

| Issue | Status |
|-------|--------|
| Ride cancellation bug: backend `cancelRide` uses `.eq('driver_id', driverId)` — rider cancel fails with 404 | Deferred |
| `"reactCompiler": true` in `app.json` experiments — user says no launch issue | Left as-is |
| `app/(confirm).tsx` route still exists but confirm flow moved into sheet | Unused but harmless |
| `ride-tracking-screen.tsx` — pre-existing eslint error: `useEffect` after early return (`react-hooks/rules-of-hooks`) | Pre-existing, untouched |

## Flow Motion 3D Transition Engine

Source of truth: `docs/Flow_Motion.md` + `docs/FLOW_MOTION_COMPONENTS.md`. Motion only — no layout/color/spacing/typography changes.

### New Infrastructure

| Status | File | Purpose |
|--------|------|---------|
| ✓ | `constants/flow-motion.ts` | Motion tokens: `timing` (320/350/380ms), `spring` (stiffness 320, damping 28, mass 0.9), `camera` (perspective 1000, rotateY 12°, rotateX 2°, scale 0.985→1, translateX 24), `layers` (map 0.05 → overlay 0.8), `press` (scale 0.96, lift 2) |
| ✓ | `components/flow/FlowCamera.tsx` | Camera engine: `cameraTransform(progress, factor)` worklet (perspective + rotateY + rotateX + scale + translateX), `useFlowCamera()` hook, `FlowCamera` wrapper. UI-thread only. |
| ✓ | `components/flow/FlowView.tsx` | Root screen wrapper — plays 3D entrance on mount (spring 320/28/0.9, rotated → straight, `factor` default 0.6 to keep native maps safe under 3D) |
| ✓ | `components/flow/FlowSurface.tsx` | Card/panel surface: subtle rotateY (≤2°), scale, translateY; `progress` (external morph) or `entrance` (auto) + `delay` |
| ✓ | `components/flow/FlowParallax.tsx` | Layer separator: `translateY`/`rotateX`/`scale` proportional to `progress × factor × amplitude` — background moves least, foreground most |
| ✓ | `components/flow/FlowSheet.tsx` | Bottom-sheet morph engine: `state` + `<FlowSheet.Pane name>` children. Outgoing pane rotates away (+Y, scale 0.985, fade-secondary) while incoming arrives (−Y) in one continuous surface. 45%/55% timing split, queues rapid state changes, `runOnJS` callbacks, no remount flash |
| ✓ | `components/flow/PressableScale.tsx` | Press primitive: scale → 0.96 + translateY lift −2 on press (spring 500/32), back via flow spring. No opacity flash, no Android ripple. `style` applied to inner animated view |
| ✓ | `components/flow/index.ts` | Barrel export |

### Integration (motion only)

| Status | File | Change |
|--------|------|--------|
| ✓ | `app/_layout.tsx` | Stack `screenOptions` — added `animation: "none"` (kills default slide; FlowView provides 3D entrance). Routes untouched |
| ✓ | `screens/rider/home-screen.tsx` | Wrapped in `FlowView`; map → `FlowParallax(factor=flowLayers.map)`; avatar + location button → `FlowParallax(factor=flowLayers.controls)`; new `useSharedValue(0)` passed as `animatedIndex` to `BottomSheet` → continuous parallax depth while sheet drags |
| ✓ | `components/BottomSheet/AnimatedSection.tsx` | Upgraded internals: camera morph (rotateY ≤6°, translateY, scale, secondary opacity) via `flowSpring` instead of pure fade+slide. Same props (`visible/delay/direction`) — zero caller changes |
| ✓ | `components/BottomSheet/BottomSheetContent.tsx` | Computed `phase` (`search | pickup | options | booking`) routed through `<FlowSheet state={phase}>` with 4 panes — states now **morph** with 3D camera instead of remounting. All opacity-flash presses → `PressableScale` (Current Location, pickup/dest result cards, recent places, ride option cards, Find Ride) |
| ✓ | `components/ride/ride-state-screen.tsx` | Wrapped in `FlowView` |
| ✓ | `components/ride/ride-selection-screen.tsx` | Wrapped in `FlowView` |
| ✓ | `components/ride/ride-tracking-screen.tsx` | Wrapped in `FlowView`; End ride / Cancel / View summary → `PressableScale` |
| ✓ | `components/ride/ride-complete-screen.tsx` | Wrapped in `FlowView`; Back to home → `PressableScale` |
| ✓ | `components/ride/ride-confirmation-screen.tsx` | Wrapped in `FlowView`; Confirm → `PressableScale` |
| ✓ | `components/ride/ride-options-sheet.tsx` | Ride option cards + Confirm ride / Back → `PressableScale` (no opacity) |
| ✓ | `components/PickupCard.tsx` | Press feedback → `PressableScale` (0.96, spring back, no bg-darken flash) |

### Verified

- `npx tsc --noEmit`: no new errors (only pre-existing `driver-app/*` + `ride-store.ts vehicleType`).
- `npx expo lint`: no errors in flow files; only pre-existing warnings + the pre-existing `ride-tracking-screen` hooks error.

### Future screens

`FlowCamera`/`useFlowCamera`, `FlowParallax`, `FlowSurface`, `FlowSheet`, `PressableScale` are exported standalone so future Profile / Menu screens inherit the Flow Motion language automatically. No Profile/Menu screens created (out of scope).

## Rider Profile (Version 1) — `/profile` Route

Source of truth: `docs/FLOW_MOTION_TRANSITIONS.md` (Home → Profile: camera shifts, current content rotates away, profile rotates toward the user, exact reverse on return).

Architecture decision: keep Expo Router + native stack (`animation: "none"`); the camera transition lives at the content layer as **reusable Flow Motion primitives** so future screens (Ride History, Saved Places, Settings) inherit the same behavior.

### New Files

| Status | File | Purpose |
|--------|------|---------|
| ✓ | `components/flow/FlowScreen.tsx` | Reusable screen primitive: `useFlowScreen()` hook (owns entrance spring `1→0` on mount + `exit(onDone)` reverse `0→1`), `FlowScreen` presentational wrapper (content layer `cameraTransform(progress)`, optional **snapshot** layer `cameraTransform(1−progress)` that starts flat matching Home and rotates away during the first portion, then unmounts once `settled` so it never reappears on exit), `FlowStagger` (sequential 25ms camera entrance per child, factor ~0.3) |
| ✓ | `components/profile/ProfileListItem.tsx` | Reusable Flow Motion row: Ionicons icon in 40dp `#F5F5F5` 12-radius square → title 16 Medium → optional subtitle 14 Regular → `chevron-forward`. `PressableScale scaleTo={0.97}` + soft elevation. Min height 60dp, no ripple/opacity |
| ✓ | `screens/rider/profile-screen.tsx` | `ProfileScreen` (uses `useFlowScreen`; header: back button, 72dp avatar + initial, name 24 SemiBold, phone 16 Regular, Edit Profile 14 Medium; 2 section labels 18 SemiBold; exactly 8 menu items — Account: Personal Information / Ride History / Saved Places / Emergency Contacts / Notifications; Support: Help & Support / Privacy / About Velos; bordered Sign Out → `signOut()` after reverse exit; `BackHandler` → reverse exit then `router.back()`) + `HomeSnapshot` (avatar bubble + locate button + sheet card silhouette — static Home skeleton shown during entrance) |
| ✓ | `app/profile.tsx` | Route entry — renders `ProfileScreen` (mirrors `app/index.tsx`) |

### Modified

| Status | File | Change |
|--------|------|--------|
| ✓ | `app/_layout.tsx` | Registered `<Stack.Screen name="profile" />` |
| ✓ | `screens/rider/home-screen.tsx` | Avatar (only): wrapped in `PressableScale` (`router.push("/profile")`), initial now derived from `user.full_name` instead of hardcoded `"U"` |

### Behavior

- Tap avatar → native push (no default transition) → profile content rotates in via `cameraTransform` while the `HomeSnapshot` layer (flat at t=0) rotates away — reads as "camera moved from Home to Profile". Header → avatar → name → phone → rows stagger in at 25ms each.
- Back button / Android hardware back → exact reverse: content rotates away (0→1) and the underlying Home is revealed, then `router.back()` pops (animation none → clean cut).
- Menu rows are tactile only (`PressableScale` 0.97 + soft elevation) — no dead navigation, no placeholder screens. Sign Out runs `useAuth().signOut()` after the reverse exit.

### Verified

- `npx tsc --noEmit`: no new errors (only pre-existing `driver-app/*` + `ride-store.ts vehicleType` + `backend/services/rideAPI.ts`).
- `npx expo lint`: no issues in flow/profile/home files; only pre-existing warnings + the pre-existing `ride-tracking-screen` hooks error.
- Regenerated `.expo/types/router.d.ts` via `expo start` so `/profile` is part of typed routes.

## Functional Profile Menu (all 8 items)

Previously the 8 menu rows were tactile-only (press feedback, no action). Now each item is a real destination screen that reuses `FlowScreen` (camera entrance + reverse exit + stagger) via a shared shell — future screens inherit the same behavior automatically.

### Backend — Ride History endpoint

| Status | File | Change |
|--------|------|--------|
| ✓ | `backend/src/controllers/ride.controller.js` | Added `getRiderRideHistory` — `rides` where `rider_id` = param, excluding active statuses, `order(created_at, desc)`, `limit(50)` |
| ✓ | `backend/src/routes/ride.routes.js` | Added `GET /rider/:riderId/history` (protect) |

### Rider service

| Status | File | Change |
|--------|------|--------|
| ✓ | `services/ride.service.ts` | Added `getRiderRideHistory(riderId): Promise<Ride[]>` |

### Shared Flow Motion infra

| Status | File | Purpose |
|--------|------|---------|
| ✓ | `components/profile/SubScreen.tsx` | Reusable destination shell (`forwardRef`): `useFlowScreen` + `FlowScreen` + back button + 24 SemiBold title + `FlowStagger` body + hardware-back → reverse exit → `router.back()`. Exposes `goBack()` via ref for action-then-back flows |
| ✓ | `components/profile/SettingRow.tsx` | Icon + label + subtitle + styled `Switch` (track `#111111`/`#E5E7EB`) |
| ✓ | `services/local-store.ts` | Typed AsyncStorage helpers: saved places, emergency contacts, notification prefs (JSON under `rideway:` keys) |

### Destination screens (`screens/profile/`)

| File | Behavior |
|------|----------|
| `personal-info-screen.tsx` | Edit name + phone → `updateProfile` + `refreshProfile()` → reverse-exit back. Validation (name ≥2, phone ≥10), saving spinner, Alert on error |
| `ride-history-screen.tsx` | Fetches `getRiderRideHistory`; loading / error / "No rides yet" empty state; rows: pickup → drop, date · `Rs fare`, Completed/Cancelled pill |
| `saved-places-screen.tsx` | Search (`searchDestinations`) → tap result to save name+address locally; delete row; empty state |
| `emergency-contacts-screen.tsx` | Add name/phone (validation); call via `Linking.openURL("tel:…")`; delete; empty state |
| `notifications-screen.tsx` | Ride updates / Promotions / Service alerts toggles persisted locally (no push infra — V1 local prefs) |
| `help-screen.tsx` | Static content: booking, pickup, cancellation, fares |
| `privacy-screen.tsx` | Static privacy text |
| `about-screen.tsx` | App mark, "Velos", version via `expo-constants` |

### Routes + wiring

| Status | File | Change |
|--------|------|--------|
| ✓ | `app/{personal-info,ride-history,saved-places,emergency-contacts,notifications,help,privacy,about}.tsx` | 8 route files (mirror `app/profile.tsx`) |
| ✓ | `screens/rider/profile-screen.tsx` | Each `ProfileListItem` now has `onPress={() => router.push("/…")}` |
| ✓ | `app/_layout.tsx` | Registered the 8 new `Stack.Screen` entries |

### Verified

- `node --check` passes on both backend files.
- `npx tsc --noEmit`: no new errors (only pre-existing `driver-app/*` + `ride-store.ts vehicleType` + `backend/services/rideAPI.ts`).
- `npx expo lint`: no issues in new files; only pre-existing warnings + the pre-existing `ride-tracking-screen` hooks error.
- Regenerated `.expo/types/router.d.ts` — all 8 new routes typed.

### Notes

- Help/Privacy/About are static content (no fabricated support links/contacts).
- Notifications toggles are local preferences only until push-notification infra exists.
- Fares/date formatting match existing ride screens (`Rs {fare}`).

## In-screen Profile Surface (FlowSurface)

Replaces the `/profile` route push with an in-screen Flow Motion presentation so the Home screen stays mounted and the map stays alive underneath — no blank gap (root cause: dual semi-transparency crossfade + screen-sized planes translating right under a pushed opaque route).

### New / rewritten

| Status | File | Change |
|--------|------|---------|
| ✓ | `components/flow/FlowSurface.tsx` | **Rewritten.** `useFlowSurface()` hook: `open` SharedValue (0 = Home, 1 = surface), `visible` state, `present()` (spring → 1), `dismiss()` (spring → 0, `runOnJS(setVisible(false))` on finish so the layer unmounts only after the close spring completes). `FlowSurface` component renders two absolute-fill layers: **world** = `cameraTransform(open, worldFactor)` (rotates away), **layer** = `cameraTransform(1 − open, layerFactor, mirror: true)` (rotates into view from the opposite side). Complementary transforms keep an opaque union at every frame → root background never exposed. White backstop on container |
| ✓ | `components/flow/FlowCamera.tsx` | `cameraTransform(progress, factor, mirror?)` + `useFlowCamera` + `FlowCamera` — added `mirror` param that negates rotateY/rotateX/translateX |
| ✓ | `constants/flow-motion.ts` | Added `flowSurface = { world: 0.6, layer: 1 }` |
| ✓ | `components/flow/index.ts` | Export `useFlowSurface` |
| ✓ | `screens/rider/profile-screen.tsx` | `ProfileScreen` → `ProfileSurface({ onClose })`: dropped `useFlowScreen`/`FlowScreen`/`BackHandler`/`HomeSnapshot`; kept design + `FlowStagger` + Sign Out (`signOut()` directly, no reverse-exit router pop); deep items still `router.push("/…")` |
| ✓ | `screens/rider/home-screen.tsx` | `useFlowSurface()`; avatar `onPress` → `present()` (removed `router.push("/profile")`); whole screen (map parallax + avatar + locate + BottomSheet) is the world slot; `<ProfileSurface onClose={dismiss}>` in the layer slot; `BackHandler` dismisses the surface first when visible |
| ✓ | `app/profile.tsx` | Deleted (no longer a route) |
| ✓ | `app/_layout.tsx` | Removed `<Stack.Screen name="profile" />` (8 deep screens kept) |

### Behavior

- Tap avatar → Home rotates right (world, factor 0.6) while Profile rotates in from the left (layer, mirror) — both planes overlap for the whole spring, so no blank/root background at any frame. Map stays mounted/live underneath.
- Back button / Android hardware back → exact reverse spring; layer unmounts only after the close completes.
- `FlowSurface` is reserved for top-level surfaces (Profile, future Menu). Deeper navigation (Ride History, Saved Places, Edit Profile…) still uses routed `SubScreen` Flow Motion entrances.

### Verified

- Regenerated `.expo/types/router.d.ts` via `expo start` — `/profile` removed, all 8 deep routes still typed.
- `npx tsc --noEmit`: no new errors (only pre-existing `driver-app/*` + `ride-store.ts vehicleType` + `services/rideAPI.ts`).
- `npx expo lint`: no issues in changed files; only pre-existing warnings + the pre-existing `ride-tracking-screen` hooks error.

## FlowSurface Transition Performance

Problem: Home → Profile rotation was correct but there was a noticeable delay before the first animation frame.

### Root cause

`useFlowSurface().present()` did `setVisible(true)` then started the spring. The `visible` toggle forced React to **mount the entire `ProfileSurface` subtree on the JS thread** (ScrollView + ~17 `FlowStagger` entries each allocating a shared value + Ionicons glyphs + font/layout measurement) synchronously inside the same commit that handed the spring to the UI thread — the JS-thread mount blocked the first frames. Home re-renders also recreated the `world`/`layer` JSX every render, so the heavy subtrees re-rendered on unrelated store updates too.

### Changes

| Status | File | Change |
|--------|------|--------|
| ✓ | `components/flow/FlowSurface.tsx` | **Layer is always mounted** (no conditional `visible ? layer : null`). Visibility is driven purely on the UI thread: `layerStyle.opacity = open.value` (0 closed → 1 open) with the mirrored `cameraTransform`; `pointerEvents` toggled by React `visible` (auto when open, none when closed) so Home stays interactive while closed. Added `FlowSurfaceOpenContext` + `useFlowSurfaceOpen()` so children can replay entrances on open. Wrapped world/layer in `<Profiler id="flow-surface-world|layer">` with `logRender` console timing (Profiler is stripped in production builds) — measures which subtree renders during transitions |
| ✓ | `components/flow/FlowScreen.tsx` | `StaggeredEntry` reads `open` via `useFlowSurfaceOpen()` and uses `useAnimatedReaction` (UI thread) to detect `open: 0→1` and **replay the 25ms stagger** by resetting `progress` → 1 and re-running `withDelay(withSpring(0))` — no remount, no JS-thread work. Under a surface it re-staggers per open; outside a surface (SubScreen routes) it keeps mount-time entrance |
| ✓ | `screens/rider/profile-screen.tsx` | `ProfileSurface` wrapped in `React.memo` (stable `onClose` → never re-renders on Home store updates). Menu rows built from module-scope `ACCOUNT_ITEMS`/`SUPPORT_ITEMS` config arrays memoized with `useMemo` → icons/list items are created once and reused across navigations |
| ✓ | `components/profile/ProfileListItem.tsx` | Wrapped in `React.memo` |
| ✓ | `screens/rider/home-screen.tsx` | `world` (map/avatar/locate/BottomSheet) and `layer` (`<ProfileSurface onClose={dismissProfile}/>`) elements wrapped in `useMemo` with explicit deps — Home re-renders (store updates, `visible` toggle) reuse the identical element references so React bails out of re-rendering the subtrees. BackHandler effect deps narrowed from the recreated `profile` object to `[surfaceVisible, dismissProfile]` (no more re-subscribe every render) |

### Result

- Tapping the avatar now only flips `pointerEvents` + starts the spring — zero subtree mounts on the JS thread → animation begins on the first frame.
- Stagger still plays on every open (UI thread via `useAnimatedReaction`), preserving the entrance animation without remounting.
- Icons, avatar, fonts and list items are mounted once at Home-ready and reused; they are not recreated on navigation.
- All animation (layer opacity, camera transforms, stagger) runs on the Reanimated UI thread.
- Dev-only measurement: `[flow-surface] flow-surface-layer mount/update actual=…ms base=…ms` logs in the console during the transition.

### Verified

- `npx tsc --noEmit`: no new errors (only pre-existing `driver-app/*` + `ride-store.ts vehicleType` + `services/rideAPI.ts`).
- `npx expo lint`: no issues in changed files; only pre-existing warnings + the pre-existing `ride-tracking-screen` hooks error.

### Fix: "Rendered more hooks than previous render"

The `world`/`layer` `useMemo`s were originally placed **after** the `loadingLocation` / `permissionDenied` early returns in `home-screen.tsx`. When location resolved on the same mounted instance, the hook count jumped by 2 → React threw. Moved both `useMemo`s above the early returns (after the `rideStatus` tracking `useEffect`) so they run on every render. Because `location` can be `null` at that point, the `RideMap` is now guarded with `{location ? <RideMap …/> : null}` (TS prop requires non-null `Coordinates`).

### Fix: blank gap in Profile navigation

Root cause: the routed deep screens (Profile → Ride History / Saved Places / Help / etc.) push with `stackAnimation: "none"` and render via `FlowScreen` (SubScreen). With `animation: "none"`, native-stack detaches the previous screen instantly on both platforms — the Profile/home is **not** visible beneath a pushed screen. Meanwhile `FlowScreen`'s content layer started at `opacity: 0` at mount, so the first frame(s) were bare white → a blank gap with no overlap. (A transparent `contentStyle` does not help: there is no screen behind the push to show through.)

Fix (no routing/design change): make the deep-screen content **visible from frame 1** so there is never an invisible/blank frame, and keep a solid white background beneath the motion so no root is ever exposed.
- `components/flow/FlowScreen.tsx` — `useFlowScreen` gains an `opacity` shared value (starts `1`). The content layer is now `opacity: opacity.value` (fully visible from mount) with the `cameraTransform(progress, 0.9)` settle — the entrance is the camera motion, no crossfade. On `exit()`, `opacity` springs → 0 (content fades out) while `progress` springs → 1 (camera moves out), and the caller's `onDone` (→ `router.back()`) fires only after the spring finishes. Root background is opaque `#FFFFFF`. `FlowStagger` gains a `fromOpacity` prop (default `0`, preserving the Profile-surface behavior) so a surface can start its children faintly visible instead of at `0`.
- `components/profile/SubScreen.tsx` — passes `opacity` to `FlowScreen` and uses `<FlowStagger fromOpacity={0.5}>` so the back button/title/rows are faintly visible at the very first frame (no void while the stagger plays).
- `app/_layout.tsx` — deep-screen `contentStyle` set to opaque `#FFFFFF` (was transparent) so the strip exposed by the camera settle is white-on-white, continuous with the Profile.

Result: on push, the deep screen shows its content immediately (opaque, slightly shifted) and camera-settles into place while rows rise to full opacity — no blank/root frame. On back, content fades + slides out over white, then pops to reveal the Profile. Note: true screen-overlap is not achievable with native-stack `animation: "none"` (the platform detaches the previous screen instantly), so continuity is achieved via matching white backgrounds + instant content visibility instead of an overlapping backdrop.
