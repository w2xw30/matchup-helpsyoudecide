import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BellOff, Check, History, Mail, Users, Utensils } from "lucide-react";
import { useStore } from "../store/useStore";
import type { Notif } from "../data/mock";
import { Avatar, Button, Chip } from "../components/ui/ui";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "invite", label: "Invites" },
  { id: "match", label: "Matches" },
  { id: "group", label: "Groups" },
] as const;

function Item({ n }: { n: Notif }) {
  const nav = useNavigate();
  const markRead = useStore((s) => s.markRead);
  const go = (to: string) => {
    markRead(n.id);
    nav(to);
  };
  const lead =
    n.type === "match" ? (
      <span className="n-icon yellow">
        <Utensils size={20} />
        <i className="n-badge"><Check size={9} strokeWidth={4} /></i>
      </span>
    ) : n.type === "stats" ? (
      <span className="n-icon muted">
        <History size={20} />
      </span>
    ) : (
      <span className="n-avatar">
        <Avatar src={n.avatar} name={n.who ?? "Group"} size={44} />
        <i className="n-badge">{n.type === "invite" ? <Mail size={9} strokeWidth={3} /> : <Users size={9} strokeWidth={3} />}</i>
      </span>
    );

  return (
    <article className={`notif ${n.read ? "read" : ""}`}>
      {lead}
      <div className="n-body">
        <p className="n-title">
          {n.who && <span className="accent">{n.who} </span>}
          {n.title}
          {n.highlight && <span className="accent"> {n.highlight}</span>}
        </p>
        <p className={`n-text ${n.quote ? "quote" : ""}`}>{n.body}</p>
        {!n.read && n.type === "invite" && (
          <div className="n-actions">
            <Button size="sm" variant="coral" onClick={() => go(`/join/${n.lobbyId}`)}>Join</Button>
            <Button size="sm" variant="soft" onClick={() => go(`/lobby/${n.lobbyId}`)}>View Details</Button>
          </div>
        )}
        {!n.read && n.type === "match" && (
          <div className="n-actions">
            <Button size="sm" variant="coral" onClick={() => go(`/session/${n.lobbyId}/result`)}>View Match</Button>
          </div>
        )}
        {!n.read && n.type === "group" && (
          <div className="n-actions">
            <Button size="sm" variant="soft" onClick={() => go(`/lobby/${n.lobbyId}`)}>Open Chat</Button>
          </div>
        )}
        {n.type === "stats" && (
          <Link to="/activity" className="n-link" onClick={() => markRead(n.id)}>
            View stats
          </Link>
        )}
      </div>
      <time className="n-time">{n.time}</time>
    </article>
  );
}

export function Notifications() {
  const notifs = useStore((s) => s.notifs);
  const markAll = useStore((s) => s.markAllRead);
  const toast = useStore((s) => s.toast);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const list = notifs.filter((n) => filter === "all" || n.type === filter);
  const unread = notifs.filter((n) => !n.read).length;

  return (
    <div className="notifs">
      <div className="notifs-head">
        <div>
          <h1>Notifications</h1>
          <p>Stay updated with your community</p>
        </div>
        <button
          type="button"
          className="link-coral"
          disabled={!unread}
          onClick={() => {
            markAll();
            toast("All caught up!");
          }}
        >
          Mark all as read
        </button>
      </div>
      <div className="chips" role="tablist" aria-label="Filter notifications">
        {FILTERS.map((f) => (
          <Chip key={f.id} active={filter === f.id} onClick={() => setFilter(f.id)}>
            {f.label}
          </Chip>
        ))}
      </div>
      <div className="notif-list">
        {list.map((n) => (
          <Item key={n.id} n={n} />
        ))}
        {list.length === 0 && (
          <div className="empty-state">
            <BellOff size={26} />
            <p>Nothing here yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
