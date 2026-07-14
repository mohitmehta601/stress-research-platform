import { clsx } from "clsx";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon?: LucideIcon;
  iconColor?: string;
  trend?: "up" | "down" | "neutral";
  highlight?: boolean;
  className?: string;                     
}

export function StatCard({ label, value, sub, icon: Icon, iconColor = "text-blue-600", highlight, className }: StatCardProps) {
  return (
    <div className={clsx(
      "bg-card rounded border border-border p-4 flex flex-col gap-2 shadow-sm hover:shadow-md transition-shadow",
      highlight && "border-l-4 border-l-[#0d9488]",
      className
    )}>
      <div className="flex items-start justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">{label}</span>
        {Icon && (
          <span className={clsx("p-1.5 rounded bg-muted", iconColor)}>
            <Icon size={14} />
          </span>
        )}
      </div>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-semibold text-foreground font-mono tabular-nums">{value}</span>
        {sub && <span className="text-xs text-muted-foreground mb-0.5">{sub}</span>}
      </div>
    </div>
  );
}
