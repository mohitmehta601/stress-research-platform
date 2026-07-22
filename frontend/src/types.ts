export interface Participant {
  recordId?: string;
  id: string;
  name: string;
  age: number;
  gender: string;
  occupation: string;
  email: string;
  consentStatus: "accepted" | "rejected" | "pending";
  profileComplete: boolean;
  totalSessions: number;
  completedSessions: number;
  lastSessionDate: string | null;
  height?: number;
  weight?: number;
  bmi?: number;
  education?: string;
  smoking?: boolean;
  smokingStatus?: "never" | "former" | "current";
  alcohol?: boolean;
  alcoholUse?: "none" | "occasional" | "regular";
  sleepHours?: number;
  exercise?: string;
  exerciseDays?: number;
  heartDisease?: boolean;
  hypertension?: boolean;
  diabetes?: boolean;
  medication?: string | null;
}

export interface Session {
  recordId?: string;
  id: string;
  participantRecordId?: string;
  participantId: string;
  condition: "relaxed" | "stress";
  date: string;
  time: string;
  status: "completed" | "in-progress" | "pending-review" | "incomplete";
  ecgCollected: boolean;
  hrv: number | null;
  eda: number | null;
  temp: number | null;
  avgHeartRate: number | null;
  rmssdMs?: number | null;
  sdnnMs?: number | null;
  spo2Percent?: number | null;
  sclUs?: number | null;
  scrPeakCount?: number | null;
  scrMean?: number | null;
  questionnaireCompleted: boolean;
  doctorAssessmentStatus: "completed" | "pending" | "not-required";
  signalQuality: "good" | "moderate" | "poor" | null;
  respiration?: number | null;
  stressScore?: number | null;
  doctorLabel?: "low" | "moderate" | "high" | "severe" | string | null;
}

export interface PhysioRecord {
  id: string;
  participantId: string;
  sessionId: string;
  condition: "relaxed" | "stress";
  ecgCollected: boolean;
  heartRate: number | null;
  hrv: number | null;
  eda: number | null;
  temperature: number | null;
  respiration: number | null;
  meanTemp: number | null;
  rmssdMs: number | null;
  sdnnMs: number | null;
  heartRateBpm: number | null;
  spo2Percent: number | null;
  sclUs: number | null;
  scrPeakCount: number | null;
  scrMean: number | null;
  accelerometer: boolean;
  battery: number | null;
  samplingRate: number | null;
  signalQuality: "good" | "moderate" | "poor" | null;
}

export interface QuestionnaireRecord {
  id: string;
  participantId: string;
  sessionId: string;
  condition: "relaxed" | "stress";
  questionnaireKey?: string | null;
  answers?: Record<string, unknown>;
  mood: number | null;
  stress: number | null;
  sleep: number | null;
  fatigue: number | null;
  physical: number | null;
  lifestyle: number | null;
  score: number | null;
  timestamp: string | null;
  completed: boolean;
}

export interface DoctorAssessment {
  id: string;
  sessionRecordId?: string;
  participantId: string;
  sessionId: string;
  condition: "relaxed" | "stress";
  clinicalStressLabel: "low" | "moderate" | "high" | "severe" | null;
  comments: string | null;
  recommendation: string | null;
  status: "completed" | "pending";
}

export interface DashboardNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  relatedId: string | null;
  createdAt: string | null;
  read: boolean;
}

export interface DashboardSummary {
  totalParticipants: number;
  totalSessions: number;
  completedSessions: number;
  consentedParticipants: number;
  sensorRecords: number;
  questionnaireRecords: number;
  avgHeartRate: number | null;
  avgHrv: number | null;
  avgTemperature: number | null;
  avgEda: number | null;
  avgSdnn: number | null;
  avgSpo2: number | null;
  avgScrPeakCount: number | null;
  avgScrMean: number | null;
  avgStressScore: number | null;
}

export interface SensorSnapshot {
  meanTemp: number | null;
  rmssdMs: number | null;
  sdnnMs: number | null;
  heartRateBpm: number | null;
  spo2Percent: number | null;
  sclUs: number | null;
  scrPeakCount: number | null;
  scrMean: number | null;
}

export interface AuthUser {
  email: string;
  name: string;
  role: string;
}

export interface AccessRequest {
  id: string;
  name: string;
  email: string;
  organization: string;
  requestedRole: "viewer" | "researcher" | "doctor";
  reason: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}
