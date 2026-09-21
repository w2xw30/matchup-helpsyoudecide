import { useEffect, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useStore } from "./store/useStore";
import { IS_BACKEND } from "./backend/config";
import { bootBackend } from "./backend/sync";
import { useBackend } from "./backend/status";
import { startWatchers } from "./lib/events";
import { Button } from "./components/ui/ui";
import { AppShell } from "./components/layout/Layout";
import { Login, Signup } from "./pages/Auth";
import { Home } from "./pages/Home";
import { Invite, Join } from "./pages/Join";
import { CreateLobby } from "./pages/Create";
import { LobbyPage } from "./pages/Lobby";
import { Customize } from "./pages/Customize";
import { Vote } from "./pages/Vote";
import { Result } from "./pages/Result";
import { Notifications } from "./pages/Notifications";
import { Settings } from "./pages/Settings";
import { Groups } from "./pages/Groups";
import { About, Activity, Faq, NotFound, Privacy, Security, Support, Visibility } from "./pages/Extra";

function ThemeSync() {
  const theme = useStore((s) => s.theme);
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#15130f" : "#B12B37");
  }, [theme]);
  return null;
}

/** Pages that only make sense for a real account (password, etc.) send guests to log in first. */
function AccountOnly({ children }: { children: ReactNode }) {
  const guest = useStore((s) => s.user.guest);
  const loc = useLocation();
  if (guest) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return <>{children}</>;
}

/** Online mode: sign in as a guest and load data before showing the app. Local mode renders straight away. */
function BootGate({ children }: { children: ReactNode }) {
  const phase = useBackend((s) => s.phase);
  const error = useBackend((s) => s.error);
  useEffect(() => {
    void bootBackend();
    return startWatchers();
  }, []);
  if (!IS_BACKEND || phase === "ready") return <>{children}</>;
  return (
    <div className="boot">
      {phase === "error" ? (
        <div className="boot-card">
          <h1>Can't reach the backend</h1>
          <p>{error}</p>
          <Button pill onClick={() => void bootBackend(true)}>
            Try again
          </Button>
          <small>Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, and that schema.sql was run. See docs/BACKEND_SETUP.md.</small>
        </div>
      ) : (
        <div className="boot-card" role="status">
          <span className="boot-spin" aria-hidden />
          <p>Connecting…</p>
        </div>
      )}
    </div>
  );
}

/** After a password-reset email link, send the person to set a new password. */
function RecoveryRedirect() {
  const recovery = useBackend((s) => s.recovery);
  const nav = useNavigate();
  useEffect(() => {
    if (recovery) nav("/settings/security", { replace: true });
  }, [recovery, nav]);
  return null;
}

/**
 * Everything is open: people can land on Home, hop into a lobby and leave without an account.
 * Logging in is optional and only adds a name/profile (and, once there's a backend, sync across devices).
 */
export default function App() {
  return (
    <BrowserRouter>
      <ThemeSync />
      <BootGate>
        <RecoveryRedirect />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        <Route element={<AppShell />}>
          <Route path="/" element={<Home />} />
          <Route path="/lobby/new" element={<CreateLobby />} />
          <Route path="/join" element={<Join />} />
          <Route path="/join/:id" element={<Invite />} />
          <Route path="/groups" element={<Groups />} />
          <Route path="/lobby/:id" element={<LobbyPage />} />
          <Route path="/lobby/:id/customize" element={<Customize />} />
          <Route path="/session/:id/vote" element={<Vote />} />
          <Route path="/session/:id/result" element={<Result />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/settings" element={<Settings />} />
          <Route
            path="/settings/security"
            element={
              <AccountOnly>
                <Security />
              </AccountOnly>
            }
          />
          <Route path="/settings/visibility" element={<Visibility />} />
          <Route path="/activity" element={<Activity />} />
          <Route path="/about" element={<About />} />
          <Route path="/faq" element={<Faq />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/support" element={<Support />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
      </BootGate>
    </BrowserRouter>
  );
}
