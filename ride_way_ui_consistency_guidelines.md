# RideWay UI/UX — Polished Production Guidelines

Version: 2.0  
Design Goal: Premium, map‑first, Uber/Rapido class experience  
Primary Font: Neue Montreal

---

# 1. Core UX Philosophy

RideWay UI must feel:

- Fast
- Calm
- Map-first
- Minimal
- Touch-friendly
- One-action focused

Golden UX rule:

User should be able to book a ride in **2 taps**.

---

# 2. Screen Layout Blueprint (Polished)

```
Full Screen Map

Top Overlay
 ├── RideWay Logo (left)
 └── Profile Pill (right)

Center
 └── Pickup Marker (always visible)

Bottom Sheet (Primary Interaction)
```

Map must always remain visible behind UI.

---

# 3. Top Header (RideWay Style)

## Layout

Left:
- RideWay logo text
- Subtitle: "Pickup, match, ride"

Right:
- Profile pill button

## Style Rules

Height: 56  
Position: absolute  
Top padding: SafeArea + 8  
Background: transparent

Profile Button:

- Background: white
- Padding: 10 horizontal
- Radius: 999
- Shadow: light

---

# 4. Bottom Sheet (Polished RideWay Design)

## Visual Rules

- Radius: 24
- Padding: 20
- Handle width: 36
- Handle height: 4
- Background: white

## Spacing

| Element | Spacing |
|---------|---------|
| Handle → Label | 12 |
| Label → Title | 6 |
| Title → Search | 16 |
| Search → Pickup | 12 |

---

# 5. Typography (Neue Montreal)

## Title

"Where to?"

Size: 26  
Weight: 700  
Line height: 30

## Section Label

"START YOUR TRIP"

Size: 11  
Weight: 600  
Letter spacing: 1.2

## Body

Size: 14  
Weight: 400

---

# 6. Search Box (RideWay Polished)

Height: 52  
Radius: 14  
Padding: 14  
Background: #F5F5F5

Layout:

```
[ search icon ]  Search destination
```

Optional:
- left icon
- right clear button

---

# 7. Pickup Text Style

Primary:

Pickup: address

Secondary:

Tap to refresh

Spacing: 4px between lines

---

# 8. Map Controls Cluster

Right side floating controls:

```
Locate button
Refresh button
More button
```

Rules:

- stack vertically
- 12 spacing
- size 44x44
- circular
- white background

Position:

Above bottom sheet
Right margin: 16

---

# 9. Polished Layout Measurements

Top Header Height: 56  
Bottom Sheet Collapsed: 180  
Map Visible: ~72% screen  
Search Height: 52  
Button Radius: 14  
Sheet Radius: 24

---

# 10. Final Polished UI Hierarchy

```
RideWay
Pickup, match, ride

                 [ Profile ]

      (map with marker)

------------------------------

START YOUR TRIP
Where to?

[ Search destination ]

Pickup: current location
Tap to refresh
```

---

# 11. Color System

Primary Text: #111111  
Secondary Text: #6B7280  
Background: #FFFFFF  
Search BG: #F5F5F5  
Accent: #111111  
Handle: #D1D5DB

No bright colors allowed on home screen.

---

# 12. Shadows

Single shadow system:

```
shadowColor: #000
shadowOpacity: 0.06
shadowRadius: 10
elevation: 4
```

---

# 13. Animation

Allowed:

- bottom sheet slide
- marker pulse
- button press scale

Avoid:

- long fades
- screen transitions

---

# 14. UX Copy Rules

Use short conversational text.

Allowed:

- Where to?
- Enter destination
- Choose ride

Avoid:

- long sentences
- marketing text

---

# 15. Component Mapping

Header → home-header.tsx  
Map → home-map.tsx  
Bottom Sheet → home-search-sheet.tsx  
State → home-state-screen.tsx  
Flow → home-flow-screen.tsx

---

# 16. Font Enforcement

All components must use:

Neue Montreal

No system font fallback unless loading.

---

# 17. Polished RideWay Look Checklist

Before merging UI:

- Map dominates screen
- Bottom sheet radius 24
- Search height 52
- Neue Montreal applied
- Spacing consistent
- No bright colors
- Profile pill white

---

# 18. Final Golden Rule

RideWay UI must feel:

Uber level clean  
Rapido level fast  
Apple level minimal
