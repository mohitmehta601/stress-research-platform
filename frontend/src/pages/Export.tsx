import { useEffect, useState } from "react";
import { Download, FileText, CheckCircle2, AlertTriangle } from "lucide-react";
import { downloadExport, getSessions } from "../services/apiClient";
import { toast } from "sonner";
import type { Session } from "../types";

const EXPORT_CONFIGS = [
  {
    id: "participant.csv",
    label: "Participant Profile Only",
    description: "Demographics, consent status, medical history, and lifestyle data.",
    color: "border-blue-200 bg-blue-50",
  },
  {
    id: "session.csv",
    label: "Research Sessions Only",
    description: "Session metadata including timestamps, conditions, status, and quality flags.",
    color: "border-indigo-200 bg-indigo-50",
  },
  {
    id: "physiological.csv",
    label: "Physiological Data Only",
    description: "ECG, HR, HRV, EDA, temperature, respiration, accelerometer, and device fields.",
    color: "border-teal-200 bg-teal-50",
  },
  {
    id: "questionnaire.csv",
    label: "Questionnaire Only",
    description: "Self-report answers, scores, questionnaire keys, and submission timestamps.",
    color: "border-violet-200 bg-violet-50",
  },
  {
    id: "doctor.csv",
    label: "Doctor Assessment Only",
    description: "Clinician stress labels, notes, recommendations, and linked session IDs.",
    color: "border-emerald-200 bg-emerald-50",
  },
];

function DataCell({ value }: { value: boolean }) {
  return (
    <td className="px-2 py-2 text-center">
      {value
        ? <span className="text-emerald-600 font-semibold">yes</span>
        : <span className="text-red-500 font-mono text-[10px] font-medium">missing</span>
      }
    </td>
  );
}

export default function Export() {
  const [downloading, setDownloading] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);

  useEffect(() => {
    getSessions().then(setSessions).catch(() => setSessions([]));
  }, []);

  async function handleDownload(id: string, label: string) {
    setDownloading(id);
    try {
      await downloadExport(id);
      window.dispatchEvent(new Event("srp-notifications-updated"));
      toast.success(`${label} downloaded successfully`);
    } catch {
      toast.error(`Failed to download ${label}`);
    } finally {
      setDownloading(null);
    }
  }

  async function handleFinalDataset() {
    setDownloading("final");
    try {
      await downloadExport("final_dataset.csv");
      window.dispatchEvent(new Event("srp-notifications-updated"));
      toast.success("Full research dataset downloaded");
    } catch {
      toast.error("Export failed. Check that the backend is online.");
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-lg font-semibold text-foreground">Dataset Export</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Generate complete and module-specific CSV datasets from MongoDB</p>
      </div>

      <div className="p-3 mb-5 bg-blue-50 border border-blue-200 rounded flex items-start gap-2">
        <AlertTriangle size={13} className="text-blue-600 flex-shrink-0 mt-0.5" />
        <span className="text-xs text-blue-800">
          CSV files are generated on demand by the backend API and reflect the current database state.
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        {EXPORT_CONFIGS.map((cfg) => (
          <div key={cfg.id} className={`rounded border p-4 ${cfg.color} flex flex-col gap-3`}>
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs font-semibold text-foreground mb-0.5">{cfg.label}</div>
                <div className="text-[10px] font-mono text-muted-foreground">{cfg.id}</div>
              </div>
              <FileText size={14} className="text-muted-foreground flex-shrink-0 mt-0.5" />
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed flex-1">{cfg.description}</p>
            <button
              onClick={() => handleDownload(cfg.id, cfg.label)}
              disabled={!!downloading}
              className="flex items-center justify-center gap-1.5 py-1.5 px-3 bg-white border border-current/20 text-[#1a3461] rounded text-xs font-medium hover:bg-[#1a3461] hover:text-white transition-colors disabled:opacity-50"
            >
              <Download size={11} />
              {downloading === cfg.id ? "Generating..." : `Download ${cfg.id}`}
            </button>
          </div>
        ))}
      </div>

      <div className="bg-[#1a3461] rounded border border-[#1a3461] p-5 mb-6">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="text-white text-sm font-semibold mb-1">Complete Research Dataset</div>
            <div className="text-[11px] font-mono text-[#a8bdd4]">final_dataset.csv</div>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-900/40 rounded">
            <CheckCircle2 size={11} className="text-emerald-400" />
            <span className="text-[10px] text-emerald-400 font-medium">Joined CSV</span>
          </div>
        </div>
        <p className="text-[11px] text-[#a8bdd4] mb-4 leading-relaxed">
          Joined participant details, session metadata, questionnaire answers, physiological readings, device fields, and doctor assessments.
        </p>
        <button
          onClick={handleFinalDataset}
          disabled={!!downloading}
          className="flex items-center gap-2 px-4 py-2 bg-[#0d9488] text-white rounded text-xs font-semibold hover:bg-[#0f766e] transition-colors disabled:opacity-50"
        >
          <Download size={13} />
          {downloading === "final" ? "Generating final dataset..." : "Download final_dataset.csv"}
        </button>
      </div>

      <div className="min-w-0 overflow-hidden rounded border border-border bg-card shadow-sm">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-foreground">Final Dataset Preview</span>
            <span className="text-[10px] text-muted-foreground ml-2">live rows from current MongoDB sessions</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[760px] w-full text-xs">
            <thead>
              <tr className="bg-muted/60 border-b border-border">
                {["Participant", "Session", "Condition", "ECG", "HRV", "EDA", "Temp", "Questionnaire", "Doctor Label"].map((h) => (
                  <th key={h} className="text-center px-2 py-2.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold whitespace-nowrap first:text-left first:pl-3 last:text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sessions.length === 0 ? (
                <tr><td colSpan={9} className="py-10 text-center text-muted-foreground">No session rows available</td></tr>
              ) : sessions.slice(0, 12).map((row, i) => (
                <tr key={row.recordId || `${row.participantId}-${row.id}`} className={`border-b border-border/50 ${i % 2 === 1 ? "bg-muted/20" : ""}`}>
                  <td className="pl-3 px-2 py-2 font-mono font-semibold text-[#1a3461]">{row.participantId}</td>
                  <td className="px-2 py-2 font-mono text-muted-foreground text-center">{row.id}</td>
                  <td className="px-2 py-2 text-center">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${row.condition === "relaxed" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"}`}>
                      {row.condition}
                    </span>
                  </td>
                  <DataCell value={row.ecgCollected} />
                  <DataCell value={row.hrv !== null} />
                  <DataCell value={row.eda !== null} />
                  <DataCell value={row.temp !== null} />
                  <DataCell value={row.questionnaireCompleted} />
                  <DataCell value={row.doctorAssessmentStatus === "completed"} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
