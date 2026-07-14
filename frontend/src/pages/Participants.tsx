import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Edit3, Plus, Save, Search, X } from "lucide-react";
import {
  createParticipant,
  getParticipants,
  updateParticipant,
  type ManualParticipantPayload,
} from "../services/apiClient";
import type { Participant } from "../types";
import { consentBadge } from "../components/StatusBadge";

type ParticipantForm = {
  participant_code: string;
  name: string;
  email: string;
  password: string;
  is_active: boolean;
  consent_completed: boolean;
  profile_completed: boolean;
  age: string;
  gender: string;
  height_cm: string;
  weight_kg: string;
  education: string;
  occupation: string;
  smoking: "never" | "former" | "current";
  alcohol: "none" | "occasional" | "regular";
  sleep_hours: string;
  exercise_days_per_week: string;
  heart_disease: boolean;
  hypertension: boolean;
  diabetes: boolean;
  medication: string;
};

const emptyForm: ParticipantForm = {
  participant_code: "",
  name: "",
  email: "",
  password: "",
  is_active: true,
  consent_completed: false,
  profile_completed: false,
  age: "",
  gender: "",
  height_cm: "",
  weight_kg: "",
  education: "",
  occupation: "",
  smoking: "never",
  alcohol: "none",
  sleep_hours: "",
  exercise_days_per_week: "",
  heart_disease: false,
  hypertension: false,
  diabetes: false,
  medication: "",
};

