import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Check, Plus, Search, Trash2, UserPlus, Users, X, Zap } from "lucide-react";
import type { Clan } from "../data/mock";
import { EMOJIS } from "../lib/emoji";
import { isMember, myRole, roleLabel } from "../lib/perms";
import { useStore } from "../store/useStore";
import { IS_BACKEND } from "../backend/config";
import { Avatar, AvatarStack, Button, Chip, ConfirmCard, LinkButton, Modal } from "../components/ui/ui";

const TABS = [
  { id: "lobbies", label: "Lobbies" },
  { id: "friends", label: "Friends" },
  { id: "clans", label: "Clans" },
] as const;
type Tab = (typeof TABS)[number]["id"];

export function Groups() {
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find((t) => t.id === params.get("tab"))?.id ?? "lobbies") as Tab;
  const lobbyMap = useStore((s) => s.lobbies);
  const friends = useStore((s) => s.friends);
  const clans = useStore((s) => s.clans);
  const lobbies = useMemo(() => Object.values(lobbyMap).filter((l) => isMember(l)), [lobbyMap]);
  const [clanModal, setClanModal] = useState<Clan | "new" | null>(null);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"recent" | "name" | "options" | "ready">("recent");
  const [view, setView] = useState<"active" | "decided">("active");
  const query = q.trim().toLowerCase();

  const decidedCount = lobbies.filter((l) => l.decision).length;
  const shownLobbies = useMemo(() => {
    const match = (l: (typeof lobbies)[number]) =>
      !query ||
      [l.name, l.description, ...l.members.map((m) => m.fullName ?? m.name), ...l.items.map((i) => i.title)].some((t) => t.toLowerCase().includes(query));
    const readyShare = (l: (typeof lobbies)[number]) => l.ready.length / Math.max(1, l.members.length);
    return lobbies
      .filter((l) => (view === "decided" ? !!l.decision : !l.decision) && match(l))
      .sort((a, b) =>
        sort === "name" ? a.name.localeCompare(b.name) : sort === "options" ? b.items.length - a.items.length : sort === "ready" ? readyShare(b) - readyShare(a) : b.createdAt - a.createdAt,
      );
  }, [lobbies, query, sort, view]);

  const counts: Record<Tab, number> = { lobbies: lobbies.length, friends: friends.filter((f) => f.status === "friend").length, clans: clans.length };

  return (
    <div className="doc-wide">
      <div className="page-head">
        <div>
          <h1>Your Groups</h1>
          <p>Lobbies you're in, the friends you play with, and the clans you've built.</p>
        </div>
        <div className="page-head-actions">
          {tab === "lobbies" && (
            <>
              <LinkButton to="/join" variant="soft" pill>
                Join Session <Zap size={15} />
              </LinkButton>
              <LinkButton to="/lobby/new" pill>
                <Plus size={16} /> New lobby
              </LinkButton>
            </>
          )}
          {tab === "clans" && (
            <Button pill onClick={() => setClanModal("new")}>
              <Plus size={16} /> New clan
            </Button>
          )}
        </div>
      </div>

      <div className="chips groups-tabs" role="tablist" aria-label="Groups sections">
        {TABS.map((t) => (
          <Chip key={t.id} active={tab === t.id} onClick={() => setParams(t.id === "lobbies" ? {} : { tab: t.id }, { replace: true })}>
            {t.label} <span className="chip-count">{counts[t.id]}</span>
          </Chip>
        ))}
      </div>

      <div className="g-tools">
        <label className="g-search">
          <Search size={16} aria-hidden />
          <input
            type="search"
            placeholder={tab === "lobbies" ? "Search lobbies, options or people" : tab === "friends" ? "Search friends" : "Search clans"}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search"
          />
        </label>
        {tab === "lobbies" && (
          <>
            <div className="seg sm" role="radiogroup" aria-label="Show lobbies">
              <button type="button" role="radio" aria-checked={view === "active"} className={view === "active" ? "on" : ""} onClick={() => setView("active")}>
                Active
              </button>
              <button type="button" role="radio" aria-checked={view === "decided"} className={view === "decided" ? "on" : ""} onClick={() => setView("decided")}>
                Decided{decidedCount ? ` (${decidedCount})` : ""}
              </button>
            </div>
            <select className="g-select" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort lobbies">
              <option value="recent">Newest first</option>
              <option value="name">Name A–Z</option>
              <option value="options">Most options</option>
              <option value="ready">Most ready</option>
            </select>
          </>
        )}
      </div>

      {tab === "lobbies" && <LobbiesTab lobbies={shownLobbies} view={view} query={query} />}
      {tab === "friends" && <FriendsTab query={query} />}
      {tab === "clans" && <ClansTab query={query} onManage={setClanModal} onNew={() => setClanModal("new")} />}

      <ClanModal target={clanModal} onClose={() => setClanModal(null)} />
    </div>
  );
}

