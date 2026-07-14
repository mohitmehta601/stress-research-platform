import { useEffect, useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import { downloadExport, getQuestionnaireRecords } from "../services/apiClient";
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
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Questionnaire</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{records.length} responses</p>
        </div>
        <button onClick={exportCsv} className="flex items-center gap-1.5 rounded bg-[#1d4ed8] px-3 py-2 text-xs font-semibold text-white">
          <Download size={13} />
          Export CSV
        </button>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            className="pl-8 pr-3 py-1.5 text-xs bg-card border border-border rounded w-52 focus:outline-none focus:ring-1 focus:ring-blue-400"
            placeholder="Search participant or session"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <select className="text-xs bg-card border border-border rounded px-2.5 py-1.5" value={condition} onChange={(event) => setCondition(event.target.value as ConditionFilter)}>
          <option value="combined">Combined</option>
          <option value="relaxed">Relaxed</option>
          <option value="stress">Stress</option>
        </select>
        <span className="text-xs text-muted-foreground">{filtered.length} records</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">Loading...</div>
      ) : (
        <div className="grid grid-cols-[minmax(420px,0.9fr)_minmax(520px,1.1fr)] gap-4">
          <div className="bg-card rounded border border-border shadow-sm overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/60 border-b border-border">
                  {["Participant", "Session", "Condition", "Key", "Answered", "Score", "Submitted", "Status"].map((heading) => (
                    <th key={heading} className="text-left px-2.5 py-2.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold whitespace-nowrap">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">No responses</td></tr>
                ) : filtered.map((record) => (
                  <tr key={record.id} onClick={() => setSelectedId(record.id)} className={`border-b border-border/50 cursor-pointer hover:bg-blue-50/40 ${selected?.id === record.id ? "bg-blue-50/60" : ""}`}>
                    <td className="px-2.5 py-2.5 font-mono font-semibold text-[#1a3461]">{record.participantId}</td>
                    <td className="px-2.5 py-2.5 font-mono text-muted-foreground">{record.sessionId}</td>
                    <td className="px-2.5 py-2.5">{conditionBadge(record.condition)}</td>
                    <td className="px-2.5 py-2.5 font-mono text-[10px]">{record.questionnaireKey || "msaq-v1"}</td>
                    <td className="px-2.5 py-2.5 font-mono">{answerRows(record).length}</td>
                    <td className="px-2.5 py-2.5 font-mono">{record.score ?? "-"}</td>
                    <td className="px-2.5 py-2.5 font-mono text-[10px] text-muted-foreground whitespace-nowrap">{record.timestamp ? record.timestamp.replace("T", " ") : "-"}</td>
                    <td className="px-2.5 py-2.5">
                      {record.completed ? <StatusBadge label="Complete" variant="success" dot /> : <StatusBadge label="Incomplete" variant="error" dot />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-card rounded border border-border shadow-sm overflow-hidden">
            <div className="border-b border-border px-4 py-3">
              <div className="text-xs font-semibold text-foreground">MSAQ Answers</div>
              <div className="text-[10px] text-muted-foreground">{selected ? `${selected.participantId} / ${selected.sessionId}` : "Select a response"}</div>
            </div>
            <div className="max-h-[560px] overflow-auto">
              <table className="w-full text-xs">
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
