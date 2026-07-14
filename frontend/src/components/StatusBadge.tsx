import { clsx } from "clsx";

type Variant = "success" | "warning" | "error" | "info" | "neutral" | "purple";

const VARIANT_CLASSES: Record<Variant, string> = {
  success: "bg-emerald-50 text-emerald-700 border-emerald-200",
  warning: "bg-amber-50 text-amber-700 border-amber-200",
  error: "bg-red-50 text-red-700 border-red-200",
  info: "bg-blue-50 text-blue-700 border-blue-200",
  neutral: "bg-slate-100 text-slate-600 border-slate-200",
  purple: "bg-violet-50 text-violet-700 border-violet-200",
};

interface StatusBadgeProps {                    
  label: string;
  variant: Variant;
  dot?: boolean;
  className?: string;
}

export function StatusBadge({ label, variant, dot = false, className }: StatusBadgeProps) {
  return (
    <span className={clsx(
      "inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-medium tracking-wide font-mono",
      VARIANT_CLASSES[variant],
      className
    )}>
      {dot && (
        <span className={clsx("w-1.5 h-1.5 rounded-full", {
          "bg-emerald-500": variant === "success",
          "bg-amber-500": variant === "warning",
          "bg-red-500": variant === "error",
          "bg-blue-500": variant === "info",
          "bg-slate-400": variant === "neutral",
          "bg-violet-500": variant === "purple",
        })} />
      )}
      {label}
    </span>
  );
}

export function sessionStatusBadge(status: string) {
  const map: Record<string, { label: string; variant: Variant }> = {
    "completed": { label: "Completed", variant: "success" },
    "in-progress": { label: "In Progress", variant: "info" },
    "pending-review": { label: "Pending Review", variant: "warning" },
    "incomplete": { label: "Incomplete", variant: "error" },
  };
  const cfg = map[status] ?? { label: status, variant: "neutral" as Variant };
  return <StatusBadge label={cfg.label} variant={cfg.variant} dot />;
}

export function consentBadge(status: string) {
  const map: Record<string, { label: string; variant: Variant }> = {
    "accepted": { label: "Consented", variant: "success" },
    "rejected": { label: "Rejected", variant: "error" },
    "pending": { label: "Pending", variant: "warning" },
  };
  const cfg = map[status] ?? { label: status, variant: "neutral" as Variant };
  return <StatusBadge label={cfg.label} variant={cfg.variant} dot />;
}

export function qualityBadge(quality: string | null) {
  if (!quality) return <StatusBadge label="Missing" variant="error" />;
  const map: Record<string, { label: string; variant: Variant }> = {
    "good": { label: "Good", variant: "success" },
    "moderate": { label: "Moderate", variant: "warning" },
    "poor": { label: "Poor", variant: "error" },
  };
  const cfg = map[quality] ?? { label: quality, variant: "neutral" as Variant };
  return <StatusBadge label={cfg.label} variant={cfg.variant} />;
}

export function assessmentBadge(status: string) {
  const map: Record<string, { label: string; variant: Variant }> = {
    "completed": { label: "Completed", variant: "success" },
    "pending": { label: "Pending", variant: "warning" },
    "not-required": { label: "N/A", variant: "neutral" },
  };
  const cfg = map[status] ?? { label: status, variant: "neutral" as Variant };
  return <StatusBadge label={cfg.label} variant={cfg.variant} dot />;
}

export function stressLabelBadge(label: string | null) {
  if (!label) return <StatusBadge label="—" variant="neutral" />;
  const map: Record<string, { variant: Variant }> = {
    "low": { variant: "success" },
    "moderate": { variant: "warning" },
    "high": { variant: "error" },
    "severe": { variant: "purple" },
  };
  const cfg = map[label] ?? { variant: "neutral" as Variant };
  return <StatusBadge label={label.charAt(0).toUpperCase() + label.slice(1)} variant={cfg.variant} />;
}

export function conditionBadge(condition: "relaxed" | "stress") {
  return (
    <StatusBadge
      label={condition === "relaxed" ? "Relaxed" : "Stress"}
      variant={condition === "relaxed" ? "info" : "warning"}
    />
  );
}

export function booleanBadge(value: boolean, trueLabel = "Yes", falseLabel = "Missing") {
  return value
    ? <StatusBadge label={trueLabel} variant="success" />
    : <StatusBadge label={falseLabel} variant="error" />;
}
