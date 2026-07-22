import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  CheckCircle2,
  FlaskConical,
  Heart,
  RotateCcw,
  Shield,
  ShieldCheck,
  Thermometer,
  Users,
  Waves,
  Zap,
} from "lucide-react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
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

function PageHeader({
  loading,
  onRefresh,
}: {
  loading: boolean;
  onRefresh: () => void;
}) {
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

      <div className="flex items-center gap-3">
        <div className="font-mono text-xs text-muted-foreground">
          {new Date().toLocaleDateString("en-GB", {
            timeZone: "Asia/Kolkata",
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RotateCcw
            size={13}
            className={loading ? "animate-spin" : ""}
          />
          Refresh
        </button>
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

const SENSOR_RANGES: Record<string, [number, number]> = {
  meanTemp: [20, 45],
  rmssdMs: [0, 300],
  sdnnMs: [0, 300],
  heartRateBpm: [30, 220],
  spo2Percent: [70, 100],
  sclUs: [0, 100],
  scrPeakCount: [0, 100],
  scrMean: [0, 100],
};

function cleanSensorValue(
  key: keyof SensorSnapshot,
  value: number | null | undefined,
): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return null;
  }

  let normalized = value;
  if (key === "meanTemp" && normalized > 100 && normalized <= 4500) {
    normalized = normalized / 100;
  }

  const range = SENSOR_RANGES[key];
  if (range && (normalized < range[0] || normalized > range[1])) {
    return null;
  }

  return Math.round(normalized * 100) / 100;
}

export default function Dashboard() {
  const [summary, setSummary] =
    useState<DashboardSummary | null>(null);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [latestSensor, setLatestSensor] =
    useState<SensorSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [sensorRefreshing, setSensorRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [dashboardSummary, researchSessions, thingSpeakReading] =
        await Promise.all([
          getDashboardSummary(),
          getSessions(),
          getLatestThingSpeakReading(),
        ]);

      setSummary(dashboardSummary);
      setSessions(researchSessions);
      setLatestSensor(thingSpeakReading);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load dashboard data.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function loadInitialDashboard() {
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

    void loadInitialDashboard();

    return () => {
      active = false;
    };
  }, []);

  const refreshThingSpeakValues = useCallback(async () => {
    setSensorRefreshing(true);
    setError("");

    try {
      setLatestSensor(await getLatestThingSpeakReading());
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "Could not refresh ThingSpeak values.",
      );
    } finally {
      setSensorRefreshing(false);
    }
  }, []);

  const dashboardData = useMemo(() => {
    if (!summary) return null;

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

    const completeDataSessions = sessions.filter(
      (session) =>
        session.ecgCollected &&
        session.questionnaireCompleted,
    ).length;

    const sessionRows = sessions;

    const hasConditionData = conditionData.some(
      (item) => item.value > 0,
    );

    return {
      conditionData,
      completeDataSessions,
      sessionRows,
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
    conditionData,
    completeDataSessions,
    sessionRows,
    hasConditionData,
  } = dashboardData;

  const hasSavedSensorRecords = summary.sensorRecords > 0;
  const sensorValue = (
    key: keyof SensorSnapshot,
    averageValue: number | null,
    latestValue: number | null | undefined,
  ) => (
    cleanSensorValue(key, latestValue)
    ?? cleanSensorValue(key, averageValue)
  );
  const sourceText = latestSensor
    ? "Latest values fetched from the configured ThingSpeak channel."
    : hasSavedSensorRecords
      ? "Showing saved research observations after removing invalid outliers."
      : "No saved observations or live ThingSpeak reading available.";

  const physiologicalMetrics = [
    {
      label: "Mean Temp",
      value: sensorValue("meanTemp", summary.avgTemperature, latestSensor?.meanTemp),
      unit: "C",
      icon: Thermometer,
      iconClassName: "text-orange-500",
    },
    {
      label: "RMSSD",
      value: sensorValue("rmssdMs", summary.avgHrv, latestSensor?.rmssdMs),
      unit: "ms",
      icon: Waves,
      iconClassName: "text-blue-500",
    },
    {
      label: "SDNN",
      value: sensorValue("sdnnMs", summary.avgSdnn, latestSensor?.sdnnMs),
      unit: "ms",
      icon: Waves,
      iconClassName: "text-violet-600",
    },
    {
      label: "Heart Rate",
      value: sensorValue("heartRateBpm", summary.avgHeartRate, latestSensor?.heartRateBpm),
      unit: "bpm",
      icon: Heart,
      iconClassName: "text-red-500",
    },
    {
      label: "SpO2",
      value: sensorValue("spo2Percent", summary.avgSpo2, latestSensor?.spo2Percent),
      unit: "%",
      icon: Shield,
      iconClassName: "text-emerald-600",
    },
    {
      label: "SCL",
      value: sensorValue("sclUs", summary.avgEda, latestSensor?.sclUs),
      unit: "uS",
      icon: Zap,
      iconClassName: "text-teal-600",
    },
    {
      label: "SCR Peaks",
      value: sensorValue("scrPeakCount", summary.avgScrPeakCount, latestSensor?.scrPeakCount),
      unit: "count",
      icon: Activity,
      iconClassName: "text-amber-600",
    },
    {
      label: "SCR Mean",
      value: sensorValue("scrMean", summary.avgScrMean, latestSensor?.scrMean),
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
      <PageHeader loading={loading} onRefresh={() => void loadDashboard()} />

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
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xs font-semibold text-foreground">
              Physiological Summary
            </h2>

            <p className="mt-0.5 text-[10px] text-muted-foreground">
              {sourceText}
            </p>
          </div>

          <button
            type="button"
            onClick={() => void refreshThingSpeakValues()}
            disabled={sensorRefreshing}
            className="inline-flex w-fit items-center gap-2 rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RotateCcw
              size={13}
              className={sensorRefreshing ? "animate-spin" : ""}
            />
            Refresh ThingSpeak Values
          </button>
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

      {/* Condition and recent sessions */}
      <div className="grid gap-4 xl:grid-cols-[minmax(320px,0.85fr)_minmax(0,1.15fr)]">
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

        <section className="overflow-hidden rounded border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <h2 className="text-xs font-semibold text-foreground">
                Research Sessions
              </h2>

              <p className="mt-0.5 text-[10px] text-muted-foreground">
                All recorded participant sessions.
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
                {sessionRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-12 text-center text-xs text-muted-foreground"
                    >
                      No research sessions available.
                    </td>
                  </tr>
                ) : (
                  sessionRows.map((session, index) => (
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
      </div>
    </div>
  );
}
