# Velos Dashboard — V1 Design

This document captures the visual and UX direction for Velos Dashboard V1. It
defines shared conventions only; page-level layout is defined when the pages are
implemented.

## Visual Direction

- **Operational console, not marketing site.** Screens answer "what is happening
  right now?" Density is acceptable where it serves monitoring; whitespace is
  never decorative filler.
- **Calm and neutral.** A quiet surface, one accent color, clear hierarchy.
  High-contrast color is reserved for data and status, never for decoration.
- **Consistency.** A single component library (Material UI) everywhere. No
  bespoke UI primitives, no mixed component sources.
- **Progress, not noise.** Loading skeletons, empty states, and error states are
  first-class UI, not afterthoughts.

## MUI Theme Principles

- Theme is defined centrally in `src/app/theme.ts` via MUI's `createTheme`.
- All colors, typography, spacing, shape, and elevation come from theme tokens;
  components never hard-code hex values or raw pixel values. This keeps dark
  mode possible later without refactoring.
- Customize MUI by overriding component defaults and styles in the theme rather
  than re-styling per-instance.
- Keep `CssBaseline` mounted so resets and theme defaults apply globally.

## Typography

- Use MUI's default type scale (Roboto stack) customized via theme tokens.
- Hierarchy: page title (`h5`/`h6` scale), section headings, body, caption.
  Keep at most one prominent size per screen.
- Numbers and data (metrics, table cells) use tabular figures so columns align.

## Spacing

- Base unit is `8px` (MUI default). Use the theme spacing scale
  (`theme.spacing(n)`) — `1` = 8px, `2` = 16px, `3` = 24px — never arbitrary
  pixel values in components.
- Page content padding: `3` (24px) on desktop, `2` (16px) on small screens.
- Card/panel internal padding: `2`–`3`. Tight table/card spacing: `1`–`2`.
- Consistent gutters between adjacent cards in a grid (e.g., `Grid` `spacing={2}`).

## Colors

- Start from the MUI default light palette; refine with a restrained brand
  palette (a single primary accent, muted grays for surfaces and borders) once
  the brand color is agreed.
- Surfaces: default `background.default` / `background.paper` for the app
  background and card/table surfaces. Use subtle contrast (not heavy shadows)
  to separate surfaces.
- Text: MUI `text.primary`, `text.secondary`, `text.disabled`.
- Accent/brand: applied to primary actions, active navigation, and key data
  highlights only.

## Border Radius

- MUI default `shape.borderRadius` (`4px`) as the base for controls and inputs.
- Cards and panels may use a slightly larger radius (`8px`) via
  `shape.borderRadius` override or component style overrides; keep one radius
  per surface family so the system stays consistent.

## Elevation

- Prefer border + background contrast over shadows for surface separation.
- Use low MUI elevation (1–2) for floating elements like menus, popovers, and
  the app bar; do not stack shadows on cards by default.

## Status Colors

- Status uses MUI semantic palette: `success`, `warning`, `error`, `info`.
- Status is conveyed by **color plus text/icon**, never color alone
  (accessibility). Examples: a status chip with label text and a tinted
  background, not just a colored dot.
- Avoid saturated red/green floods; use tinted backgrounds with darker text.

## Navigation Appearance

- Persistent left navigation drawer lists the four V1 sections: Overview,
  Operations, Rides, Drivers.
- Active section: filled `ListItemButton` with the primary color tint and the
  accent applied to the leading icon.
- Each item: an icon (`@mui/icons-material`) plus a text label. Collapsible on
  small screens.
- Top app bar: product identity, page context, and context-agnostic actions.

## Tables

- All tabular data uses MUI X Data Grid (sorting, filtering, pagination,
  column density, responsive density toggle).
- Compact density for monitoring views; standard density for detailed lists.
- Header cells: `text.secondary`, small/medium size; body cells tabular figures.
- Row interactions (select, view) exposed via row actions; empty states render
  the Data Grid's built-in "no rows" state.

## Drawers

- Navigation drawer: permanent (fixed, ~240px) on desktop, temporary overlay on
  small screens via `variant="permanent"` → `variant="temporary"`.
- Detail/forms drawers: right-side temporary drawers, width 360–480px, for
  record details and edit forms.
- Scrim closes on outside click / Escape; drawer content scrolls internally.

## Cards

- Use MUI `Card` for metrics, summaries, and grouped content.
- Metric card anatomy: label (caption), value (large tabular figure), optional
  delta/status line.
- Cards in a grid have equal height and consistent internal padding; avoid
  nested cards — use a `CardContent`/`Divider` layout instead.

## Responsive Behavior

- Breakpoints follow MUI defaults (`sm` 600px, `md` 900px, `lg` 1200px).
- Drawer: permanent on `lg`, temporary overlay below `lg`.
- Metric grids: 1 column on `xs`, scaling up to 4 columns on `lg`.
- Data Grid uses responsive density and horizontal scroll instead of truncation.
- Touch targets remain ≥ 40px on small screens.

## Motion Principles

- Keep motion minimal and purposeful; use MUI transition tokens
  (`theme.transitions`), not bespoke animation libraries.
- Standard durations: ~150–200ms for micro-interactions, ~300ms for drawers and
  dialogs; ease curves from MUI defaults.
- Respect `prefers-reduced-motion`: MUI's built-in support is preserved; no
  infinite or decorative animation in V1.

## Accessibility Baseline

- All interactive elements focusable and labeled.
- Color contrast satisfies WCAG AA for text on the default theme.
- Semantic HTML (headings, `main`, `nav`) used via MUI components.
- Keyboard: navigation, drawer toggles, and dialogs are fully keyboard-reachable.

## Non-Goals (Design)

- No design system outside MUI tokens.
- No custom icon set; use `@mui/icons-material`.
- No motion/choreography spec beyond the principles above.
