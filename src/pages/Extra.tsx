import { useMemo, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, ChevronDown, Globe, Lock, MonitorSmartphone, Smartphone, TrendingUp, Users, Zap } from "lucide-react";
import { isMember } from "../lib/perms";
import { useStore } from "../store/useStore";
import { Button, Chip, ConfirmCard, LinkButton, TextField, Toggle } from "./../components/ui/ui";
import { faqs } from "../data/mock";

/* ---------------- Activity ---------------- */
const TABS = [
  { id: "recent", label: "My Activity" },
  { id: "trending", label: "Trending" },
  { id: "community", label: "Community" },
] as const;

export function Activity() {
  const [params, setParams] = useSearchParams();
  const lobbyMap = useStore((s) => s.lobbies);
  const mine = useMemo(() => Object.values(lobbyMap).filter(isMember).sort((x, y) => y.createdAt - x.createdAt), [lobbyMap]);
  const tab = (TABS.find((t) => t.id === params.get("tab"))?.id ?? "recent") as (typeof TABS)[number]["id"];
  return (
    <div className="doc-wide">
      <div className="page-head">
        <div>
          <h1>Activity</h1>
          <p>What you and the community have been matching lately.</p>
        </div>
      </div>
      <div className="chips">
        {TABS.map((t) => (
          <Chip key={t.id} active={tab === t.id} onClick={() => setParams(t.id === "recent" ? {} : { tab: t.id })}>
            {t.label}
          </Chip>
        ))}
      </div>

      {tab === "recent" && (
        <div className="recents-card wide">
          {mine.length === 0 && <p className="empty pad">No lobbies yet — create one and it will show up here.</p>}
          {mine.map((l) => (
            <Link key={l.id} to={`/lobby/${l.id}`} className="recent-row">
              <span className="emoji-big sm" aria-hidden>
                {l.emoji}
              </span>
              <span className="recent-text">
                <strong>{l.name}</strong>
                <small>
                  {l.items.length} options • {l.members.length} {l.members.length === 1 ? "member" : "members"}
                </small>
              </span>
            </Link>
          ))}
        </div>
      )}

      {tab === "trending" && (
        <div className="stat-grid">
          {[
            ["Best Pizza in NY", "12.4k matches today"],
            ["Sunday Movie Night", "8.1k matches today"],
            ["Board Game Cafés", "5.9k matches today"],
            ["Late-night Ramen", "4.2k matches today"],
          ].map(([t, s], i) => (
            <div key={t} className={`tile ${i === 0 ? "tile-pink" : ""} tile-left`}>
              <TrendingUp size={22} className="accent" />
              <h3>{t}</h3>
              <p>{s}</p>
            </div>
          ))}
        </div>
      )}

      {tab === "community" && (
        <div className="stat-grid">
          {[
            [<Globe key="g" size={22} className="tile-globe" />, "2,403", "active sessions worldwide"],
            [<Users key="u" size={22} className="tile-globe" />, "48k", "friends matched this week"],
            [<Zap key="z" size={22} className="tile-globe" />, "91%", "of groups reach a decision"],
          ].map(([icon, n, s], i) => (
            <div key={i} className="tile tile-left">
              {icon}
              <h3>{n}</h3>
              <p>{s}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- Settings sub pages ---------------- */
function SubHead({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="page-head col">
      <Link to="/settings" className="back-link">
        <ArrowLeft size={15} /> Settings
      </Link>
      <h1>{title}</h1>
      <p>{sub}</p>
    </div>
  );
}

export function Security() {
  const settings = useStore((s) => s.settings);
  const setSetting = useStore((s) => s.setSetting);
  const toast = useStore((s) => s.toast);
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [conf, setConf] = useState("");
  const [err, setErr] = useState<Record<string, string>>({});
  const [ok, setOk] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const x: Record<string, string> = {};
    if (cur.length < 6) x.cur = "Enter your current password.";
    if (next.length < 8) x.next = "Use at least 8 characters.";
    else if (next === cur) x.next = "Choose a password you haven't used.";
    if (conf !== next) x.conf = "Passwords don't match.";
    setErr(x);
    if (Object.keys(x).length) return;
    setCur("");
    setNext("");
    setConf("");
    setOk(true);
  };

  return (
    <div className="doc">
      <SubHead title="Password & Security" sub="Keep your account safe with a strong password and two-factor sign-in." />
      <form className="card s-card stack" onSubmit={submit} noValidate>
        <div className="s-title"><span><Lock size={16} className="accent" /> Change password</span></div>
        <TextField label="Current password" toggleable value={cur} onChange={(e) => setCur(e.target.value)} error={err.cur} autoComplete="current-password" />
        <TextField label="New password" toggleable value={next} onChange={(e) => setNext(e.target.value)} error={err.next} autoComplete="new-password" />
        <TextField label="Confirm new password" toggleable value={conf} onChange={(e) => setConf(e.target.value)} error={err.conf} autoComplete="new-password" />
        <div><Button type="submit" pill>Update password</Button></div>
      </form>

      <section className="card s-card">
        <div className="pref">
          <div>
            <strong>Two-factor authentication</strong>
            <small>{settings.twoFactor ? "ON — CODE REQUIRED AT SIGN-IN" : "ADD AN EXTRA LAYER OF PROTECTION"}</small>
          </div>
          <Toggle
            checked={settings.twoFactor}
            onChange={(v) => {
              setSetting("twoFactor", v);
              toast(v ? "Two-factor enabled" : "Two-factor disabled", v ? "success" : "info");
            }}
            label="Two-factor authentication"
          />
        </div>
      </section>

      <section className="card s-card">
        <div className="s-title"><span><MonitorSmartphone size={16} className="accent" /> Signed-in devices</span></div>
        {[
          { icon: <MonitorSmartphone size={18} />, name: "This browser", meta: "ACTIVE NOW", here: true },
          { icon: <Smartphone size={18} />, name: "iPhone 15", meta: "LAST ACTIVE 2 DAYS AGO", here: false },
        ].map((d) => (
          <div key={d.name} className="s-row static">
            <span className="row-icon">{d.icon}</span>
            <span className="row-text"><strong>{d.name}</strong><small>{d.meta}</small></span>
            {!d.here && <button type="button" className="link-coral" onClick={() => toast("Device signed out", "info")}>Sign out</button>}
          </div>
        ))}
      </section>

      <ConfirmCard open={ok} onClose={() => setOk(false)} tone="success" title="Success!" text="Your password has been updated." confirmLabel="Done" cancelLabel={null} onConfirm={() => setOk(false)} />
    </div>
  );
}

export function Visibility() {
  const settings = useStore((s) => s.settings);
  const setSetting = useStore((s) => s.setSetting);
  const toast = useStore((s) => s.toast);
  const opts = [
    { id: "everyone", t: "Everyone", s: "Anyone on Matchup can see your polls and groups." },
    { id: "friends", t: "Friends only", s: "Only people you've matched with." },
    { id: "me", t: "Only me", s: "Your activity stays private." },
  ] as const;
  return (
    <div className="doc">
      <SubHead title="Profile Visibility" sub="Choose who can see your polls, groups and activity." />
      <section className="card s-card" role="radiogroup" aria-label="Profile visibility">
        {opts.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={settings.visibility === o.id}
            className={`radio-row ${settings.visibility === o.id ? "on" : ""}`}
            onClick={() => {
              setSetting("visibility", o.id);
              toast("Changes Saved");
            }}
          >
            <span className="radio-dot" />
            <span className="row-text"><strong>{o.t}</strong><small>{o.s}</small></span>
          </button>
        ))}
      </section>
      <section className="card s-card">
        <div className="pref">
          <div><strong>Show activity status</strong><small>LET FRIENDS SEE WHEN YOU'RE IN A LOBBY</small></div>
          <Toggle checked={settings.showActivity} onChange={(v) => setSetting("showActivity", v)} label="Show activity status" />
        </div>
        <div className="pref">
          <div><strong>Appear in search</strong><small>ALLOW PEOPLE TO FIND YOU BY NAME</small></div>
          <Toggle checked={settings.discoverable} onChange={(v) => setSetting("discoverable", v)} label="Appear in search" />
        </div>
      </section>
    </div>
  );
}

/* ---------------- Info pages ---------------- */
export function About() {
  return (
    <div className="doc">
      <div className="page-head col center">
        <span className="pill pill-yellow pill-lg">ABOUT US</span>
        <h1>
          Deciding together should be <span className="accent">fun.</span>
        </h1>
        <p>Matchup turns "I don't know, what do you want?" into a two-minute game your whole group actually enjoys.</p>
      </div>
      <div className="feature-grid">
        {[
          ["Real-time lobbies", "Everyone joins the same lobby, adds their favorite options and locks in when they're ready."],
          ["Swipe to decide", "Vote yes or pass on each option. No long threads, no endless \"anything is fine\"."],
          ["A match everyone loves", "We reveal the option the group liked most, with the numbers to back it up."],
        ].map(([t, s]) => (
          <div key={t} className="tile tile-left">
            <h3>{t}</h3>
            <p>{s}</p>
          </div>
        ))}
      </div>
      <div className="center-actions">
        <LinkButton to="/join" pill size="lg">Try a session <Zap size={16} /></LinkButton>
      </div>
    </div>
  );
}

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="doc">
      <div className="page-head col">
        <h1>Frequently Asked Questions</h1>
        <p>Quick answers about lobbies, voting and your account.</p>
      </div>
      <div className="faq">
        {faqs.map((f, i) => (
          <div key={f.q} className={`faq-item ${open === i ? "open" : ""}`}>
            <button type="button" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
              {f.q}
              <ChevronDown size={18} />
            </button>
            {open === i && <p>{f.a}</p>}
          </div>
        ))}
      </div>
      <p className="doc-foot">
        Still stuck? <Link to="/support">Contact support</Link>
      </p>
    </div>
  );
}

export function Privacy() {
  const sections = [
    ["What we collect", "Your name, email address and the options and votes you submit inside lobbies. We never sell your data."],
    ["How we use it", "To run your sessions, show your friends who is ready, and reveal each group's match. Aggregated, anonymous trends power the Trending tab."],
    ["Your controls", "You decide who can see your profile in Settings → Profile Visibility, and you can delete your account and data at any time."],
    ["Cookies & storage", "Matchup stores your theme, preferences and session progress in your browser so the app feels instant."],
    ["Questions", "Reach out through the Contact Support page and we'll get back within one business day."],
  ];
  return (
    <div className="doc">
      <div className="page-head col">
        <h1>Privacy Policy</h1>
        <p>Last updated January 2026</p>
      </div>
      <div className="card s-card prose">
        {sections.map(([h, p]) => (
          <section key={h}>
            <h3>{h}</h3>
            <p>{p}</p>
          </section>
        ))}
      </div>
    </div>
  );
}

export function Support() {
  const user = useStore((s) => s.user);
  const [subject, setSubject] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const x: Record<string, string> = {};
    if (subject.trim().length < 3) x.subject = "Add a short subject.";
    if (msg.trim().length < 10) x.msg = "Tell us a little more (10+ characters).";
    setErr(x);
    if (Object.keys(x).length) return;
    setSubject("");
    setMsg("");
    setSent(true);
  };
  return (
    <div className="doc">
      <div className="page-head col">
        <Link to="/settings" className="back-link"><ArrowLeft size={15} /> Settings</Link>
        <h1>Contact Support</h1>
        <p>Our team is here 24/7. {user ? `We'll reply to ${user.email}.` : ""}</p>
      </div>
      <form className="card s-card stack" onSubmit={submit} noValidate>
        <TextField label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} error={err.subject} />
        <div className={`field ${err.msg ? "has-error" : ""}`}>
          <div className="field-head"><label htmlFor="msg">Message</label></div>
          <div className="field-control area"><textarea id="msg" rows={5} value={msg} onChange={(e) => setMsg(e.target.value)} /></div>
          {err.msg && <p className="field-error" role="alert">{err.msg}</p>}
        </div>
        <div><Button type="submit" pill>Send message</Button></div>
      </form>
      <ConfirmCard open={sent} onClose={() => setSent(false)} tone="success" title="Success!" text="Message sent. We'll be in touch shortly." confirmLabel="Done" cancelLabel={null} onConfirm={() => setSent(false)} />
    </div>
  );
}

export function NotFound() {
  return (
    <div className="doc">
      <div className="page-head col center">
        <span className="pill pill-yellow pill-lg">404</span>
        <h1>This page didn't match</h1>
        <p>The link may be broken or the page may have moved.</p>
        <LinkButton to="/" pill size="lg">Back home</LinkButton>
      </div>
    </div>
  );
}
