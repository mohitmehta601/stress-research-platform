# Stress Research Platform

Backend-first research platform for managing participants, consent, multimodal stress sessions, questionnaires, doctor labels, and export-ready datasets.

The frontend is a Vite React researcher dashboard connected to the Express/MongoDB backend. The `app/` workspace contains the StressSense participant app prototype connected to the same participant/session APIs.

## Run Backend Locally

```powershell
cd backend
npm install
npm run dev
```

Configure `backend/.env` and ensure MongoDB is running.

API health check:

```text
http://localhost:8010/api
```

## Run Frontend Locally

Researcher dashboard, in a second terminal:

```powershell
npm run web
```

Open:

```text
http://localhost:5173/researcher/login
```

Participant app prototype, in a third terminal:

```powershell
npm run app
```

Open:

```text
http://localhost:5174
```

## Project Layout

- `backend/` - Express API, MongoDB/Mongoose models, services, middleware, and route modules
- `frontend/` - Vite React researcher dashboard
- `app/` - StressSense participant app prototype
- `database/` - MongoDB schema, seed, and export helpers
- `docs/` - product, API, architecture, and research notes

## Verify

```powershell
npm test
npm run build:web
npm run build:app
```

## Optional Demo Data

Optional representative dashboard data can be loaded with `mongosh` if it is installed:

```powershell
mongosh "mongodb://localhost:27017/stress_research_platform" database/schema.js
mongosh "mongodb://localhost:27017/stress_research_platform" database/seed.js
```

This is a research prototype, not a diagnostic or emergency-care product.
