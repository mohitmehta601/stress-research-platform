# Stress Research Platform Feature Documentation

This document describes the implemented features in the current `backend/`, `frontend/`, and `app/` codebases. It is based on the custom project code, including route modules, services, models, API clients, dashboard pages, and participant app screens. Generated shared UI primitives are listed as supporting infrastructure rather than as product features.

## 1. Product Areas

The project has three running applications:

- `backend/`: Express and MongoDB API for authentication, participant records, research sessions, physiological data, questionnaires, doctor labels, notifications, access requests, ThingSpeak sync, and CSV exports.
- `frontend/`: Vite React researcher dashboard for administrators, researchers, doctors, and viewers.
- `app/`: Vite React phone-frame participant app prototype for participant signup, consent, profile, stress/relaxed session collection, questionnaire submission, history, profile viewing, and staff preview screens.

## 2. Backend Features

### 2.1 Server Runtime

Files:

- `backend/src/server.js`
- `backend/src/config/settings.js`
- `backend/src/config/database.js`
- `backend/src/routes/api.js`
- `backend/src/routes/compat/stressResearchRoutes.js`

Runtime features:

- Starts an Express server on `settings.port`.
- Loads environment variables from `backend/.env` and process environment.
- Connects to MongoDB through Mongoose.
- Ensures model indexes at startup.
- Bootstraps a super admin account when bootstrap environment variables are present.
- Enables JSON and URL-encoded body parsing.
- Enables cookie parsing.
- Enables request logging through `morgan`.
- Applies CORS for local dashboard/app origins and configured hosted origins.
- Exposes `GET /health`.
- Redirects `GET /` to the researcher login URL.
- Mounts all API routes under `settings.apiPrefix`, default `/api`.

### 2.2 MongoDB Connection and Indexing

Files:

- `backend/src/config/database.js`
- `backend/sync-mongo-atlas.js`

Features:

- Connects to `MONGODB_URI` with configurable database name.
- Supports a direct Atlas seed-list fallback for `mongodb+srv://` DNS failures.
- Redacts MongoDB passwords in connection logs.
- Creates indexes for core Mongoose models.
- Provides a sync script that drops a legacy global `session_code` index and recreates current indexes.

### 2.3 Authentication and Authorization

Files:

- `backend/src/middleware/auth.js`
- `backend/src/middleware/authorize.js`
- `backend/src/config/roles.js`
- `backend/src/services/auth.js`
- `backend/src/utils/security.js`

Features:

- JWT access tokens and refresh tokens.
- Access tokens can be read from `Authorization: Bearer ...` or `srp_access_token` cookie.
- Refresh token endpoint issues a new session payload.
- Password hashing with `bcryptjs`.
- Email normalization.
- Random token generation for OTP and password reset.
- Six-digit OTP generation.
- Required-field validation helper.
- Participant account lookup from JWT subject.
- Role-based dashboard access:
  - `viewer`
  - `researcher`
  - `doctor`
  - `admin`
  - `super_admin`
- Super admin-only enforcement for access request management.
- Participant public profile serialization that removes password data.
- Participant `next_step` calculation:
  - `consent`
  - `profile`
  - `dashboard`
- Participant code generation with prefixes such as `P`, `R`, and `A`.
- Optional super admin bootstrap from environment variables.

### 2.4 Email and OTP

Files:

- `backend/src/services/email.js`
- `backend/src/routes/compat/stressResearchRoutes.js`

Features:

- Brevo SMTP API integration for OTP, access request verification, and password reset emails.
- Email delivery is skipped and logged when Brevo credentials are not configured.
- Participant signup OTP challenge.
- Dashboard access request OTP challenge.
- Registration OTP verification.
- Password reset token generation and email link delivery.
- Password reset token validation with expiry and one-time use.

### 2.5 Data Models and Collections

Files:

- `backend/src/models/index.js`
- Compatibility model re-export files under `backend/src/models/*.js`

Core collections:

- `participants`
- `sessions`
- `password_reset_tokens`
- `dashboard_access_requests`
- `notifications`
- `physiological`
- `questionnaire_responses`
- `doctor_assessments`

