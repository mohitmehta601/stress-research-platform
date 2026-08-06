import { useEffect, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, Download, Search, XCircle } from "lucide-react";
import { downloadExport, getPhysioRecords } from "../services/apiClient";
import type { PhysioRecord } from "../types";
import { conditionBadge } from "../components/StatusBadge";
import { StatCard } from "../components/StatCard";

type ConditionFilter = "combined" | "relaxed" | "stress";
type QualityBucket = "good" | "moderate" | "poorMissing";

function Metric({ value, unit }: { value: number | null; unit?: string }) {
  if (value === null) return <span className="text-red-400 font-mono text-[10px]">missing</span>;
  return <span className="font-mono text-[10px] text-foreground">{value}{unit ? ` ${unit}` : ""}</span>;
}

function CheckCell({ value }: { value: boolean }) {
  return value
    ? <span className="text-emerald-600 font-mono">yes</span>
    : <span className="text-red-500 font-mono">no</span>;
}

function sensorValueCount(record: PhysioRecord): number {
  return [
    record.meanTemp,
    record.rmssdMs,
    record.sdnnMs,
    record.heartRateBpm,
    record.spo2Percent,
    record.sclUs,
    record.scrPeakCount,
    record.scrMean,
  ].filter((value) => value !== null).length;
}

function qualityBucket(record: PhysioRecord): QualityBucket {
  const present = sensorValueCount(record);
  if (present >= 7) return "good";
  if (present >= 4) return "moderate";
  return "poorMissing";
}

