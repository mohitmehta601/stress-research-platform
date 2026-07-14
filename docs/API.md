# API

All responses are JSON.

| Method | Route | Purpose |
| --- | --- | --- |
| POST | `/api/auth/register` | Create a participant and return an access token |
| POST | `/api/auth/login` | Authenticate and return an access token |
| GET | `/api/auth/me` | Return the authenticated participant |
| GET | `/api/consents/current` | Return the current consent decision |
| POST | `/api/consents/decision` | Record acceptance or rejection |
| GET | `/api/profiles/onboarding` | Return onboarding completion state |
| GET | `/api/profiles/me` | Return the participant profile |
| PUT | `/api/profiles/me` | Create or update the participant profile |
| GET | `/health` | Service status |
| GET | `/api/dashboard/summary` | Research metrics, quality and recent sessions |
| GET | `/api/dashboard/participants` | Search participant records |
| GET | `/api/dashboard/sessions` | Filter and inspect sessions |
| GET | `/api/dashboard/exports/{filename}` | Generate a current CSV export |

Protected routes require `Authorization: Bearer <access_token>`. Dashboard and export routes additionally require the `researcher` role. Supported exports are `participant.csv`, `session.csv`, `physiological.csv`, `questionnaire.csv`, `doctor.csv`, and `final_dataset.csv`. API documentation is available at `/docs` while the service is running.
