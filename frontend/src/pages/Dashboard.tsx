import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  FlaskConical,
  Heart,
  Shield,
  ShieldCheck,
  Thermometer,
  Users,
  Waves,
  Zap,
} from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { StatCard } from "../components/StatCard";
import {
  conditionBadge,
  sessionStatusBadge,
} from "../components/StatusBadge";
import {
  getDashboardSummary,
  getLatestThingSpeakReading,
  getSessions,
} from "../services/apiClient";
import type {
  DashboardSummary,
  SensorSnapshot,
  Session,
} from "../types";

function PageHeader() {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-lg font-semibold text-foreground">
          Research Overview
        </h1>

        <p className="mt-0.5 text-xs text-muted-foreground">
          Participant enrolment, research sessions, physiological
          observations, and dataset quality.
        </p>
      </div>

      <div className="font-mono text-xs text-muted-foreground">
        {new Date().toLocaleDateString("en-GB", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })}
      </div>
    </div>
  );
}

function EmptyChart({
  message,
}: {
  message: string;
}) {
  return (
    <div className="flex h-[190px] items-center justify-center text-xs text-muted-foreground">
      {message}
    </div>
  );
}

export default function Dashboard() {
  const [summary, setSummary] =
    useState<DashboardSummary | null>(null);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [latestSensor, setLatestSensor] =
    useState<SensorSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      setLoading(true);
      setError("");

      try {
        const [dashboardSummary, researchSessions, thingSpeakReading] =
          await Promise.all([
            getDashboardSummary(),
            getSessions(),
            getLatestThingSpeakReading(),
          ]);

        if (!active) return;

        setSummary(dashboardSummary);
        setSessions(researchSessions);
        setLatestSensor(thingSpeakReading);
      } catch (loadError) {
        if (!active) return;

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not load dashboard data.",
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadDashboard();

    return () => {
      active = false;
    };
  }, []);

  const dashboardData = useMemo(() => {
    if (!summary) return null;

    const statusCounts: Record<Session["status"], number> = {
      completed: 0,
      "in-progress": 0,
      "pending-review": 0,
      incomplete: 0,
    };

    sessions.forEach((session) => {
      statusCounts[session.status] =
        (statusCounts[session.status] ?? 0) + 1;
    });

    const statusData = [
      {
        name: "Completed",
        value: statusCounts.completed,
        fill: "#10b981",
      },
      {
        name: "In Progress",
        value: statusCounts["in-progress"],
        fill: "#3b82f6",
      },
      {
        name: "Pending Review",
        value: statusCounts["pending-review"],
        fill: "#f59e0b",
      },
      {
        name: "Incomplete",
        value: statusCounts.incomplete,
        fill: "#ef4444",
      },
    ];

    const relaxedSessions = sessions.filter(
      (session) => session.condition === "relaxed",
    ).length;

    const stressSessions = sessions.filter(
      (session) => session.condition === "stress",
    ).length;

    const conditionData = [
      {
        name: "Relaxed",
        value: relaxedSessions,
        fill: "#3b82f6",
      },
      {
        name: "Stress",
        value: stressSessions,
        fill: "#f59e0b",
      },
    ];

    const missingDataSessions = sessions.filter(
      (session) =>
        !session.ecgCollected ||
        !session.questionnaireCompleted,
    );

    const completeDataSessions = sessions.filter(
      (session) =>
        session.ecgCollected &&
        session.questionnaireCompleted,
    ).length;

    const recentSessions = sessions.slice(0, 8);

    const hasStatusData = statusData.some(
      (item) => item.value > 0,
    );

    const hasConditionData = conditionData.some(
      (item) => item.value > 0,
    );

    return {
      statusData,
      conditionData,
      missingDataSessions,
      completeDataSessions,
      recentSessions,
      hasStatusData,
      hasConditionData,
    };
  }, [sessions, summary]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        <div className="text-center">
          <div className="mx-auto mb-2 h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          Loading research dashboard…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <div className="font-semibold">
          Could not load research data.
        </div>

        <div className="mt-1 text-xs">{error}</div>

        <div className="mt-2 text-xs">
          Check the API session and database connection.
        </div>
      </div>
    );
  }

  if (!summary || !dashboardData) {
    return null;
  }

  const {
    statusData,
    conditionData,
    missingDataSessions,
    completeDataSessions,
    recentSessions,
    hasStatusData,
    hasConditionData,
  } = dashboardData;

  const hasSavedSensorRecords = summary.sensorRecords > 0;
  const sensorValue = (
    averageValue: number,
    latestValue: number | null | undefined,
  ) => (hasSavedSensorRecords ? averageValue : latestValue);
  const sourceText = hasSavedSensorRecords
    ? "Average values calculated from saved research observations."
    : latestSensor
      ? "Latest values fetched from the configured ThingSpeak channel."
      : "No saved observations or live ThingSpeak reading available.";

  const physiologicalMetrics = [
    {
      label: "Mean Temp",
      value: sensorValue(summary.avgTemperature, latestSensor?.meanTemp),
      unit: "C",
      icon: Thermometer,
      iconClassName: "text-orange-500",
    },
    {
      label: "RMSSD",
      value: sensorValue(summary.avgHrv, latestSensor?.rmssdMs),
      unit: "ms",
      icon: Waves,
      iconClassName: "text-blue-500",
    },
    {
      label: "SDNN",
      value: sensorValue(summary.avgSdnn, latestSensor?.sdnnMs),
      unit: "ms",
      icon: Waves,
      iconClassName: "text-violet-600",
    },
    {
      label: "Heart Rate",
      value: sensorValue(summary.avgHeartRate, latestSensor?.heartRateBpm),
      unit: "bpm",
      icon: Heart,
      iconClassName: "text-red-500",
    },
    {
      label: "SpO2",
      value: sensorValue(summary.avgSpo2, latestSensor?.spo2Percent),
      unit: "%",
      icon: Shield,
      iconClassName: "text-emerald-600",
    },
    {
      label: "SCL",
      value: sensorValue(summary.avgEda, latestSensor?.sclUs),
      unit: "uS",
      icon: Zap,
      iconClassName: "text-teal-600",
    },
    {
      label: "SCR Peaks",
      value: sensorValue(summary.avgScrPeakCount, latestSensor?.scrPeakCount),
      unit: "count",
      icon: Activity,
      iconClassName: "text-amber-600",
    },
    {
      label: "SCR Mean",
      value: sensorValue(summary.avgScrMean, latestSensor?.scrMean),
      unit: "",
      icon: Activity,
      iconClassName: "text-indigo-600",
    },
    {
      label: "Stress Score",
      value: summary.avgStressScore,
      unit: "/100",
      icon: Activity,
      iconClassName: "text-violet-600",
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader />

      {/* Core research indicators */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          label="Participants"
          value={summary.totalParticipants}
          icon={Users}
          iconColor="text-blue-600"
          highlight
        />

        <StatCard
          label="Consented Participants"
          value={summary.consentedParticipants}
          sub={`/ ${summary.totalParticipants}`}
          icon={ShieldCheck}
          iconColor="text-teal-600"
        />

        <StatCard
          label="Research Sessions"
          value={summary.totalSessions}
          icon={FlaskConical}
          iconColor="text-indigo-600"
        />

        <StatCard
          label="Complete Datasets"
          value={completeDataSessions}
          sub={`/ ${summary.totalSessions}`}
          icon={CheckCircle2}
          iconColor="text-emerald-600"
        />
      </div>

      {/* Physiological research averages */}
      <section className="rounded border border-border bg-card p-4 shadow-sm">
        <div className="mb-3">
          <h2 className="text-xs font-semibold text-foreground">
            Physiological Summary
          </h2>

          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {sourceText}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-9">
          {physiologicalMetrics.map(
            ({
              label,
              value,
              unit,
              icon: Icon,
              iconClassName,
            }) => (
              <div
                key={label}
                className="rounded border border-border bg-background p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-mono text-lg font-semibold tabular-nums text-foreground">
                      {value ?? "—"}
                    </div>

                    <div className="font-mono text-[10px] text-muted-foreground">
                      {unit}
                    </div>
                  </div>

                  <div
                    className={`rounded bg-muted p-1.5 ${iconClassName}`}
                  >
                    <Icon size={14} />
                  </div>
                </div>

                <div className="mt-2 text-[10px] text-muted-foreground">
                  {label}
                </div>
              </div>
            ),
          )}
        </div>
      </section>

      {/* Research distributions */}
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded border border-border bg-card p-4 shadow-sm lg:col-span-2">
          <div className="mb-3">
            <h2 className="text-xs font-semibold text-foreground">
              Session Status Distribution
            </h2>

            <p className="mt-0.5 text-[10px] text-muted-foreground">
              Current processing and completion state of research
              sessions.
            </p>
          </div>

          {hasStatusData ? (
            <ResponsiveContainer width="100%" height={190}>
              <BarChart
                data={statusData}
                layout="vertical"
                margin={{
                  top: 5,
                  right: 25,
                  bottom: 5,
                  left: 10,
                }}
              >
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={{ fontSize: 11 }}
                />

                <YAxis
                  type="category"
                  dataKey="name"
                  width={105}
                  tick={{ fontSize: 11 }}
                />

                <Tooltip
                  contentStyle={{ fontSize: 12 }}
                  cursor={{ fill: "rgba(148, 163, 184, 0.08)" }}
                />

                <Bar
                  dataKey="value"
                  name="Sessions"
                  radius={[0, 3, 3, 0]}
                >
                  {statusData.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={entry.fill}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart message="No session data available." />
          )}
        </section>

        <section className="rounded border border-border bg-card p-4 shadow-sm">
          <div className="mb-3">
            <h2 className="text-xs font-semibold text-foreground">
              Experimental Condition
            </h2>

            <p className="mt-0.5 text-[10px] text-muted-foreground">
              Distribution of relaxed and stress sessions.
            </p>
          </div>

          {hasConditionData ? (
            <ResponsiveContainer width="100%" height={190}>
              <PieChart>
                <Pie
                  data={conditionData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={35}
                  outerRadius={65}
                  paddingAngle={2}
                  label={({ name, percent }) =>
                    `${name} ${(
                      (percent ?? 0) * 100
                    ).toFixed(0)}%`
                  }
                  labelLine={false}
                >
                  {conditionData.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={entry.fill}
                    />
                  ))}
                </Pie>

                <Tooltip
                  contentStyle={{ fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart message="No condition data available." />
          )}
        </section>
      </div>

      {/* Sessions and data-quality review */}
      <div className="grid gap-4 xl:grid-cols-3">
        <section className="overflow-hidden rounded border border-border bg-card shadow-sm xl:col-span-2">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <h2 className="text-xs font-semibold text-foreground">
                Recent Research Sessions
              </h2>

              <p className="mt-0.5 text-[10px] text-muted-foreground">
                Latest recorded participant sessions.
              </p>
            </div>

            <span className="font-mono text-[10px] text-muted-foreground">
              {sessions.length} total
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  {[
                    "Session",
                    "Participant",
                    "Condition",
                    "Date",
                    "Status",
                  ].map((heading) => (
                    <th
                      key={heading}
                      className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {recentSessions.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-12 text-center text-xs text-muted-foreground"
                    >
                      No research sessions available.
                    </td>
                  </tr>
                ) : (
                  recentSessions.map((session, index) => (
                    <tr
                      key={session.id}
                      className={`border-b border-border/50 last:border-b-0 hover:bg-muted/40 ${
                        index % 2 === 1
                          ? "bg-muted/20"
                          : "bg-card"
                      }`}
                    >
                      <td className="px-3 py-2.5 font-mono font-medium text-foreground">
                        {session.id}
                      </td>

                      <td className="px-3 py-2.5 font-mono text-muted-foreground">
                        {session.participantId}
                      </td>

                      <td className="px-3 py-2.5">
                        {conditionBadge(session.condition)}
                      </td>

                      <td className="px-3 py-2.5 font-mono text-muted-foreground">
                        {session.date ?? "—"}
                      </td>

                      <td className="px-3 py-2.5">
                        {sessionStatusBadge(session.status)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <AlertTriangle
                size={14}
                className="text-amber-500"
              />

              <div>
                <h2 className="text-xs font-semibold text-foreground">
                  Data Quality Alerts
                </h2>

                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  Sessions with incomplete research records.
                </p>
              </div>
            </div>

            {missingDataSessions.length > 0 && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 font-mono text-[10px] font-semibold text-amber-700">
                {missingDataSessions.length}
              </span>
            )}
          </div>

          <div className="max-h-[330px] space-y-2 overflow-y-auto p-3">
            {missingDataSessions.length === 0 ? (
              <div className="py-10 text-center">
                <CheckCircle2
                  size={20}
                  className="mx-auto text-emerald-500"
                />

                <p className="mt-2 text-xs font-medium text-foreground">
                  No data quality issues
                </p>

                <p className="mt-1 text-[10px] text-muted-foreground">
                  All sessions contain sensor and questionnaire
                  data.
                </p>
              </div>
            ) : (
              missingDataSessions.map((session) => (
                <div
                  key={session.id}
                  className="rounded border border-amber-200 bg-amber-50 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-mono text-[10px] font-semibold text-amber-900">
                        {session.id}
                      </div>

                      <div className="mt-0.5 font-mono text-[10px] text-amber-700">
                        Participant: {session.participantId}
                      </div>
                    </div>

                    {conditionBadge(session.condition)}
                  </div>

                  <div className="mt-2 space-y-1 text-[10px] text-amber-800">
                    {!session.ecgCollected && (
                      <div>• Physiological sensor data missing</div>
                    )}

                    {!session.questionnaireCompleted && (
                      <div>• Questionnaire data incomplete</div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
