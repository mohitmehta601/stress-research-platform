const API_BASE = import.meta.env?.VITE_API_URL || "http://127.0.0.1:8010/api";
const TOKEN_KEY = "stresssense_token";
const REFRESH_TOKEN_KEY = "stresssense_refresh_token";
const SESSION_KEY = "stresssense_session_id";
const SESSION_CODE_KEY = "stresssense_session_code";
const USER_KEY = "stresssense_user";
let accessToken: string | null =
  typeof window === "undefined" ? null : localStorage.getItem(TOKEN_KEY);

type LoginResponse = {
  access_token: string;
  refresh_token?: string;
  participant: {
    id: string;
    email: string;
    participant_code: string;
    name: string;
    role: "participant" | "researcher" | "doctor" | "super_admin" | string;
    consent_completed?: boolean;
    profile_completed?: boolean;
    next_step: "consent" | "profile" | "dashboard";
  };
};

type CurrentParticipant = LoginResponse["participant"];

export type PendingOtpLogin = {
  requires_otp: true;
  otp_token: string;
  email: string;
  expires_in_seconds: number;
  message: string;
};

export type ParticipantProfilePayload = {
  age: number;
  gender: string;
  height_cm: number;
  weight_kg: number;
  education: string;
  occupation: string;
  smoking: "never" | "former" | "current";
  alcohol: "none" | "occasional" | "regular";
  sleep_hours: number;
  exercise_days_per_week: number;
  heart_disease: boolean;
  hypertension: boolean;
  diabetes: boolean;
  medication: string | null;
};

export type ParticipantProfile = ParticipantProfilePayload & {
  participant_id: string;
  bmi: number;
  updated_at: string;
};

export type MobileParticipant = {
  id: string;
  name: string;
  gender: string;
  age: number;
  consent: boolean;
  sessions: number;
  last: string;
  pct: number;
};

export type MobileSession = {
  rawId?: string;
  id: string;
  pid: string;
  pname: string;
  cond: "Relaxed" | "Stress";
  date: string;
  ecg: boolean;
  hrv: boolean;
  eda: boolean;
  temp: boolean;
  q: boolean;
  doctor: "Completed" | "Pending";
  quality: "Good" | "Moderate" | "Poor" | "Missing";
  questionnaireScore?: number;
  questionnaireAnswers?: Record<string, unknown>;
};

export type MobileSummary = {
  participants: number;
  sessions: number;
  completed: number;
  pending: number;
  quality: { name: string; value: number }[];
};

function token(): string | null {
  accessToken = accessToken || localStorage.getItem(TOKEN_KEY);
  return accessToken;
}

function normalizeParticipant(data: LoginResponse): CurrentParticipant {
  if (!data?.access_token || !data?.participant) {
    throw new Error("Login response was invalid. Please try again.");
  }

  return {
    ...data.participant,
    role: data.participant.role || "participant",
    next_step: data.participant.next_step || "dashboard",
  };
}

function saveAuth(data: LoginResponse): CurrentParticipant {
  const participant = normalizeParticipant(data);
  accessToken = data.access_token;
  localStorage.setItem(TOKEN_KEY, data.access_token);
  if (data.refresh_token) {
    localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);
  }
  api.currentParticipant = participant;
  return participant;
}

function dateText(value?: string | null): string {
  if (!value) return "—";
  const normalized = /\dT\d/.test(value) && !/[zZ]|[+-]\d{2}:\d{2}$/.test(value) ? `${value}Z` : value;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function qualityText(value?: string | null): MobileSession["quality"] {
  if (value === "good") return "Good";
  if (value === "moderate") return "Moderate";
  if (value === "poor") return "Poor";
  return "Missing";
}

function isBackendUnavailable(error: unknown): boolean {
  return error instanceof Error && error.message.includes("Cannot reach backend API");
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
        ...(options.headers ?? {}),
      },
    });
  } catch (error) {
    throw new Error(`Cannot reach backend API at ${API_BASE}. Start FastAPI on port 8010.`);
  }
  if (!res.ok) {
    if (res.status === 401 && path !== "/auth/refresh" && localStorage.getItem(REFRESH_TOKEN_KEY)) {
      const refreshed = await refreshSession();
      if (refreshed) return request<T>(path, options);
    }
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      message = body.detail || message;
    } catch {
      // keep default
    }
    throw new Error(message);
  }
  return res.json();
}

