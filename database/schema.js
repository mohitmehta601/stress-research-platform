/* Run with: mongosh "$MONGODB_URI/stress_research_platform" database/schema.js */

const collections = {
  participants: {
    bsonType: "object",
    required: ["email", "name", "participant_code", "password_hash", "created_at"],
    properties: {
      email: { bsonType: "string" },
      name: { bsonType: "string" },
      participant_code: { bsonType: "string" },
      password_hash: { bsonType: "string" },
      is_active: { bsonType: "bool" },
      consent_completed: { bsonType: "bool" },
      profile_completed: { bsonType: "bool" },
      created_at: { bsonType: "date" }
    }
  },
  consents: {
    bsonType: "object",
    required: ["participant_id", "version", "accepted", "recorded_at"],
    properties: {
      participant_id: { bsonType: "objectId" },
      version: { bsonType: "string" },
      accepted: { bsonType: "bool" },
      recorded_at: { bsonType: "date" }
    }
  },
  profiles: {
    bsonType: "object",
    required: ["participant_id"],
    properties: {
      participant_id: { bsonType: "objectId" },
      age: { bsonType: "int", minimum: 18, maximum: 100 },
      gender: { bsonType: "string" },
      height_cm: { bsonType: ["double", "int"] },
      weight_kg: { bsonType: ["double", "int"] },
      bmi: { bsonType: ["double", "int"] },
      education: { bsonType: "string" },
      occupation: { bsonType: "string" }
    }
  },
  sessions: {
    bsonType: "object",
    required: ["participant_id", "session_type", "stress_score", "started_at"],
    properties: {
      participant_id: { bsonType: "objectId" },
      session_type: { enum: ["relaxed", "stress"] },
      stress_score: { bsonType: "int", minimum: 1, maximum: 10 },
      started_at: { bsonType: "date" },
      completed_at: { bsonType: ["date", "null"] }
    }
  },
  physiological: {
    bsonType: "object",
    required: ["session_id", "participant_id", "signal_quality", "recorded_at"],
    properties: {
      session_id: { bsonType: "objectId" },
      participant_id: { bsonType: "objectId" },
      ecg: { bsonType: ["array", "null"] },
      heart_rate: { bsonType: ["double", "int", "null"] },
      hrv: { bsonType: ["double", "int", "null"] },
      eda: { bsonType: ["double", "int", "null"] },
      temperature: { bsonType: ["double", "int", "null"] },
      respiration: { bsonType: ["double", "int", "null"] },
      signal_quality: { enum: ["good", "moderate", "poor"] },
      recorded_at: { bsonType: "date" }
    }
  },
  questionnaire_responses: {
    bsonType: "object",
    required: ["session_id", "participant_id", "questionnaire_key", "answers", "submitted_at"],
    properties: {
      session_id: { bsonType: "objectId" },
      participant_id: { bsonType: "objectId" },
      questionnaire_key: { bsonType: "string" },
      answers: { bsonType: "object" },
      submitted_at: { bsonType: "date" }
    }
  },
  doctor_assessments: {
    bsonType: "object",
    required: ["session_id", "clinical_stress", "created_at"],
    properties: {
      session_id: { bsonType: "objectId" },
      clinical_stress: { bsonType: "string" },
      comments: { bsonType: ["string", "null"] },
      recommendation: { bsonType: ["string", "null"] },
      created_at: { bsonType: "date" }
    }
  }
};

for (const [name, schema] of Object.entries(collections)) {
  if (!db.getCollectionNames().includes(name)) {
    db.createCollection(name, { validator: { $jsonSchema: schema } });
  } else {
    db.runCommand({ collMod: name, validator: { $jsonSchema: schema } });
  }
}

db.participants.createIndex({ email: 1 }, { unique: true });
db.participants.createIndex({ participant_code: 1 }, { unique: true });
db.consents.createIndex({ participant_id: 1, version: 1 }, { unique: true });
db.profiles.createIndex({ participant_id: 1 }, { unique: true });
db.sessions.createIndex({ participant_id: 1, started_at: -1 });
db.sessions.createIndex({ session_code: 1 }, { unique: true });
db.physiological.createIndex({ session_id: 1 }, { unique: true });
db.questionnaire_responses.createIndex({ participant_id: 1, submitted_at: -1 });
db.doctor_assessments.createIndex({ session_id: 1 }, { unique: true });
