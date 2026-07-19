import { NavLink, useNavigate } from "react-router";
import {
  Activity,
  ClipboardList,
  Download,
  FlaskConical,
  FlaskRound,
  LayoutDashboard,
  LogOut,
  Settings,
  Stethoscope,
  Users,
  X,
} from "lucide-react";
import { clsx } from "clsx";
import { clearToken } from "../services/apiClient";

const NAV_ITEMS = [
  { path: "/researcher", label: "Dashboard", icon: LayoutDashboard, end: true },
  { path: "/researcher/participants", label: "Participants", icon: Users },
  { path: "/researcher/sessions", label: "Research Sessions", icon: FlaskConical },
  { path: "/researcher/physiological", label: "Physiological Data", icon: Activity },
  { path: "/researcher/questionnaires", label: "Questionnaires", icon: ClipboardList },
  { path: "/researcher/doctor", label: "Doctor Assessments", icon: Stethoscope },
  { path: "/researcher/export", label: "Dataset Export", icon: Download },
  { path: "/researcher/settings", label: "Settings & Access", icon: Settings },
];

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const navigate = useNavigate();

  function handleSignOut() {
    clearToken();
    navigate("/researcher/login");
    onNavigate?.();
  }

  return (
    <>
      <div className="border-b px-5 py-5" style={{ borderColor: "var(--sidebar-border)" }}>
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-[#0d9488]">
            <FlaskRound size={14} className="text-white" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold leading-tight text-white">Stress Research</div>
            <div className="text-xs font-semibold leading-tight text-white">Platform</div>
          </div>
        </div>
        <div className="mt-2.5 flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] font-medium" style={{ color: "rgba(226, 234, 244, 0.6)" }}>Study Active</span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-3">
        <div className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "rgba(226, 234, 244, 0.4)" }}>
          Research Modules
        </div>
        {NAV_ITEMS.map(({ path, label, icon: Icon, end }) => (
          <NavLink
            key={path}
            to={path}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) => clsx(
              "mb-0.5 flex items-center gap-2.5 rounded px-2.5 py-2 text-xs font-medium transition-all group",
              isActive
                ? "bg-[#0d9488] text-white"
                : "text-[#a8bdd4] hover:bg-white/10 hover:text-white",
            )}
          >
            <Icon size={14} className="flex-shrink-0" />
            <span className="truncate">{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="border-t px-3 py-4" style={{ borderColor: "var(--sidebar-border)" }}>
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-2.5 rounded px-2.5 py-2 text-left text-xs font-medium transition-all hover:bg-red-900/40 hover:text-red-300"
          style={{ color: "rgba(168, 189, 212, 0.7)" }}
        >
          <LogOut size={14} />
          Sign Out
        </button>
      </div>
    </>
  );
}

export function Sidebar({ open = false, onClose }: SidebarProps) {
  return (
    <>
      <aside className="fixed left-0 top-0 z-20 hidden h-screen w-60 flex-col lg:flex" style={{ background: "var(--sidebar)", borderRight: "1px solid var(--sidebar-border)" }}>
        <SidebarContent />
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-black/45"
            onClick={onClose}
          />
          <aside className="relative flex h-full w-[min(18rem,86vw)] flex-col shadow-2xl" style={{ background: "var(--sidebar)", borderRight: "1px solid var(--sidebar-border)" }}>
            <button
              type="button"
              aria-label="Close navigation"
              onClick={onClose}
              className="absolute right-3 top-3 rounded p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
            >
              <X size={18} />
            </button>
            <SidebarContent onNavigate={onClose} />
          </aside>
        </div>
      )}
    </>
  );
}