Participant model features:

- Stores email, participant code, name, password hash, role, activity flag, approval status, email verification, consent completion, profile completion, profile data, timestamps, and arbitrary additional fields.
- Indexes email, participant code, role, approval status, created date, and consent version.

Research session model features:

- Stores participant reference, session code, condition, task, status, signal quality, started/completed timestamps, physiological data, questionnaire data, doctor assessment data, and arbitrary additional fields.
- Indexes participant/date, participant/session code, status/date, condition/date, physiological recorded date, physiological quality, questionnaire submit date, and doctor assessment date.

Token model features:

- Stores hashed token values, purpose, participant reference, email payload, used flag, created/expiry timestamps.
- Uses TTL expiry through `expires_at`.

Dashboard access request model features:

- Stores email, request status, requested role, organization, reason, request/review timestamps, and review metadata.

Notification model features:

- Stores dashboard notification type, title, message, related ID, read state, and timestamps.

### 2.6 Participant Authentication API

Mounted under `/api`.

Routes:

- `POST /participant/request-otp`
- `POST /participant/register`
- `POST /auth/register`
- `POST /auth/verify-registration-otp`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `GET /auth/me`

Features:

- Participant OTP signup.
- Legacy participant registration route.
- Login for participants and dashboard roles.
- Refresh token rotation through the refresh endpoint.
- Forgot password request.
- Password reset.
- Current user profile restore.
- Access token cookie writing.

### 2.7 Dashboard Access Request API

Routes:

- `POST /auth/dashboard-access-requests`
- `POST /auth/dashboard-access-requests/verify-otp`
- `GET /dashboard/access-requests`
- `PATCH /dashboard/access-requests/:requestId`
- `DELETE /dashboard/access-requests/:requestId`

Features:

- Public dashboard access request submission.
- Requester email OTP verification.
- Access request storage with status `pending`.
- Super admin access request listing.
- Super admin approval and rejection.
- Approved requests create or update a dashboard-capable user account.
- Approved accounts receive setup/reset email.
- Request deletion.

### 2.8 Participant Consent and Profile API

Routes:

- `GET /profiles/onboarding`
- `GET /profiles/me`
- `PUT /profiles/me`
- `GET /consents/current`
- `POST /consents/decision`

Features:

- Current onboarding state.
- Participant profile retrieval.
- Participant profile update.
- BMI calculation from height and weight.
- Profile completion flag update.
- Current consent metadata.
- Consent acceptance/rejection.
- Consent version storage.
- Consent completion flag update.

Profile fields include:

- Age
- Gender
- Height
- Weight
- BMI
- Education
- Occupation
- Smoking status
- Alcohol use
- Sleep hours
- Exercise days per week
- Heart disease
- Hypertension
- Diabetes
- Medication

### 2.9 Participant Session Collection API

Routes:

- `GET /sessions/status`
- `POST /sessions`
- `GET /sessions/me`
- `POST /sessions/:sessionId/physiological`
- `POST /sessions/:sessionId/thingspeak-sync`
- `POST /sessions/:sessionId/complete`

Features:

- Session service health/status endpoint.
- Participant creates a relaxed or stress session.
- Session code generation per participant.
- Participant-specific session history.
- Manual physiological payload save.
- ThingSpeak latest reading sync into a session.
- Session completion.
- Physiological signal normalization.
- Collection checklist metadata for physiological, questionnaire, and doctor assessment status.

Session conditions:

- `relaxed`
- `stress`

Session statuses include:

- `incomplete`
- `in_progress`
- `pending`
- `completed`

### 2.10 Physiological and ThingSpeak Features

Files:

- `backend/src/services/thingspeak.js`
- `backend/src/routes/compat/stressResearchRoutes.js`

ThingSpeak field mapping:

- `field1` - `Mean_Temp`, `mean_temp`, alias `temperature`, unit `C`
- `field2` - `RMSSD_ms`, `rmssd_ms`, alias `hrv`, unit `ms`
- `field3` - `SDNN_ms`, `sdnn_ms`, unit `ms`
- `field4` - `Heart_Rate_bpm`, `heart_rate_bpm`, alias `heart_rate`, unit `bpm`
- `field5` - `SpO2_percent`, `spo2_percent`, unit `%`
- `field6` - `SCL_uS`, `scl_us`, alias `eda`, unit `uS`
- `field7` - `SCR_Peak_Count`, `scr_peak_count`, unit `count`
- `field8` - `SCR_Mean`, `scr_mean`

