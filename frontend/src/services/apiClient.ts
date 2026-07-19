import type {
  Participant, Session, PhysioRecord,
  QuestionnaireRecord, DoctorAssessment, DashboardSummary, AuthUser, AccessRequest, DashboardNotification, SensorSnapshot
} from "../types";

function normalizeApiBase(url?: string): string {
  const baseUrl = (url || "http://127.0.0.1:8010/api").replace(/\/$/, "");
  return baseUrl.endsWith("/api") ? baseUrl : `${baseUrl}/api`;
}

const API_BASE = normalizeApiBase(
  import.meta.env?.VITE_API_BASE_URL || import.meta.env?.VITE_API_URL,
);
const TOKEN_KEY = "srp_token";
const REFRESH_TOKEN_KEY = "srp_refresh_token";
const USER_KEY = "srp_user";
const ACCESS_REQUESTS_KEY = "srp_access_requests";
const IST_TIME_ZONE = "Asia/Kolkata";
let accessToken: string | null =
  typeof window === "undefined" ? null : localStorage.getItem(TOKEN_KEY);

function notifyAuthChanged(): void {
  window.dispatchEvent(new Event("srp-auth-changed"));
}

type BackendParticipant = {
  id?: string;
  _id?: string;
  participant_code?: string;
  name?: string;
  email?: string;
  sessions?: number;
  completed_sessions?: number;
  consent_completed?: boolean;
  profile_completed?: boolean;
  age?: number | null;
  gender?: string | null;
  height_cm?: number | null;
  weight_kg?: number | null;
  bmi?: number | null;
  education?: string | null;
  occupation?: string | null;
  smoking?: "never" | "former" | "current" | null;
  alcohol?: "none" | "occasional" | "regular" | null;
  sleep_hours?: number | null;
  exercise_days_per_week?: number | null;
  heart_disease?: boolean | null;
  hypertension?: boolean | null;
  diabetes?: boolean | null;
  medication?: string | null;
  last_session_at?: string | null;
  is_active?: boolean;
};

export type ManualParticipantPayload = {
  participant_code?: string;
  name: string;
  email: string;
  password?: string;
  is_active: boolean;
  consent_completed: boolean;
  profile_completed: boolean;
  age?: number | null;
  gender?: string | null;
  height_cm?: number | null;
  weight_kg?: number | null;
  education?: string | null;
  occupation?: string | null;
  smoking?: "never" | "former" | "current" | null;
  alcohol?: "none" | "occasional" | "regular" | null;
  sleep_hours?: number | null;
  exercise_days_per_week?: number | null;
  heart_disease: boolean;
  hypertension: boolean;
  diabetes: boolean;
  medication?: string | null;
};

type BackendSummary = {
  metrics?: {
    participants?: number;
    total_sessions?: number;
    completed_sessions?: number;
    consented?: number;
    sensor_records?: number;
    questionnaire_records?: number;
  };
  averages?: {
    heart_rate?: number;
    hrv?: number;
    temperature?: number;
    eda?: number;
    sdnn_ms?: number;
    spo2_percent?: number;
    scr_peak_count?: number;
    scr_mean?: number;
    stress_score?: number;
  };
};

type BackendSession = {
  _id?: string;
  id?: string;
  session_code?: string;
  participant_id?: string;
  participant_object_id?: string;
  participant_code?: string;
  participant_name?: string;
  condition?: "relaxed" | "stress";
  status?: string;
  started_at?: string | null;
  completed_at?: string | null;
  signal_quality?: "good" | "moderate" | "poor" | "pending" | null;
  collected?: {
    physiological?: boolean;
    questionnaire?: boolean;
    doctor_assessment?: boolean;
  };
  physiological?: {
    heart_rate?: number | null;
    hrv?: number | null;
    eda?: number | null;
    temperature?: number | null;
    respiration?: number | null;
    mean_temp?: number | null;
    rmssd_ms?: number | null;
    sdnn_ms?: number | null;
    heart_rate_bpm?: number | null;
    spo2_percent?: number | null;
    scl_us?: number | null;
    scr_peak_count?: number | null;
    scr_mean?: number | null;
  } | null;
  stress_score?: number | null;
  doctor_label?: string | null;
};

