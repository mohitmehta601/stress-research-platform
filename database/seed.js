/* Dashboard demo data. Run after schema.js with mongosh. */

const now = new Date();
const participantCode = "P001";

db.participants.updateOne(
  { participant_code: participantCode },
  {
    $set: {
      email: "participant001@example.test",
      name: "Demo Participant",
      participant_code: participantCode,
      role: "participant",
      password_hash: "$2a$12$demo.hash.is.not.for.login.only.schema.compat",
      is_active: true,
      email_verified: true,
      approval_status: "approved",
      consent_completed: true,
      profile_completed: true,
      consent: {
        version: "1.0",
        accepted: true,
        recorded_at: now
      },
      profile: {
        age: 25,
        gender: "Female",
        height_cm: 165,
        weight_kg: 58,
        bmi: 21.3,
        education: "Postgraduate",
        occupation: "Research volunteer",
        smoking: "never",
        alcohol: "occasional",
        sleep_hours: 7,
        exercise_days_per_week: 3,
        heart_disease: false,
        hypertension: false,
        diabetes: false,
        medication: null,
        updated_at: now
      },
      updated_at: now
    },
    $setOnInsert: { created_at: now }
  },
  { upsert: true }
);

const participant = db.participants.findOne({ participant_code: participantCode });
db.participants.updateOne(
  { _id: participant._id },
  { $set: { "profile.participant_id": participant._id } }
);

const sessions = [
  {
    session_code: "S01",
    condition: "relaxed",
    signal_quality: "good",
    minutes_ago: 50,
    questionnaire_score: 5,
    physiological: {
      heart_rate: 72,
      hrv: 48,
      rmssd_ms: 48,
      sdnn_ms: 52,
      eda: 2.35,
      scl_us: 2.35,
      temperature: 36.6,
      mean_temp: 36.6,
      heart_rate_bpm: 72,
      spo2_percent: 98,
      scr_peak_count: 1,
      scr_mean: 0.18
    },
    doctor_assessment: {
      clinical_stress: "low",
      comments: "Signals consistent with relaxed condition.",
      recommendation: "No follow-up required."
    }
  },
  {
    session_code: "S02",
    condition: "stress",
    signal_quality: "moderate",
    minutes_ago: 20,
    questionnaire_score: 16,
    physiological: {
      heart_rate: 98,
      hrv: 31,
      rmssd_ms: 31,
      sdnn_ms: 34,
      eda: 4.8,
      scl_us: 4.8,
      temperature: 37.1,
      mean_temp: 37.1,
      heart_rate_bpm: 98,
      spo2_percent: 97,
      scr_peak_count: 4,
      scr_mean: 0.46
    }
  }
];

for (const item of sessions) {
  const started = new Date(now.getTime() - item.minutes_ago * 60000);
  const completed = new Date(started.getTime() + 15 * 60000);
  db.sessions.updateOne(
    { participant_id: participant._id, session_code: item.session_code },
    {
      $set: {
        participant_id: participant._id,
        session_code: item.session_code,
        condition: item.condition,
        status: "completed",
        signal_quality: item.signal_quality,
        started_at: started,
        completed_at: completed,
        duration_seconds: 900,
        physiological: {
          ...item.physiological,
          condition: item.condition,
          ecg: [0.12, 0.18, 0.09, 0.21],
          signal_quality: item.signal_quality,
          recorded_at: started,
          updated_at: completed
        },
        questionnaire: {
          condition: item.condition,
          questionnaire_key: "msaq-v1",
          answers: {
            current_stress: item.condition === "stress" ? 4 : 1
          },
          score: item.questionnaire_score,
          submitted_at: new Date(started.getTime() + 14 * 60000),
          updated_at: completed
        },
        ...(item.doctor_assessment
          ? {
              doctor_assessment: {
                ...item.doctor_assessment,
                created_at: now,
                updated_at: now
              }
            }
          : {}),
        updated_at: now
      },
      $setOnInsert: { created_at: started }
    },
    { upsert: true }
  );
}