Features:

- Fetches latest ThingSpeak reading.
- Normalizes readings into numeric fields.
- Keeps raw ThingSpeak field values.
- Stores channel ID and entry ID metadata.
- Calculates signal quality from field completeness:
  - `good`
  - `moderate`
  - `poor`
  - `pending`
- Supports both participant session sync and dashboard session sync.

### 2.11 Questionnaire API

Routes:

- `GET /questionnaires/status`
- `POST /questionnaires`
- `GET /dashboard/questionnaires`

Features:

- Questionnaire service status endpoint.
- Participant questionnaire submission linked to session.
- Questionnaire score storage.
- Arbitrary answer map storage.
- Dashboard questionnaire listing.
- Dashboard answer detail support.

The participant app uses `msaq-v1` and stores item-level answer metadata, including question ID, section, question text, raw score, scored value, and reverse-scoring markers.

### 2.12 Doctor Assessment API

Routes:

- `GET /doctors/status`
- `POST /doctors/assessments`
- `GET /doctors/assessments/:sessionId`
- `GET /dashboard/doctor`
- `POST /dashboard/doctor`

Features:

- Doctor service status endpoint.
- Researcher/doctor-only session assessment save.
- Clinical stress labels.
- Doctor comments.
- Doctor recommendation.
- Dashboard list of pending and completed assessments.
- Assessment completion notifications.

Supported clinical labels:

- `low`
- `moderate`
- `high`
- `severe`

### 2.13 Dashboard Research API

Routes:

- `GET /dashboard/summary`
- `GET /dashboard/participants`
- `POST /dashboard/participants`
- `PUT /dashboard/participants/:participantId`
- `GET /dashboard/participants/:participantId`
- `GET /dashboard/sessions`
- `POST /dashboard/sessions`
- `PUT /dashboard/sessions/:sessionId`
- `GET /dashboard/sessions/:sessionId`
- `GET /dashboard/thingspeak/latest`
- `POST /dashboard/sessions/:sessionId/thingspeak-sync`
- `GET /dashboard/physiological`
- `GET /dashboard/questionnaires`
- `GET /dashboard/doctor`
- `POST /dashboard/doctor`
- `GET /dashboard/notifications`
- `POST /dashboard/notifications/:notificationId/read`

Features:

- Dashboard summary metrics.
- Participant listing, create, edit, and detail.
- Research session listing, create, edit, and detail.
- Manual session child data synchronization:
  - Physiological data
  - Questionnaire completion/score
  - Doctor assessment completion/label
- Latest ThingSpeak reading preview.
- ThingSpeak sync into a dashboard-selected session.
- Physiological record listing with search/filter support.
- Questionnaire response listing with answer details.
- Doctor assessment listing and save.
- Notification listing.
- Notification mark-as-read.

Dashboard summary metrics include:

- Participants
- Total sessions
- Completed sessions
- Consented participants
- Sensor records
- Questionnaire records
- Pending reviews
- Quality counts
- Average heart rate
- Average HRV/RMSSD
- Average temperature
- Average EDA/SCL
- Average SDNN
- Average SpO2
- Average SCR peak count
- Average SCR mean
- Average stress score

### 2.14 CSV Export API

Files:

- `backend/src/services/dataset.js`

Route:

- `GET /dashboard/exports/:filename`

Export files:

- `participant.csv`
- `participant_profile.csv`
- `session.csv`
- `research_sessions.csv`
- `physiological.csv`
- `questionnaire.csv`
- `doctor.csv`
- `doctor_assessment.csv`
- `final_dataset.csv`

Features:

- CSV generation from MongoDB session and participant records.
- Optional condition filter for `relaxed` or `stress`.
- Participant exports include participant identity/profile fields.
- Session exports include session metadata and timing.
- Physiological exports include sensor and ThingSpeak fields.
- Questionnaire exports include key, score, submit time, and answers.
- Doctor exports include clinical label and notes.
- Final dataset combines participant, session, physiological, questionnaire, and doctor assessment information.

### 2.15 Notifications

Features:

- Notification creation for session creation, ThingSpeak sync, doctor assessment completion, export completion, and dashboard access workflows.
- Dashboard notification dropdown reads recent notifications.
- Notifications can be marked read one at a time or in bulk from the dashboard UI.

## 3. Frontend Dashboard Features

### 3.1 App Shell and Routing

Files:

- `frontend/src/main.tsx`
- `frontend/src/App.tsx`
- `frontend/src/contexts/AuthContext.tsx`
- `frontend/src/lib/routeAuthorization.ts`
- `frontend/src/components/DashboardLayout.tsx`
- `frontend/src/components/Sidebar.tsx`

Routes:

- `/researcher/login`
- `/researcher`
- `/researcher/participants`
- `/researcher/sessions`
- `/researcher/physiological`
- `/researcher/questionnaires`
- `/researcher/doctor`
- `/researcher/export`
- `/researcher/settings`

Shell features:

- Protected researcher route wrapper.
- Session restore from local storage and `/auth/me`.
- Dashboard role authorization.
- Sidebar navigation.
- Sticky topbar.
- Global search that routes to matching modules.
- Notification dropdown with polling every 15 seconds.
- Notification refresh.
- Mark one or all notifications read.
- Notification click routing based on type.
- User avatar/name/role display.
- Logout.
- Toast provider.

### 3.2 Dashboard API Client

File:

- `frontend/src/services/apiClient.ts`

Features:

- Reads `VITE_API_BASE_URL` and legacy `VITE_API_URL`.
- Normalizes API base URL to include `/api`.
- Stores access token, refresh token, and auth user in local storage.
- Adds bearer token to requests.
- Uses cookies when available.
- Refreshes sessions on 401 through `/auth/refresh`.
- Clears local session on invalid/expired dashboard access.
- Normalizes backend snake_case responses to frontend camelCase types.
- Provides typed functions for all dashboard pages.

Client functions include:

- Auth: `login`, `forgotPassword`, `resetPassword`, `getCurrentUser`, `clearToken`.
- Access requests: `submitAccessRequest`, `verifyAccessRequestOtp`, `getAccessRequests`, `reviewAccessRequest`, `removeAccessRequest`.
- Dashboard: `getDashboardSummary`, `getLatestThingSpeakReading`, `getNotifications`, `markNotificationRead`.
- Participants: `getParticipants`, `getParticipant`, `createParticipant`, `updateParticipant`.
- Sessions: `getSessions`, `getSession`, `createSession`, `updateSession`.
- Data modules: `getPhysioRecords`, `getQuestionnaireRecords`, `getDoctorAssessments`, `saveDoctorAssessment`.
- Exports: `downloadExport`.

### 3.3 Login and Access Request Page

File:

- `frontend/src/pages/Login.tsx`

Features:

- Researcher/dashboard login.
- Password show/hide toggle.
- Forgot password request.
- Password reset when `resetToken` query parameter is present.
- Dashboard access request modal.
- Access request fields:
  - Name
  - Email
  - Organization
  - Requested role
  - Reason
- OTP verification for access requests.
- Access request success state.
- Platform feature overview panel.

### 3.4 Research Overview Dashboard

File:

- `frontend/src/pages/Dashboard.tsx`

Features:

- Loads dashboard summary, sessions, and latest ThingSpeak reading.
- Participant count card.
- Consented participant card.
- Research session count card.
- Complete dataset count card.
- Physiological summary grid:
  - Mean temperature
  - RMSSD
  - SDNN
  - Heart rate
  - SpO2
  - SCL
  - SCR peaks
  - SCR mean
  - Stress score
- Uses saved averages when sensor records exist.
- Falls back to latest ThingSpeak reading when saved data does not exist.
- Session status distribution chart.
- Experimental condition distribution chart.
- Recent research sessions table.
- Data quality alerts for sessions missing sensor or questionnaire data.
- Loading and error states.