export type ManualSessionPayload = {
  participant_id: string;
  session_code?: string;
  condition: "relaxed" | "stress";
  status: "completed" | "in_progress" | "in-progress" | "pending" | "pending-review" | "incomplete";
  task?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  duration_seconds?: number | null;
  signal_quality?: "good" | "moderate" | "poor" | null;
  ecg_collected: boolean;
  heart_rate?: number | null;
  hrv?: number | null;
  eda?: number | null;
  temperature?: number | null;
  respiration?: number | null;
  questionnaire_completed: boolean;
  questionnaire_score?: number | null;
  doctor_assessment_completed: boolean;
  doctor_label?: "low" | "moderate" | "high" | "severe" | null;
};

type BackendPhysio = {
  id?: string;
  participant_id?: string;
  session_id?: string;
  condition?: "relaxed" | "stress";
  ecg_collected?: boolean;
  heart_rate?: number | null;
  hrv?: number | null;
  eda?: number | null;
  temperature?: number | null;
  respiration?: number | null;
  mean_temp?: number | null;
  rmssd_ms?: number | null;
  sdnn_ms?: number | null;
  heart_rate_bpm?: number | null;
  spo2_percent?: number | null;
  scl_us?: number | null;
  scr_peak_count?: number | null;
  scr_mean?: number | null;
  accelerometer?: boolean;
  battery?: number | null;
  sampling_rate?: number | null;
  signal_quality?: "good" | "moderate" | "poor" | null;
};

type BackendQuestionnaire = {
  id?: string;
  participant_id?: string;
  session_id?: string;
  condition?: "relaxed" | "stress";
  questionnaire_key?: string | null;
  answers?: Record<string, unknown>;
  mood?: number | null;
  stress?: number | null;
  sleep?: number | null;
  fatigue?: number | null;
  physical?: number | null;
  lifestyle?: number | null;
  score?: number | null;
  timestamp?: string | null;
  completed?: boolean;
};

type BackendDoctor = {
  id?: string;
  session_record_id?: string;
  participant_id?: string;
  session_id?: string;
  condition?: "relaxed" | "stress";
  clinical_stress_label?: "low" | "moderate" | "high" | "severe" | string | null;
  comments?: string | null;
  recommendation?: string | null;
  status?: "completed" | "pending";
};

type BackendNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  related_id?: string | null;
  created_at?: string | null;
  read?: boolean;
};

type BackendLogin = {
  access_token: string;
  refresh_token?: string;
  participant?: {
    email?: string;
    name?: string;
    role?: string;
  };
  user?: AuthUser;
};

export type PendingOtpLogin = {
  requires_otp: true;
  otp_token: string;
  email: string;
  expires_in_seconds: number;
  message: string;
};

function headers(options?: RequestInit, token?: string | null): HeadersInit {
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options?.headers ?? {}),
  };
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const requestToken = accessToken || localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: headers(options, requestToken),
  });
  if (!res.ok) {
    if (res.status === 401 && path !== "/auth/refresh" && localStorage.getItem(REFRESH_TOKEN_KEY)) {
      const refreshed = await refreshSession();
      if (refreshed) {
        return apiFetch<T>(path, options);
      }
    }
    let detail = `API error ${res.status}`;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {
      // Keep status-based message.
    }
    const currentToken = accessToken || localStorage.getItem(TOKEN_KEY);
    const failedCurrentSession = requestToken === currentToken;

    if (
      failedCurrentSession
      && (
        res.status === 401
        || (res.status === 403 && detail.toLowerCase().includes("researcher access"))
      )
    ) {
      clearToken();
      notifyAuthChanged();
    }
    throw new Error(detail);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return res.json();
}

async function refreshSession(): Promise<boolean> {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) throw new Error("Refresh failed");
    const data = await res.json() as BackendLogin;
    accessToken = data.access_token;
    localStorage.setItem(TOKEN_KEY, data.access_token);
    if (data.refresh_token) localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);
    return true;
  } catch {
    clearToken();
    return false;
  }
}

function normalizeStatus(status?: string): Session["status"] {
  const value = (status || "incomplete").replace("_", "-").toLowerCase();
  if (value === "in-progress" || value === "completed" || value === "pending-review" || value === "incomplete") return value;
  if (value === "pending") return "pending-review";
  return "incomplete";
}

