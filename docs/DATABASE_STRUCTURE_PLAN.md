# Database Structure Plan

This plan maps the implemented backend, dashboard, and participant app features to an efficient MongoDB structure. The app is read-heavy around participants, sessions, collection completeness, dashboards, and exports, so the primary design is session-centric with targeted indexes.

## Design Goals

- Fast participant login and account restore.
- Fast participant history lookup.
- Fast dashboard participant/session listings.
- Fast dashboard summary metrics by status, condition, and signal quality.
- Fast data review for physiological, questionnaire, and doctor modules.
- Simple CSV export generation.
- Low join overhead for the current Express API.
- Compatibility with existing code paths and export helpers.

## Collection Strategy

### `participants`

Stores participant accounts and dashboard-capable users in one collection. The `role` field separates participants from dashboard users.

Primary uses:

- Participant signup/login.
- Researcher, doctor, viewer, admin, and super admin login.
- Participant profile and consent state.
- Dashboard participant list.
- Participant-code lookup.

Important fields:

- `email`
- `participant_code`
- `name`
- `password_hash`
- `role`
- `is_active`
- `approval_status`
- `email_verified`
- `consent_completed`
- `profile_completed`
- `profile`
- `consent`
- `created_at`
- `updated_at`

Indexes:

- Unique `email`
- Unique `participant_code`
- `role, created_at`
- `approval_status, role`
- `role, participant_code`
- `role, email`
- `consent_completed, role`
- `profile_completed, role`

### `sessions`

Stores research sessions and embeds the most-used child records: physiological data, questionnaire response, and doctor assessment. This is the main performance choice because dashboards, participant history, completeness checks, and exports usually read whole session rows.

Primary uses:

- Participant session history.
- Researcher session table.
- Dashboard summary.
- Physiological review.
- Questionnaire review.
- Doctor review.
- Final dataset export.

Important fields:

- `participant_id`
- `session_code`
- `condition`
- `task`
- `status`
- `signal_quality`
- `started_at`
- `completed_at`
- `duration_seconds`
- `physiological`
- `questionnaire`
- `doctor_assessment`

Indexes:

- `participant_id, started_at`
- Unique partial `participant_id, session_code`
- `status, started_at`
- `condition, started_at`
- `signal_quality, started_at`
- `condition, status, started_at`
- `physiological.signal_quality, physiological.recorded_at`
- `condition, physiological.recorded_at`
- Partial `questionnaire.submitted_at`
- Partial `doctor_assessment.created_at`

### `password_reset_tokens`

Stores hashed OTP and reset-token records.

Primary uses:

- Participant signup OTP.
- Dashboard access request OTP.
- Forgot password and password reset.
- One-time token validation.

Indexes:

- Unique `token_hash`
- TTL `expires_at`
- `purpose, payload.email, used, expires_at`
- `purpose, participant_id, used, expires_at`

### `dashboard_access_requests`

Stores requests from new dashboard users.

Primary uses:

- Public access request form.
- Super admin review queue.
- Approval/rejection workflow.

Indexes:

- `email, status`
- `status, requested_at`
- `requested_role, status`

### `notifications`

Stores dashboard activity notifications.

Primary uses:

- Dashboard notification dropdown.
- Unread counts.
- Activity routing by notification type.

Indexes:

- `created_at`
- `read, created_at`
- `type, created_at`
- `related_id, created_at`

### Compatibility Collections

The current app embeds most data in `sessions`, but these collections remain available for compatibility, migration, or future high-volume ingestion.

#### `physiological`

Indexes:

- `participant_id, recorded_at`
- Sparse `session_id`
- `condition, recorded_at`
- `signal_quality, recorded_at`
- Sparse `thingspeak_entry_id`

#### `questionnaire_responses`

Indexes:

- `participant_id, submitted_at`
- Sparse `session_id`
- `condition, submitted_at`
- `questionnaire_key, submitted_at`

#### `doctor_assessments`

Indexes:

- `participant_id, created_at`
- Sparse `session_id`
- `clinical_stress, created_at`
- `status, created_at`

## Why Session Embedding Is Efficient Here

The dashboard and app often need the same row-level session facts:

- Who the participant is.
- Which condition was recorded.
- Whether physiological data exists.
- Whether questionnaire data exists.
- Whether a doctor label exists.
- Latest status and quality.

Embedding these child records in `sessions` means most pages can read one collection instead of joining three or four collections. This is appropriate while each session has one main physiological summary, one questionnaire response, and one doctor assessment.

## When to Split Data Later

Separate high-volume collections should be introduced if:

- Raw ECG streams are stored sample-by-sample.
- Multiple questionnaire submissions per session are required.
- Multiple clinical reviewers can label the same session.
- ThingSpeak readings are synced continuously instead of once per session.
- Audit logs become legally required and must be immutable.

Suggested future collections:

- `raw_sensor_samples`
- `session_events`
- `audit_logs`
- `export_jobs`
- `application_settings`

## Sync Command

Run this command to push the collection/index structure to MongoDB:

```powershell
cd backend
npm.cmd run sync:mongodb
```

The sync command is additive:

- It creates missing collections.
- It creates missing indexes.
- It keeps existing documents.
- It drops only a known legacy global `session_code` index if found, because the current schema requires session codes to be unique per participant rather than globally unique.
