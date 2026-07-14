# Stress Research Platform

Backend-first research platform for managing participants, consent, multimodal stress sessions, questionnaires, doctor labels, and export-ready datasets.

The frontend is a Vite React researcher dashboard connected to the FastAPI backend. The mobile folder contains the StressSense Vite prototype connected to the same backend participant/session APIs.

## Run backend locally

```bash
python -m venv .venv
python -m pip install -r backend/requirements.txt
python -m uvicorn backend.main:app --reload
```

Configure `backend/.env` and ensure MongoDB is running.

FastAPI documentation:

```text
http://localhost:8000/docs
```

## Run frontend locally

Researcher dashboard, in a second terminal:

```bash
npm run web
```

Open:

```text
http://localhost:5173/researcher/login
```

Mobile participant prototype, in a third terminal:

```bash
npm run mobile
```

Open:

```text
http://localhost:5174
```

Development researcher credentials:

```text
researcher@stressplatform.dev
ChangeMe123!
```

## Project layout

- `backend/` — FastAPI service and MongoDB integration
- `frontend/` — Vite React researcher dashboard
- `mobile/` — StressSense Vite mobile prototype
- `database/` — MongoDB schema, seed, and export helpers
- `docs/` — product, API, architecture, and research notes

## Verify backend

```bash
python -m compileall -q backend
npm test
npm run build:web
npm run build:mobile
```

## Optional demo data

Optional representative dashboard data can be loaded with `mongosh` if it is installed:

```bash
mongosh "mongodb://localhost:27017/stress_research_platform" database/schema.js
mongosh "mongodb://localhost:27017/stress_research_platform" database/seed.js
```

This is a research prototype, not a diagnostic or emergency-care product.