/* ---------------- Lobbies ---------------- */
function LobbiesTab({ lobbies, view, query }: { lobbies: ReturnType<typeof useStore.getState>["lobbies"][string][]; view: "active" | "decided"; query: string }) {
  const sorted = lobbies;
  if (sorted.length === 0 && (query || view === "decided")) {
    return (
      <div className="empty-state">
        <Users size={28} />
        <p>{query ? `No lobbies match “${query}”.` : "Nothing decided yet. Lock in a pick from a result page and it lands here."}</p>
      </div>
    );
  }
  if (sorted.length === 0) {
    return (
      <div className="empty-state">
        <Users size={28} />
        <p>You're not in any lobbies yet.</p>
        <LinkButton to="/lobby/new" pill>
          Create your first lobby
        </LinkButton>
      </div>
    );
  }
  return (
    <div className="group-grid">
      {sorted.map((l) => {
        const ready = l.ready.length;
        const role = myRole(l)!;
        return (
          <article key={l.id} className="tpl-card group-card">
            <div className="tpl-top">
              <span className="emoji-big md" aria-hidden>
                {l.emoji}
              </span>
              <span className="tpl-badges">
                <span className={`pill ${l.decision || l.phase === "voting" || ready >= l.members.length ? "pill-yellow" : "pill-gray"}`}>
                  {l.decision ? "DECIDED" : l.phase === "voting" ? "VOTING" : ready >= l.members.length ? "ALL READY" : `${ready}/${l.members.length} READY`}
                </span>
                <span className={`role-badge role-${role}`}>{roleLabel(role)}</span>
              </span>
            </div>
            <h3>{l.name}</h3>
            <p>
              {l.items.length} options · {l.members.length} {l.members.length === 1 ? "member" : "members"}
            </p>
            {l.decision && <p className="decision-note">Decided: {l.decision.title}</p>}
            <AvatarStack avatars={l.members.filter((m) => m.avatar).slice(0, 4).map((m) => m.avatar!)} extra={`${l.members.length}`} size={28} />
            <div className="group-actions">
              <Link to={`/lobby/${l.id}`} className="tpl-create">
                Open lobby
              </Link>
              <Link to={`/session/${l.id}/vote`} className="tpl-create alt">
                Vote
              </Link>
              <Link to={`/lobby/${l.id}/customize`} className="tpl-create alt">
                Options
              </Link>
            </div>
          </article>
        );
      })}
    </div>
  );
}

