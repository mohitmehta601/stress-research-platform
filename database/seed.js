/* Dashboard demo data. Run after schema.js with mongosh. */

const now = new Date();

db.participants.updateOne(
  { participant_code: "P001" },
  {
    $set: {
      email: "participant001@example.test",
      name: "Demo Participant",
      participant_code: "P001",
      role: "participant",
      password_hash: "DEMO_ACCOUNT_NOT_FOR_LOGIN",
      is_active: true,
      consent_completed: true,
      profile_completed: true,
      updated_at: now
    },
    $setOnInsert: { created_at: now }
  },
  { upsert: true }
);

const participant = db.participants.findOne({ participant_code: "P001" });

db.profiles.updateOne(
  { participant_id: participant._id },
  { $set: {
    participant_id: participant._id, age: 25, gender: "Female",
    height_cm: 165, weight_kg: 58, bmi: 21.3,
    education: "Postgraduate", occupation: "Research volunteer",
    smoking: "never", alcohol: "occasional", sleep_hours: 7,
    exercise_days_per_week: 3, heart_disease: false,
    hypertension: false, diabetes: false, medication: null, updated_at: now
  }},
  { upsert: true }
);

db.consents.updateOne(
  { participant_id: participant._id, version: "1.0" },
  { $set: { participant_id: participant._id, version: "1.0", accepted: true, recorded_at: now } },
  { upsert: true }
);

const sessionData = [
  { session_code: "S01", condition: "relaxed", signal_quality: "good", minutes_ago: 50 },
  { session_code: "S02", condition: "stress", signal_quality: "moderate", minutes_ago: 20 }
];

for (const item of sessionData) {
  const started = new Date(now.getTime() - item.minutes_ago * 60000);
  db.sessions.updateOne(
    { session_code: item.session_code },
    { $set: {
      participant_id: participant._id, session_code: item.session_code,
      condition: item.condition, status: "completed", signal_quality: item.signal_quality,
      started_at: started, completed_at: new Date(started.getTime() + 15 * 60000),
      duration_seconds: 900
    }},
    { upsert: true }
  );
  const session = db.sessions.findOne({ session_code: item.session_code });
  db.physiological.updateOne(
    { session_id: session._id },
    { $set: {
      session_id: session._id, participant_id: participant._id,
      ecg: [0.12, 0.18, 0.09, 0.21], heart_rate: item.condition === "stress" ? 98 : 72,
      hrv: item.condition === "stress" ? 31 : 48, eda: item.condition === "stress" ? 4.8 : 2.35,
      temperature: 36.6, respiration: item.condition === "stress" ? 21 : 14,
      signal_quality: item.signal_quality, recorded_at: started
    }},
    { upsert: true }
  );
  db.questionnaire_responses.updateOne(
    { session_id: session._id },
    { $set: {
      session_id: session._id, participant_id: participant._id,
      questionnaire_key: "post-session-v1", answers: { current_stress: item.condition === "stress" ? 4 : 1 },
      score: item.condition === "stress" ? 16 : 5, submitted_at: new Date(started.getTime() + 14 * 60000)
    }},
    { upsert: true }
  );
}

const relaxed = db.sessions.findOne({ session_code: "S01" });
db.doctor_assessments.updateOne(
  { session_id: relaxed._id },
  { $set: {
    session_id: relaxed._id, clinical_stress: "Low",
    comments: "Signals consistent with relaxed condition.",
    recommendation: "No follow-up required.", created_at: now
  }},
  { upsert: true }
);
