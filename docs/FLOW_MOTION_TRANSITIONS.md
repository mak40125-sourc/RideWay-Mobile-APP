# Flow Motion Transitions
### Velos Motion System
Version: 1.0

---

# Introduction

Flow Motion defines how movement behaves throughout Velos.

Motion is not decoration.

Motion communicates hierarchy, continuity, direction and intent.

Every animation should answer three questions:

• What changed?

• Where did it move?

• What should the user focus on?

If movement does not improve understanding,

it should not exist.

---

# Motion Philosophy

The application is one continuous environment.

Users should never feel that one screen disappeared and another appeared.

Instead,

the interface transforms naturally into its next state.

Movement should feel inevitable.

Nothing should surprise the user.

---

# Core Motion Principles

## Preserve Context

Always preserve visual continuity.

Avoid abrupt replacements.

Avoid flashes.

Avoid teleportation.

The previous interface should naturally evolve into the next.

---

## Components Transform

Components should change state instead of disappearing.

Example

Search

↓

Ride Options

↓

Searching

↓

Driver Assigned

These are states of one interface.

Not independent screens.

---

## Motion Has Weight

Everything has mass.

Large surfaces move slower.

Small controls move quicker.

Movement should feel physical.

Never robotic.

---

## Camera Instead Of Pages

Navigation is not page switching.

Navigation is camera movement.

The user feels as though they are moving around the interface,

not replacing it.

---

# Motion Layers

Flow Motion treats the interface as independent layers.

Layer 1

Map

Layer 2

Background Decorations

Layer 3

Floating Controls

Layer 4

Status Cards

Layer 5

Bottom Sheets

Layer 6

Dialogs

Every layer moves independently.

---

# Parallax

Depth is created through movement.

Background moves least.

Foreground moves most.

Example

Map

↓

10px

Floating Controls

↓

18px

Cards

↓

30px

Bottom Sheet

↓

42px

Never move all layers equally.

---

# Navigation

Every transition should preserve orientation.

Users should always understand

where they came from.

Navigation should feel like rotating around a physical object.

Never like loading another webpage.

---

# Home → Profile

Current screen remains visible.

↓

Camera shifts slightly.

↓

Current content rotates away.

↓

Profile rotates toward the user.

↓

Transition settles.

Returning follows the exact reverse path.

---

# Home → Menu

Menu originates from the floating menu button.

Sequence

Menu button compresses.

↓

Menu begins rotating.

↓

Home shifts slightly.

↓

Menu items enter sequentially.

↓

Everything settles.

The menu should never appear instantly.

---

# Bottom Sheet Motion

Bottom sheets never appear abruptly.

They grow naturally.

Searching

↓

Ride Options

↓

Searching Driver

↓

Driver Assigned

The sheet morphs between these states.

Never destroy and recreate.

---

# Shared Elements

Whenever possible,

reuse visible components.

Examples

Avatar

Search Bar

Location Card

Ride Card

Menu Button

These should move between interfaces rather than disappear.

---

# Timing

Small Components

180–220ms

Medium Components

220–280ms

Navigation

320–380ms

Complex Morphs

400–500ms

Never exceed 500ms.

Animations should feel responsive.

---

# Motion Curves

Default

Spring

Stiffness

320

Damping

28

Mass

0.9

No bounce.

No overshoot.

No elastic effects.

Movement should settle naturally.

---

# Opacity

Opacity is never the primary animation.

Use opacity only to support movement.

Never fade between entire screens.

Never fade navigation.

---

# Scale

Pressed Buttons

1.00

↓

0.96

Cards

1.00

↓

0.985

Never exaggerate scaling.

Scaling should be subtle.

---

# Rotation

Rotation communicates spatial change.

Avoid excessive rotation.

Small rotations feel premium.

Large rotations feel theatrical.

Maximum rotation

12°

---

# Perspective

All major navigation transitions should use perspective.

The interface exists in depth.

Not on a flat canvas.

Perspective should remain subtle.

Users should perceive it.

Not notice it.

---

# Performance

Maintain 60 FPS.

Animate GPU-friendly properties.

Prefer

Transform

Scale

Rotation

Translation

Opacity

Avoid animating layout whenever possible.

Avoid unnecessary re-renders.

---

# Motion Rules

Never animate simply because animation is possible.

Every movement should have meaning.

Never interrupt ongoing animations.

Allow gestures to influence motion naturally.

Maintain continuity across the application.

---

# Anti-Patterns

Never use

✕ Fade-only transitions

✕ Android default transitions

✕ iOS push animations

✕ Material Design page transitions

✕ Overshoot springs

✕ Bouncy cards

✕ Random delays

✕ Components teleporting

✕ Independent screen replacements

---

# Success Criteria

Users should never consciously think,

"That was a nice animation."

Instead,

they should simply understand where the interface moved.

The best Flow Motion transition is one the user never notices,

yet always understands.

Motion should become invisible.

When movement feels natural,

Flow Motion has succeeded.