### 3.5 Participants Page

File:

- `frontend/src/pages/Participants.tsx`

Features:

- Participant list from MongoDB.
- Search by participant ID, name, or email.
- Participant detail drawer.
- Create participant drawer.
- Edit participant drawer.
- Participant fields:
  - Participant code
  - Name
  - Email
  - Password for create/update when provided
  - Active flag
  - Consent completion
  - Profile completion
  - Age
  - Gender
  - Height
  - Weight
  - Education
  - Occupation
  - Smoking
  - Alcohol
  - Sleep hours
  - Exercise days per week
  - Heart disease
  - Hypertension
  - Diabetes
  - Medication
- Derived BMI display.
- Total/completed session counts.
- Last session date.

### 3.6 Research Sessions Page

File:

- `frontend/src/pages/Sessions.tsx`

Features:

- Research session table.
- Loads sessions and participant list together.
- Search by session or participant.
- Filter by condition.
- Filter by status.
- Session detail drawer.
- Create session drawer.
- Edit session drawer.
- Session identity fields:
  - Participant
  - Session ID
  - Condition
  - Status
  - Date
  - Time
  - Duration seconds
  - Task/note
- Physiological fields:
  - ECG collected
  - Signal quality
  - Heart rate
  - HRV
  - EDA
  - Temperature
  - Respiration
- Collection checklist fields:
  - Questionnaire completed
  - Questionnaire score
  - Doctor assessment completed
  - Doctor label
- Completeness display for sensor, questionnaire, and doctor assessment.
- Manual session save updates backend session and embedded child data.

### 3.7 Physiological Data Page

File:

- `frontend/src/pages/Physiological.tsx`

Features:

- Physiological records table.
- Search by participant or session.
- Filter by condition.
- Export CSV.
- Quality summary cards:
  - Total records
  - Good
  - Moderate
  - Poor/missing
- Table columns:
  - Participant
  - Session
  - Condition
  - Mean temperature
  - RMSSD
  - SDNN
  - Heart rate
  - SpO2
  - SCL
  - SCR peaks
  - SCR mean
  - Quality

### 3.8 Questionnaire Page

File:

- `frontend/src/pages/Questionnaires.tsx`

Features:

- Questionnaire response list.
- Search by participant or session.
- Filter by condition.
- Export CSV.
- Response summary columns:
  - Participant
  - Session
  - Condition
  - Questionnaire key
  - Answer count
  - Score
  - Submitted timestamp
  - Completion status
- Select a response to view detailed answer rows.
- Answer detail columns:
  - ID
  - Section
  - Question
  - Raw score
  - Scored value

### 3.9 Doctor Assessments Page

File:

- `frontend/src/pages/Doctor.tsx`

Features:

- Doctor assessment table.
- Search by participant or session.
- Filter by completed/pending.
- Summary cards:
  - Total assessments
  - Completed
  - Pending
- Pending assessment alert.
- Assessment drawer for edit or new assessment.
- Clinical stress label selector.
- Comments field.
- Recommendation field.
- Save assessment to backend.
- Dispatches notification refresh event after saving.

### 3.10 Dataset Export Page

File:

- `frontend/src/pages/Export.tsx`

Features:

- Lists exportable research datasets.
- Downloads module-level CSV files.
- Downloads final combined dataset.
- Displays data completeness matrix from sessions.
- Shows per-session flags for ECG, HRV, EDA, temperature, questionnaire, and doctor assessment.
- Uses backend CSV endpoint.

### 3.11 Platform Settings Page

File:

- `frontend/src/pages/Settings.tsx`

Features:

- Multi-section settings UI.
- Saves settings in browser local storage.
- Reset settings to defaults.
- Export settings JSON.
- Access request administration with backend API.
- Approve, reject, and remove access requests.
- General platform settings:
  - Platform name
  - Support email
  - Study status
  - Timezone
  - Date format
  - Self-registration/access request availability
  - Maintenance mode
- Notification settings:
  - New access request alerts
  - Missing data alerts
  - Export ready alerts
  - Failed session alerts
  - Daily summary
  - Weekly summary
