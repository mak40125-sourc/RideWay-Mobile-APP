# Velos Dashboard — V1 Architecture

This document describes the code structure and technical conventions for
Velos Dashboard V1. It covers the foundation only; feature-level design is
captured when each page is implemented.

## Tech Stack

| Concern      | Choice                         | Notes                                  |
| ------------ | ------------------------------ | -------------------------------------- |
| Build / dev  | Vite 8                         | HMR, `vite build`                      |
| UI runtime   | React 19 + TypeScript (strict) | `react-jsx`, bundler module resolution |
| UI library   | Material UI 9 (MUI)            | Only UI component library              |
| Data grid    | MUI X Data Grid 9              | `@mui/x-data-grid`                     |
| Routing      | React Router 7                 | Data router (`createBrowserRouter`)    |
| Server state | TanStack Query 5               | `@tanstack/react-query`                |
| Charts       | Recharts 3                     | `recharts`                             |
| Maps         | React Leaflet 5 + Leaflet      | `leaflet`, `@types/leaflet`            |
| Linting      | ESLint (flat config)           | `eslint.config.js`                     |
| Formatting   | Prettier                       | `.prettierrc.json`                     |

TypeScript is the project language; the template was created with TypeScript.

## Project Structure

Feature-oriented but not over-engineered. Shared infrastructure lives under
`src/app`; each V1 section lives in its own folder under `src/features`.

```
src/
├── main.tsx                  # ReactDOM mount, mounts AppProviders
├── App.tsx                   # Root: providers + router
├── index.css                 # Minimal global styles (MUI CssBaseline owns resets)
└── app/                      # App-wide infrastructure (not features)
    ├── AppProviders.tsx      # ThemeProvider, CssBaseline, QueryClientProvider
    ├── theme.ts              # MUI theme (palette, typography, shape)
    └── router/
        ├── index.tsx         # createBrowserRouter + route definitions
        └── paths.ts          # Route path constants
    └── layouts/
        └── AppLayout.tsx     # App shell: nav drawer + app bar + <Outlet/>
└── features/                 # One folder per V1 section
    ├── overview/OverviewPage.tsx
    ├── operations/OperationsPage.tsx
    ├── rides/RidesPage.tsx
    └── drivers/DriversPage.tsx
```

### Structure rules

- Each feature folder owns its page component and, as pages are implemented,
  its domain-specific components, hooks, and types.
- Cross-feature/shared code goes in `src/app/` only when it is truly
  app-wide; otherwise keep it inside the feature that uses it.
- No barrel files are required; import from explicit file paths.
- Do not add layers (services, repositories, state machines) until a feature
  demonstrably needs them.

## Routing

- React Router data router (`createBrowserRouter`) defined in
  `src/app/router/index.tsx`.
- `AppLayout` is the layout route; its children are the four V1 sections:
  - `/` → Overview (index route)
  - `/operations` → Operations
  - `/rides` → Rides
  - `/drivers` → Drivers
- Route paths are constants in `src/app/router/paths.ts` and used by both the
  router and the navigation drawer so links never drift from routes.
- V1 pages are statically imported. Code-splitting via `lazy`/`Suspense` is
  deferred until bundle size demands it.

## Server State & Data Fetching

- TanStack Query is the single source of truth for server state. No `useEffect`
  - `fetch` data loading pattern.
- One `QueryClient` created in `src/app/AppProviders.tsx` (default options:
  sensible stale time, retry 1).
- Query keys are feature-scoped and co-located in the feature folder.
- Mutations use `useMutation` with query invalidation on success.

## Theme

- `src/app/theme.ts` exports the MUI theme used by `ThemeProvider`.
- All colors, spacing, shape, and typography live in theme tokens (see
  `V1_DESIGN.md`); components reference tokens, never hard-coded values.
- `CssBaseline` is mounted in `AppProviders` so global resets follow the theme.

## Linting & Formatting

- ESLint flat config (`eslint.config.js`): `@eslint/js` recommended,
  `typescript-eslint` recommended, `eslint-plugin-react-hooks`,
  `eslint-plugin-react-refresh`, and `eslint-config-prettier` last to disable
  style rules ESLint should not own.
- Prettier config in `.prettierrc.json` (single quotes, no semicolons,
  trailing commas) matching the template style; `.prettierignore` excludes
  `node_modules`, `dist`, and lockfiles.
- Code must pass `npm run lint` and `npm run format:check` before merge.

## Scripts

```bash
npm run dev            # Vite dev server
npm run build          # tsc -b && vite build (type-check + production build)
npm run preview        # preview the production build
npm run lint           # ESLint over the project
npm run format         # Prettier write
npm run format:check   # Prettier check
```

## Conventions

- **Imports:** relative imports within `src`; no path alias is configured in V1
  (add only if imports get unwieldy).
- **Components:** default-export page components; named exports for shared
  pieces. Function components only, no class components.
- **Types:** `import type { … }` for type-only imports (`verbatimModuleSyntax`).
- **Accessibility:** labels/ARIA from MUI components preserved (see design doc).
- **No global CSS for layout;** MUI components + theme tokens are the styling
  system.

## Non-Goals (V1 Architecture)

- No state management library (Redux/Zustand/Jotai) — server state is TanStack
  Query; local UI state stays in React hooks.
- No form library, no validation library, no test framework wired yet.
- No API client module — the backend contract is not defined in this task.
- No i18n, no theming-switcher, no analytics, no auth.
