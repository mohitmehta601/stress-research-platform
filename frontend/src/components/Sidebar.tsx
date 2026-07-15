import { NavLink, useNavigate } from "react-router";
import {
  LayoutDashboard, Users, FlaskConical, Activity,
  ClipboardList, Stethoscope, Download, LogOut, FlaskRound, Settings
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
                  
export function Sidebar() {
  const navigate = useNavigate();

  function handleSignOut() {
    clearToken();
    navigate("/researcher/login");
  }

  return (
    <aside className="fixed top-0 left-0 h-screen w-60 flex flex-col z-20" style={{ background: "var(--sidebar)", borderRight: "1px solid var(--sidebar-border)" }}>
      {/* Brand */}
      <div className="px-5 py-5 border-b" style={{ borderColor: "var(--sidebar-border)" }}>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-[#0d9488] flex items-center justify-center flex-shrink-0">
            <FlaskRound size={14} className="text-white" />
          </div>
          <div>
            <div className="text-xs font-semibold text-white leading-tight">Stress Research</div>
            <div className="text-xs font-semibold text-white leading-tight">Platform</div>
          </div>
        </div>
        <div className="mt-2.5 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] font-medium" style={{ color: "rgba(226, 234, 244, 0.6)" }}>Study Active</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-3">
        <div className="text-[10px] font-semibold px-2 mb-1.5 uppercase tracking-widest" style={{ color: "rgba(226, 234, 244, 0.4)" }}>
          Research Modules
        </div>
        {NAV_ITEMS.map(({ path, label, icon: Icon, end }) => (
          <NavLink
            key={path}
            to={path}
            end={end}
            className={({ isActive }) => clsx(
              "flex items-center gap-2.5 px-2.5 py-2 rounded text-xs font-medium mb-0.5 transition-all group",
              isActive
                ? "bg-[#0d9488] text-white"
                : "text-[#a8bdd4] hover:bg-white/8 hover:text-white"
            )}
          >
            <Icon size={14} className="flex-shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Sign Out */}
      <div className="px-3 py-4 border-t" style={{ borderColor: "var(--sidebar-border)" }}>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2.5 px-2.5 py-2 rounded text-xs font-medium w-full text-left transition-all hover:bg-red-900/40 hover:text-red-300"
          style={{ color: "rgba(168, 189, 212, 0.7)" }}
        >
          <LogOut size={14} />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
