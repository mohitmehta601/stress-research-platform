import { useEffect, useState } from "react";
import { Search, AlertCircle, Edit3, Save, X } from "lucide-react";
import { getDoctorAssessments, saveDoctorAssessment } from "../services/apiClient";
import type { DoctorAssessment } from "../types";
import { conditionBadge, assessmentBadge, stressLabelBadge } from "../components/StatusBadge";
import { StatCard } from "../components/StatCard";
import { Stethoscope, CheckCircle2, Clock } from "lucide-react";

export default function Doctor() {
  const [records, setRecords] = useState<DoctorAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [editing, setEditing] = useState<DoctorAssessment | null>(null);
  const [form, setForm] = useState({
    clinicalStressLabel: "moderate" as NonNullable<DoctorAssessment["clinicalStressLabel"]>,
    comments: "",
    recommendation: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getDoctorAssessments().then(setRecords).finally(() => setLoading(false));
  }, []);

  function startEdit(record: DoctorAssessment) {
    setEditing(record);
    setError("");
    setForm({
      clinicalStressLabel: record.clinicalStressLabel || "moderate",
      comments: record.comments || "",
      recommendation: record.recommendation || "",
    });
  }

  async function submitAssessment() {
    if (!editing?.sessionRecordId) {
      setError("Session ID is missing for this assessment.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const saved = await saveDoctorAssessment({
        session_id: editing.sessionRecordId,
        clinical_stress_label: form.clinicalStressLabel,
        comments: form.comments.trim() || null,
        recommendation: form.recommendation.trim() || null,
      });
      setRecords((current) => current.map((item) => item.sessionId === saved.sessionId ? saved : item));
      setEditing(null);
      window.dispatchEvent(new Event("srp-notifications-updated"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save assessment.");
    } finally {
      setSaving(false);
    }
  }

  const filtered = records.filter((r) => {
    const q = search.toLowerCase();
    const matchSearch = !q || r.participantId.toLowerCase().includes(q) || r.sessionId.toLowerCase().includes(q);
    const matchStatus = filterStatus === "all" || r.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const completed = records.filter((r) => r.status === "completed").length;
  const pending = records.filter((r) => r.status === "pending").length;

  return (
    <div className="min-w-0">
      <div className="mb-5">
        <h1 className="text-lg font-semibold text-foreground">Doctor Assessments</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Clinical stress labels and physician notes</p>
      </div>

      <div className="grid grid-cols-1 gap-3 mb-5 sm:grid-cols-3">
        <StatCard label="Total Assessments" value={records.length} icon={Stethoscope} iconColor="text-indigo-600" />
        <StatCard label="Completed" value={completed} icon={CheckCircle2} iconColor="text-emerald-600" />
        <StatCard label="Pending" value={pending} icon={Clock} iconColor="text-amber-600" />
      </div>

      {pending > 0 && (
        <div className="mb-4 flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
          <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
          <span>{pending} session{pending > 1 ? "s" : ""} require doctor assessment. These sessions cannot be included in the final labeled dataset until assessed.</span>
        </div>
      )}

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <div className="relative min-w-0 sm:w-60">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            className="w-full rounded border border-border bg-card py-1.5 pl-8 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
            placeholder="Search participant or session…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="rounded border border-border bg-card px-2.5 py-1.5 text-xs sm:w-auto" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="all">All Statuses</option>
          <option value="completed">Completed</option>
          <option value="pending">Pending</option>
        </select>
        <span className="text-xs text-muted-foreground">{filtered.length} results</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2" />
          Loading…
        </div>
      ) : (
        <div className="min-w-0 overflow-x-auto rounded border border-border bg-card shadow-sm">
          <table className="min-w-[900px] w-full text-xs">
            <thead>
              <tr className="bg-muted/60 border-b border-border">
                {["Participant", "Session", "Condition", "Clinical Stress Label", "Comments", "Recommendation", "Status", "Actions"].map((h) => (
                  <th key={h} className="text-left px-3 py-2.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">No assessments found</td></tr>
              ) : filtered.map((r, i) => (
                <tr key={r.id} className={`border-b border-border/50 ${i % 2 === 1 ? "bg-muted/20" : ""} ${r.status === "pending" ? "bg-amber-50/30" : ""}`}>
                  <td className="px-3 py-2.5 font-mono font-semibold text-[#1a3461]">{r.participantId}</td>
                  <td className="px-3 py-2.5 font-mono text-muted-foreground">{r.sessionId}</td>
                  <td className="px-3 py-2.5">{conditionBadge(r.condition)}</td>
                  <td className="px-3 py-2.5">{stressLabelBadge(r.clinicalStressLabel)}</td>
                  <td className="px-3 py-2.5 max-w-[200px]">
                    <span className="text-[10px] text-muted-foreground truncate block" title={r.comments ?? ""}>
                      {r.comments ?? <span className="text-muted-foreground/50">Pending assessment</span>}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 max-w-[180px]">
                    <span className="text-[10px] text-muted-foreground truncate block" title={r.recommendation ?? ""}>
                      {r.recommendation ?? <span className="text-muted-foreground/50">—</span>}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">{assessmentBadge(r.status)}</td>
                  <td className="px-3 py-2.5">
                    <button onClick={() => startEdit(r)} className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[10px] font-semibold hover:bg-muted">
                      <Edit3 size={11} />
                      {r.status === "completed" ? "Edit" : "Assess"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <div className="absolute inset-0 bg-black/25" onClick={() => setEditing(null)} />
          <aside className="relative z-10 h-full w-full max-w-[420px] overflow-y-auto border-l border-border bg-card shadow-2xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-border bg-card px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Doctor assessment</h2>
                <p className="text-xs text-muted-foreground">{editing.participantId} / {editing.sessionId}</p>
              </div>
              <button onClick={() => setEditing(null)} className="rounded p-1 hover:bg-muted"><X size={14} /></button>
            </div>
            <div className="space-y-4 p-5">
              {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}
              <label className="space-y-1 block">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Clinical stress label</span>
                <select
                  className="w-full rounded border border-border bg-background px-3 py-2 text-xs"
                  value={form.clinicalStressLabel}
                  onChange={(event) => setForm((current) => ({ ...current, clinicalStressLabel: event.target.value as typeof form.clinicalStressLabel }))}
                >
                  <option value="low">Low</option>
                  <option value="moderate">Moderate</option>
                  <option value="high">High</option>
                  <option value="severe">Severe</option>
                </select>
              </label>
              <label className="space-y-1 block">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Comments</span>
                <textarea className="min-h-28 w-full rounded border border-border bg-background px-3 py-2 text-xs" value={form.comments} onChange={(event) => setForm((current) => ({ ...current, comments: event.target.value }))} />
              </label>
              <label className="space-y-1 block">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Recommendation</span>
                <textarea className="min-h-24 w-full rounded border border-border bg-background px-3 py-2 text-xs" value={form.recommendation} onChange={(event) => setForm((current) => ({ ...current, recommendation: event.target.value }))} />
              </label>
              <button
                onClick={submitAssessment}
                disabled={saving}
                className="flex w-full items-center justify-center gap-2 rounded bg-[#1d4ed8] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1e40af] disabled:opacity-60"
              >
                <Save size={14} />
                {saving ? "Saving..." : "Save assessment"}
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