function numberOrNull(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formFromParticipant(p?: Participant | null): ParticipantForm {
  if (!p) return emptyForm;
  return {
    participant_code: p.id === "Unknown" ? "" : p.id,
    name: p.name === "Unknown participant" ? "" : p.name,
    email: p.email === "—" || p.email === "â€”" ? "" : p.email,
    password: "",
    is_active: true,
    consent_completed: p.consentStatus === "accepted",
    profile_completed: p.profileComplete,
    age: p.age ? String(p.age) : "",
    gender: p.gender === "—" || p.gender === "â€”" ? "" : p.gender,
    height_cm: p.height ? String(p.height) : "",
    weight_kg: p.weight ? String(p.weight) : "",
    education: p.education || "",
    occupation: p.occupation === "—" || p.occupation === "â€”" ? "" : p.occupation,
    smoking: p.smokingStatus || (p.smoking ? "current" : "never"),
    alcohol: p.alcoholUse || (p.alcohol ? "occasional" : "none"),
    sleep_hours: p.sleepHours ? String(p.sleepHours) : "",
    exercise_days_per_week: typeof p.exerciseDays === "number" ? String(p.exerciseDays) : "",
    heart_disease: Boolean(p.heartDisease),
    hypertension: Boolean(p.hypertension),
    diabetes: Boolean(p.diabetes),
    medication: p.medication || "",
  };
}

function payloadFromForm(form: ParticipantForm, includePassword: boolean): ManualParticipantPayload {
  return {
    participant_code: form.participant_code.trim() || undefined,
    name: form.name.trim(),
    email: form.email.trim(),
    password: includePassword && form.password.trim() ? form.password.trim() : undefined,
    is_active: form.is_active,
    consent_completed: form.consent_completed,
    profile_completed: form.profile_completed,
    age: numberOrNull(form.age),
    gender: form.gender.trim() || null,
    height_cm: numberOrNull(form.height_cm),
    weight_kg: numberOrNull(form.weight_kg),
    education: form.education.trim() || null,
    occupation: form.occupation.trim() || null,
    smoking: form.smoking,
    alcohol: form.alcohol,
    sleep_hours: numberOrNull(form.sleep_hours),
    exercise_days_per_week: numberOrNull(form.exercise_days_per_week),
    heart_disease: form.heart_disease,
    hypertension: form.hypertension,
    diabetes: form.diabetes,
    medication: form.medication.trim() || null,
  };
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="space-y-1">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{label}</span>
      <input
        className="w-full rounded border border-border bg-background px-3 py-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-blue-400"
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function DetailDrawer({
  participant: p,
  onClose,
  onEdit,
}: {
  participant: Participant;
  onClose: () => void;
  onEdit: () => void;
}) {
  return (
    <div className="fixed inset-0 z-30 flex justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <aside className="relative z-10 h-full w-[420px] overflow-y-auto border-l border-border bg-card shadow-xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-border bg-card px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1a3461] text-sm font-semibold text-white">
              {p.name.charAt(0)}
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground">{p.name}</div>
              <div className="font-mono text-[10px] text-muted-foreground">{p.id}</div>
            </div>
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
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Consent</div>
            {consentBadge(p.consentStatus)}
          </section>

          <section>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Participant profile</div>
            <div className="grid grid-cols-2 gap-2">
              {[
                ["Age", p.age || "—"],
                ["Gender", p.gender],
                ["Occupation", p.occupation],
                ["Education", p.education ?? "—"],
                ["Height", p.height ? `${p.height} cm` : "—"],
                ["Weight", p.weight ? `${p.weight} kg` : "—"],
                ["BMI", p.bmi ?? "—"],
                ["Email", p.email],
                ["Smoking", p.smokingStatus ?? "—"],
                ["Alcohol", p.alcoholUse ?? "—"],
                ["Sleep", p.sleepHours ? `${p.sleepHours}h` : "—"],
                ["Exercise", typeof p.exerciseDays === "number" ? `${p.exerciseDays} days/week` : "—"],
              ].map(([label, val]) => (
                <div key={label as string} className="rounded bg-muted/50 p-2">
                  <div className="text-[10px] text-muted-foreground">{label}</div>
                  <div className="truncate text-xs font-medium text-foreground">{String(val)}</div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Medical history</div>
            <div className="grid grid-cols-2 gap-2">
              {[
                ["Heart Disease", p.heartDisease ? "Yes" : "No"],
                ["Hypertension", p.hypertension ? "Yes" : "No"],
                ["Diabetes", p.diabetes ? "Yes" : "No"],
                ["Medication", p.medication ?? "None"],
              ].map(([label, val]) => (
                <div key={label as string} className="rounded bg-muted/50 p-2">
                  <div className="text-[10px] text-muted-foreground">{label}</div>
                  <div className="text-xs font-medium text-foreground">{String(val)}</div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Session summary</div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded bg-muted/50 p-2">
                <div className="text-[10px] text-muted-foreground">Total Sessions</div>
                <div className="font-mono text-xl font-semibold text-foreground">{p.totalSessions}</div>
              </div>
              <div className="rounded bg-muted/50 p-2">
                <div className="text-[10px] text-muted-foreground">Completed</div>
                <div className="font-mono text-xl font-semibold text-foreground">{p.completedSessions}</div>
              </div>
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}

function ParticipantEditor({
  participant,
  onClose,
  onSaved,
}: {
  participant: Participant | null;
  onClose: () => void;
  onSaved: (participant: Participant) => void;
}) {
  const [form, setForm] = useState(() => formFromParticipant(participant));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const isEdit = Boolean(participant);

  const patch = <K extends keyof ParticipantForm>(key: K, value: ParticipantForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  async function save() {
    setError("");
    if (!form.name.trim() || !form.email.trim()) {
      setError("Name and email are required.");
      return;
    }
    if (!isEdit && form.password.trim().length < 8) {
      setError("Temporary password must be at least 8 characters.");
      return;
    }
    setSaving(true);
    try {
      const payload = payloadFromForm(form, !isEdit);
      const saved = isEdit && participant?.recordId
        ? await updateParticipant(participant.recordId, payload)
        : await createParticipant(payload);
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save participant.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/25" onClick={onClose} />
      <aside className="relative z-10 h-full w-[520px] overflow-y-auto border-l border-border bg-card shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-border bg-card px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">{isEdit ? "Edit participant" : "Add participant"}</h2>
            <p className="text-xs text-muted-foreground">Manual entries save directly to the backend database.</p>
          </div>
          <button onClick={onClose} className="rounded p-1 hover:bg-muted"><X size={14} /></button>
        </div>

        <div className="space-y-5 p-5">
          {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}

          <section className="space-y-3">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Identity</div>
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Participant ID" value={form.participant_code} placeholder="P001" onChange={(value) => patch("participant_code", value)} />
              <TextField label="Name" value={form.name} onChange={(value) => patch("name", value)} />
              <TextField label="Email" value={form.email} type="email" onChange={(value) => patch("email", value)} />
              {!isEdit && <TextField label="Temporary password" value={form.password} type="password" placeholder="Minimum 8 characters" onChange={(value) => patch("password", value)} />}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                ["Active", "is_active"],
                ["Consent completed", "consent_completed"],
                ["Profile completed", "profile_completed"],
              ].map(([label, key]) => (
                <label key={key} className="flex items-center gap-2 rounded border border-border bg-background px-3 py-2 text-xs">
                  <input
                    type="checkbox"
                    checked={Boolean(form[key as keyof ParticipantForm])}
                    onChange={(event) => patch(key as keyof ParticipantForm, event.target.checked as never)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Demographics & lifestyle</div>
            <div className="grid grid-cols-3 gap-3">
              <TextField label="Age" value={form.age} type="number" onChange={(value) => patch("age", value)} />
              <TextField label="Gender" value={form.gender} onChange={(value) => patch("gender", value)} />
              <TextField label="Occupation" value={form.occupation} onChange={(value) => patch("occupation", value)} />
              <TextField label="Height cm" value={form.height_cm} type="number" onChange={(value) => patch("height_cm", value)} />
              <TextField label="Weight kg" value={form.weight_kg} type="number" onChange={(value) => patch("weight_kg", value)} />
              <TextField label="Education" value={form.education} onChange={(value) => patch("education", value)} />
              <label className="space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Smoking</span>
                <select className="w-full rounded border border-border bg-background px-3 py-2 text-xs" value={form.smoking} onChange={(e) => patch("smoking", e.target.value as ParticipantForm["smoking"])}>
                  <option value="never">Never</option>
                  <option value="former">Former</option>
                  <option value="current">Current</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Alcohol</span>
                <select className="w-full rounded border border-border bg-background px-3 py-2 text-xs" value={form.alcohol} onChange={(e) => patch("alcohol", e.target.value as ParticipantForm["alcohol"])}>
                  <option value="none">None</option>
                  <option value="occasional">Occasional</option>
                  <option value="regular">Regular</option>
                </select>
              </label>
              <TextField label="Sleep hours" value={form.sleep_hours} type="number" onChange={(value) => patch("sleep_hours", value)} />
              <TextField label="Exercise days/week" value={form.exercise_days_per_week} type="number" onChange={(value) => patch("exercise_days_per_week", value)} />
            </div>
          </section>

          <section className="space-y-3">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Medical notes</div>
            <div className="grid grid-cols-3 gap-2">
              {[
                ["Heart disease", "heart_disease"],
                ["Hypertension", "hypertension"],
                ["Diabetes", "diabetes"],
              ].map(([label, key]) => (
                <label key={key} className="flex items-center gap-2 rounded border border-border bg-background px-3 py-2 text-xs">
                  <input
                    type="checkbox"
                    checked={Boolean(form[key as keyof ParticipantForm])}
                    onChange={(event) => patch(key as keyof ParticipantForm, event.target.checked as never)}
                  />
                  {label}
                </label>
              ))}
            </div>
            <TextField label="Medication / notes" value={form.medication} onChange={(value) => patch("medication", value)} />
          </section>

          <button
            onClick={save}
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded bg-[#1d4ed8] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1e40af] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save size={14} />
            {saving ? "Saving..." : "Save participant"}
          </button>
        </div>
      </aside>
    </div>
  );
}

export default function Participants() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterConsent, setFilterConsent] = useState<string>("all");
  const [selected, setSelected] = useState<Participant | null>(null);
  const [editing, setEditing] = useState<Participant | null | undefined>(undefined);

  async function loadParticipants() {
    setLoading(true);
    try {
      setParticipants(await getParticipants());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadParticipants();
  }, []);

  const filtered = useMemo(() => participants.filter((p) => {
    const q = search.toLowerCase();
    const matchSearch = !q || p.id.toLowerCase().includes(q) || p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q);
    const matchConsent = filterConsent === "all" || p.consentStatus === filterConsent;
    return matchSearch && matchConsent;
  }), [participants, search, filterConsent]);

  function handleSaved(saved: Participant) {
    setParticipants((current) => {
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
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Participants</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">{participants.length} enrolled participants · manual entries save to MongoDB</p>
        </div>
        <button
          onClick={() => setEditing(null)}
          className="flex items-center gap-2 rounded bg-[#1d4ed8] px-3 py-2 text-xs font-semibold text-white hover:bg-[#1e40af]"
        >
          <Plus size={14} />
          Add Participant
        </button>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            className="w-full rounded border border-border bg-card py-1.5 pl-8 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
            placeholder="Search by ID, name, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="rounded border border-border bg-card px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
          value={filterConsent}
          onChange={(e) => setFilterConsent(e.target.value)}
        >
          <option value="all">All Consent Status</option>
          <option value="accepted">Consented</option>
          <option value="rejected">Rejected</option>
          <option value="pending">Pending</option>
        </select>
        <span className="text-xs text-muted-foreground">{filtered.length} results</span>
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
          <div className="mr-2 h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          Loading...
        </div>
      ) : (
        <div className="overflow-hidden rounded border border-border bg-card shadow-sm">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/60">
                {["Participant ID", "Name", "Age", "Gender", "Occupation", "Consent", "Profile", "Sessions", "Last Session", "Actions"].map((h) => (
                  <th key={h} className="whitespace-nowrap px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={10} className="py-12 text-center text-muted-foreground">No participants found</td></tr>
              ) : filtered.map((p, i) => (
                <tr
                  key={p.recordId || p.id}
                  className={`border-b border-border/50 transition-colors hover:bg-blue-50/50 ${i % 2 === 1 ? "bg-muted/20" : ""}`}
                >
                  <td onClick={() => setSelected(p)} className="cursor-pointer px-3 py-2.5 font-mono font-semibold text-[#1a3461]">{p.id}</td>
                  <td onClick={() => setSelected(p)} className="cursor-pointer px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[#1a3461]/10 text-[10px] font-semibold text-[#1a3461]">
                        {p.name.charAt(0)}
                      </div>
                      {p.name}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-muted-foreground">{p.age || "—"}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{p.gender}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{p.occupation}</td>
                  <td className="px-3 py-2.5">{consentBadge(p.consentStatus)}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{p.profileComplete ? "Complete" : "Incomplete"}</td>
                  <td className="px-3 py-2.5 text-center font-mono text-muted-foreground">{p.completedSessions}/{p.totalSessions}</td>
                  <td className="px-3 py-2.5 font-mono text-muted-foreground">{p.lastSessionDate ?? "—"}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setEditing(p)} className="rounded border border-border px-2 py-1 text-[10px] font-semibold hover:bg-muted">
                        Edit
                      </button>
                      <button onClick={() => setSelected(p)} className="rounded p-1 hover:bg-muted">
                        <ChevronRight size={12} className="text-muted-foreground" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && <DetailDrawer participant={selected} onClose={() => setSelected(null)} onEdit={() => setEditing(selected)} />}
      {editing !== undefined && <ParticipantEditor participant={editing} onClose={() => setEditing(undefined)} onSaved={handleSaved} />}
    </div>
  );
}
