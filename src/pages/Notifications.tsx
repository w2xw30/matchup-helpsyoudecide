import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BellOff, Check, History, ListPlus, Mail, ShieldCheck, Trophy, UserPlus, Users, Utensils, Zap } from "lucide-react";
import { useStore } from "../store/useStore";
import type { Notif, NotifType } from "../data/mock";
import { timeAgo } from "../lib/time";
import { isMember } from "../lib/perms";
import { Avatar, Button, Chip } from "../components/ui/ui";

const FILTERS = [
  { id: "all", label: "All", types: null },
  { id: "invite", label: "Invites", types: ["invite", "friend"] },
  { id: "match", label: "Matches", types: ["match", "decision"] },
  { id: "group", label: "Groups", types: ["group", "ready", "role", "item"] },
] as const satisfies readonly { id: string; label: string; types: readonly NotifType[] | null }[];

const ICON: Partial<Record<NotifType, { icon: ReactNode; tone: "yellow" | "muted" }>> = {
  match: { icon: <Utensils size={20} />, tone: "yellow" },
  decision: { icon: <Trophy size={20} />, tone: "yellow" },
  ready: { icon: <Zap size={20} />, tone: "yellow" },
  role: { icon: <ShieldCheck size={20} />, tone: "muted" },
  item: { icon: <ListPlus size={20} />, tone: "muted" },
  friend: { icon: <UserPlus size={20} />, tone: "muted" },
  stats: { icon: <History size={20} />, tone: "muted" },
  group: { icon: <Users size={20} />, tone: "muted" },
};

function Item({ n }: { n: Notif }) {
  const nav = useNavigate();
  const markRead = useStore((s) => s.markRead);
  const lobby = useStore((s) => (n.lobbyId ? s.lobbies[n.lobbyId] : undefined));
  const member = isMember(lobby);
  const go = (to: string) => {
    markRead(n.id);
    nav(to);
  };
  const lobbyLink = n.lobbyId ? (member ? `/lobby/${n.lobbyId}` : `/join/${n.lobbyId}`) : (n.to ?? "/");

  const badge = n.type === "invite" ? <Mail size={9} strokeWidth={3} /> : n.type === "friend" ? <UserPlus size={9} strokeWidth={3} /> : <Users size={9} strokeWidth={3} />;
  const lead =
    n.avatar || n.who ? (
      <span className="n-avatar">
        <Avatar src={n.avatar} name={n.who ?? n.highlight ?? "Group"} size={44} />
        <i className="n-badge">{badge}</i>
      </span>
    ) : (
      <span className={`n-icon ${ICON[n.type]?.tone ?? "muted"}`}>
        {ICON[n.type]?.icon}
        {(n.type === "match" || n.type === "decision") && (
          <i className="n-badge">
            <Check size={9} strokeWidth={4} />
          </i>
        )}
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
        {!n.read && (
          <div className="n-actions">
            {n.type === "invite" && (
              <>
                <Button size="sm" variant="coral" onClick={() => go(`/join/${n.lobbyId}`)}>
                  Join
                </Button>
                <Button size="sm" variant="soft" onClick={() => go(lobbyLink)}>
                  View Details
                </Button>
              </>
            )}
            {(n.type === "match" || n.type === "decision") && n.lobbyId && (
              <Button size="sm" variant="coral" onClick={() => go(`/session/${n.lobbyId}/result`)}>
                View Match
              </Button>
            )}
            {n.type === "ready" && (
              <Button size="sm" variant="coral" onClick={() => go(lobbyLink)}>
                Start Voting
              </Button>
            )}
            {(n.type === "group" || n.type === "role" || n.type === "item") && (
              <Button size="sm" variant="soft" onClick={() => go(lobbyLink)}>
                Open Lobby
              </Button>
            )}
            {n.type === "friend" && (
              <Button size="sm" variant="soft" onClick={() => go(n.to ?? "/groups?tab=friends")}>
                View
              </Button>
            )}
          </div>
        )}
        {n.type === "stats" && (
          <Link to={n.to ?? "/activity"} className="n-link" onClick={() => markRead(n.id)}>
            View stats
          </Link>
        )}
      </div>
      <time className="n-time" dateTime={new Date(n.at).toISOString()}>
        {timeAgo(n.at)}
      </time>
    </article>
  );
}

export function Notifications() {
  const notifs = useStore((s) => s.notifs);
  const markAll = useStore((s) => s.markAllRead);
  const toast = useStore((s) => s.toast);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const types = FILTERS.find((f) => f.id === filter)?.types as readonly NotifType[] | null | undefined;
  const list = notifs.filter((n) => !types || types.includes(n.type));
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
            <p>{notifs.length === 0 ? "Nothing yet — activity from your lobbies and friends will show up here." : "Nothing in this filter."}</p>
          </div>
        )}
      </div>
    </div>
  );
}
