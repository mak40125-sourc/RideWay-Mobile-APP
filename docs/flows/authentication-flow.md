# Authentication Flow

```mermaid
sequenceDiagram
  App->>SecureStore: getSession (persisted)
  App->>Auth: INITIAL_SESSION event
  Auth->>Auth: first-wins resolveInitialAuth
  Auth->>App: BOOTSTRAPPING→AUTHENTICATED|UNAUTHENTICATED
  App->>API: Bearer token (supabaseAdmin.auth.getUser)
  Auth->>API: getProfile (parallel, versioned)
```

- Rider: `context/auth-context` + token mirror `supabase_token`; gating unauth→Login, no-name→ProfileCreation.
- Driver: tri-state + `StartupGate` + `StartupSplashGate`; `TOKEN_REFRESHED` never re-enters BOOTSTRAPPING; `home` respects `authState`.
- Dashboard: `x-dashboard-key` vs `DASHBOARD_API_KEY`.
- ✅ IMPLEMENTED.
