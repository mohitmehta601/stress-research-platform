import { Participant, ResearchSession, Physiological, QuestionnaireResponse, DoctorAssessment } from "../models/index.js";
import { csvResponse } from "../utils/format.js";

const participantFilter = { role: "participant" };

export async function participantRows() {
  const participants = await Participant.find(participantFilter).lean();
  return participants.map((item) => {
    const profile = item.profile || {};
    return {
      ParticipantID: item.participant_code || "",
      ParticipantObjectID: String(item._id || ""),
      Name: item.name || "",
      Email: item.email || "",
      Age: profile.age || "",
      Gender: profile.gender || "",
      HeightCm: profile.height_cm || "",
      WeightKg: profile.weight_kg || "",
      BMI: profile.bmi || "",
      Education: profile.education || "",
      Occupation: profile.occupation || "",
      ConsentCompleted: Boolean(item.consent_completed),
      ProfileCompleted: Boolean(item.profile_completed),
      CreatedAt: item.created_at || ""
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
  const sessions = await ResearchSession.find({ physiological: { $exists: true } }).sort({ "physiological.recorded_at": -1 }).lean();
  const people = await Participant.find({ _id: { $in: sessions.map((item) => item.participant_id).filter(Boolean) } }).lean();
  const map = new Map(people.map((item) => [String(item._id), item]));
  return sessions.map((session) => {
    const item = session.physiological || {};
    const person = map.get(String(session.participant_id)) || {};
    return {
      ParticipantID: person.participant_code || String(session.participant_id || ""),
      SessionID: session.session_code || String(session._id || ""),
      Condition: session.condition || item.condition || "",
      ECG: item.ecg || "",
      HeartRate: item.heart_rate || "",
      HRV: item.hrv || "",
      RMSSD_ms: item.rmssd_ms ?? item.hrv ?? "",
      SDNN_ms: item.sdnn_ms ?? "",
      SpO2_percent: item.spo2_percent ?? "",
      EDA: item.eda || "",
      SCL_uS: item.scl_us ?? item.eda ?? "",
      SCR_Peak_Count: item.scr_peak_count ?? "",
      SCR_Mean: item.scr_mean ?? "",
      Temperature: item.temperature || "",
      Mean_Temp: item.mean_temp ?? item.temperature ?? "",
      Respiration: item.respiration || "",
      SignalQuality: item.signal_quality || "",
      ThingSpeakEntryID: item.thingspeak?.entry_id || "",
      RecordedAt: item.recorded_at || ""
    };
  });
}

export async function questionnaireRows() {
  const sessions = await ResearchSession.find({ questionnaire: { $exists: true } }).sort({ "questionnaire.submitted_at": -1 }).lean();
  return sessions.map((session) => ({
    ParticipantID: String(session.participant_id || ""),
    SessionID: session.session_code || String(session._id || ""),
    Condition: session.condition || "",
    QuestionnaireKey: session.questionnaire?.questionnaire_key || "",
    Score: session.questionnaire?.score || "",
    SubmittedAt: session.questionnaire?.submitted_at || "",
    Answers: session.questionnaire?.answers || {}
  }));
}

export async function doctorRows() {
  const sessions = await ResearchSession.find({ doctor_assessment: { $exists: true } }).sort({ "doctor_assessment.created_at": -1 }).lean();
  return sessions.map((session) => ({
    id: String(session._id || ""),
    session_id: String(session._id || ""),
    participant_id: String(session.participant_id || ""),
    clinical_stress: session.doctor_assessment?.clinical_stress || "",
    comments: session.doctor_assessment?.comments || "",
    recommendation: session.doctor_assessment?.recommendation || "",
    created_at: session.doctor_assessment?.created_at || "",
    updated_at: session.doctor_assessment?.updated_at || ""
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
  "participant.csv": [participantRows, ["ParticipantID", "ParticipantObjectID", "Name", "Email", "Age", "Gender", "HeightCm", "WeightKg", "BMI", "Education", "Occupation"]],
  "participant_profile.csv": [participantRows, ["ParticipantID", "Name", "Email", "Age", "Gender", "HeightCm", "WeightKg", "BMI", "Education", "Occupation"]],
  "session.csv": [sessionRows, ["SessionID", "SessionObjectID", "ParticipantID", "ParticipantObjectID", "Condition", "Task", "Status", "SignalQuality", "StartedAt", "CompletedAt", "DurationSeconds"]],
  "research_sessions.csv": [sessionRows, ["SessionID", "SessionObjectID", "ParticipantID", "Condition", "Task", "Status", "StartedAt", "CompletedAt", "DurationSeconds"]],
  "physiological.csv": [physiologicalRows, ["ParticipantID", "SessionID", "Condition", "ECG", "Mean_Temp", "RMSSD_ms", "SDNN_ms", "HeartRate", "SpO2_percent", "SCL_uS", "SCR_Peak_Count", "SCR_Mean", "EDA", "Temperature", "Respiration", "SignalQuality", "ThingSpeakEntryID", "RecordedAt"]],
  "questionnaire.csv": [questionnaireRows, ["ParticipantID", "SessionID", "Condition", "QuestionnaireKey", "Score", "SubmittedAt", "Answers"]],
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