- Security settings:
  - Strong password policy flag
  - MFA for admins flag
  - Security event logging flag
  - Session timeout
  - Failed sign-in limit
  - Security score visualization
- Data settings:
  - Retention days
  - Default export format
  - Export anonymization flag
  - Consent required for export flag
  - Include audit metadata flag
  - Allow participant deletion flag

Implementation note: many settings are currently dashboard-side/local preferences. Some sections explicitly state that backend enforcement would need additional server implementation.

### 3.12 Shared Dashboard Components

Files:

- `frontend/src/components/StatCard.tsx`
- `frontend/src/components/StatusBadge.tsx`
- `frontend/src/components/figma/ImageWithFallback.tsx`
- `frontend/src/components/ui/*`

Features:

- Reusable statistic cards.
- Reusable status badge helpers for:
  - Session status
  - Consent status
  - Signal quality
  - Assessment status
  - Stress labels
  - Experimental condition
  - Boolean collected/missing flags
- Image fallback component.
- Generated/shared UI primitives based on Radix/shadcn patterns:
  - Buttons, inputs, dialogs, sheets, tables, tabs, selects, sliders, popovers, dropdowns, calendars, forms, charts, tooltips, sidebar primitives, and related layout controls.

## 4. Participant App Features

### 4.1 App Runtime

Files:

- `app/src/main.tsx`
- `app/src/app/RootParticipantApp.tsx`
- `app/src/features/prototype/StressSensePrototype.tsx`
- `app/src/services/apiClient.ts`

Features:

- Vite React app.
- Renders a phone-frame prototype UI.
- Stores current screen in local storage as `stresssense_screen`.
- Restores authenticated participant/staff session from local storage and backend `/auth/me`.
- Uses a local navigation state machine rather than browser routes for most screens.
- Supports direct path-to-screen mapping for prototype screens.

### 4.2 Participant App API Client

File:

- `app/src/services/apiClient.ts`

Features:

- Reads `VITE_API_BASE_URL` and legacy `VITE_API_URL`.
- Normalizes API base URL to include `/api`.
- Stores:
  - Access token
  - Refresh token
  - Active session ID
  - Active session code
  - Current participant/user
- Refreshes session on 401 when refresh token exists.
- Logs out and clears local session state.
- Provides participant workflow functions:
  - `requestRegistrationOtp`
  - `register`
  - `verifyRegistrationOtp`
  - `login`
  - `forgotPassword`
  - `resetPassword`
  - `me`
  - `consent`
  - `getProfile`
  - `saveProfile`
  - `createSession`
  - `useSession`
  - `savePhysiological`
  - `saveQuestionnaire`
  - `completeSession`
  - `saveDoctorAssessment`
  - `getMySessions`
  - `getParticipantHome`
- Provides staff/research preview functions:
  - `getResearchData`
  - `getPhysiologicalQuality`
  - `downloadExport`

### 4.3 App Screens

The participant prototype defines these screens:

- `splash`
- `register`
- `login`
- `consent`
- `participant-profile`
- `select-session`
- `relaxed-instructions`
- `relaxed-recording`
- `stress-task-select`
- `stress-task`
- `stress-recording`
- `audio-recording`
- `questionnaire`
- `questionnaire-complete`
- `session-summary`
- `history`
- `participant-dashboard`
- `profile-view`
- `staff-login`
- `researcher-dashboard`
- `researcher-participants`
- `researcher-sessions`
- `sensor-quality`
- `doctor-assessment`
- `export`
- `export-history`
- `data-overview`

### 4.4 Splash and Role Entry

Features:

- Branded StressSense entry screen.
- Participant account creation.
- Participant login.
- Staff login entry.
- Phone status bar and app-frame visuals.

### 4.5 Participant Registration

Features:

- Name, email, and password account creation.
- Consent/agreement gate before OTP request.
- OTP request through `/participant/request-otp`.
- OTP verification/signup through `/participant/register`.
- Handles development OTP display when returned by backend.
- Routes participants to consent/profile/dashboard based on backend `next_step`.

### 4.6 Participant Login

Features:

- Email/password login.
- Uses `/auth/login`.
- Detects returned role:
  - Participant
  - Researcher
  - Doctor
  - Super admin handling
