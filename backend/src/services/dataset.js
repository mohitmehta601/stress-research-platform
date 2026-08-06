import { Participant, ResearchSession, Physiological, QuestionnaireResponse, DoctorAssessment } from "../models/index.js";
import { csvResponse, formatDateTimeIST } from "../utils/format.js";

const participantFilter = { role: "participant" };
const PARTICIPANT_EXPORT_FIELDS = [
  "ParticipantID",
  "ParticipantObjectID",
  "Name",
  "Email",
  "Role",
  "Active",
  "ApprovalStatus",
  "EmailVerified",
  "ConsentCompleted",
  "ProfileCompleted",
  "ConsentVersion",
  "Age",
  "Gender",
  "Occupation",
  "HeightCm",
  "WeightKg",
  "BMI",
  "Education",
  "Smoking",
  "Alcohol",
  "SleepHours",
  "ExerciseDaysPerWeek",
  "HeartDisease",
  "Hypertension",
  "Diabetes",
  "MedicationNotes",
  "TotalSessions",
  "CompletedSessions",
  "LastSessionAt",
  "CreatedAt",
  "UpdatedAt",
  "ApprovedAt",
  "EmailVerifiedAt"
];

export async function participantRows() {
  const [participants, sessionCounts] = await Promise.all([
    Participant.find(participantFilter).lean(),
    ResearchSession.aggregate([
      {
        $group: {
          _id: "$participant_id",
          sessions: { $sum: 1 },
          completed_sessions: {
            $sum: {
              $cond: [{ $eq: ["$status", "completed"] }, 1, 0]
            }
          },
          last_session_at: { $max: "$started_at" }
        }
      }
    ])
  ]);
  const sessionsByParticipant = new Map(
    sessionCounts.map((item) => [String(item._id), item])
  );
  return participants.map((item) => {
    const profile = item.profile || {};
    const sessionSummary = sessionsByParticipant.get(String(item._id)) || {};
    return {
      ParticipantID: item.participant_code || "",
      ParticipantObjectID: String(item._id || ""),
      Name: item.name || "",
      Email: item.email || "",
      Role: item.role || "",
      Active: item.is_active !== false,
      ApprovalStatus: item.approval_status || "",
      EmailVerified: Boolean(item.email_verified),
      ConsentCompleted: Boolean(item.consent_completed),
      ProfileCompleted: Boolean(item.profile_completed),
      ConsentVersion: item.consent?.version ?? "",
      Age: profile.age ?? "",
      Gender: profile.gender ?? "",
      Occupation: profile.occupation ?? "",
      HeightCm: profile.height_cm ?? "",
      WeightKg: profile.weight_kg ?? "",
      BMI: profile.bmi ?? "",
      Education: profile.education ?? "",
      Smoking: profile.smoking ?? "",
      Alcohol: profile.alcohol ?? "",
      SleepHours: profile.sleep_hours ?? "",
      ExerciseDaysPerWeek: profile.exercise_days_per_week ?? "",
      HeartDisease: Boolean(profile.heart_disease),
      Hypertension: Boolean(profile.hypertension),
      Diabetes: Boolean(profile.diabetes),
      MedicationNotes: profile.medication ?? "",
      TotalSessions: sessionSummary.sessions ?? 0,
      CompletedSessions: sessionSummary.completed_sessions ?? 0,
      LastSessionAt: sessionSummary.last_session_at || "",
      CreatedAt: item.created_at || "",
      UpdatedAt: item.updated_at || "",
      ApprovedAt: item.approved_at || "",
      EmailVerifiedAt: item.email_verified_at || ""
    };
  });
}

export async function sessionRows() {
  const [sessions, participants] = await Promise.all([
    ResearchSession.find({}).sort({ started_at: -1 }).lean(),
    Participant.find({}).lean()
  ]);
  const codes = new Map(participants.map((item) => [String(item._id), item.participant_code || ""]));
  return sessions.map((item) => ({
    SessionID: item.session_code || String(item._id || ""),
    SessionObjectID: String(item._id || ""),
    ParticipantID: codes.get(String(item.participant_id)) || "",
    ParticipantObjectID: String(item.participant_id || ""),
    Condition: item.condition || "",
    Task: item.task || "",
    Status: item.status || "",
    SignalQuality: item.signal_quality || "",
    StartedAt: item.started_at || "",
    CompletedAt: item.completed_at || "",
    DurationSeconds: item.duration_seconds || ""
  }));
}