function normalizeQuality(value?: string | null): PhysioRecord["signalQuality"] {
  if (value === "good" || value === "moderate" || value === "poor") return value;
  return null;
}

function splitDateTime(value?: string | null): { date: string; time: string } {
  if (!value) return { date: "", time: "" };
  const normalized = /\dT\d/.test(value) && !/[zZ]|[+-]\d{2}:\d{2}$/.test(value) ? `${value}Z` : value;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return { date: value.slice(0, 10), time: "" };
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone: IST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date).map((part) => [part.type, part.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}

export function formatDateTimeIST(value?: string | null): string {
  if (!value) return "";
  const normalized = /\dT\d/.test(value) && !/[zZ]|[+-]\d{2}:\d{2}$/.test(value) ? `${value}Z` : value;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return String(value);
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone: IST_TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.day} ${parts.month} ${parts.year}, ${parts.hour}:${parts.minute} IST`;
}

function toAuthUser(data: BackendLogin["participant"] | AuthUser | undefined): AuthUser {
  return {
    email: data?.email || "",
    name: data?.name || "",
    role: data && "role" in data && data.role ? data.role : "",
  };
}

function toParticipant(item: BackendParticipant): Participant {
  return {
    recordId: item.id || item._id,
    id: item.participant_code || item.id || item._id || "Unknown",
    name: item.name || "Unknown participant",
    age: item.age ?? 0,
    gender: item.gender || "—",
    occupation: item.occupation || "—",
    email: item.email || "—",
    consentStatus: item.consent_completed ? "accepted" : "pending",
    profileComplete: Boolean(item.profile_completed),
    totalSessions: item.sessions ?? 0,
    completedSessions: item.completed_sessions ?? 0,
    lastSessionDate: item.last_session_at ? splitDateTime(item.last_session_at).date : null,
    height: item.height_cm ?? undefined,
    weight: item.weight_kg ?? undefined,
    bmi: item.bmi ?? undefined,
    education: item.education ?? undefined,
    smoking: item.smoking ? item.smoking !== "never" : undefined,
    smokingStatus: item.smoking ?? undefined,
    alcohol: item.alcohol ? item.alcohol !== "none" : undefined,
    alcoholUse: item.alcohol ?? undefined,
    sleepHours: item.sleep_hours ?? undefined,
    exercise: typeof item.exercise_days_per_week === "number" ? `${item.exercise_days_per_week} days/week` : undefined,
    exerciseDays: item.exercise_days_per_week ?? undefined,
    heartDisease: Boolean(item.heart_disease),
    hypertension: Boolean(item.hypertension),
    diabetes: Boolean(item.diabetes),
    medication: item.medication ?? null,
  };
}

function toSummary(item: BackendSummary): DashboardSummary {
  const metrics = item.metrics || {};
  const averages = item.averages || {};
  return {
    totalParticipants: metrics.participants ?? 0,
    totalSessions: metrics.total_sessions ?? 0,
    completedSessions: metrics.completed_sessions ?? 0,
    consentedParticipants: metrics.consented ?? 0,
    sensorRecords: metrics.sensor_records ?? 0,
    questionnaireRecords: metrics.questionnaire_records ?? 0,
    avgHeartRate: averages.heart_rate ?? 0,
    avgHrv: averages.hrv ?? 0,
    avgTemperature: averages.temperature ?? 0,
    avgEda: averages.eda ?? 0,
    avgSdnn: averages.sdnn_ms ?? 0,
    avgSpo2: averages.spo2_percent ?? 0,
    avgScrPeakCount: averages.scr_peak_count ?? 0,
    avgScrMean: averages.scr_mean ?? 0,
    avgStressScore: averages.stress_score ?? 0,
  };
}

function toSensorSnapshot(item: BackendPhysio): SensorSnapshot {
  return {
    meanTemp: item.mean_temp ?? item.temperature ?? null,
    rmssdMs: item.rmssd_ms ?? item.hrv ?? null,
    sdnnMs: item.sdnn_ms ?? null,
    heartRateBpm: item.heart_rate_bpm ?? item.heart_rate ?? null,
    spo2Percent: item.spo2_percent ?? null,
    sclUs: item.scl_us ?? item.eda ?? null,
    scrPeakCount: item.scr_peak_count ?? null,
    scrMean: item.scr_mean ?? null,
  };
}

function toSession(item: BackendSession): Session {
  const when = splitDateTime(item.started_at);
  return {
    recordId: item.id || item._id,
    id: item.session_code || item.id || item._id || "Unknown",
    participantRecordId: item.participant_object_id || item.participant_id,
    participantId: item.participant_code || item.participant_id || "Unknown",
    condition: item.condition || "relaxed",
    date: when.date,
    time: when.time,
    status: normalizeStatus(item.status),
    ecgCollected: Boolean(item.collected?.physiological),
    hrv: item.physiological?.hrv ?? null,
    eda: item.physiological?.eda ?? null,
    temp: item.physiological?.temperature ?? null,
    respiration: item.physiological?.respiration ?? null,
    avgHeartRate: item.physiological?.heart_rate ?? null,
    rmssdMs: item.physiological?.rmssd_ms ?? item.physiological?.hrv ?? null,
    sdnnMs: item.physiological?.sdnn_ms ?? null,
    spo2Percent: item.physiological?.spo2_percent ?? null,
    sclUs: item.physiological?.scl_us ?? item.physiological?.eda ?? null,
    scrPeakCount: item.physiological?.scr_peak_count ?? null,
    scrMean: item.physiological?.scr_mean ?? null,
    questionnaireCompleted: Boolean(item.collected?.questionnaire),
    doctorAssessmentStatus: item.collected?.doctor_assessment ? "completed" : "pending",
    signalQuality: normalizeQuality(item.signal_quality),
    stressScore: item.stress_score ?? null,
    doctorLabel: item.doctor_label ?? null,
  };
}

function toPhysio(item: BackendPhysio): PhysioRecord {
  return {
    id: item.id || `${item.participant_id}-${item.session_id}`,
    participantId: item.participant_id || "Unknown",
    sessionId: item.session_id || "Unknown",
    condition: item.condition || "relaxed",
    ecgCollected: Boolean(item.ecg_collected),
    heartRate: item.heart_rate ?? null,
    hrv: item.hrv ?? null,
    eda: item.eda ?? null,
    temperature: item.temperature ?? null,
    respiration: item.respiration ?? null,
    meanTemp: item.mean_temp ?? item.temperature ?? null,
    rmssdMs: item.rmssd_ms ?? item.hrv ?? null,
    sdnnMs: item.sdnn_ms ?? null,
    heartRateBpm: item.heart_rate_bpm ?? item.heart_rate ?? null,
    spo2Percent: item.spo2_percent ?? null,
    sclUs: item.scl_us ?? item.eda ?? null,
    scrPeakCount: item.scr_peak_count ?? null,
    scrMean: item.scr_mean ?? null,
    accelerometer: Boolean(item.accelerometer),
    battery: item.battery ?? null,
    samplingRate: item.sampling_rate ?? null,
    signalQuality: normalizeQuality(item.signal_quality),
  };
}

function toQuestionnaire(item: BackendQuestionnaire): QuestionnaireRecord {
  return {
    id: item.id || `${item.participant_id}-${item.session_id}`,
    participantId: item.participant_id || "Unknown",
    sessionId: item.session_id || "Unknown",
    condition: item.condition || "relaxed",
    questionnaireKey: item.questionnaire_key ?? null,
    answers: item.answers ?? {},
    mood: item.mood ?? null,
    stress: item.stress ?? null,
    sleep: item.sleep ?? null,
    fatigue: item.fatigue ?? null,
    physical: item.physical ?? null,
    lifestyle: item.lifestyle ?? null,
    score: item.score ?? null,
    timestamp: item.timestamp ?? null,
    completed: Boolean(item.completed),
  };
}

function toDoctor(item: BackendDoctor): DoctorAssessment {
  const label = (item.clinical_stress_label || null)?.toLowerCase() as DoctorAssessment["clinicalStressLabel"];
  return {
    id: item.id || `${item.participant_id}-${item.session_id}`,
    sessionRecordId: item.session_record_id,
    participantId: item.participant_id || "Unknown",
    sessionId: item.session_id || "Unknown",
    condition: item.condition || "relaxed",
    clinicalStressLabel: label,
    comments: item.comments ?? null,
    recommendation: item.recommendation ?? null,
    status: item.status || "pending",
  };
}

function toNotification(item: BackendNotification): DashboardNotification {
  return {
    id: item.id,
    type: item.type,
    title: item.title,
    message: item.message,
    relatedId: item.related_id ?? null,
    createdAt: item.created_at ?? null,
    read: Boolean(item.read),
  };
}

export function getToken(): string | null {
  accessToken = accessToken || localStorage.getItem(TOKEN_KEY);
  return accessToken;
}

export function getCachedUser(): AuthUser | null {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || "null") as AuthUser | null;
  } catch {
    return null;
  }
}

export function clearToken(): void {
  accessToken = null;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  notifyAuthChanged();
}

function readAccessRequests(): AccessRequest[] {
  try {
    return JSON.parse(localStorage.getItem(ACCESS_REQUESTS_KEY) || "[]") as AccessRequest[];
  } catch {
    return [];
  }
}

function writeAccessRequests(requests: AccessRequest[]): void {
  localStorage.setItem(ACCESS_REQUESTS_KEY, JSON.stringify(requests));
}

export async function getAccessRequests(): Promise<AccessRequest[]> {
  return apiFetch<AccessRequest[]>("/dashboard/access-requests");
}

export async function reviewAccessRequest(
  id: string,
  status: "approved" | "rejected",
): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(
    `/dashboard/access-requests/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify({ status }),
    },
  );
}

