import { useEffect } from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { useStore } from "./store/useStore";
import { AppShell } from "./components/layout/Layout";
import { Login, Signup } from "./pages/Auth";
import { Home } from "./pages/Home";
import { Invite, Join } from "./pages/Join";
import { LobbyPage } from "./pages/Lobby";
import { Customize } from "./pages/Customize";
import { Result, Vote } from "./pages/Vote";
import { Notifications } from "./pages/Notifications";
import { Settings } from "./pages/Settings";
import { About, Activity, Faq, Groups, NotFound, Privacy, Security, Support, Visibility } from "./pages/Extra";

function RequireAuth() {
  const user = useStore((s) => s.user);
  const loc = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />;
  return <Outlet />;
}

function ThemeSync() {
  const theme = useStore((s) => s.theme);
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#15130f" : "#B12B37");
  }, [theme]);
  return null;
}

/** Home is the only screen with the floating theme toggle, as in the design. */
function HomeShell() {
  return (
    <AppShell themeToggle>
      <Home />
    </AppShell>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeSync />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        <Route element={<RequireAuth />}>
          <Route path="/" element={<HomeShell />} />
          <Route element={<AppShell />}>
            <Route path="/join" element={<Join />} />
            <Route path="/join/:id" element={<Invite />} />
            <Route path="/groups" element={<Groups />} />
            <Route path="/lobby/:id" element={<LobbyPage />} />
            <Route path="/lobby/:id/customize" element={<Customize />} />
            <Route path="/session/:id/vote" element={<Vote />} />
            <Route path="/session/:id/result" element={<Result />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/settings/security" element={<Security />} />
            <Route path="/settings/visibility" element={<Visibility />} />
            <Route path="/activity" element={<Activity />} />
          </Route>
        </Route>

        <Route element={<AppShell />}>
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
