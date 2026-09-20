import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronRight, Globe, History, MoreHorizontal, Plus, TrendingUp, Zap } from "lucide-react";
import { av, recents, templates, type Template } from "../data/mock";
import { useStore } from "../store/useStore";
import { Avatar, AvatarStack, LinkButton } from "../components/ui/ui";

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
        <Link to="/join" className="hero-friends" aria-label="12 friends waiting to play">
          <AvatarStack avatars={[av(5), av(2), av(6)]} extra="+12" size={44} />
          <span className="eyebrow">Friends waiting to play</span>
        </Link>
      </section>

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
            {recents.map((r) => (
              <Link key={r.id} to={`/lobby/${r.lobbyId}`} className="recent-row">
                <span className="recent-avatars">
                  {r.avatars.map((a, i) => (
                    <Avatar key={i} src={a} size={30} className="stack-item" />
                  ))}
                  {r.initials && <span className="stack-extra sm">{r.initials}</span>}
                </span>
                <span className="recent-text">
                  <strong>{r.title}</strong>
                  <small>{r.meta}</small>
                </span>
                <ChevronRight size={16} />
              </Link>
            ))}
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

