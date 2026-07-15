/* Run with: mongosh "$MONGODB_URI/stress_research_platform" database/schema.js */

const objectId = { bsonType: "objectId" };
const dateOrNull = { bsonType: ["date", "null"] };
const numberOrNull = { bsonType: ["double", "int", "long", "decimal", "null"] };
const stringOrNull = { bsonType: ["string", "null"] };

const participantSchema = {
  bsonType: "object",
  required: ["email", "name", "participant_code", "password_hash", "role", "created_at"],
  additionalProperties: true,
  properties: {
    email: { bsonType: "string" },
    name: { bsonType: "string" },
    participant_code: { bsonType: "string" },
    password_hash: { bsonType: "string" },
    role: { enum: ["participant", "viewer", "researcher", "doctor", "admin", "super_admin"] },
    is_active: { bsonType: "bool" },
    approval_status: { enum: ["pending", "approved", "rejected", "suspended", null] },
    email_verified: { bsonType: "bool" },
    consent_completed: { bsonType: "bool" },
    profile_completed: { bsonType: "bool" },
    consent: {
      bsonType: ["object", "null"],
      additionalProperties: true,
      properties: {
        version: { bsonType: "string" },
        accepted: { bsonType: "bool" },
        recorded_at: { bsonType: "date" }
      }
    },
    profile: {
      bsonType: ["object", "null"],
      additionalProperties: true,
      properties: {
        participant_id: objectId,
        age: numberOrNull,
        gender: stringOrNull,
        height_cm: numberOrNull,
        weight_kg: numberOrNull,
        bmi: numberOrNull,
        education: stringOrNull,
        occupation: stringOrNull,
        smoking: stringOrNull,
        alcohol: stringOrNull,
        sleep_hours: numberOrNull,
        exercise_days_per_week: numberOrNull,
        heart_disease: { bsonType: ["bool", "null"] },
        hypertension: { bsonType: ["bool", "null"] },
        diabetes: { bsonType: ["bool", "null"] },
        medication: stringOrNull
      }
    },
    created_at: { bsonType: "date" },
    updated_at: dateOrNull
  }
};

const sessionSchema = {
  bsonType: "object",
  required: ["participant_id", "session_code", "condition", "status", "started_at"],
  additionalProperties: true,
  properties: {
    participant_id: objectId,
    session_code: { bsonType: "string" },
    condition: { enum: ["relaxed", "stress"] },
    task: stringOrNull,
    status: { enum: ["in_progress", "completed", "pending", "incomplete"] },
    signal_quality: { enum: ["good", "moderate", "poor", "pending", null] },
    started_at: { bsonType: "date" },
    completed_at: dateOrNull,
    duration_seconds: numberOrNull,
    physiological: {
      bsonType: ["object", "null"],
      additionalProperties: true,
      properties: {
        condition: { enum: ["relaxed", "stress", null] },
        ecg: { bsonType: ["array", "null"] },
        heart_rate: numberOrNull,
        hrv: numberOrNull,
        eda: numberOrNull,
        temperature: numberOrNull,
        respiration: numberOrNull,
        mean_temp: numberOrNull,
        rmssd_ms: numberOrNull,
        sdnn_ms: numberOrNull,
        heart_rate_bpm: numberOrNull,
        spo2_percent: numberOrNull,
        scl_us: numberOrNull,
        scr_peak_count: numberOrNull,
        scr_mean: numberOrNull,
        sensor_fields: { bsonType: ["array", "null"] },
        thingspeak: { bsonType: ["object", "null"] },
        signal_quality: { enum: ["good", "moderate", "poor", "pending", null] },
        recorded_at: dateOrNull,
        updated_at: dateOrNull
      }
    },
    questionnaire: {
      bsonType: ["object", "null"],
      additionalProperties: true,
      properties: {
        condition: { enum: ["relaxed", "stress", null] },
        questionnaire_key: stringOrNull,
        answers: { bsonType: ["object", "null"] },
        score: numberOrNull,
        submitted_at: dateOrNull,
        updated_at: dateOrNull
      }
    },
    doctor_assessment: {
      bsonType: ["object", "null"],
      additionalProperties: true,
      properties: {
        clinical_stress: { enum: ["low", "moderate", "high", "severe", "Low", "Moderate", "High", "Severe", null] },
        comments: stringOrNull,
        recommendation: stringOrNull,
        created_at: dateOrNull,
        updated_at: dateOrNull
      }
    },
    created_at: dateOrNull,
    updated_at: dateOrNull
  }
};

