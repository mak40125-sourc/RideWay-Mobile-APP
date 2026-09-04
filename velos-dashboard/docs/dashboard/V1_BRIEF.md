# Velos Dashboard — V1 Brief

Status: Foundation (structure established; pages not yet implemented)

## Purpose

Velos Dashboard V1 is the front-end control surface for the Velos ride-hailing
operation. V1 delivers a single-page dashboard that lets operators monitor and
manage the core of the business: operational activity, rides, and drivers.

## V1 Scope

V1 contains exactly four top-level sections:

1. **Overview** — high-level operational snapshot of the day.
2. **Operations** — operational state and current activity.
3. **Rides** — ride records and ride management.
4. **Drivers** — driver records and driver management.

Feature details for each section are out of scope for this foundation task and
are defined when those pages are implemented.

## Non-Goals (V1)

- No authentication or user management.
- No billing/payments, pricing, or finance screens.
- No mobile client work.
- No real-time push (e.g., WebSockets) wiring yet.
- No changes to the Velos backend or any other project.

## Tech Stack (locked)

- **React 19** + **Vite 8** (build/dev tooling, HMR)
- **TypeScript** — strict, bundler-mode project references
- **Material UI (MUI)** — the _only_ UI component library
- **MUI X Data Grid** — data tables
- **React Router v7** — routing
- **TanStack Query v5** — server state / data fetching
- **Recharts** — charts
- **React Leaflet** — maps
- **ESLint** (flat config) + **Prettier** — linting and formatting

### Explicitly excluded

Tailwind CSS, Bootstrap, Ant Design, Chakra UI, shadcn/ui, any other component
library, and any pre-built admin dashboard template.

## How to Work in This Repo

```bash
npm install        # install dependencies
npm run dev        # start dev server
npm run lint       # ESLint
npm run format     # Prettier (write)
npm run format:check  # Prettier (verify)
npm run build      # type-check + production build
```

## Related Documents

- `docs/dashboard/V1_DESIGN.md` — visual and UX direction.
- `docs/dashboard/V1_ARCHITECTURE.md` — code structure and conventions.
