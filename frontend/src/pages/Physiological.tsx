import { useEffect, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, Download, Search, XCircle } from "lucide-react";
import { downloadExport, getPhysioRecords } from "../services/apiClient";
import type { PhysioRecord } from "../types";
import { conditionBadge, qualityBadge } from "../components/StatusBadge";
import { StatCard } from "../components/StatCard";

type ConditionFilter = "combined" | "relaxed" | "stress";

function Metric({ value, unit }: { value: number | null; unit?: string }) {
  if (value === null) return <span className="text-red-400 font-mono text-[10px]">missing</span>;
  return <span className="font-mono text-[10px] text-foreground">{value}{unit ? ` ${unit}` : ""}</span>;
}

function CheckCell({ value }: { value: boolean }) {
  return value
    ? <span className="text-emerald-600 font-mono">yes</span>
    : <span className="text-red-500 font-mono">no</span>;
}

export default function Physiological() {
  const [records, setRecords] = useState<PhysioRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [condition, setCondition] = useState<ConditionFilter>("combined");

  useEffect(() => {
    getPhysioRecords().then(setRecords).finally(() => setLoading(false));
  }, []);

  const filtered = records.filter((record) => {
    const q = search.toLowerCase();
    const matchSearch = !q || record.participantId.toLowerCase().includes(q) || record.sessionId.toLowerCase().includes(q);
    const matchCondition = condition === "combined" || record.condition === condition;
    return matchSearch && matchCondition;
  });

  const good = records.filter((record) => record.signalQuality === "good").length;
  const moderate = records.filter((record) => record.signalQuality === "moderate").length;
  const poor = records.filter((record) => record.signalQuality === "poor").length;
  const missing = records.filter((record) => !record.signalQuality).length;

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
        <StatCard label="Good" value={good} icon={CheckCircle2} iconColor="text-emerald-600" />
        <StatCard label="Moderate" value={moderate} icon={AlertTriangle} iconColor="text-amber-600" />
        <StatCard label="Poor / Missing" value={poor + missing} icon={XCircle} iconColor="text-red-500" />
      </div>

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
                {["Participant", "Session", "Condition", "Mean Temp", "RMSSD", "SDNN", "Heart Rate", "SpO2", "SCL", "SCR Peaks", "SCR Mean", "Quality"].map((heading) => (
                  <th key={heading} className="text-left px-2.5 py-2.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold whitespace-nowrap">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={12} className="text-center py-12 text-muted-foreground">No records</td></tr>
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
                  <td className="px-2.5 py-2">{qualityBadge(record.signalQuality)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
