import {
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import {
  Bell,
  CheckCircle2,
  Clock3,
  Database,
  Download,
  Eye,
  FileText,
  KeyRound,
  LockKeyhole,
  Mail,
  RefreshCcw,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  UserCog,
  Users,
  XCircle,
} from "lucide-react";

import {
  getAccessRequests,
  removeAccessRequest,
  reviewAccessRequest,
} from "../services/apiClient";
import type { AccessRequest } from "../types";

type SettingsSection =
  | "overview"
  | "access"
  | "general"
  | "notifications"
  | "security"
  | "data";

type StudyStatus = "active" | "paused" | "archived";
type ExportFormat = "csv" | "json" | "xlsx";

type PlatformSettings = {
  platformName: string;
  supportEmail: string;
  studyStatus: StudyStatus;
  timezone: string;
  dateFormat: string;

  allowSelfRegistration: boolean;
  maintenanceMode: boolean;

  notifyNewAccessRequest: boolean;
  notifyMissingData: boolean;
  notifyExportReady: boolean;
  notifyFailedSession: boolean;
  dailySummary: boolean;
  weeklySummary: boolean;

  sessionTimeoutMinutes: number;
  lockoutAttempts: number;
  requireMfaForAdmins: boolean;
  enforceStrongPasswords: boolean;
  logSecurityEvents: boolean;

  retentionDays: number;
  defaultExportFormat: ExportFormat;
  anonymizeExports: boolean;
  requireConsentForExport: boolean;
  includeAuditMetadata: boolean;
  allowParticipantDeletion: boolean;
};

const STORAGE_KEY = "srp-platform-settings";

const DEFAULT_SETTINGS: PlatformSettings = {
  platformName: "Stress Research Platform",
  supportEmail: "",
  studyStatus: "active",
  timezone: "Asia/Kolkata",
  dateFormat: "DD/MM/YYYY",

  allowSelfRegistration: true,
  maintenanceMode: false,

  notifyNewAccessRequest: true,
  notifyMissingData: true,
  notifyExportReady: true,
  notifyFailedSession: true,
  dailySummary: false,
  weeklySummary: true,

  sessionTimeoutMinutes: 60,
  lockoutAttempts: 5,
  requireMfaForAdmins: false,
  enforceStrongPasswords: true,
  logSecurityEvents: true,

  retentionDays: 3650,
  defaultExportFormat: "csv",
  anonymizeExports: true,
  requireConsentForExport: true,
  includeAuditMetadata: true,
  allowParticipantDeletion: false,
};

const SETTINGS_NAVIGATION: Array<{
  id: SettingsSection;
  label: string;
  description: string;
  icon: ComponentType<{ size?: number; className?: string }>;
}> = [
  {
    id: "overview",
    label: "Overview",
    description: "Settings summary",
    icon: Settings2,
  },
  {
    id: "access",
    label: "Access & Roles",
    description: "Dashboard access requests",
    icon: Users,
  },
  {
    id: "general",
    label: "General",
    description: "Platform configuration",
    icon: SlidersHorizontal,
  },
  {
    id: "notifications",
    label: "Notifications",
    description: "Alerts and summaries",
    icon: Bell,
  },
  {
    id: "security",
    label: "Security",
    description: "Sessions and passwords",
    icon: ShieldCheck,
  },
  {
    id: "data",
    label: "Data & Export",
    description: "Retention and exports",
    icon: Database,
  },
];

const ROLE_RULES = [
  {
    role: "Super Admin",
    icon: ShieldCheck,
    access: "Full system access, user approvals, exports, and configuration.",
  },
  {
    role: "Researcher",
    icon: UserCog,
    access: "Manage participants, research sessions, datasets, and exports.",
  },
  {
    role: "Doctor",
    icon: KeyRound,
    access: "Review assigned sessions and add clinical stress assessments.",
  },
  {
    role: "Viewer",
    icon: Eye,
    access: "Read-only access for review and auditing.",
  },
];

function getStatusStyle(status: string) {
  switch (status.toLowerCase()) {
    case "approved":
      return {
        label: "Approved",
        className:
          "border-emerald-200 bg-emerald-50 text-emerald-700",
      };

    case "rejected":
      return {
        label: "Rejected",
        className: "border-red-200 bg-red-50 text-red-700",
      };

    default:
      return {
        label: "Pending",
        className: "border-amber-200 bg-amber-50 text-amber-700",
      };
  }
}

function formatRole(role: string) {
  return role
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function SettingsPanel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded border border-border bg-card shadow-sm">
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-sm font-semibold text-foreground">
          {title}
        </h2>

        {description && (
          <p className="mt-1 text-xs text-muted-foreground">
            {description}
          </p>
        )}
      </div>

      <div className="p-5">{children}</div>
    </section>
  );
}

