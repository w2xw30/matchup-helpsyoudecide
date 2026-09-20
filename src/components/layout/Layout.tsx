import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Bell, Compass, Globe, LogOut, Mail, Moon, Settings, Share2, Sun, UserRound, Users } from "lucide-react";
import { useStore } from "../../store/useStore";
import { useUI } from "../../store/ui";
import { Avatar, ConfirmCard, LinkButton, ToastHost } from "../ui/ui";

const homeish = (p: string) => p === "/" || p.startsWith("/join") && !/^\/join\/.+/.test(p) || p.startsWith("/activity");
const groupish = (p: string) =>
  p.startsWith("/groups") || p.startsWith("/lobby") || p.startsWith("/session") || /^\/join\/.+/.test(p);

export function Navbar({ themeToggle }: { themeToggle?: boolean }) {
  const { pathname } = useLocation();
  const user = useStore((s) => s.user);
  const unread = useStore((s) => s.notifs.some((n) => !n.read));
  const theme = useStore((s) => s.theme);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const setLogoutOpen = useUI((s) => s.setLogoutOpen);
  const [menuAt, setMenuAt] = useState<string | null>(null);
  const menu = menuAt === pathname;
  const setMenu = (v: boolean | ((m: boolean) => boolean)) => setMenuAt((cur) => ((typeof v === "function" ? v(cur === pathname) : v) ? pathname : null));
  const menuRef = useRef<HTMLDivElement>(null);
  const nav = useNavigate();

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuAt(null);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setMenuAt(null);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [menu]);

  return (
    <header className="nav-wrap">
      <nav className="nav" aria-label="Main">
        <Link to="/" className="nav-logo">
          Matchup
        </Link>
        <div className="nav-tabs">
          <Link to="/" className={`nav-tab ${homeish(pathname) ? "active" : ""}`}>
            Home
          </Link>
          <Link to="/groups" className={`nav-tab ${groupish(pathname) ? "active" : ""}`}>
            Groups
          </Link>
        </div>
        <div className="nav-right">
          {user ? (
            <>
              <Link to="/notifications" className="nav-bell" aria-label={unread ? "Notifications (unread)" : "Notifications"}>
                <Bell size={18} />
                {unread && <span className="nav-bell-dot" />}
              </Link>
              <div className="nav-user" ref={menuRef}>
                <button type="button" className="nav-avatar" onClick={() => setMenu((m) => !m)} aria-haspopup="menu" aria-expanded={menu} aria-label="Account menu">
                  <Avatar src={user.avatar} name={user.name} size={32} />
                </button>
                {menu && (
                  <div className="menu" role="menu">
                    <div className="menu-head">
                      <strong>{user.name}</strong>
                      <span>{user.email}</span>
                    </div>
                    <button role="menuitem" onClick={() => nav("/settings")}>
                      <Settings size={16} /> Settings
                    </button>
                    <button role="menuitem" onClick={() => nav("/notifications")}>
                      <Bell size={16} /> Notifications
                    </button>
                    <button role="menuitem" onClick={toggleTheme}>
                      {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />} {theme === "dark" ? "Light" : "Dark"} mode
                    </button>
                    <button
                      role="menuitem"
                      className="danger"
                      onClick={() => {
                        setMenu(false);
                        setLogoutOpen(true);
                      }}
                    >
                      <LogOut size={16} /> Logout
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <LinkButton to="/login" size="sm" pill>
              Log in
            </LinkButton>
          )}
        </div>
      </nav>
      {themeToggle && (
        <button type="button" className="theme-toggle" onClick={toggleTheme} aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      )}
    </header>
  );
}

export function Footer() {
  const toast = useStore((s) => s.toast);
  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin);
    } catch {
      /* clipboard may be blocked */
    }
    toast("Link copied to clipboard!");
  };
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-cols">
          <div>
            <h4 className="footer-title">About Matchup</h4>
            <p className="footer-text">
              Matchup is the ultimate platform for real-time group engagement. We bring people together through interactive polls, high-stakes trivia, and shared experiences designed to spark connection.
            </p>
          </div>
          <div>
            <h5 className="footer-head">Navigation</h5>
            <ul className="footer-links">
              <li><Link to="/">Home</Link></li>
              <li><Link to="/about">About</Link></li>
              <li><Link to="/faq">FAQ</Link></li>
              <li><Link to="/privacy">Privacy Policy</Link></li>
            </ul>
          </div>
          <div>
            <h5 className="footer-head">Connect</h5>
            <div className="footer-icons">
              <button type="button" onClick={share} aria-label="Copy site link"><Share2 size={17} /></button>
              <Link to="/about" aria-label="About Matchup"><Globe size={17} /></Link>
              <Link to="/support" aria-label="Contact support"><Mail size={17} /></Link>
            </div>
            <p className="footer-made">
              Made with <span aria-label="love">❤️</span> for groups
            </p>
          </div>
        </div>
        <p className="footer-copy">© 2026 MATCHUP INC. ALL RIGHTS RESERVED.</p>
      </div>
    </footer>
  );
}

export function BottomNav() {
  const { pathname } = useLocation();
  const items = [
    { to: "/", label: "Discover", icon: <Compass size={20} />, on: homeish(pathname) },
    { to: "/groups", label: "Sessions", icon: <Users size={20} />, on: groupish(pathname) },
    { to: "/notifications", label: "Alerts", icon: <Bell size={20} />, on: pathname.startsWith("/notifications") },
    { to: "/settings", label: "Profile", icon: <UserRound size={20} />, on: pathname.startsWith("/settings") },
  ];
  return (
    <nav className="bottom-nav" aria-label="Primary">
      {items.map((i) => (
        <NavLink key={i.to} to={i.to} className={i.on ? "active" : ""}>
          <span className="bn-icon">{i.icon}</span>
          {i.label}
        </NavLink>
      ))}
    </nav>
  );
}

export function LogoutHost() {
  const open = useUI((s) => s.logoutOpen);
  const setOpen = useUI((s) => s.setLogoutOpen);
  const logout = useStore((s) => s.logout);
  const nav = useNavigate();
  return (
    <ConfirmCard
      open={open}
      onClose={() => setOpen(false)}
      title="Warning!"
      text="Are you sure you want to logout?"
      confirmLabel="Logout"
      onConfirm={() => {
        setOpen(false);
        logout();
        nav("/login");
      }}
    />
  );
}

/** Standard page chrome: floating navbar, content, footer, mobile bottom nav. */
export function AppShell({ children, themeToggle, wide }: { children?: ReactNode; themeToggle?: boolean; wide?: boolean }) {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return (
    <div className="page">
      <Navbar themeToggle={themeToggle} />
      <main className={`page-main ${wide ? "wide" : ""}`}>{children ?? <Outlet />}</main>
      <Footer />
      <BottomNav />
      <LogoutHost />
      <ToastHost />
    </div>
  );
}

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="auth-page">
      {children}
      <ToastHost />
    </div>
  );
}
