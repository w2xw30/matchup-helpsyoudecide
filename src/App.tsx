import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useStore } from "./store/useStore";
import { AppShell } from "./components/layout/Layout";
import { Login, Signup } from "./pages/Auth";
import { Home } from "./pages/Home";
import { Invite, Join } from "./pages/Join";
import { CreateLobby } from "./pages/Create";
import { LobbyPage } from "./pages/Lobby";
import { Customize } from "./pages/Customize";
import { Result, Vote } from "./pages/Vote";
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
function AccountOnly({ children }: { children: React.ReactNode }) {
  const guest = useStore((s) => s.user.guest);
  const loc = useLocation();
  if (guest) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return <>{children}</>;
}

/**
 * Everything is open: people can land on Home, hop into a lobby and leave without an account.
 * Logging in is optional and only adds a name/profile (and, once there's a backend, sync across devices).
 */
export default function App() {
  return (
    <BrowserRouter>
      <ThemeSync />
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
    </BrowserRouter>
  );
}