function TextField({
  label,
  description,
  value,
  type = "text",
  placeholder,
  onChange,
}: {
  label: string;
  description?: string;
  value: string | number;
  type?: "text" | "email" | "number";
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold text-foreground">
        {label}
      </span>

      {description && (
        <span className="block text-[10px] leading-relaxed text-muted-foreground">
          {description}
        </span>
      )}

      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded border border-border bg-background px-3 py-2 text-xs text-foreground outline-none transition focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
      />
    </label>
  );
}

function SelectField({
  label,
  description,
  value,
  children,
  onChange,
}: {
  label: string;
  description?: string;
  value: string | number;
  children: ReactNode;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold text-foreground">
        {label}
      </span>

      {description && (
        <span className="block text-[10px] leading-relaxed text-muted-foreground">
          {description}
        </span>
      )}

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded border border-border bg-background px-3 py-2 text-xs text-foreground outline-none transition focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
      >
        {children}
      </select>
    </label>
  );
}

function ToggleSetting({
  title,
  description,
  checked,
  disabled = false,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-5 border-b border-border/60 py-4 first:pt-0 last:border-b-0 last:pb-0">
      <div className="min-w-0">
        <div className="text-xs font-semibold text-foreground">
          {title}
        </div>

        <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-5 w-9 flex-shrink-0 rounded-full transition ${
          checked ? "bg-[#0d9488]" : "bg-slate-300"
        } ${
          disabled
            ? "cursor-not-allowed opacity-50"
            : "cursor-pointer"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
            checked ? "translate-x-[18px]" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}

function StatCard({
  label,
  value,
  description,
  icon: Icon,
  iconClassName,
  iconBackground,
}: {
  label: string;
  value: string | number;
  description: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  iconClassName: string;
  iconBackground: string;
}) {
  return (
    <div className="rounded border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </div>

          <div className="mt-2 font-mono text-2xl font-semibold tabular-nums text-foreground">
            {value}
          </div>

          <p className="mt-1 text-[10px] text-muted-foreground">
            {description}
          </p>
        </div>

        <div
          className={`rounded p-2 ${iconBackground} ${iconClassName}`}
        >
          <Icon size={16} />
        </div>
      </div>
    </div>
  );
}

export default function Settings() {
  const [activeSection, setActiveSection] =
    useState<SettingsSection>("overview");

  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [requestSearch, setRequestSearch] = useState("");
  const [requestStatus, setRequestStatus] = useState("all");
  const [requestRole, setRequestRole] = useState("all");
  const [requestError, setRequestError] = useState("");
  const [requestActionId, setRequestActionId] = useState("");

  const [settings, setSettings] =
    useState<PlatformSettings>(DEFAULT_SETTINGS);

  const [savedSettings, setSavedSettings] =
    useState<PlatformSettings>(DEFAULT_SETTINGS);

  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => {
    try {
      const storedSettings = window.localStorage.getItem(STORAGE_KEY);

      if (storedSettings) {
        const parsedSettings = JSON.parse(
          storedSettings,
        ) as Partial<PlatformSettings>;

        const mergedSettings = {
          ...DEFAULT_SETTINGS,
          ...parsedSettings,
        };

        setSettings(mergedSettings);
        setSavedSettings(mergedSettings);
      }
    } catch (error) {
      console.error("Could not load saved settings:", error);
    }
  }, []);

  async function loadRequests() {
    try {
      setRequestError("");
      const data = await getAccessRequests();
      setRequests(data);
    } catch (error) {
      console.error("Could not load access requests:", error);
      setRequestError("Could not load dashboard access requests.");
    }
  }

  useEffect(() => {
  void loadRequests();

  window.addEventListener(
    "srp-access-requests-updated",
    loadRequests,
  );

  return () => {
    window.removeEventListener(
      "srp-access-requests-updated",
      loadRequests,
    );
  };
}, []);

  const pendingRequests = useMemo(
    () =>
      requests.filter(
        (request) => request.status.toLowerCase() === "pending",
      ),
    [requests],
  );

  const approvedRequests = useMemo(
    () =>
      requests.filter(
        (request) => request.status.toLowerCase() === "approved",
      ),
    [requests],
  );

  const rejectedRequests = useMemo(
    () =>
      requests.filter(
        (request) => request.status.toLowerCase() === "rejected",
      ),
    [requests],
  );

  const filteredRequests = useMemo(() => {
    const normalizedSearch = requestSearch.trim().toLowerCase();

    return requests.filter((request) => {
      const searchableText = [
        request.name,
        request.email,
        request.organization,
        request.requestedRole,
        request.reason,
        request.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !normalizedSearch ||
        searchableText.includes(normalizedSearch);

      const matchesStatus =
        requestStatus === "all" ||
        request.status.toLowerCase() === requestStatus;

      const matchesRole =
        requestRole === "all" ||
        request.requestedRole.toLowerCase() === requestRole;

      return matchesSearch && matchesStatus && matchesRole;
    });
  }, [requestRole, requestSearch, requestStatus, requests]);

  const availableRoles = useMemo(
    () =>
      Array.from(
        new Set(
          requests
            .map((request) =>
              request.requestedRole.toLowerCase(),
            )
            .filter(Boolean),
        ),
      ),
    [requests],
  );

  const hasUnsavedChanges =
    JSON.stringify(settings) !== JSON.stringify(savedSettings);

  const securityScore = useMemo(() => {
    let score = 0;

    if (settings.enforceStrongPasswords) score += 25;
    if (settings.requireMfaForAdmins) score += 25;
    if (settings.logSecurityEvents) score += 20;
    if (settings.sessionTimeoutMinutes <= 60) score += 15;
    if (settings.lockoutAttempts <= 5) score += 15;

    return score;
  }, [settings]);

  function updateSetting<K extends keyof PlatformSettings>(
    key: K,
    value: PlatformSettings[K],
  ) {
    setSettings((currentSettings) => ({
      ...currentSettings,
      [key]: value,
    }));

    setSaveMessage("");
  }

  function saveSettings() {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(settings),
      );

      setSavedSettings(settings);
      setSaveMessage("Settings saved successfully.");

      window.setTimeout(() => {
        setSaveMessage("");
      }, 3000);
    } catch (error) {
      console.error("Could not save settings:", error);
      setSaveMessage("Could not save settings.");
    }
  }

  function resetSettings() {
    const confirmed = window.confirm(
      "Reset all settings to their default values?",
    );

    if (!confirmed) return;

    setSettings(DEFAULT_SETTINGS);
    setSavedSettings(DEFAULT_SETTINGS);

    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(DEFAULT_SETTINGS),
    );

    setSaveMessage("Settings reset to default values.");
  }

  function downloadJsonFile(filename: string, data: unknown) {
    const file = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });

    const fileUrl = URL.createObjectURL(file);
    const anchor = document.createElement("a");

    anchor.href = fileUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    URL.revokeObjectURL(fileUrl);
  }

  function exportSettings() {
    downloadJsonFile("stress-research-platform-settings.json", {
      exportedAt: new Date().toISOString(),
      settings,
    });
  }

  async function handleReviewAccessRequest(
    id: string,
    status: "approved" | "rejected",
  ) {
    setRequestActionId(`${status}:${id}`);
    setRequestError("");

    try {
      await reviewAccessRequest(id, status);
      await loadRequests();
    } catch (error) {
      console.error("Could not update access request:", error);
      setRequestError(
        error instanceof Error
          ? error.message
          : "Could not update access request.",
      );
    } finally {
      setRequestActionId("");
    }
  }

  async function handleRemoveAccessRequest(id: string) {
    const confirmed = window.confirm(
      "Remove this dashboard access request?",
    );

    if (!confirmed) return;

    setRequestActionId(`remove:${id}`);
    setRequestError("");

    try {
      await removeAccessRequest(id);
      await loadRequests();
    } catch (error) {
      console.error("Could not remove access request:", error);
      setRequestError(
        error instanceof Error
          ? error.message
          : "Could not remove access request.",
      );
    } finally {
      setRequestActionId("");
    }
  }

  function renderOverview() {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatCard
            label="Access Requests"
            value={requests.length}
            description="Total received"
            icon={Users}
            iconClassName="text-blue-600"
            iconBackground="bg-blue-50"
          />

          <StatCard
            label="Pending Review"
            value={pendingRequests.length}
            description="Require administrator action"
            icon={Clock3}
            iconClassName="text-amber-600"
            iconBackground="bg-amber-50"
          />

          <StatCard
            label="Security Score"
            value={`${securityScore}%`}
            description="Based on current controls"
            icon={ShieldCheck}
            iconClassName={
              securityScore >= 80
                ? "text-emerald-600"
                : "text-amber-600"
            }
            iconBackground={
              securityScore >= 80
                ? "bg-emerald-50"
                : "bg-amber-50"
            }
          />

          <StatCard
            label="Study Status"
            value={formatRole(settings.studyStatus)}
            description={
              settings.maintenanceMode
                ? "Maintenance mode enabled"
                : "Platform available"
            }
            icon={Settings2}
            iconClassName={
              settings.studyStatus === "active"
                ? "text-emerald-600"
                : "text-slate-600"
            }
            iconBackground={
              settings.studyStatus === "active"
                ? "bg-emerald-50"
                : "bg-slate-100"
            }
          />
        </div>

        <SettingsPanel
          title="Configuration overview"
          description="Review the most important platform controls."
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {[
              {
                section: "access" as SettingsSection,
                icon: Users,
                title: "Access and roles",
                description: `${pendingRequests.length} access requests waiting for review.`,
                status:
                  pendingRequests.length > 0
                    ? "Action required"
                    : "Up to date",
                statusClass:
                  pendingRequests.length > 0
                    ? "text-amber-700 bg-amber-50"
                    : "text-emerald-700 bg-emerald-50",
              },
              {
                section: "notifications" as SettingsSection,
                icon: Bell,
                title: "Notifications",
                description:
                  "Configure access, missing-data, export, and session alerts.",
                status:
                  settings.notifyNewAccessRequest ||
                  settings.notifyMissingData
                    ? "Enabled"
                    : "Disabled",
                statusClass:
                  settings.notifyNewAccessRequest ||
                  settings.notifyMissingData
                    ? "text-emerald-700 bg-emerald-50"
                    : "text-slate-600 bg-slate-100",
              },
              {
                section: "security" as SettingsSection,
                icon: LockKeyhole,
                title: "Security controls",
                description:
                  "Manage session expiry, passwords, MFA, and lockout rules.",
                status: `${securityScore}% configured`,
                statusClass:
                  securityScore >= 80
                    ? "text-emerald-700 bg-emerald-50"
                    : "text-amber-700 bg-amber-50",
              },
              {
                section: "data" as SettingsSection,
                icon: Database,
                title: "Data and exports",
                description:
                  "Control retention, consent checks, and export privacy.",
                status: settings.anonymizeExports
                  ? "Anonymized"
                  : "Identifiers included",
                statusClass: settings.anonymizeExports
                  ? "text-emerald-700 bg-emerald-50"
                  : "text-amber-700 bg-amber-50",
              },
              {
                section: "general" as SettingsSection,
                icon: SlidersHorizontal,
                title: "General settings",
                description:
                  "Manage platform identity, timezone, and availability.",
                status: formatRole(settings.studyStatus),
                statusClass:
                  settings.studyStatus === "active"
                    ? "text-emerald-700 bg-emerald-50"
                    : "text-slate-600 bg-slate-100",
              },
              {
                section: "data" as SettingsSection,
                icon: FileText,
                title: "Default export",
                description:
                  "Preferred format for research dataset exports.",
                status:
                  settings.defaultExportFormat.toUpperCase(),
                statusClass: "text-blue-700 bg-blue-50",
              },
            ].map(
              ({
                section,
                icon: Icon,
                title,
                description,
                status,
                statusClass,
              }) => (
                <button
                  key={title}
                  type="button"
                  onClick={() => setActiveSection(section)}
                  className="rounded border border-border bg-background p-4 text-left transition hover:border-blue-300 hover:bg-blue-50/30"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="rounded bg-muted p-2 text-[#1a3461]">
                      <Icon size={16} />
                    </div>

                    <span
                      className={`rounded px-2 py-1 text-[10px] font-semibold ${statusClass}`}
                    >
                      {status}
                    </span>
                  </div>

                  <div className="mt-3 text-xs font-semibold text-foreground">
                    {title}
                  </div>

                  <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                    {description}
                  </p>
                </button>
              ),
            )}
          </div>
        </SettingsPanel>
      </div>
    );
  }

  function renderAccessSettings() {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="Total Requests"
            value={requests.length}
            description="All dashboard requests"
            icon={Users}
            iconClassName="text-blue-600"
            iconBackground="bg-blue-50"
          />

          <StatCard
            label="Pending"
            value={pendingRequests.length}
            description="Awaiting review"
            icon={Clock3}
            iconClassName="text-amber-600"
            iconBackground="bg-amber-50"
          />

          <StatCard
            label="Approved"
            value={approvedRequests.length}
            description="Access granted"
            icon={CheckCircle2}
            iconClassName="text-emerald-600"
            iconBackground="bg-emerald-50"
          />

          <StatCard
            label="Rejected"
            value={rejectedRequests.length}
            description="Access declined"
            icon={XCircle}
            iconClassName="text-red-600"
            iconBackground="bg-red-50"
          />
        </div>

        <SettingsPanel
          title="Dashboard access requests"
          description="Search and review requests submitted for researcher dashboard access."
        >
          <div className="mb-3 flex flex-col gap-2 xl:flex-row xl:items-center">
            <div className="relative min-w-0 flex-1">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />

              <input
                type="search"
                value={requestSearch}
                onChange={(event) =>
                  setRequestSearch(event.target.value)
                }
                placeholder="Search request..."
                className="w-full rounded border border-border bg-background py-1.5 pl-9 pr-3 text-xs outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
              />
            </div>

            <select
              value={requestStatus}
              onChange={(event) =>
                setRequestStatus(event.target.value)
              }
              className="rounded border border-border bg-background px-3 py-1.5 text-xs outline-none focus:border-blue-400"
            >
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>

            <select
              value={requestRole}
              onChange={(event) =>
                setRequestRole(event.target.value)
              }
              className="rounded border border-border bg-background px-3 py-1.5 text-xs outline-none focus:border-blue-400"
            >
              <option value="all">All roles</option>

              {availableRoles.map((role) => (
                <option key={role} value={role}>
                  {formatRole(role)}
                </option>
              ))}
            </select>

          </div>

          {requestError ? (
            <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
              {requestError}
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded border border-dashed border-border px-4 py-12 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Users size={18} />
              </div>

              <div className="mt-3 text-sm font-semibold text-foreground">
                No access requests found
              </div>

              <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                New dashboard access requests will appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded border border-border">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      {[
                        "User",
                        "Request",
                        "Status",
                        "Actions",
                      ].map((heading) => (
                        <th
                          key={heading}
                          className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {filteredRequests.map((request, index) => {
                      const status = getStatusStyle(
                        request.status,
                      );

                      const initial =
                        request.name
                          ?.trim()
                          .charAt(0)
                          .toUpperCase() ||
                        request.email
                          ?.trim()
                          .charAt(0)
                          .toUpperCase() ||
                        "U";

                      return (
                        <tr
                          key={request.id}
                          className={`border-b border-border/60 last:border-b-0 hover:bg-muted/40 ${
                            index % 2 === 1
                              ? "bg-muted/10"
                              : ""
                          }`}
                        >
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#1a3461]/10 text-[10px] font-semibold text-[#1a3461]">
                                {initial}
                              </div>

                              <div className="min-w-0">
                                <div className="truncate font-semibold text-foreground">
                                  {request.name ||
                                    "Unknown user"}
                                </div>

                                <div className="mt-0.5 truncate text-[10px] text-muted-foreground">
                                  {request.email}
                                </div>

                                <div className="mt-0.5 truncate text-[10px] text-muted-foreground">
                                  {request.organization ||
                                    "No organization"}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="max-w-md px-3 py-2">
                            <span className="mb-1 inline-flex rounded border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                              {formatRole(
                                request.requestedRole,
                              )}
                            </span>

                            <p className="line-clamp-2 leading-relaxed text-muted-foreground">
                              {request.reason ||
                                "No reason provided."}
                            </p>
                          </td>

                          <td className="px-3 py-2">
                            <span
                              className={`inline-flex rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${status.className}`}
                            >
                              {status.label}
                            </span>
                          </td>

                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1.5">
                              {request.status === "pending" && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void handleReviewAccessRequest(
                                        request.id,
                                        "approved",
                                      )
                                    }
                                    disabled={
                                      Boolean(requestActionId) &&
                                      requestActionId !==
                                        `approved:${request.id}`
                                    }
                                    className="inline-flex h-7 items-center justify-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-2 text-[10px] font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    <CheckCircle2 size={13} />
                                    {requestActionId ===
                                    `approved:${request.id}`
                                      ? "Approving"
                                      : "Accept"}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      void handleReviewAccessRequest(
                                        request.id,
                                        "rejected",
                                      )
                                    }
                                    disabled={
                                      Boolean(requestActionId) &&
                                      requestActionId !==
                                        `rejected:${request.id}`
                                    }
                                    className="inline-flex h-7 items-center justify-center gap-1 rounded border border-red-200 bg-red-50 px-2 text-[10px] font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    <XCircle size={13} />
                                    {requestActionId ===
                                    `rejected:${request.id}`
                                      ? "Declining"
                                      : "Decline"}
                                  </button>
                                </>
                              )}

                              <button
                                type="button"
                                onClick={() =>
                                  void handleRemoveAccessRequest(
                                    request.id,
                                  )
                                }
                                disabled={
                                  Boolean(requestActionId) &&
                                  requestActionId !==
                                    `remove:${request.id}`
                                }
                                className="inline-flex h-7 items-center justify-center rounded border border-border bg-background px-2 text-[10px] font-semibold text-muted-foreground transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {requestActionId ===
                                `remove:${request.id}`
                                  ? "Removing"
                                  : "Remove"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-border bg-muted/20 px-4 py-3 text-[10px] text-muted-foreground">
                Showing {filteredRequests.length} of{" "}
                {requests.length} requests
              </div>
            </div>
          )}
        </SettingsPanel>

        <SettingsPanel
          title="Role permissions"
          description="Reference for the access level assigned to each dashboard role."
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {ROLE_RULES.map(
              ({ role, icon: Icon, access }) => (
                <div
                  key={role}
                  className="rounded border border-border bg-background p-4"
                >
                  <Icon
                    size={17}
                    className="text-[#0d9488]"
                  />

                  <div className="mt-3 text-xs font-semibold text-foreground">
                    {role}
                  </div>

                  <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                    {access}
                  </p>
                </div>
              ),
            )}
          </div>
        </SettingsPanel>
      </div>
    );
  }

  function renderGeneralSettings() {
    return (
      <div className="space-y-5">
        <SettingsPanel
          title="Platform identity"
          description="Basic information displayed throughout the research dashboard."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <TextField
              label="Platform name"
              description="Displayed in the dashboard navigation and browser title."
              value={settings.platformName}
              onChange={(value) =>
                updateSetting("platformName", value)
              }
            />

            <TextField
              label="Support email"
              description="Administrative contact for researchers and doctors."
              type="email"
              value={settings.supportEmail}
              placeholder="research-support@example.com"
              onChange={(value) =>
                updateSetting("supportEmail", value)
              }
            />

            <SelectField
              label="Study status"
              description="Controls the current operational state of the study."
              value={settings.studyStatus}
              onChange={(value) =>
                updateSetting(
                  "studyStatus",
                  value as StudyStatus,
                )
              }
            >
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="archived">Archived</option>
            </SelectField>

            <SelectField
              label="Timezone"
              description="Used when displaying sessions and audit events."
              value={settings.timezone}
              onChange={(value) =>
                updateSetting("timezone", value)
              }
            >
              <option value="Asia/Kolkata">
                Asia/Kolkata
              </option>
              <option value="UTC">UTC</option>
              <option value="Asia/Dubai">Asia/Dubai</option>
              <option value="Europe/London">
                Europe/London
              </option>
              <option value="America/New_York">
                America/New_York
              </option>
            </SelectField>

            <SelectField
              label="Date format"
              value={settings.dateFormat}
              onChange={(value) =>
                updateSetting("dateFormat", value)
              }
            >
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
            </SelectField>
          </div>
        </SettingsPanel>

        <SettingsPanel
          title="Platform availability"
          description="Control registration and temporary platform availability."
        >
          <ToggleSetting
            title="Allow dashboard access requests"
            description="Allow researchers, doctors, and viewers to submit requests for dashboard access."
            checked={settings.allowSelfRegistration}
            onChange={(checked) =>
              updateSetting(
                "allowSelfRegistration",
                checked,
              )
            }
          />

          <ToggleSetting
            title="Maintenance mode"
            description="Temporarily restrict normal dashboard access while maintenance is being performed."
            checked={settings.maintenanceMode}
            onChange={(checked) =>
              updateSetting("maintenanceMode", checked)
            }
          />
        </SettingsPanel>
      </div>
    );
  }

  function renderNotificationSettings() {
    return (
      <div className="space-y-5">
        <SettingsPanel
          title="Administrative alerts"
          description="Choose which platform events should generate administrator notifications."
        >
          <ToggleSetting
            title="New access request"
            description="Notify administrators whenever someone requests dashboard access."
            checked={settings.notifyNewAccessRequest}
            onChange={(checked) =>
              updateSetting(
                "notifyNewAccessRequest",
                checked,
              )
            }
          />

          <ToggleSetting
            title="Missing research data"
            description="Notify administrators when a session is missing physiological or questionnaire records."
            checked={settings.notifyMissingData}
            onChange={(checked) =>
              updateSetting("notifyMissingData", checked)
            }
          />

          <ToggleSetting
            title="Dataset export ready"
            description="Notify the requesting user when a dataset export is prepared."
            checked={settings.notifyExportReady}
            onChange={(checked) =>
              updateSetting("notifyExportReady", checked)
            }
          />

          <ToggleSetting
            title="Session processing failure"
            description="Notify administrators when session processing or validation fails."
            checked={settings.notifyFailedSession}
            onChange={(checked) =>
              updateSetting("notifyFailedSession", checked)
            }
          />
        </SettingsPanel>

        <SettingsPanel
          title="Summary emails"
          description="Control scheduled research activity summaries."
        >
          <ToggleSetting
            title="Daily activity summary"
            description="Send a daily summary of participants, sessions, missing data, and access requests."
            checked={settings.dailySummary}
            onChange={(checked) =>
              updateSetting("dailySummary", checked)
            }
          />

          <ToggleSetting
            title="Weekly research summary"
            description="Send a weekly summary of data collection progress and outstanding actions."
            checked={settings.weeklySummary}
            onChange={(checked) =>
              updateSetting("weeklySummary", checked)
            }
          />

          <div className="mt-5 rounded border border-blue-200 bg-blue-50 px-4 py-3">
            <div className="flex items-start gap-3">
              <Mail
                size={16}
                className="mt-0.5 flex-shrink-0 text-blue-600"
              />

              <div>
                <div className="text-xs font-semibold text-blue-800">
                  Email delivery integration
                </div>

                <p className="mt-1 text-[10px] leading-relaxed text-blue-700">
                  These preferences are saved, but sending
                  actual emails requires the Resend backend
                  integration and verified sender domain.
                </p>
              </div>
            </div>
          </div>
        </SettingsPanel>
      </div>
    );
  }

  function renderSecuritySettings() {
    return (
      <div className="space-y-5">
        <div className="rounded border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs font-semibold text-foreground">
                Security configuration score
              </div>

              <p className="mt-1 text-[10px] text-muted-foreground">
                Based on enabled authentication and session
                controls.
              </p>
            </div>

            <div
              className={`font-mono text-2xl font-semibold ${
                securityScore >= 80
                  ? "text-emerald-600"
                  : securityScore >= 60
                    ? "text-amber-600"
                    : "text-red-600"
              }`}
            >
              {securityScore}%
            </div>
          </div>

          <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all ${
                securityScore >= 80
                  ? "bg-emerald-500"
                  : securityScore >= 60
                    ? "bg-amber-500"
                    : "bg-red-500"
              }`}
              style={{ width: `${securityScore}%` }}
            />
          </div>
        </div>

        <SettingsPanel
          title="Authentication policy"
          description="Set the minimum security requirements for dashboard accounts."
        >
          <ToggleSetting
            title="Enforce strong passwords"
            description="Require passwords with a minimum length and a mixture of character types."
            checked={settings.enforceStrongPasswords}
            onChange={(checked) =>
              updateSetting(
                "enforceStrongPasswords",
                checked,
              )
            }
          />

          <ToggleSetting
            title="Require MFA for administrators"
            description="Require super administrators to complete an additional authentication step."
            checked={settings.requireMfaForAdmins}
            onChange={(checked) =>
              updateSetting("requireMfaForAdmins", checked)
            }
          />

          <ToggleSetting
            title="Log security events"
            description="Record sign-ins, failed authentication, role changes, and account suspensions."
            checked={settings.logSecurityEvents}
            onChange={(checked) =>
              updateSetting("logSecurityEvents", checked)
            }
          />
        </SettingsPanel>

        <SettingsPanel
          title="Session protection"
          description="Configure session expiration and failed sign-in protection."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <SelectField
              label="Session timeout"
              description="Automatically sign users out after inactivity."
              value={settings.sessionTimeoutMinutes}
              onChange={(value) =>
                updateSetting(
                  "sessionTimeoutMinutes",
                  Number(value),
                )
              }
            >
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={60}>1 hour</option>
              <option value={120}>2 hours</option>
              <option value={480}>8 hours</option>
            </SelectField>

            <SelectField
              label="Failed sign-in limit"
              description="Lock the account after this number of failed attempts."
              value={settings.lockoutAttempts}
              onChange={(value) =>
                updateSetting(
                  "lockoutAttempts",
                  Number(value),
                )
              }
            >
              <option value={3}>3 attempts</option>
              <option value={5}>5 attempts</option>
              <option value={10}>10 attempts</option>
            </SelectField>
          </div>

          <div className="mt-5 rounded border border-amber-200 bg-amber-50 px-4 py-3 text-[10px] leading-relaxed text-amber-800">
            The backend authentication middleware must enforce
            these policies. Saving this page alone does not
            terminate existing server sessions.
          </div>
        </SettingsPanel>
      </div>
    );
  }

  function renderDataSettings() {
    return (
      <div className="space-y-5">
        <SettingsPanel
          title="Data retention"
          description="Define how long research records remain available."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <TextField
              label="Retention period"
              description="Number of days records should be retained. Use 3650 for approximately ten years."
              type="number"
              value={settings.retentionDays}
              onChange={(value) =>
                updateSetting(
                  "retentionDays",
                  Math.max(0, Number(value) || 0),
                )
              }
            />

            <SelectField
              label="Default export format"
              description="Default file type for new research exports."
              value={settings.defaultExportFormat}
              onChange={(value) =>
                updateSetting(
                  "defaultExportFormat",
                  value as ExportFormat,
                )
              }
            >
              <option value="csv">CSV</option>
              <option value="xlsx">Excel XLSX</option>
              <option value="json">JSON</option>
            </SelectField>
          </div>
        </SettingsPanel>

        <SettingsPanel
          title="Export privacy"
          description="Protect participant information when datasets are exported."
        >
          <ToggleSetting
            title="Anonymize exports by default"
            description="Exclude direct participant identifiers from exported research datasets."
            checked={settings.anonymizeExports}
            onChange={(checked) =>
              updateSetting("anonymizeExports", checked)
            }
          />

          <ToggleSetting
            title="Require valid consent before export"
            description="Prevent participant records without completed consent from being included in exports."
            checked={settings.requireConsentForExport}
            onChange={(checked) =>
              updateSetting(
                "requireConsentForExport",
                checked,
              )
            }
          />

          <ToggleSetting
            title="Include audit metadata"
            description="Include export creator, creation date, filters, and dataset version in the export manifest."
            checked={settings.includeAuditMetadata}
            onChange={(checked) =>
              updateSetting(
                "includeAuditMetadata",
                checked,
              )
            }
          />

          <ToggleSetting
            title="Allow permanent participant deletion"
            description="Permit authorised administrators to permanently remove participant records."
            checked={settings.allowParticipantDeletion}
            onChange={(checked) =>
              updateSetting(
                "allowParticipantDeletion",
                checked,
              )
            }
          />
        </SettingsPanel>

        <SettingsPanel
          title="Configuration backup"
          description="Download a JSON copy of the current dashboard settings."
        >
          <button
            type="button"
            onClick={exportSettings}
            className="inline-flex items-center gap-2 rounded border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-muted"
          >
            <Download size={14} />
            Export settings
          </button>
        </SettingsPanel>
      </div>
    );
  }

  function renderActiveSection() {
    switch (activeSection) {
      case "access":
        return renderAccessSettings();

      case "general":
        return renderGeneralSettings();

      case "notifications":
        return renderNotificationSettings();

      case "security":
        return renderSecuritySettings();

      case "data":
        return renderDataSettings();

      default:
        return renderOverview();
    }
  }

  const currentNavigationItem =
    SETTINGS_NAVIGATION.find(
      (item) => item.id === activeSection,
    ) ?? SETTINGS_NAVIGATION[0];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 border-b border-border pb-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Settings2
              size={20}
              className="text-[#0d9488]"
            />

            <h1 className="text-lg font-semibold text-foreground">
              Platform Settings
            </h1>
          </div>

          <p className="mt-1 text-xs text-muted-foreground">
            Manage access, security, notifications, data policy,
            and platform configuration.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {saveMessage && (
            <span
              className={`text-xs font-medium ${
                saveMessage.includes("Could not")
                  ? "text-red-600"
                  : "text-emerald-600"
              }`}
            >
              {saveMessage}
            </span>
          )}

          <button
            type="button"
            onClick={resetSettings}
            className="inline-flex items-center gap-2 rounded border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-muted"
          >
            <RefreshCcw size={13} />
            Reset
          </button>

          <button
            type="button"
            onClick={saveSettings}
            disabled={!hasUnsavedChanges}
            className="inline-flex items-center gap-2 rounded bg-[#1d4ed8] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#1e40af] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save size={13} />
            {hasUnsavedChanges ? "Save Changes" : "Saved"}
          </button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[230px_minmax(0,1fr)]">
        <aside className="h-fit overflow-hidden rounded border border-border bg-card shadow-sm">
          <div className="border-b border-border px-4 py-3">
            <div className="text-xs font-semibold text-foreground">
              Settings
            </div>

            <div className="mt-0.5 text-[10px] text-muted-foreground">
              Platform administration
            </div>
          </div>

          <nav className="p-2">
            {SETTINGS_NAVIGATION.map(
              ({
                id,
                label,
                description,
                icon: Icon,
              }) => {
                const isActive = activeSection === id;

                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActiveSection(id)}
                    className={`mb-1 flex w-full items-center gap-3 rounded px-3 py-2.5 text-left transition last:mb-0 ${
                      isActive
                        ? "bg-[#0d9488]/10 text-[#0d9488]"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <Icon
                      size={15}
                      className="flex-shrink-0"
                    />

                    <span className="min-w-0">
                      <span className="block text-xs font-semibold">
                        {label}
                      </span>

                      <span className="mt-0.5 block truncate text-[9px] opacity-75">
                        {description}
                      </span>
                    </span>

                    {id === "access" &&
                      pendingRequests.length > 0 && (
                        <span className="ml-auto rounded-full bg-amber-100 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-amber-700">
                          {pendingRequests.length}
                        </span>
                      )}
                  </button>
                );
              },
            )}
          </nav>
        </aside>

        <main className="min-w-0">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-foreground">
              {currentNavigationItem.label}
            </h2>

            <p className="mt-0.5 text-xs text-muted-foreground">
              {currentNavigationItem.description}
            </p>
          </div>

          {renderActiveSection()}
        </main>
      </div>
    </div>
  );
}
