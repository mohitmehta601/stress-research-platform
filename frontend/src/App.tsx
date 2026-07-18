import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { canAccessDashboard } from "./lib/routeAuthorization";
import { DashboardLayout } from "./components/DashboardLayout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Participants from "./pages/Participants";
import Sessions from "./pages/Sessions";
import Physiological from "./pages/Physiological";
import Questionnaires from "./pages/Questionnaires";
import Doctor from "./pages/Doctor";
import Export from "./pages/Export";
import Settings from "./pages/Settings";

function LoadingScreen({ label }: { label: string }) {
  return <div className="min-h-screen bg-background flex items-center justify-center text-sm text-muted-foreground">{label}</div>;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { checking, isAuthenticated, user } = useAuth();

  if (checking) {
    return <LoadingScreen label="Checking session..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/researcher/login" state={{ from: location }} replace />;
  }

  if (!user || !canAccessDashboard(user.role)) {
    return <LoadingScreen label="Opening dashboard..." />;
  }

  return <>{children}</>;
}

function LoginRoute() {
  const { checking, isAuthenticated, user } = useAuth();

  if (checking) {
    return <LoadingScreen label="Checking session..." />;
  }

  if (isAuthenticated && user && canAccessDashboard(user.role)) {
    return <Navigate to="/researcher" replace />;
  }

  return <Login />;
}

function DashboardShell() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/researcher/login" element={<LoginRoute />} />
      <Route
        path="/researcher"
        element={
          <ProtectedRoute>
            <DashboardLayout user={user ?? undefined} />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="participants" element={<Participants />} />
        <Route path="sessions" element={<Sessions />} />
        <Route path="physiological" element={<Physiological />} />
        <Route path="questionnaires" element={<Questionnaires />} />
        <Route path="doctor" element={<Doctor />} />
        <Route path="export" element={<Export />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/researcher/login" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-right" toastOptions={{ style: { fontSize: "12px" } }} />
        <DashboardShell />
      </AuthProvider>
    </BrowserRouter>
  );
}