async function refreshSession(): Promise<boolean> {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) return false;
  try {
    const data = await request<LoginResponse>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    saveAuth(data);
    return true;
  } catch (error) {
    if (!isBackendUnavailable(error)) api.logout();
    return false;
  }
}

export const api = {
  get token() {
    return token();
  },
  get activeSessionId() {
    return localStorage.getItem(SESSION_KEY);
  },
  set activeSessionId(value: string | null) {
    if (value) localStorage.setItem(SESSION_KEY, value);
    else localStorage.removeItem(SESSION_KEY);
  },
  get activeSessionCode() {
    return localStorage.getItem(SESSION_CODE_KEY);
  },
  set activeSessionCode(value: string | null) {
    if (value) localStorage.setItem(SESSION_CODE_KEY, value);
    else localStorage.removeItem(SESSION_CODE_KEY);
  },
  get currentParticipant(): CurrentParticipant | null {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as CurrentParticipant;
    } catch {
      return null;
    }
  },
  set currentParticipant(value: CurrentParticipant | null) {
    if (value) localStorage.setItem(USER_KEY, JSON.stringify(value));
    else localStorage.removeItem(USER_KEY);
  },
  logout() {
    accessToken = null;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_CODE_KEY);
    localStorage.removeItem(USER_KEY);
  },
  isSignedIn() {
    return Boolean(token());
  },
  async register(name: string, email: string, password: string) {
    return request<PendingOtpLogin>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    });
  },
  async verifyRegistrationOtp(otpToken: string, otpCode: string) {
    const data = await request<LoginResponse>("/auth/verify-registration-otp", {
      method: "POST",
      body: JSON.stringify({ otp_token: otpToken, otp_code: otpCode }),
    });
    return saveAuth(data);
  },
  async login(email: string, password: string) {
    api.logout();
    const data = await request<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    return saveAuth(data);
  },
  forgotPassword(email: string) {
    return request("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  },
  resetPassword(token: string, password: string) {
    return request("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    });
  },
  async me() {
    const participant = await request<CurrentParticipant>("/auth/me");
    api.currentParticipant = {
      ...participant,
      role: participant.role || "participant",
      next_step: participant.next_step || "dashboard",
    };
    return participant;
  },
  consent(accepted: boolean) {
    return request("/consents/decision", {
      method: "POST",
      body: JSON.stringify({ accepted }),
    });
  },
  getProfile() {
    return request<ParticipantProfile>("/profiles/me");
  },
  saveProfile(profile: ParticipantProfilePayload) {
    return request("/profiles/me", {
      method: "PUT",
      body: JSON.stringify(profile),
    });
  },
  async createSession(condition: "relaxed" | "stress", task?: string) {
    const session = await request<{ id: string; session_code: string }>("/sessions", {
      method: "POST",
      body: JSON.stringify({ condition, task }),
    });
    api.activeSessionId = session.id;
    api.activeSessionCode = session.session_code;
    return session;
  },
  useSession(sessionId?: string | null, sessionCode?: string | null) {
    api.activeSessionId = sessionId || null;
    api.activeSessionCode = sessionCode || null;
  },
  savePhysiological(condition: "relaxed" | "stress") {
    const sessionId = api.activeSessionId;
    if (!sessionId) return Promise.resolve();
    return request(`/sessions/${sessionId}/physiological`, {
      method: "POST",
      body: JSON.stringify({
        ecg: [0.12, 0.18, 0.09, 0.21],
        heart_rate: condition === "stress" ? 96 : 72,
        hrv: condition === "stress" ? 30 : 48,
        eda: condition === "stress" ? 4.7 : 2.2,
        temperature: 36.6,
        sampling_rate: 250,
        signal_quality: condition === "stress" ? "moderate" : "good",
      }),
    });
  },
  saveQuestionnaire(score: number, answers: Record<string, unknown>) {
    const sessionId = api.activeSessionId;
    if (!sessionId) return Promise.resolve();
    return request("/questionnaires", {
      method: "POST",
      body: JSON.stringify({
        session_id: sessionId,
        questionnaire_key: "msaq-v1",
        answers,
        score,
      }),
    });
  },
  completeSession() {
    const sessionId = api.activeSessionId;
    if (!sessionId) return Promise.resolve();
    return request(`/sessions/${sessionId}/complete`, { method: "POST" });
  },
  saveDoctorAssessment(label: "Low" | "Moderate" | "High" | "Severe", comments?: string) {
    const sessionId = api.activeSessionId;
    if (!sessionId) return Promise.resolve();
    return request("/doctors/assessments", {
      method: "POST",
      body: JSON.stringify({
        session_id: sessionId,
        clinical_stress: label,
        comments,
        recommendation: "Follow study protocol and continue monitoring.",
      }),
    });
  },
  async downloadExport(filename: string, condition?: "combined" | "relaxed" | "stress") {
    const query = condition && condition !== "combined" ? `?condition=${condition}` : "";
    let res = await fetch(`${API_BASE}/dashboard/exports/${filename}${query}`, {
      headers: token() ? { Authorization: `Bearer ${token()}` } : {},
    });
    if (res.status === 401 && localStorage.getItem(REFRESH_TOKEN_KEY) && await refreshSession()) {
      res = await fetch(`${API_BASE}/dashboard/exports/${filename}${query}`, {
        headers: token() ? { Authorization: `Bearer ${token()}` } : {},
      });
    }
    if (!res.ok) throw new Error("Export failed");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = condition && condition !== "combined" ? `${condition}_${filename}` : filename;
    link.click();
    URL.revokeObjectURL(url);
  },
  async getResearchData(): Promise<{ summary: MobileSummary; participants: MobileParticipant[]; sessions: MobileSession[] }> {
    const [summary, participants, sessions] = await Promise.all([
      request<{
        metrics?: { participants?: number; total_sessions?: number; completed_sessions?: number; pending_reviews?: number };
        quality?: Record<string, number>;
      }>("/dashboard/summary"),
      request<Array<{
        id?: string;
        participant_code?: string;
        name?: string;
        gender?: string | null;
        age?: number | null;
        consent_completed?: boolean;
        sessions?: number;
        completed_sessions?: number;
        last_session_at?: string | null;
      }>>("/dashboard/participants"),
      request<Array<{
        _id?: string;
        session_code?: string;
        participant_code?: string;
        participant_name?: string;
        condition?: "relaxed" | "stress";
        started_at?: string | null;
        signal_quality?: string | null;
        collected?: { physiological?: boolean; questionnaire?: boolean; doctor_assessment?: boolean };
        physiological?: { hrv?: number | null; eda?: number | null; temperature?: number | null };
      }>>("/dashboard/sessions"),
    ]);

    const mappedParticipants: MobileParticipant[] = participants.map((participant) => {
      const total = participant.sessions ?? 0;
      const done = participant.completed_sessions ?? 0;
      return {
        id: participant.participant_code || participant.id || "Unknown",
        name: participant.name || "Unknown participant",
        gender: (participant.gender || "U").slice(0, 1).toUpperCase(),
        age: participant.age ?? 0,
        consent: Boolean(participant.consent_completed),
        sessions: total,
        last: participant.last_session_at ? dateText(participant.last_session_at) : "—",
        pct: total > 0 ? Math.round((done / total) * 100) : 0,
      };
    });

    const mappedSessions: MobileSession[] = sessions.map((session) => ({
      rawId: session._id,
      id: session.session_code || session._id || "Unknown",
      pid: session.participant_code || "Unknown",
      pname: session.participant_name || "Unknown participant",
      cond: session.condition === "stress" ? "Stress" : "Relaxed",
      date: dateText(session.started_at),
      ecg: Boolean(session.collected?.physiological),
      hrv: session.physiological?.hrv !== null && session.physiological?.hrv !== undefined,
      eda: session.physiological?.eda !== null && session.physiological?.eda !== undefined,
      temp: session.physiological?.temperature !== null && session.physiological?.temperature !== undefined,
      q: Boolean(session.collected?.questionnaire),
      doctor: session.collected?.doctor_assessment ? "Completed" : "Pending",
      quality: qualityText(session.signal_quality),
    }));

    const quality = summary.quality || {};
    const totalQuality = Math.max((quality.good || 0) + (quality.moderate || 0) + (quality.poor || 0), 1);

    return {
      participants: mappedParticipants,
      sessions: mappedSessions,
      summary: {
        participants: summary.metrics?.participants ?? mappedParticipants.length,
        sessions: summary.metrics?.total_sessions ?? mappedSessions.length,
        completed: summary.metrics?.completed_sessions ?? mappedSessions.filter((session) => session.q).length,
        pending: summary.metrics?.pending_reviews ?? mappedSessions.filter((session) => session.doctor === "Pending").length,
        quality: [
          { name: "Good", value: Math.round(((quality.good || 0) / totalQuality) * 100) },
          { name: "Moderate", value: Math.round(((quality.moderate || 0) / totalQuality) * 100) },
          { name: "Poor", value: Math.round(((quality.poor || 0) / totalQuality) * 100) },
        ],
      },
    };
  },
  async getPhysiologicalQuality(): Promise<Array<{ name: string; quality: string; score: number }>> {
    const records = await request<Array<{
      heart_rate?: number | null;
      hrv?: number | null;
      eda?: number | null;
      temperature?: number | null;
      respiration?: number | null;
      accelerometer?: boolean;
      battery?: number | null;
      signal_quality?: "good" | "moderate" | "poor" | null;
    }>>("/dashboard/physiological");
    const latest = records[0];
    if (!latest) return [];
    const quality = qualityText(latest.signal_quality);
    const baseScore = quality === "Good" ? 92 : quality === "Moderate" ? 72 : quality === "Poor" ? 45 : 0;
    return [
      { name: "ECG", quality, score: baseScore },
      { name: "HRV (RMSSD)", quality: latest.hrv != null ? quality : "Missing", score: latest.hrv != null ? baseScore : 0 },
      { name: "EDA", quality: latest.eda != null ? quality : "Missing", score: latest.eda != null ? baseScore : 0 },
      { name: "Temperature", quality: latest.temperature != null ? "Good" : "Missing", score: latest.temperature != null ? 95 : 0 },
      { name: "Respiration", quality: latest.respiration != null ? quality : "Missing", score: latest.respiration != null ? baseScore : 0 },
      { name: "Accelerometer", quality: latest.accelerometer ? "Good" : "Missing", score: latest.accelerometer ? 90 : 0 },
      { name: "Battery", quality: latest.battery != null ? "Good" : "Missing", score: latest.battery ?? 0 },
    ];
  },
  async getMySessions(): Promise<MobileSession[]> {
    const sessions = await request<Array<{
      id?: string;
      session_code?: string;
      condition?: "relaxed" | "stress";
      started_at?: string | null;
      signal_quality?: string | null;
      collected?: { physiological?: boolean; questionnaire?: boolean; doctor_assessment?: boolean };
      physiological?: { hrv?: number | null; eda?: number | null; temperature?: number | null };
    }>>("/sessions/me");
    return sessions.map((session) => ({
      rawId: session.id,
      id: session.session_code || session.id || "Unknown",
      pid: "Me",
      pname: "Current participant",
      cond: session.condition === "stress" ? "Stress" : "Relaxed",
      date: dateText(session.started_at),
      ecg: Boolean(session.collected?.physiological),
      hrv: session.physiological?.hrv !== null && session.physiological?.hrv !== undefined,
      eda: session.physiological?.eda !== null && session.physiological?.eda !== undefined,
      temp: session.physiological?.temperature !== null && session.physiological?.temperature !== undefined,
      q: Boolean(session.collected?.questionnaire),
      doctor: session.collected?.doctor_assessment ? "Completed" : "Pending",
      quality: qualityText(session.signal_quality),
    }));
  },
  async getParticipantHome() {
    const [participant, sessions] = await Promise.all([
      api.me(),
      api.getMySessions(),
    ]);
    const completed = sessions.filter((session) => session.q).length;
    const relaxed = sessions.filter((session) => session.cond === "Relaxed").length;
    const stress = sessions.filter((session) => session.cond === "Stress").length;
    return {
      participant,
      sessions,
      completed,
      relaxed,
      stress,
      last: sessions[0]?.date || "—",
    };
  },
};
