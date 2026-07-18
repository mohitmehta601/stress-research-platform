# Stress Research Platform Architecture

This project now follows the same high-level workspace layout as the referenced research platform while keeping the stress-study domain intact.

```text
stress-research-platform/
  backend/
  frontend/
  app/
  database/
  docs/
```

## Backend

`backend/` is the Express and MongoDB API.

```text
backend/src/
  server.js
  config/
  middleware/
  models/
  routes/
    api.js
    compat/
      stressResearchRoutes.js
  services/
  utils/
```

- `routes/api.js` is the stable API router mounted by `server.js`.
- `routes/compat/stressResearchRoutes.js` contains the existing stress research API surface so current frontend and participant app calls remain compatible.
- Future route modules should be split by workflow, such as auth, participants, sessions, physiological data, questionnaires, doctor assessments, exports, and notifications.

## Researcher Dashboard

`frontend/` is the Vite React dashboard for researchers and admins.

```text
frontend/src/
  App.tsx
  contexts/
    AuthContext.tsx
  lib/
    routeAuthorization.ts
  services/
    apiClient.ts
  components/
    DashboardLayout.tsx
    Sidebar.tsx
    ui/
  pages/
```

- `AuthContext` owns dashboard session restoration.
- `routeAuthorization` centralizes dashboard role checks.
- `DashboardLayout` owns the shell, sidebar, topbar, notifications, search, and logout controls.
- `apiClient` reads `VITE_API_BASE_URL`, with `VITE_API_URL` still supported for older local env files.

## Participant App

`app/` is the Vite participant app prototype.

```text
app/src/
  main.tsx
  app/
    RootParticipantApp.tsx
  features/
    prototype/
      StressSensePrototype.tsx
  services/
    apiClient.ts
  shared/
  styles/
```

- `RootParticipantApp` is now a thin runtime entrypoint.
- The large prototype screen flow lives under `features/prototype` so it can be decomposed gradually into auth, consent, profile, recording, questionnaire, history, and researcher preview modules.
- `apiClient` reads `VITE_API_BASE_URL`, with `VITE_API_URL` still supported for compatibility.

## Local Commands

```powershell
cd backend
npm run dev

cd ..\frontend
npm run dev

cd ..\app
npm run dev
```

Build checks:

```powershell
npm test
npm run build:web
npm run build:app
```
