import { useEffect, useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import { downloadExport, formatDateTimeIST, getQuestionnaireRecords } from "../services/apiClient";
import type { QuestionnaireRecord } from "../types";
import { conditionBadge, StatusBadge } from "../components/StatusBadge";

type ConditionFilter = "combined" | "relaxed" | "stress";

function answerRows(record: QuestionnaireRecord) {
  return Object.entries(record.answers || {}).map(([id, value]) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const item = value as Record<string, unknown>;
      return {
        id,
        section: String(item.section || ""),
        question: String(item.question || id),
        raw: item.raw_score ?? "",
        scored: item.scored_value ?? item.raw_score ?? "",
      };
    }
    return { id, section: "", question: id, raw: String(value ?? ""), scored: String(value ?? "") };
  });
}

function formatSubmittedCompact(value?: string | null) {
  const formatted = formatDateTimeIST(value);
  if (!formatted) return { date: "-", time: "" };
  const [date = "-", rest = ""] = formatted.split(", ");
  return { date, time: rest };
}

export default function Questionnaires() {
  const [records, setRecords] = useState<QuestionnaireRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [condition, setCondition] = useState<ConditionFilter>("combined");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    getQuestionnaireRecords().then((items) => {
      setRecords(items);
      setSelectedId(items[0]?.id ?? null);
    }).finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => records.filter((record) => {
    const q = search.toLowerCase();
    const matchSearch = !q || record.participantId.toLowerCase().includes(q) || record.sessionId.toLowerCase().includes(q);
    const matchCondition = condition === "combined" || record.condition === condition;
    return matchSearch && matchCondition;
  }), [records, search, condition]);

  const selected = filtered.find((record) => record.id === selectedId) || filtered[0] || null;
  const rows = selected ? answerRows(selected) : [];

  async function exportCsv() {
    await downloadExport("questionnaire.csv", condition);
  }

  return (
    <div className="min-w-0">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-foreground">Questionnaire</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{records.length} responses</p>
        </div>
        <button onClick={exportCsv} className="flex w-full items-center justify-center gap-1.5 rounded bg-[#1d4ed8] px-3 py-2 text-xs font-semibold text-white sm:w-auto">
          <Download size={13} />
          Export CSV
        </button>
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
        <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="min-w-0 overflow-hidden rounded border border-border bg-card shadow-sm">
            <table className="w-full table-fixed text-xs">
              <colgroup>
                <col className="w-[15%]" />
                <col className="w-[10%]" />
                <col className="w-[16%]" />
                <col className="w-[11%]" />
                <col className="w-[10%]" />
                <col className="w-[24%]" />
                <col className="w-[14%]" />
              </colgroup>
              <thead>
                <tr className="bg-muted/60 border-b border-border">
                  {["Participant", "Session", "Condition", "Answered", "Score", "Submitted", "Status"].map((heading) => (
                    <th key={heading} className="text-left px-2 py-2.5 text-[10px] uppercase tracking-wide text-muted-foreground font-semibold whitespace-nowrap">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">No responses</td></tr>
                ) : filtered.map((record) => {
                  const submitted = formatSubmittedCompact(record.timestamp);
                  return (
                  <tr key={record.id} onClick={() => setSelectedId(record.id)} className={`border-b border-border/50 cursor-pointer hover:bg-blue-50/40 ${selected?.id === record.id ? "bg-blue-50/60" : ""}`}>
                    <td className="truncate px-2 py-2.5 font-mono font-semibold text-[#1a3461]" title={record.participantId}>{record.participantId}</td>
                    <td className="truncate px-2 py-2.5 font-mono text-muted-foreground" title={record.sessionId}>{record.sessionId}</td>
                    <td className="px-2 py-2.5">{conditionBadge(record.condition)}</td>
                    <td className="px-2 py-2.5 font-mono">{answerRows(record).length}</td>
                    <td className="px-2 py-2.5 font-mono">{record.score ?? "-"}</td>
                    <td className="px-2 py-2.5 font-mono text-[10px] leading-tight text-muted-foreground">
                      <div className="truncate" title={record.timestamp ? formatDateTimeIST(record.timestamp) : "-"}>{submitted.date}</div>
                      {submitted.time && <div className="truncate">{submitted.time}</div>}
                    </td>
                    <td className="px-2 py-2.5">
                      {record.completed ? <StatusBadge label="Done" variant="success" dot className="px-1.5 text-[10px]" /> : <StatusBadge label="Missing" variant="error" dot className="px-1.5 text-[10px]" />}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="min-w-0 overflow-hidden rounded border border-border bg-card shadow-sm">
            <div className="border-b border-border px-4 py-3">
              <div className="text-xs font-semibold text-foreground">MSAQ Answers</div>
              <div className="text-[10px] text-muted-foreground">{selected ? `${selected.participantId} / ${selected.sessionId}` : "Select a response"}</div>
            </div>
            <div className="max-h-[min(560px,65vh)] overflow-auto">
              <table className="min-w-[760px] w-full text-xs">
                <thead className="sticky top-0 bg-muted">
                  <tr>
                    {["ID", "Section", "Question", "Raw", "Score"].map((heading) => (
                      <th key={heading} className="text-left px-2.5 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-12 text-muted-foreground">No answer details</td></tr>
                  ) : rows.map((row) => (
                    <tr key={row.id} className="border-b border-border/50">
                      <td className="px-2.5 py-2 font-mono font-semibold">{row.id}</td>
                      <td className="px-2.5 py-2 text-muted-foreground">{row.section}</td>
                      <td className="px-2.5 py-2">{row.question}</td>
                      <td className="px-2.5 py-2 font-mono">{String(row.raw)}</td>
                      <td className="px-2.5 py-2 font-mono">{String(row.scored)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