export async function physiologicalRows() {
  const records = await Physiological.find({}).sort({ recorded_at: -1 }).lean();
  const people = await Participant.find({ _id: { $in: records.map((item) => item.participant_id).filter(Boolean) } }).lean();
  const map = new Map(people.map((item) => [String(item._id), item]));
  return records.map((item) => {
    const person = map.get(String(item.participant_id)) || {};
    return {
      Participant_ID: item.participant_code || person.participant_code || String(item.participant_id || ""),
      Name_Participant: person.name || "",
      Session_ID: item.session_code || String(item.session_id || ""),
      Condition: item.condition || "",
      Mean_Temp: item.mean_temp ?? item.temperature ?? "",
      RMSSD_ms: item.rmssd_ms ?? item.hrv ?? "",
      SDNN_ms: item.sdnn_ms ?? "",
      Heart_Rate_bpm: item.heart_rate_bpm ?? item.heart_rate ?? "",
      SpO2_percent: item.spo2_percent ?? "",
      SCL_uS: item.scl_us ?? item.eda ?? "",
      SCR_Peak_Count: item.scr_peak_count ?? "",
      SCR_Mean: item.scr_mean ?? "",
      Recorder_AT: item.recorded_at ? formatDateTimeIST(item.recorded_at) : ""
    };
  });
}

export async function questionnaireRows() {
  const responses = await QuestionnaireResponse.find({}).sort({ submitted_at: -1 }).lean();
  const people = await Participant.find({
    _id: { $in: responses.map((item) => item.participant_id).filter(Boolean) }
  }).lean();
  const map = new Map(people.map((item) => [String(item._id), item]));
  const optionLabels = {
    0: "Never",
    1: "Rarely",
    2: "Sometimes",
    3: "Often",
    4: "Always"
  };

  return responses.map((response) => {
    const person = map.get(String(response.participant_id)) || {};
    const row = {
      Participant_ID: response.participant_code || String(response.participant_id || ""),
      Name_Participant: person.name || "",
      Session_ID: response.session_code || String(response.session_id || ""),
      Condition: response.condition || "",
      Score: response.score ?? "",
      Submitted_At: response.submitted_at ? formatDateTimeIST(response.submitted_at) : ""
    };

    const answers = Object.entries(response.answers || {}).sort(([left], [right]) => left.localeCompare(right, undefined, { numeric: true }));
    for (const [questionId, answer] of answers) {
      const value = answer && typeof answer === "object" && !Array.isArray(answer)
        ? answer.raw_score ?? answer.scored_value ?? ""
        : answer ?? "";
      const question = answer && typeof answer === "object" && !Array.isArray(answer)
        ? answer.question ?? questionId
        : questionId;
      row[`${questionId}_Question`] = question;
      row[`${questionId}_Option_Value`] = value;
      row[`${questionId}_Option_Selected`] = optionLabels[value] || "";
    }

    return row;
  });
}

export async function doctorRows() {
  const assessments = await DoctorAssessment.find({}).sort({ created_at: -1 }).lean();
  return assessments.map((assessment) => ({
    id: String(assessment._id || ""),
    session_id: assessment.session_code || String(assessment.session_id || ""),
    participant_id: assessment.participant_code || String(assessment.participant_id || ""),
    clinical_stress: assessment.clinical_stress || assessment.clinical_stress_label || "",
    comments: assessment.comments || "",
    recommendation: assessment.recommendation || "",
    created_at: assessment.created_at || "",
    updated_at: assessment.updated_at || ""
  }));
}