export default function Physiological() {
  const [records, setRecords] = useState<PhysioRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [condition, setCondition] = useState<ConditionFilter>("combined");
  const [selectedQuality, setSelectedQuality] = useState<QualityBucket | null>(null);

  useEffect(() => {
    getPhysioRecords().then(setRecords).finally(() => setLoading(false));
  }, []);

  const filtered = records.filter((record) => {
    const q = search.toLowerCase();
    const matchSearch = !q || record.participantId.toLowerCase().includes(q) || record.sessionId.toLowerCase().includes(q);
    const matchCondition = condition === "combined" || record.condition === condition;
    return matchSearch && matchCondition;
  });

  const qualityCounts = filtered.reduce(
    (counts, record) => {
      const bucket = qualityBucket(record);
      return { ...counts, [bucket]: counts[bucket] + 1 };
    },
    { good: 0, moderate: 0, poorMissing: 0 },
  );

  const selectedQualityRecords = selectedQuality
    ? filtered.filter((record) => qualityBucket(record) === selectedQuality)
    : [];

  const selectedQualityLabel = selectedQuality === "good"
    ? "Good"
    : selectedQuality === "moderate"
      ? "Moderate"
      : selectedQuality === "poorMissing"
        ? "Poor / Missing"
        : "";

  async function exportCsv() {
    await downloadExport("physiological.csv", condition);
  }

  return (
    <div className="min-w-0">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-foreground">Physiological Data</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{records.length} records</p>
        </div>
        <button onClick={exportCsv} className="flex w-full items-center justify-center gap-1.5 rounded bg-[#1d4ed8] px-3 py-2 text-xs font-semibold text-white sm:w-auto">
          <Download size={13} />
          Export CSV
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 mb-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Records" value={records.length} icon={Activity} iconColor="text-blue-600" />
        <button
          type="button"
          onClick={() => setSelectedQuality((current) => current === "good" ? null : "good")}
          className={`text-left rounded outline-none transition focus:ring-2 focus:ring-emerald-300 ${selectedQuality === "good" ? "ring-2 ring-emerald-300" : ""}`}
        >
          <StatCard label="Good" value={qualityCounts.good} icon={CheckCircle2} iconColor="text-emerald-600" />
        </button>
        <button
          type="button"
          onClick={() => setSelectedQuality((current) => current === "moderate" ? null : "moderate")}
          className={`text-left rounded outline-none transition focus:ring-2 focus:ring-amber-300 ${selectedQuality === "moderate" ? "ring-2 ring-amber-300" : ""}`}
        >
          <StatCard label="Moderate" value={qualityCounts.moderate} icon={AlertTriangle} iconColor="text-amber-600" />
        </button>
        <button
          type="button"
          onClick={() => setSelectedQuality((current) => current === "poorMissing" ? null : "poorMissing")}
          className={`text-left rounded outline-none transition focus:ring-2 focus:ring-red-300 ${selectedQuality === "poorMissing" ? "ring-2 ring-red-300" : ""}`}
        >
          <StatCard label="Poor / Missing" value={qualityCounts.poorMissing} icon={XCircle} iconColor="text-red-500" />
        </button>
      </div>

      {selectedQuality && (
        <div className="mb-5 overflow-hidden rounded border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <div className="text-xs font-semibold text-foreground">{selectedQualityLabel} Details</div>
              <div className="mt-0.5 text-[10px] text-muted-foreground">
                {selectedQualityRecords.length} matching records from the current filters
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedQuality(null)}
              className="rounded border border-border px-2.5 py-1.5 text-[10px] font-semibold text-muted-foreground transition hover:bg-muted"
            >
              Clear
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/60">
                  {["Participant_ID", "Session_ID", "Sensor Values"].map((heading) => (
                    <th key={heading} className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {selectedQualityRecords.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-xs text-muted-foreground">
                      No matching records.
                    </td>
                  </tr>
                ) : selectedQualityRecords.map((record, index) => (
                  <tr key={`${record.id}-${selectedQuality}`} className={`border-b border-border/50 last:border-b-0 ${index % 2 === 1 ? "bg-muted/20" : ""}`}>
                    <td className="px-3 py-2 font-mono font-semibold text-[#1a3461]">{record.participantId}</td>
                    <td className="px-3 py-2 font-mono text-muted-foreground">{record.sessionId}</td>
                    <td className="px-3 py-2 font-mono text-muted-foreground">{sensorValueCount(record)} / 8</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <div className="relative min-w-0 sm:w-60">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            className="w-full rounded border border-border bg-card py-1.5 pl-8 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
            placeholder="Search participant or session"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <select className="rounded border border-border bg-card px-2.5 py-1.5 text-xs sm:w-auto" value={condition} onChange={(event) => setCondition(event.target.value as ConditionFilter)}>
          <option value="combined">Combined</option>
          <option value="relaxed">Relaxed</option>
          <option value="stress">Stress</option>
        </select>
        <span className="text-xs text-muted-foreground">{filtered.length} records</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">Loading...</div>
      ) : (
        <div className="min-w-0 overflow-x-auto rounded border border-border bg-card shadow-sm">
          <table className="min-w-[980px] w-full text-xs">
            <thead>
              <tr className="bg-muted/60 border-b border-border">
                {["Participant", "Session", "Condition", "Mean Temp", "RMSSD", "SDNN", "Heart Rate", "SpO2", "SCL", "SCR Peaks", "SCR Mean"].map((heading) => (
                  <th key={heading} className="text-left px-2.5 py-2.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold whitespace-nowrap">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={11} className="text-center py-12 text-muted-foreground">No records</td></tr>
              ) : filtered.map((record, index) => (
                <tr key={record.id} className={`border-b border-border/50 ${index % 2 === 1 ? "bg-muted/20" : ""}`}>
                  <td className="px-2.5 py-2 font-mono font-semibold text-[#1a3461]">{record.participantId}</td>
                  <td className="px-2.5 py-2 font-mono text-muted-foreground">{record.sessionId}</td>
                  <td className="px-2.5 py-2">{conditionBadge(record.condition)}</td>
                  <td className="px-2.5 py-2"><Metric value={record.meanTemp} unit="C" /></td>
                  <td className="px-2.5 py-2"><Metric value={record.rmssdMs} unit="ms" /></td>
                  <td className="px-2.5 py-2"><Metric value={record.sdnnMs} unit="ms" /></td>
                  <td className="px-2.5 py-2"><Metric value={record.heartRateBpm} unit="bpm" /></td>
                  <td className="px-2.5 py-2"><Metric value={record.spo2Percent} unit="%" /></td>
                  <td className="px-2.5 py-2"><Metric value={record.sclUs} unit="uS" /></td>
                  <td className="px-2.5 py-2"><Metric value={record.scrPeakCount} /></td>
                  <td className="px-2.5 py-2"><Metric value={record.scrMean} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
