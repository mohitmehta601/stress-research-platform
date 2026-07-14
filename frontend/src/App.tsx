import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router";
import { useEffect, useState } from "react";
import { Toaster } from "sonner";
import { getToken, getCurrentUser, getCachedUser } from "./services/apiClient";
import type { AuthUser } from "./types";
import { Layout } from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Participants from "./pages/Participants";
import Sessions from "./pages/Sessions";
import Physiological from "./pages/Physiological";
import Questionnaires from "./pages/Questionnaires";
import Doctor from "./pages/Doctor";
import Export from "./pages/Export";
import Settings from "./pages/Settings";

function ProtectedRoute({ children, user, checking }: { children: React.ReactNode; user: AuthUser | null; checking: boolean }) {
  const location = useLocation();
  if (checking) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-sm text-muted-foreground">Checking session...</div>;
  }
  if (!getToken()) {
    return <Navigate to="/researcher/login" state={{ from: location }} replace />;
  }
  if (!user) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-sm text-muted-foreground">Opening dashboard...</div>;
  }
  return <>{children}</>;
}

function LoginRoute({ user, checking }: { user: AuthUser | null; checking: boolean }) {
  if (checking) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-sm text-muted-foreground">Checking session...</div>;
  }
  if (user || getToken()) return <Navigate to="/researcher" replace />;
  return <Login />;
}

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const check = () => {
      setChecking(true);
      if (getToken()) {
        const cachedUser = getCachedUser();
        if (cachedUser) {
          setUser(cachedUser);
          setChecking(false);
          return;
        }
        getCurrentUser().then(setUser).catch(() => setUser(null)).finally(() => setChecking(false));
      } else {
        setUser(null);
        setChecking(false);
      }
    };
    check();
    window.addEventListener("srp-auth-changed", check);
    return () => window.removeEventListener("srp-auth-changed", check);
  }, []);

  return (
    <BrowserRouter>
      <Toaster position="top-right" toastOptions={{ style: { fontSize: "12px" } }} />
      <Routes>
        <Route path="/researcher/login" element={<LoginRoute user={user} checking={checking} />} />
        <Route
          path="/researcher"
          element={
            <ProtectedRoute user={user} checking={checking}>
              <Layout user={user ?? undefined} />
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
    </BrowserRouter>
  );
}