/* ---------------- Friends ---------------- */
function FriendsTab({ query }: { query: string }) {
  const friends = useStore((s) => s.friends);
  const add = useStore((s) => s.addFriend);
  const accept = useStore((s) => s.acceptFriend);
  const remove = useStore((s) => s.removeFriend);
  const respond = useStore((s) => s.respondFriend);
  const toast = useStore((s) => s.toast);
  const [who, setWho] = useState("");
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState<string | null>(null);

  // Prototype: requests are accepted a few seconds later. Remove once the server sends acceptances.
  const pendingKey = friends.filter((f) => f.status === "pending").map((f) => f.id).join(",");
  useEffect(() => {
    if (IS_BACKEND || !pendingKey) return;
    const timers = pendingKey.split(",").map((id) =>
      setTimeout(() => {
        const f = useStore.getState().friends.find((x) => x.id === id);
        if (f?.status === "pending") {
          accept(id);
          toast(`${f.name} accepted your friend request`);
        }
      }, 3500),
    );
    return () => timers.forEach(clearTimeout);
  }, [pendingKey, accept, toast]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const r = add(who);
    if (r === "ok") {
      toast(`Friend request sent to ${who.trim()}`);
      setWho("");
      setError("");
    } else {
      setError(
        r === "invalid" ? "Enter an email address or a username." : r === "duplicate" ? "You're already friends (or a request is pending)." : "That's you! Add someone else.",
      );
    }
  };

  const matches = (f: (typeof friends)[number]) => !query || f.name.toLowerCase().includes(query) || f.handle.toLowerCase().includes(query);
  const incoming = friends.filter((f) => f.status === "incoming" && matches(f));
  const sorted = friends.filter((f) => f.status !== "incoming" && matches(f)).sort((a, b) => Number(a.status === "pending") - Number(b.status === "pending") || a.name.localeCompare(b.name));

  return (
    <div className="friends">
      <form className="add-friend" onSubmit={submit} noValidate>
        <div className={`field-control ${error ? "err" : ""}`}>
          <span className="field-icon">
            <UserPlus size={17} />
          </span>
          <input placeholder="Add a friend by email or @username" value={who} onChange={(e) => (setWho(e.target.value), setError(""))} aria-label="Friend email or username" />
        </div>
        <Button type="submit" pill>
          Add friend
        </Button>
      </form>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}

      {incoming.length > 0 && (
        <div className="friend-reqs">
          <h4>Friend requests ({incoming.length})</h4>
          <ul className="friend-list card">
            {incoming.map((f) => (
              <li key={f.id}>
                <Avatar src={f.avatar} name={f.name} size={42} />
                <span className="row-main">
                  <strong>{f.name}</strong>
                  <small>wants to be friends</small>
                </span>
                <Button size="sm" pill onClick={() => (respond(f.id, true), toast(`You and ${f.name} are now friends`))}>
                  Accept
                </Button>
                <Button size="sm" pill variant="soft" onClick={() => respond(f.id, false)}>
                  Decline
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="empty-state">
          <Users size={28} />
          <p>{query ? `No friends match “${query}”.` : "No friends yet. Add someone above and they'll show up here."}</p>
        </div>
      ) : (
        <ul className="friend-list card">
          {sorted.map((f) => (
            <li key={f.id}>
              <Avatar src={f.avatar} name={f.name} size={42} />
              <span className="row-main">
                <strong>{f.name}</strong>
                <small>{f.handle}</small>
              </span>
              {f.status === "pending" ? <span className="pill pill-yellow">PENDING</span> : null}
              {confirm === f.id ? (
                <span className="row-actions">
                  <button type="button" className="link-inline danger" onClick={() => (remove(f.id), setConfirm(null), toast(`${f.name} removed`, "info"))}>
                    {f.status === "pending" ? "Cancel request" : "Confirm remove"}
                  </button>
                  <button type="button" className="link-inline muted" onClick={() => setConfirm(null)}>
                    Keep
                  </button>
                </span>
              ) : (
                <button type="button" className="icon-btn danger" aria-label={`Remove ${f.name}`} onClick={() => setConfirm(f.id)}>
                  <Trash2 size={15} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------------- Clans ---------------- */
function ClansTab({ query, onManage, onNew }: { query: string; onManage: (c: Clan) => void; onNew: () => void }) {
  const allClans = useStore((s) => s.clans);
  const clans = query ? allClans.filter((c) => c.name.toLowerCase().includes(query) || c.description.toLowerCase().includes(query)) : allClans;
  const friends = useStore((s) => s.friends);
  const nav = useNavigate();

  if (clans.length === 0 && query) {
    return (
      <div className="empty-state">
        <Users size={28} />
        <p>No clans match “{query}”.</p>
      </div>
    );
  }
  if (clans.length === 0) {
    return (
      <div className="empty-state">
        <Users size={28} />
        <p>Clans are your regular crews — build one from your friends and start a lobby with everyone in a tap.</p>
        <Button pill onClick={onNew}>
          <Plus size={16} /> Create a clan
        </Button>
      </div>
    );
  }
  return (
    <div className="group-grid">
      {clans.map((c) => {
        const members = c.memberIds.map((id) => friends.find((f) => f.id === id)).filter((f) => !!f);
        return (
          <article key={c.id} className="tpl-card group-card clan-card">
            <div className="tpl-top">
              <span className="emoji-big md" aria-hidden>
                {c.emoji}
              </span>
              <span className="role-badge role-owner">Owner</span>
            </div>
            <h3>{c.name}</h3>
            <p>{c.description || `${members.length + 1} members including you`}</p>
            <div className="clan-members">
              <AvatarStack avatars={members.filter((m) => m.avatar).slice(0, 4).map((m) => m.avatar!)} extra={`${members.length + 1}`} size={28} />
              <small>{members.length + 1} members</small>
            </div>
            <div className="group-actions">
              <button type="button" className="tpl-create" onClick={() => nav(`/lobby/new?clan=${c.id}`)}>
                New lobby
              </button>
              <button type="button" className="tpl-create alt" onClick={() => onManage(c)}>
                Manage
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function ClanModal({ target, onClose }: { target: Clan | "new" | null; onClose: () => void }) {
  return (
    <Modal open={!!target} onClose={onClose} label={target === "new" ? "New clan" : "Manage clan"}>
      {target && <ClanForm key={target === "new" ? "new" : target.id} clan={target === "new" ? null : target} onClose={onClose} />}
    </Modal>
  );
}

function ClanForm({ clan, onClose }: { clan: Clan | null; onClose: () => void }) {
  const friends = useStore((s) => s.friends).filter((f) => f.status === "friend");
  const create = useStore((s) => s.createClan);
  const update = useStore((s) => s.updateClan);
  const del = useStore((s) => s.deleteClan);
  const toast = useStore((s) => s.toast);
  const [name, setName] = useState(clan?.name ?? "");
  const [emoji, setEmoji] = useState(clan?.emoji ?? "🏕️");
  const [desc, setDesc] = useState(clan?.description ?? "");
  const [ids, setIds] = useState<string[]>(clan?.memberIds ?? []);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);

  const toggle = (id: string) => setIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const save = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 3) return setError("Give your clan a name (3+ characters).");
    if (clan) update(clan.id, { name, emoji, description: desc, memberIds: ids });
    else create({ name, emoji, description: desc, memberIds: ids });
    toast(clan ? "Changes Saved" : `"${name.trim()}" created`);
    onClose();
  };

  return (
    <form className="sheet sheet-wide" onSubmit={save} noValidate>
      <button type="button" className="modal-x" onClick={onClose} aria-label="Close">
        <X size={16} />
      </button>
      <h3>{clan ? "Manage clan" : "New clan"}</h3>
      <p className="sheet-sub">A clan is a saved crew. Start a lobby with everyone in one tap.</p>

      <label className="sheet-label" htmlFor="clan-name">
        Name
      </label>
      <div className="title-row">
        <span className="emoji-big" aria-hidden>
          {emoji}
        </span>
        <input id="clan-name" className={`sheet-input ${error ? "err" : ""}`} value={name} onChange={(e) => (setName(e.target.value), setError(""))} maxLength={30} placeholder="e.g. Weekend Crew" data-autofocus />
      </div>
      {error && <p className="field-error">{error}</p>}
      <div className="emoji-row" role="radiogroup" aria-label="Clan icon">
        {EMOJIS.map((e) => (
          <button key={e} type="button" role="radio" aria-checked={emoji === e} className={`emoji-opt ${emoji === e ? "on" : ""}`} onClick={() => setEmoji(e)}>
            {e}
          </button>
        ))}
      </div>

      <label className="sheet-label" htmlFor="clan-desc">
        Description <em>(optional)</em>
      </label>
      <input id="clan-desc" className="sheet-input" value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={80} />

      <span className="sheet-label">
        Members <em>({ids.length} of your friends)</em>
      </span>
      {friends.length === 0 ? (
        <p className="sheet-note">
          Add friends first, then come back to build a clan. <Link to="/groups?tab=friends" onClick={onClose} className="link-inline">Go to Friends</Link>
        </p>
      ) : (
        <div className="pick-list">
          {friends.map((f) => {
            const on = ids.includes(f.id);
            return (
              <button key={f.id} type="button" className={`pick ${on ? "on" : ""}`} aria-pressed={on} onClick={() => toggle(f.id)}>
                <Avatar src={f.avatar} name={f.name} size={30} />
                <span>{f.name}</span>
                {on && <Check size={14} />}
              </button>
            );
          })}
        </div>
      )}

      <div className="sheet-actions">
        {clan && (
          <Button variant="soft" onClick={() => setConfirm(true)} className="push-left">
            Delete clan
          </Button>
        )}
        <Button variant="soft" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit">{clan ? "Save changes" : "Create clan"}</Button>
      </div>

      <ConfirmCard
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Delete this clan?"
        text="Your friends stay — only the clan is removed."
        confirmLabel="Delete"
        onConfirm={() => {
          if (clan) del(clan.id);
          setConfirm(false);
          onClose();
          toast("Clan deleted", "info");
        }}
      />
    </form>
  );
}