- Routes participant to consent, profile, or dashboard depending on completion state.
- Routes staff roles to researcher dashboard preview.

### 4.7 Consent Flow

Features:

- Research consent screen.
- Accept/decline decision.
- Saves decision through `/consents/decision`.
- Accepted participants continue to profile.
- Decline path remains in consent/login flow.

### 4.8 Participant Profile/Baseline

Features:

- Loads current profile from `/profiles/me`.
- Saves profile to `/profiles/me`.
- Collects demographic and health fields:
  - Age
  - Gender
  - Height
  - Weight
  - Education
  - Occupation
  - Smoking
  - Alcohol
  - Sleep hours
  - Exercise days
  - Heart disease
  - Hypertension
  - Diabetes
  - Medication
- Backend calculates BMI and marks profile complete.

### 4.9 Participant Home and Session Selection

Features:

- Loads participant home summary from backend.
- Shows participant identity and progress.
- Shows completed, relaxed, and stress session counts.
- Starts relaxed or stress sessions.
- Creates backend session through `/sessions`.
- Stores active session ID and session code locally.
- Bottom navigation tabs:
  - Home
  - History
  - Dashboard
  - Profile

### 4.10 Relaxed Session Flow

Screens:

- `relaxed-instructions`
- `relaxed-recording`
- `audio-recording`
- `questionnaire`
- `questionnaire-complete`
- `session-summary`

Features:

- Relaxed session instructions.
- Simulated recording screen with physiological signal cards.
- Saves physiological data by syncing latest ThingSpeak reading to the active session.
- Audio prompt/recording placeholder.
- Questionnaire submission.
- Session summary.

### 4.11 Stress Session Flow

Screens:

- `stress-task-select`
- `stress-task`
- `stress-recording`
- `audio-recording`
- `questionnaire`
- `questionnaire-complete`
- `session-summary`

Stress tasks:

- Mental Arithmetic
- Stroop Test
- Memory Test
- Time Pressure Task

Features:

- Task selection.
- Task instruction screen.
- Stress recording screen with physiological signal visuals.
- ThingSpeak physiological sync to active stress session.
- Audio prompt/recording placeholder.
- Questionnaire submission.
- Session summary.

### 4.12 MSAQ Questionnaire

File:

- `app/src/features/prototype/StressSensePrototype.tsx`

Features:

- Multi-section stress questionnaire.
- One question at a time.
- Progress bar.
- Likert-style numeric answers.
- Reverse-scored items.
- Calculates total stress score from answered questions.
- Saves attempted count, total count, and score to local storage for summary screens.
- Saves answer detail object to backend with:
  - Section
  - Question
  - Raw score
  - Scored value
  - Reverse-scored marker
- Uses questionnaire key `msaq-v1`.

Question sections:

- Emotional Stress
- Cognitive Stress
- Physical Stress
- Sleep and Recovery
- Behavioural Changes
- Positive Coping
- Lifestyle and Environment
- Technology and Digital Behaviour

### 4.13 Session Completion and Summary

Features:

- Questionnaire completion screen.
- Session summary screen.
- Displays condition, score, and completion progress.
- Can complete backend session through active session context.
- Links back to home/history.

### 4.14 Participant History

Features:

- Loads participant session history from `/sessions/me`.
- Shows participant-only sessions.
- Shows condition, date, collected flags, doctor status, and quality.
- Handles logged-out state.
- Handles no-session state.
- Opens a session summary from a history row.

### 4.15 Participant Dashboard

Features:

- Loads participant home data.
- Displays personal session statistics:
  - Completed
  - Relaxed
  - Stress
  - Last session
- Shows recent sessions and collection state.
- Handles logged-out state.

### 4.16 Participant Profile View

Features:

- Loads saved participant profile from backend.
- Displays demographic and health fields.
- Handles logged-out state.
- Links back to edit/profile-related flow.

### 4.17 Staff Login and Researcher Preview Screens

Screens:

- `staff-login`
- `researcher-dashboard`
- `researcher-participants`
- `researcher-sessions`
- `sensor-quality`
- `doctor-assessment`
- `export`
- `export-history`
- `data-overview`