const passwordResetTokenSchema = {
  bsonType: "object",
  required: ["purpose", "token_hash", "used", "created_at", "expires_at"],
  additionalProperties: true,
  properties: {
    purpose: { bsonType: "string" },
    token_hash: { bsonType: "string" },
    otp_hash: stringOrNull,
    participant_id: objectId,
    payload: { bsonType: ["object", "null"] },
    used: { bsonType: "bool" },
    created_at: { bsonType: "date" },
    used_at: dateOrNull,
    expires_at: { bsonType: "date" }
  }
};

const dashboardAccessRequestSchema = {
  bsonType: "object",
  required: ["email", "status", "created_at"],
  additionalProperties: true,
  properties: {
    request_code: { bsonType: "string" },
    name: { bsonType: "string" },
    email: { bsonType: "string" },
    organization: stringOrNull,
    requested_role: { enum: ["viewer", "researcher", "doctor", null] },
    reason: stringOrNull,
    status: { enum: ["pending", "approved", "rejected"] },
    email_verified: { bsonType: ["bool", "null"] },
    requested_at: dateOrNull,
    reviewed_at: dateOrNull,
    created_at: { bsonType: "date" },
    updated_at: dateOrNull
  }
};

const notificationSchema = {
  bsonType: "object",
  required: ["type", "title", "message", "created_at"],
  additionalProperties: true,
  properties: {
    type: { bsonType: "string" },
    title: { bsonType: "string" },
    message: { bsonType: "string" },
    related_id: { bsonType: ["objectId", "null"] },
    read: { bsonType: "bool" },
    created_at: { bsonType: "date" },
    read_at: dateOrNull
  }
};

const collections = {
  participants: participantSchema,
  sessions: sessionSchema,
  password_reset_tokens: passwordResetTokenSchema,
  dashboard_access_requests: dashboardAccessRequestSchema,
  notifications: notificationSchema
};

for (const [name, schema] of Object.entries(collections)) {
  if (!db.getCollectionNames().includes(name)) {
    db.createCollection(name, { validator: { $jsonSchema: schema }, validationLevel: "moderate" });
  } else {
    db.runCommand({
      collMod: name,
      validator: { $jsonSchema: schema },
      validationLevel: "moderate"
    });
  }
}

for (const index of db.sessions.getIndexes()) {
  if (index.name === "session_code_1") {
    db.sessions.dropIndex(index.name);
  }
}

db.participants.createIndex({ email: 1 }, { unique: true });
db.participants.createIndex({ participant_code: 1 }, { unique: true });
db.participants.createIndex({ role: 1, created_at: -1 });
db.participants.createIndex({ approval_status: 1, role: 1 });

db.sessions.createIndex({ participant_id: 1, started_at: -1 });
db.sessions.createIndex({ participant_id: 1, session_code: 1 }, { unique: true });
db.sessions.createIndex({ status: 1, started_at: -1 });
db.sessions.createIndex({ condition: 1, started_at: -1 });
db.sessions.createIndex({ "physiological.recorded_at": -1 });
db.sessions.createIndex({ "physiological.signal_quality": 1 });
db.sessions.createIndex({ "questionnaire.submitted_at": -1 });
db.sessions.createIndex({ "doctor_assessment.created_at": -1 });

db.password_reset_tokens.createIndex({ token_hash: 1 }, { unique: true });
db.password_reset_tokens.createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 });
db.password_reset_tokens.createIndex({ purpose: 1, "payload.email": 1, used: 1, expires_at: -1 });
db.password_reset_tokens.createIndex({ purpose: 1, participant_id: 1, used: 1, expires_at: -1 });

db.dashboard_access_requests.createIndex({ email: 1, status: 1 });
db.dashboard_access_requests.createIndex({ requested_at: -1 });
db.notifications.createIndex({ created_at: -1 });
