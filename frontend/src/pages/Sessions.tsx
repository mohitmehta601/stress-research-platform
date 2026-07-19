import { useEffect, useMemo, useState } from "react";
import { Edit3, Plus, Save, Search, X } from "lucide-react";
import {
  createSession,
  getParticipants,
  getSessions,
  updateSession,
  type ManualSessionPayload,
} from "../services/apiClient";
import type { Participant, Session } from "../types";
import { assessmentBadge, conditionBadge, qualityBadge, sessionStatusBadge } from "../components/StatusBadge";

type SessionForm = {
  participant_id: string;
  session_code: string;
  condition: "relaxed" | "stress";
  status: Session["status"];
  task: string;
  date: string;
  time: string;
  duration_seconds: string;
  signal_quality: "" | "good" | "moderate" | "poor";
  ecg_collected: boolean;
  heart_rate: string;
  hrv: string;
  eda: string;
  temperature: string;
  respiration: string;
  questionnaire_completed: boolean;
  questionnaire_score: string;
  doctor_assessment_completed: boolean;
  doctor_label: "" | "low" | "moderate" | "high" | "severe";
};

const emptyForm: SessionForm = {
  participant_id: "",
  session_code: "",
  condition: "relaxed",
  status: "incomplete",
  task: "",
  date: "",
  time: "",
  duration_seconds: "",
  signal_quality: "",
  ecg_collected: false,
  heart_rate: "",
  hrv: "",
  eda: "",
  temperature: "",
  respiration: "",
  questionnaire_completed: false,
  questionnaire_score: "",
  doctor_assessment_completed: false,
  doctor_label: "",
};