Features:

- Staff login through the same auth endpoint.
- Researcher dashboard preview from mobile app.
- Participant list preview.
- Research sessions preview.
- Sensor quality preview.
- Doctor assessment save for active session.
- Export options and export history preview.
- Data overview/completeness matrix.
- Pulls data through dashboard endpoints when staff role has dashboard access.

## 5. End-to-End Workflows

### 5.1 Participant Signup to Dashboard

1. Participant opens app splash.
2. Participant creates account.
3. App requests OTP.
4. Backend sends OTP through Brevo or returns development OTP when enabled.
5. Participant verifies OTP and receives tokens.
6. App asks for consent if not completed.
7. App asks for profile if not completed.
8. Participant lands on home/dashboard once consent and profile are complete.

### 5.2 Relaxed Session Collection

1. Participant starts a relaxed session.
2. Backend creates a session document.
3. App shows relaxed instructions.
4. App shows recording UI.
5. App syncs latest ThingSpeak reading to the session.
6. App continues to audio placeholder.
7. App runs MSAQ questionnaire.
8. App saves questionnaire score and answers.
9. App shows completion and summary.
10. Session appears in participant history and researcher dashboard.

### 5.3 Stress Session Collection

1. Participant starts a stress session.
2. Backend creates a session document.
3. App asks participant to choose a stress task.
4. App shows task instructions.
5. App shows stress recording UI.
6. App syncs ThingSpeak data to the stress session.
7. App records audio placeholder step.
8. App runs MSAQ questionnaire.
9. App saves questionnaire data.
10. Session appears in dashboards and export datasets.

### 5.4 Researcher Manual Data Management

1. Researcher signs into the dashboard.
2. Researcher opens Participants or Sessions.
3. Researcher creates or edits participant/session records.
4. Session editor can include physiological values, questionnaire completion, questionnaire score, and doctor labels.
5. Backend embeds child data into the session.
6. Dashboard summary, session tables, exports, and quality indicators update.

### 5.5 Doctor Labeling

1. Doctor/researcher opens Doctor Assessments.
2. Pending sessions are highlighted.
3. Doctor selects a session.
4. Doctor chooses clinical stress label and adds comments/recommendation.
5. Backend stores assessment inside the session.
6. Notification is created.
7. Final dataset export can include the label.

### 5.6 Data Export

1. Researcher opens Export page or a data module page.
2. Dashboard calls `/dashboard/exports/:filename`.
3. Backend loads rows from MongoDB.
4. Optional condition filter is applied.
5. Backend returns CSV.
6. Browser downloads the generated file.

## 6. Current Implementation Notes

- The backend API is mounted under `/api` by default.
- Dashboard and app clients expect a Vite env variable named `VITE_API_BASE_URL`, with `VITE_API_URL` still supported.
- Shared `ui/` folders contain reusable generated primitives; they are infrastructure for UI composition.
- The participant app is currently a large prototype feature file under `app/src/features/prototype/StressSensePrototype.tsx`; it is ready to be split into smaller feature folders later.
- Dashboard settings are mostly saved in browser local storage. Server enforcement for some settings, such as MFA or retention policy, is not fully implemented.
- The export service can include participant names and emails in some CSVs, especially `final_dataset.csv`; use this carefully for privacy-sensitive research data.
- The current `settings.js` reads `JWT_SECRET`, not `JWT_SECRET_KEY`. If the environment file only provides `JWT_SECRET_KEY`, the backend will fall back to the development default unless compatibility is added.
- The current `settings.js` reads `MONGODB_DATABASE`, not `MONGODB_DB_NAME`.

## 7. Verification Commands

Useful local verification commands:

```powershell
npm.cmd test
npm.cmd run build:web
npm.cmd run build:app
```

If existing `dist/` directories are locked on Windows, use a temporary output directory for Vite build verification:

```powershell
cd frontend
npm.cmd run build -- --outDir ..\.build-check\frontend --emptyOutDir true

cd ..\app
npm.cmd run build -- --outDir ..\.build-check\app --emptyOutDir true
```
