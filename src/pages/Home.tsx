import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronRight, Globe, History, MoreHorizontal, Plus, TrendingUp, X, Zap } from "lucide-react";
import { templates, type Template } from "../data/mock";
import { isMember } from "../lib/perms";
import { useStore } from "../store/useStore";
import { LinkButton } from "../components/ui/ui";

function TemplateCard({ tpl }: { tpl: Template }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const nav = useNavigate();
  const hide = useStore((s) => s.hideTemplate);
  const toast = useStore((s) => s.toast);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const start = () => nav(`/lobby/new?template=${tpl.id}`);

  return (
    <article className="tpl-card">
      <div className="tpl-top">
        <span className={`pill pill-${tpl.tagTone}`}>{tpl.tag}</span>
        <div className="tpl-more" ref={ref}>
          <button type="button" aria-label={`${tpl.title} options`} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            <MoreHorizontal size={18} />
          </button>
          {open && (
            <div className="menu menu-sm" role="menu">
              <button role="menuitem" onClick={start}>Use template</button>
              <button
                role="menuitem"
                onClick={() => {
                  hide(tpl.id);
                  toast("Template hidden", "info");
                }}
              >
                Hide template
              </button>
            </div>
          )}
        </div>
      </div>
      <h3>{tpl.title}</h3>
      <p>{tpl.blurb}</p>
      <button type="button" className="tpl-create" onClick={start}>
        Create
      </button>
    </article>
  );
}

export function Home() {
  const hidden = useStore((s) => s.hiddenTemplates);
  const nav = useNavigate();
  const shown = templates.filter((t) => !hidden.includes(t.id));
  const lobbyMap = useStore((s) => s.lobbies);
  const mine = useMemo(() => Object.values(lobbyMap).filter(isMember).sort((a, b) => b.createdAt - a.createdAt), [lobbyMap]);
  const resume = mine[0];
  const introDismissed = useStore((s) => s.introDismissed);
  const dismissIntro = useStore((s) => s.dismissIntro);

  return (
    <div className="home">
      <section className="hero-card">
        <h1>
          Ready for the next <span className="accent">Matchup?</span>
        </h1>
        <p>Gather your crew, set the stakes, and dive into a high-energy session designed for real-time connection.</p>
        <LinkButton to="/join" size="xl" className="hero-cta">
          Join Session <Zap size={17} />
        </LinkButton>
        <Link to="/lobby/new" className="hero-create">
          <Plus size={15} /> or create your own lobby
        </Link>
        {resume && (
          <Link to={`/lobby/${resume.id}`} className="hero-resume">
            <span className="emoji-big sm" aria-hidden>
              {resume.emoji}
            </span>
            <span className="hero-resume-text">
              <small>PICK UP WHERE YOU LEFT OFF</small>
              <strong>{resume.name}</strong>
            </span>
            <ChevronRight size={16} />
          </Link>
        )}
      </section>

      {!introDismissed && (
        <section className="how" aria-labelledby="how-h">
          <h2 id="how-h">How Matchup works</h2>
          <div className="how-steps">
            <div className="how-step">
              <span className="how-n">1</span>
              <div>
                <strong>Create a lobby</strong>
                <p>Name it and say what you're deciding — dinner, a movie, a game night.</p>
              </div>
            </div>
            <div className="how-step">
              <span className="how-n">2</span>
              <div>
                <strong>Invite your people</strong>
                <p>Share a link, a 6-digit code or a QR code. No account needed to join.</p>
              </div>
            </div>
            <div className="how-step">
              <span className="how-n">3</span>
              <div>
                <strong>Swipe to a match</strong>
                <p>Everyone swipes the same options. The group's favourite wins.</p>
              </div>
            </div>
          </div>
          <button type="button" className="how-x" aria-label="Hide this guide" onClick={dismissIntro}>
            <X size={16} />
          </button>
        </section>
      )}

      <div className="home-grid">
        <section aria-labelledby="tpl-h">
          <div className="section-head">
            <h2 id="tpl-h">Templates</h2>
          </div>
          <div className="tpl-grid">
            {shown.map((t) => (
              <TemplateCard key={t.id} tpl={t} />
            ))}
            {shown.length === 0 && (
              <p className="empty">
                All templates hidden. <button className="link-inline" onClick={() => useStore.getState().resetDemo()}>Restore</button>
              </p>
            )}
          </div>
        </section>

        <section aria-labelledby="rec-h">
          <div className="section-head">
            <h2 id="rec-h">Recents</h2>
            <Link to="/activity" aria-label="View history" className="icon-link">
              <History size={18} />
            </Link>
          </div>
          <div className="recents-card">
            {mine.slice(0, 3).map((l) => (
              <Link key={l.id} to={`/lobby/${l.id}`} className="recent-row">
                <span className="emoji-big sm" aria-hidden>
                  {l.emoji}
                </span>
                <span className="recent-text">
                  <strong>{l.name}</strong>
                  <small>
                    {l.items.length} OPTIONS • {l.members.length} {l.members.length === 1 ? "MEMBER" : "MEMBERS"}
                  </small>
                </span>
                <ChevronRight size={16} />
              </Link>
            ))}
            {mine.length === 0 && (
              <p className="recents-empty">
                No lobbies yet. <Link to="/lobby/new">Create your first one</Link>.
              </p>
            )}
            <button type="button" className="recents-bar" onClick={() => nav("/activity")}>
              View all activity
            </button>
          </div>
        </section>
      </div>

      <div className="tiles">
        <Link to="/activity?tab=trending" className="tile tile-pink">
          <TrendingUp size={22} className="accent" />
          <h3>Global Trend</h3>
          <p>"Best Pizza in NY" is viral today.</p>
        </Link>
        <Link to="/activity?tab=community" className="tile">
          <Globe size={22} className="tile-globe" />
          <h3>Community</h3>
          <p>2,403 active sessions worldwide.</p>
        </Link>
      </div>
    </div>
  );
}