export async function finalDatasetRows() {
  const [sessions, participants, legacyPhys, legacyQuestionnaires, legacyAssessments] = await Promise.all([
    ResearchSession.find({}).sort({ started_at: -1 }).lean(),
    Participant.find({}).lean(),
    Physiological.find({}).lean(),
    QuestionnaireResponse.find({}).lean(),
    DoctorAssessment.find({}).lean()
  ]);
  const people = new Map(participants.map((item) => [String(item._id), item]));
  const phys = new Map(legacyPhys.filter((item) => item.session_id).map((item) => [String(item.session_id), item]));
  const questionnaires = new Map(legacyQuestionnaires.filter((item) => item.session_id).map((item) => [String(item.session_id), item]));
  const assessments = new Map(legacyAssessments.filter((item) => item.session_id).map((item) => [String(item.session_id), item]));
  return sessions.map((session) => {
    const person = people.get(String(session.participant_id)) || {};
    const profile = person.profile || {};
    const signals = session.physiological || phys.get(String(session._id)) || {};
    const questionnaire = session.questionnaire || questionnaires.get(String(session._id)) || {};
    const assessment = session.doctor_assessment || assessments.get(String(session._id)) || {};
    return {
      Participant: person.participant_code || "",
      Session: session.session_code || String(session._id),
      Condition: session.condition || "",
      ECG: Boolean(signals.ecg),
      HRV: signals.hrv !== undefined,
      EDA: signals.eda !== undefined,
      Temp: signals.temperature !== undefined,
      Questionnaire: Boolean(questionnaire),
      "Doctor Label": assessment.clinical_stress || "",
      ParticipantID: person.participant_code || "",
      ParticipantName: person.name || "",
      ParticipantEmail: person.email || "",
      Age: profile.age || "",
      Gender: profile.gender || "",
      SessionID: session.session_code || String(session._id),
      HeartRate: signals.heart_rate || "",
      RMSSD_ms: signals.rmssd_ms ?? signals.hrv ?? "",
      SDNN_ms: signals.sdnn_ms ?? "",
      SpO2_percent: signals.spo2_percent ?? "",
      SCL_uS: signals.scl_us ?? signals.eda ?? "",
      SCR_Peak_Count: signals.scr_peak_count ?? "",
      SCR_Mean: signals.scr_mean ?? "",
      Temperature: signals.temperature || "",
      Mean_Temp: signals.mean_temp ?? signals.temperature ?? "",
      Respiration: signals.respiration || "",
      QuestionnaireScore: questionnaire.score || "",
      QuestionnaireAnswers: questionnaire.answers || {},
      DoctorLabel: assessment.clinical_stress || "",
      DoctorComments: assessment.comments || "",
      DoctorRecommendation: assessment.recommendation || ""
    };
  });
}

export const EXPORTS = {
  "participant.csv": [participantRows, PARTICIPANT_EXPORT_FIELDS],
  "participant_profile.csv": [participantRows, PARTICIPANT_EXPORT_FIELDS],
  "session.csv": [sessionRows, ["SessionID", "SessionObjectID", "ParticipantID", "ParticipantObjectID", "Condition", "Task", "Status", "SignalQuality", "StartedAt", "CompletedAt", "DurationSeconds"]],
  "research_sessions.csv": [sessionRows, ["SessionID", "SessionObjectID", "ParticipantID", "Condition", "Task", "Status", "StartedAt", "CompletedAt", "DurationSeconds"]],
  "physiological.csv": [physiologicalRows, ["Participant_ID", "Name_Participant", "Session_ID", "Condition", "Mean_Temp", "RMSSD_ms", "SDNN_ms", "Heart_Rate_bpm", "SpO2_percent", "SCL_uS", "SCR_Peak_Count", "SCR_Mean", "Recorder_AT"]],
  "questionnaire.csv": [questionnaireRows, ["Participant_ID", "Name_Participant", "Session_ID", "Condition", "Score", "Submitted_At"]],
  "doctor.csv": [doctorRows, ["id", "session_id", "participant_id", "clinical_stress", "comments", "recommendation", "created_at", "updated_at"]],
  "doctor_assessment.csv": [doctorRows, ["id", "session_id", "participant_id", "clinical_stress", "comments", "recommendation", "created_at", "updated_at"]],
  "final_dataset.csv": [finalDatasetRows, ["Participant", "Session", "Condition", "ECG", "HRV", "EDA", "Temp", "Questionnaire", "Doctor Label", "ParticipantID", "ParticipantName", "ParticipantEmail", "Age", "Gender", "SessionID", "HeartRate", "Mean_Temp", "RMSSD_ms", "SDNN_ms", "SpO2_percent", "SCL_uS", "SCR_Peak_Count", "SCR_Mean", "Temperature", "Respiration", "QuestionnaireScore", "QuestionnaireAnswers", "DoctorLabel", "DoctorComments", "DoctorRecommendation"]]
};

export async function exportCsv(filename, condition) {
  const entry = EXPORTS[filename];
  if (!entry) return null;
  const [loader, fields] = entry;
  let rows = await loader();
  if (condition) rows = rows.filter((row) => String(row.Condition || row.condition || "").toLowerCase() === condition);
  return csvResponse(rows, fields);
}