function numberOrNull(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toIso(date: string, time: string): string | null {
  if (!date) return null;
  const [year, month, day] = date.split("-").map(Number);
  const [hour = 0, minute = 0] = (time || "00:00").split(":").map(Number);
  if (![year, month, day, hour, minute].every(Number.isFinite)) return null;
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const utcTime = Date.UTC(year, month - 1, day, hour, minute) - istOffsetMs;
  return new Date(utcTime).toISOString();
}

function formFromSession(session?: Session | null): SessionForm {
  if (!session) return emptyForm;
  return {
    participant_id: session.participantRecordId || session.participantId,
    session_code: session.id === "Unknown" ? "" : session.id,
    condition: session.condition,
    status: session.status,
    task: "",
    date: session.date || "",
    time: session.time || "",
    duration_seconds: "",
    signal_quality: session.signalQuality || "",
    ecg_collected: session.ecgCollected,
    heart_rate: session.avgHeartRate === null ? "" : String(session.avgHeartRate),
    hrv: session.hrv === null ? "" : String(session.hrv),
    eda: session.eda === null ? "" : String(session.eda),
    temperature: session.temp === null ? "" : String(session.temp),
    respiration: session.respiration === null || session.respiration === undefined ? "" : String(session.respiration),
    questionnaire_completed: session.questionnaireCompleted,
    questionnaire_score: session.stressScore === null || session.stressScore === undefined ? "" : String(session.stressScore),
    doctor_assessment_completed: session.doctorAssessmentStatus === "completed",
    doctor_label: (session.doctorLabel as SessionForm["doctor_label"]) || "",
  };
}

function payloadFromForm(form: SessionForm): ManualSessionPayload {
  const status = form.status === "in-progress" ? "in_progress" : form.status;
  const startedAt = toIso(form.date, form.time);
  const duration = numberOrNull(form.duration_seconds);
  const completedAt = form.status === "completed" && startedAt && duration
    ? new Date(new Date(startedAt).getTime() + duration * 1000).toISOString()
    : null;
  return {
    participant_id: form.participant_id,
    session_code: form.session_code.trim() || undefined,
    condition: form.condition,
    status,
    task: form.task.trim() || null,
    started_at: startedAt,
    completed_at: completedAt,
    duration_seconds: duration,
    signal_quality: form.signal_quality || null,
    ecg_collected: form.ecg_collected,
    heart_rate: numberOrNull(form.heart_rate),
    hrv: numberOrNull(form.hrv),
    eda: numberOrNull(form.eda),
    temperature: numberOrNull(form.temperature),
    respiration: numberOrNull(form.respiration),
    questionnaire_completed: form.questionnaire_completed,
    questionnaire_score: numberOrNull(form.questionnaire_score),
    doctor_assessment_completed: form.doctor_assessment_completed,
    doctor_label: form.doctor_label || null,
  };
}

function CheckIcon({ value }: { value: boolean | null }) {
  if (value === null) return <span className="font-mono text-[10px] text-muted-foreground">—</span>;
  return value
    ? <span className="font-mono text-xs text-emerald-600">✓</span>
    : <span className="font-mono text-xs text-red-500">×</span>;
}

function Metric({ value, unit }: { value: number | null; unit: string }) {
  if (value === null) return <span className="font-mono text-[10px] text-red-400">missing</span>;
  return <span className="font-mono text-[10px] text-foreground">{value} <span className="text-muted-foreground">{unit}</span></span>;
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="space-y-1">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</span>
      <input
        className="w-full rounded border border-border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-blue-400"
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function SessionDrawer({ session: s, onClose, onEdit }: { session: Session; onClose: () => void; onEdit: () => void }) {
  return (
    <div className="fixed inset-0 z-30 flex justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <aside className="relative z-10 h-full w-full max-w-[400px] overflow-y-auto border-l border-border bg-card shadow-xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-border bg-card px-5 py-4">
          <div>
            <div className="font-mono text-sm font-semibold text-foreground">{s.id}</div>
            <div className="text-[10px] text-muted-foreground">{s.participantId} · {s.date || "No date"}</div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onEdit} className="rounded border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted">
              <Edit3 size={12} className="mr-1 inline" />
              Edit
            </button>
            <button onClick={onClose} className="rounded p-1 hover:bg-muted"><X size={14} /></button>
          </div>
        </div>
        <div className="space-y-5 p-5">
          <section>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Session metadata</div>
            <div className="grid grid-cols-2 gap-2">
              {[
                ["Session ID", s.id],
                ["Participant", s.participantId],
                ["Condition", s.condition],
                ["Date", s.date || "—"],
                ["Time", s.time || "—"],
                ["Status", s.status],
              ].map(([label, val]) => (
                <div key={label as string} className="rounded bg-muted/50 p-2">
                  <div className="text-[10px] text-muted-foreground">{label}</div>
                  <div className="font-mono text-xs font-medium text-foreground">{String(val)}</div>
                </div>
              ))}
            </div>
          </section>
          <section>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Sensor data</div>
            <div className="grid grid-cols-2 gap-2">
              {[
                ["ECG", s.ecgCollected ? "Collected" : "Missing"],
                ["Avg Heart Rate", s.avgHeartRate ? `${s.avgHeartRate} bpm` : "—"],
                ["HRV", s.hrv ? `${s.hrv} ms` : "missing"],
                ["EDA", s.eda ? `${s.eda} μS` : "missing"],
                ["Temperature", s.temp ? `${s.temp} °C` : "missing"],
                ["Respiration", s.respiration ? `${s.respiration} bpm` : "missing"],
                ["Signal Quality", s.signalQuality ?? "—"],
              ].map(([label, val]) => (
                <div key={label as string} className="rounded bg-muted/50 p-2">
                  <div className="text-[10px] text-muted-foreground">{label}</div>
                  <div className="font-mono text-xs font-medium text-foreground">{String(val)}</div>
                </div>
              ))}
            </div>
          </section>
          <section>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Completeness checklist</div>
            {[
              ["Sensor Data", s.ecgCollected],
              ["Questionnaire Done", s.questionnaireCompleted],
              ["Doctor Assessment", s.doctorAssessmentStatus === "completed"],
            ].map(([label, val]) => (
              <div key={label as string} className="flex items-center justify-between border-b border-border/50 py-2 last:border-0">
                <span className="text-xs text-foreground">{label}</span>
                <CheckIcon value={val as boolean} />
              </div>
            ))}
          </section>
        </div>
      </aside>
    </div>
  );
}

function SessionEditor({
  session,
  participants,
  onClose,
  onSaved,
}: {
  session: Session | null;
  participants: Participant[];
  onClose: () => void;
  onSaved: (session: Session) => void;
}) {
  const [form, setForm] = useState(() => {
    const initial = formFromSession(session);
    if (!session && !initial.participant_id && participants[0]) {
      return { ...initial, participant_id: participants[0].recordId || participants[0].id };
    }
    return initial;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const isEdit = Boolean(session);

  const patch = <K extends keyof SessionForm>(key: K, value: SessionForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  async function save() {
    setError("");
    if (!form.participant_id) {
      setError("Participant is required.");
      return;
    }
    if (!form.date) {
      setError("Session date is required.");
      return;
    }
    setSaving(true);
    try {
      const payload = payloadFromForm(form);
      const saved = isEdit && session?.recordId
        ? await updateSession(session.recordId, payload)
        : await createSession(payload);
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save session.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/25" onClick={onClose} />
      <aside className="relative z-10 h-full w-full max-w-[540px] overflow-y-auto border-l border-border bg-card shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-border bg-card px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">{isEdit ? "Edit research session" : "Add research session"}</h2>
            <p className="text-xs text-muted-foreground">Manual session records save to MongoDB and update linked datasets.</p>
          </div>
          <button onClick={onClose} className="rounded p-1 hover:bg-muted"><X size={14} /></button>
        </div>

        <div className="space-y-5 p-5">
          {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}

          <section className="space-y-3">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Session identity</div>
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Participant</span>
                <select className="w-full rounded border border-border bg-background px-3 py-2 text-xs" value={form.participant_id} onChange={(e) => patch("participant_id", e.target.value)}>
                  <option value="">Select participant</option>
                  {participants.map((p) => (
                    <option key={p.recordId || p.id} value={p.recordId || p.id}>{p.id} · {p.name}</option>
                  ))}
                </select>
              </label>
              <TextField label="Session ID" value={form.session_code} onChange={(value) => patch("session_code", value)} />
              <label className="space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Condition</span>
                <select className="w-full rounded border border-border bg-background px-3 py-2 text-xs" value={form.condition} onChange={(e) => patch("condition", e.target.value as SessionForm["condition"])}>
                  <option value="relaxed">Relaxed</option>
                  <option value="stress">Stress</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Status</span>
                <select className="w-full rounded border border-border bg-background px-3 py-2 text-xs" value={form.status} onChange={(e) => patch("status", e.target.value as SessionForm["status"])}>
                  <option value="incomplete">Incomplete</option>
                  <option value="in-progress">In Progress</option>
                  <option value="pending-review">Pending Review</option>
                  <option value="completed">Completed</option>
                </select>
              </label>
              <TextField label="Date" value={form.date} type="date" onChange={(value) => patch("date", value)} />
              <TextField label="Time" value={form.time} type="time" onChange={(value) => patch("time", value)} />
              <TextField label="Duration seconds" value={form.duration_seconds} type="number" onChange={(value) => patch("duration_seconds", value)} />
              <TextField label="Task / note" value={form.task} onChange={(value) => patch("task", value)} />
            </div>
          </section>

          <section className="space-y-3">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Physiological data</div>
            <div className="grid grid-cols-3 gap-3">
              <label className="flex items-center gap-2 rounded border border-border bg-background px-3 py-2 text-xs">
                <input type="checkbox" checked={form.ecg_collected} onChange={(e) => patch("ecg_collected", e.target.checked)} />
                ECG collected
              </label>
              <label className="space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Quality</span>
                <select className="w-full rounded border border-border bg-background px-3 py-2 text-xs" value={form.signal_quality} onChange={(e) => patch("signal_quality", e.target.value as SessionForm["signal_quality"])}>
                  <option value="">Pending</option>
                  <option value="good">Good</option>
                  <option value="moderate">Moderate</option>
                  <option value="poor">Poor</option>
                </select>
              </label>
              <TextField label="Heart rate" value={form.heart_rate} type="number" onChange={(value) => patch("heart_rate", value)} />
              <TextField label="HRV" value={form.hrv} type="number" onChange={(value) => patch("hrv", value)} />
              <TextField label="EDA" value={form.eda} type="number" onChange={(value) => patch("eda", value)} />
              <TextField label="Temperature" value={form.temperature} type="number" onChange={(value) => patch("temperature", value)} />
              <TextField label="Respiration" value={form.respiration} type="number" onChange={(value) => patch("respiration", value)} />
            </div>
          </section>

          <section className="space-y-3">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Collection checklist</div>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex items-center gap-2 rounded border border-border bg-background px-3 py-2 text-xs">
                <input type="checkbox" checked={form.questionnaire_completed} onChange={(e) => patch("questionnaire_completed", e.target.checked)} />
                Questionnaire completed
              </label>
              <label className="flex items-center gap-2 rounded border border-border bg-background px-3 py-2 text-xs">
                <input type="checkbox" checked={form.doctor_assessment_completed} onChange={(e) => patch("doctor_assessment_completed", e.target.checked)} />
                Doctor assessment completed
              </label>
              <TextField label="Questionnaire score" value={form.questionnaire_score} type="number" onChange={(value) => patch("questionnaire_score", value)} />
              <label className="space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Doctor label</span>
                <select className="w-full rounded border border-border bg-background px-3 py-2 text-xs" value={form.doctor_label} onChange={(e) => patch("doctor_label", e.target.value as SessionForm["doctor_label"])}>
                  <option value="">None</option>
                  <option value="low">Low</option>
                  <option value="moderate">Moderate</option>
                  <option value="high">High</option>
                  <option value="severe">Severe</option>
                </select>
              </label>
            </div>
          </section>

          <button
            onClick={save}
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded bg-[#1d4ed8] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1e40af] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save size={14} />
            {saving ? "Saving..." : "Save session"}
          </button>
        </div>
      </aside>
    </div>
  );
}

export default function Sessions() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCondition, setFilterCondition] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selected, setSelected] = useState<Session | null>(null);
  const [editing, setEditing] = useState<Session | null | undefined>(undefined);

  async function load() {
    setLoading(true);
    try {
      const [sessionItems, participantItems] = await Promise.all([getSessions(), getParticipants()]);
      setSessions(sessionItems);
      setParticipants(participantItems);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => sessions.filter((s) => {
    const q = search.toLowerCase();
    const matchSearch = !q || s.id.toLowerCase().includes(q) || s.participantId.toLowerCase().includes(q);
    const matchCond = filterCondition === "all" || s.condition === filterCondition;
    const matchStatus = filterStatus === "all" || s.status === filterStatus;
    return matchSearch && matchCond && matchStatus;
  }), [sessions, search, filterCondition, filterStatus]);

  function handleSaved(saved: Session) {
    setSessions((current) => {
      const key = saved.recordId || saved.id;
      const exists = current.some((item) => (item.recordId || item.id) === key);
      return exists
        ? current.map((item) => ((item.recordId || item.id) === key ? saved : item))
        : [saved, ...current];
    });
    setSelected(saved);
    setEditing(undefined);
  }

  return (
    <div className="min-w-0">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-foreground">Research Sessions</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {sessions.length} sessions across {[...new Set(sessions.map((s) => s.participantId))].length} participants · manual entries save to MongoDB
          </p>
        </div>
        <button
          onClick={() => setEditing(null)}
          className="flex w-full items-center justify-center gap-2 rounded bg-[#1d4ed8] px-3 py-2 text-xs font-semibold text-white hover:bg-[#1e40af] sm:w-auto"
        >
          <Plus size={14} />
          Add Session
        </button>
      </div>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
        <div className="relative min-w-0 sm:w-60">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            className="w-full rounded border border-border bg-card py-1.5 pl-8 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
            placeholder="Search session or participant..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="rounded border border-border bg-card px-2.5 py-1.5 text-xs" value={filterCondition} onChange={(e) => setFilterCondition(e.target.value)}>
          <option value="all">All Conditions</option>
          <option value="relaxed">Relaxed</option>
          <option value="stress">Stress</option>
        </select>
        <select className="rounded border border-border bg-card px-2.5 py-1.5 text-xs" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="all">All Statuses</option>
          <option value="completed">Completed</option>
          <option value="in-progress">In Progress</option>
          <option value="pending-review">Pending Review</option>
          <option value="incomplete">Incomplete</option>
        </select>
        <span className="text-xs text-muted-foreground">{filtered.length} results</span>
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
          <div className="mr-2 h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          Loading...
        </div>
      ) : (
        <div className="min-w-0 overflow-x-auto rounded border border-border bg-card shadow-sm">
          <table className="min-w-[1120px] w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/60">
                {["Session ID", "Participant", "Condition", "Date/Time", "ECG", "HRV", "EDA", "Temp", "Questionnaire", "Doctor", "Quality", "Status", "Actions"].map((h) => (
                  <th key={h} className="whitespace-nowrap px-2.5 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={13} className="py-12 text-center text-muted-foreground">No sessions found</td></tr>
              ) : filtered.map((s, i) => (
                <tr
                  key={s.recordId || s.id}
                  className={`border-b border-border/50 transition-colors hover:bg-blue-50/50 ${i % 2 === 1 ? "bg-muted/20" : ""}`}
                >
                  <td onClick={() => setSelected(s)} className="cursor-pointer px-2.5 py-2 font-mono font-semibold text-[#1a3461]">{s.id}</td>
                  <td onClick={() => setSelected(s)} className="cursor-pointer px-2.5 py-2 font-mono text-muted-foreground">{s.participantId}</td>
                  <td className="px-2.5 py-2">{conditionBadge(s.condition)}</td>
                  <td className="whitespace-nowrap px-2.5 py-2 font-mono text-muted-foreground">{s.date || "—"} {s.time || ""}</td>
                  <td className="px-2.5 py-2"><CheckIcon value={s.ecgCollected} /></td>
                  <td className="px-2.5 py-2"><Metric value={s.hrv} unit="ms" /></td>
                  <td className="px-2.5 py-2"><Metric value={s.eda} unit="μS" /></td>
                  <td className="px-2.5 py-2"><Metric value={s.temp} unit="°C" /></td>
                  <td className="px-2.5 py-2"><CheckIcon value={s.questionnaireCompleted} /></td>
                  <td className="px-2.5 py-2">{assessmentBadge(s.doctorAssessmentStatus)}</td>
                  <td className="px-2.5 py-2">{qualityBadge(s.signalQuality)}</td>
                  <td className="px-2.5 py-2">{sessionStatusBadge(s.status)}</td>
                  <td className="px-2.5 py-2">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setEditing(s)} className="rounded border border-border px-2 py-1 text-[10px] font-semibold hover:bg-muted">
                        Edit
                      </button>
                      <button onClick={() => setSelected(s)} className="rounded p-1 text-muted-foreground hover:bg-muted">›</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && <SessionDrawer session={selected} onClose={() => setSelected(null)} onEdit={() => setEditing(selected)} />}
      {editing !== undefined && (
        <SessionEditor
          session={editing}
          participants={participants}
          onClose={() => setEditing(undefined)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
