# Dashboard Flow (`velos-dashboard/`)

Routes `/, /operations, /rides, /drivers, /kyc` (`router/index.tsx`). `apiClient` (`VITE_API_BASE_URL`, `x-dashboard-key`). Backend `dashboard.routes` (stats, rides list/detail, drivers list/detail/KYC, `POST …/kyc/review`).

- Overview: metrics + recent rides + attention.
- Rides: filters + drawer + timeline.
- Drivers: list + drawer + KYC dialog.
- Operations: summary + map + panels + active rides (⚠️ map/table partly mock `mockOperations.ts`).
- ✅ Read/KYC paths implemented; ⚠️ operations live-data partial.