export async function removeAccessRequest(id: string): Promise<void> {
  await apiFetch<void>(`/dashboard/access-requests/${id}`, {
    method: "DELETE",
  });
}

export function getPendingAccessRequestCount(): number {
  return readAccessRequests().filter((request) => request.status === "pending").length;
}

type AccessRequestResponse = {
  id: string;
  request_code: string;
  status: string;
  message: string;
};

export async function submitAccessRequest(
  payload: Omit<AccessRequest, "id" | "status" | "createdAt">,
): Promise<PendingOtpLogin> {
  return apiFetch<PendingOtpLogin>(
    "/auth/dashboard-access-requests",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export async function verifyAccessRequestOtp(
  otpToken: string,
  otpCode: string,
): Promise<AccessRequestResponse> {
  return apiFetch<AccessRequestResponse>(
    "/auth/dashboard-access-requests/verify-otp",
    {
      method: "POST",
      body: JSON.stringify({
        otp_token: otpToken,
        otp_code: otpCode,
      }),
    },
  );
}

export async function login(
  email: string,
  password: string,
): Promise<AuthUser> {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  accessToken = null;

  const data = await apiFetch<BackendLogin>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  const user = toAuthUser(data.user || data.participant);
  const role = user.role.toLowerCase();

  const dashboardRoles = new Set([
    "viewer",
    "researcher",
    "doctor",
    "admin",
    "super_admin",
  ]);

  if (!dashboardRoles.has(role)) {
    throw new Error(
      "This account is not authorized to access the research dashboard",
    );
  }

  accessToken = data.access_token;
  localStorage.setItem(TOKEN_KEY, data.access_token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));

  if (data.refresh_token) {
    localStorage.setItem(
      REFRESH_TOKEN_KEY,
      data.refresh_token,
    );
  }

  notifyAuthChanged();
  return user;
}

export async function forgotPassword(email: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(
  token: string,
  password: string,
): Promise<{ message: string }> {
  return apiFetch<{ message: string }>("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, password }),
  });
}

export async function getCurrentUser(): Promise<AuthUser> {
  const data = await apiFetch<BackendLogin["participant"]>("/auth/me");
  return toAuthUser(data);
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  return toSummary(await apiFetch<BackendSummary>("/dashboard/summary"));
}

export async function getLatestThingSpeakReading(): Promise<SensorSnapshot | null> {
  try {
    return toSensorSnapshot(await apiFetch<BackendPhysio>("/dashboard/thingspeak/latest"));
  } catch {
    return null;
  }
}

export async function getParticipants(): Promise<Participant[]> {
  return (await apiFetch<BackendParticipant[]>("/dashboard/participants")).map(toParticipant);
}

export async function getParticipant(id: string): Promise<Participant | null> {
  const detail = await apiFetch<{ participant: BackendParticipant; profile?: Record<string, unknown> | null }>(`/dashboard/participants/${id}`);
  return toParticipant({ ...detail.participant, ...(detail.profile || {}) });
}

export async function createParticipant(payload: ManualParticipantPayload): Promise<Participant> {
  return toParticipant(await apiFetch<BackendParticipant>("/dashboard/participants", {
    method: "POST",
    body: JSON.stringify(payload),
  }));
}

export async function updateParticipant(recordId: string, payload: ManualParticipantPayload): Promise<Participant> {
  return toParticipant(await apiFetch<BackendParticipant>(`/dashboard/participants/${recordId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  }));
}

export async function getSessions(): Promise<Session[]> {
  return (await apiFetch<BackendSession[]>("/dashboard/sessions")).map(toSession);
}

export async function getSession(id: string): Promise<Session | null> {
  const detail = await apiFetch<{ session: BackendSession; physiological?: BackendSession["physiological"]; questionnaire?: unknown; doctor_assessment?: unknown }>(`/dashboard/sessions/${id}`);
  return toSession({
    ...detail.session,
    physiological: detail.physiological,
    collected: {
      physiological: Boolean(detail.physiological),
      questionnaire: Boolean(detail.questionnaire),
      doctor_assessment: Boolean(detail.doctor_assessment),
    },
  });
}

export async function createSession(payload: ManualSessionPayload): Promise<Session> {
  return toSession(await apiFetch<BackendSession>("/dashboard/sessions", {
    method: "POST",
    body: JSON.stringify(payload),
  }));
}

export async function updateSession(recordId: string, payload: ManualSessionPayload): Promise<Session> {
  return toSession(await apiFetch<BackendSession>(`/dashboard/sessions/${recordId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  }));
}

export async function getPhysioRecords(): Promise<PhysioRecord[]> {
  return (await apiFetch<BackendPhysio[]>("/dashboard/physiological")).map(toPhysio);
}

export async function getQuestionnaireRecords(): Promise<QuestionnaireRecord[]> {
  return (await apiFetch<BackendQuestionnaire[]>("/dashboard/questionnaires")).map(toQuestionnaire);
}

export async function getDoctorAssessments(): Promise<DoctorAssessment[]> {
  return (await apiFetch<BackendDoctor[]>("/dashboard/doctor")).map(toDoctor);
}

export async function saveDoctorAssessment(payload: {
  session_id: string;
  clinical_stress_label: "low" | "moderate" | "high" | "severe";
  comments?: string | null;
  recommendation?: string | null;
}): Promise<DoctorAssessment> {
  return toDoctor(await apiFetch<BackendDoctor>("/dashboard/doctor", {
    method: "POST",
    body: JSON.stringify(payload),
  }));
}

export async function getNotifications(): Promise<DashboardNotification[]> {
  return (await apiFetch<BackendNotification[]>("/dashboard/notifications")).map(toNotification);
}

export async function markNotificationRead(id: string): Promise<void> {
  await apiFetch(`/dashboard/notifications/${id}/read`, { method: "POST" });
}

export async function downloadExport(type: string, condition?: "relaxed" | "stress" | "combined"): Promise<void> {
  const token = accessToken || localStorage.getItem(TOKEN_KEY);
  const query = condition && condition !== "combined" ? `?condition=${condition}` : "";
  let res = await fetch(`${API_BASE}/dashboard/exports/${type}${query}`, {
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (res.status === 401 && localStorage.getItem(REFRESH_TOKEN_KEY) && await refreshSession()) {
    const refreshedToken = accessToken || localStorage.getItem(TOKEN_KEY);
    res = await fetch(`${API_BASE}/dashboard/exports/${type}${query}`, {
      credentials: "include",
      headers: refreshedToken ? { Authorization: `Bearer ${refreshedToken}` } : {},
    });
  }
  if (res.status === 401 || res.status === 403) {
    clearToken();
  }
  if (!res.ok) {
    let detail = "Export failed";
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {
      // keep default
    }
    throw new Error(detail);
  }
  const blob = await res.blob();
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = condition && condition !== "combined" ? `${condition}_${type}` : type;
  link.click();
  URL.revokeObjectURL(link.href);
}
