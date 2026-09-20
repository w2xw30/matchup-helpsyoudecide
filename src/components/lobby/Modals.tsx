import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import QRCode from "qrcode";
import { Copy, Crown, Download, KeyRound, Mail, RefreshCw, Share2, ShieldCheck, UserMinus, X } from "lucide-react";
import { LOBBY_KINDS, type LobbyKind } from "../../lib/catalog";
import { isAdmin, isOwner, roleLabel } from "../../lib/perms";
import { inviteDisplay, inviteUrl } from "../../lib/url";
import type { Lobby, Member } from "../../data/mock";
import { handleToName, useStore } from "../../store/useStore";
import { Avatar, Button, Chip, ConfirmCard, Modal, Toggle } from "../ui/ui";


async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Invite: link, code, QR, and invite-by-name/email                    */
/* ------------------------------------------------------------------ */
export function InviteModal({ open, onClose, lobby }: { open: boolean; onClose: () => void; lobby: Lobby }) {
  return (
    <Modal open={open} onClose={onClose} label="Invite friends">
      <InviteBody lobby={lobby} onClose={onClose} />
    </Modal>
  );
}

function InviteBody({ lobby, onClose }: { lobby: Lobby; onClose: () => void }) {
  const toast = useStore((s) => s.toast);
  const invite = useStore((s) => s.inviteMember);
  const cancel = useStore((s) => s.cancelInvite);
  const regen = useStore((s) => s.regenerateCode);
  const admin = isAdmin(lobby);
  const [tab, setTab] = useState<"share" | "people">("share");
  const [qr, setQr] = useState("");
  const [who, setWho] = useState("");
  const [err, setErr] = useState("");
  const url = inviteUrl(lobby);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(url, { width: 512, margin: 1, errorCorrectionLevel: "M", color: { dark: "#8f1f2b", light: "#ffffff" } })
      .then((d) => !cancelled && setQr(d))
      .catch(() => !cancelled && setQr(""));
    return () => {
      cancelled = true;
    };
  }, [url]);

  const copy = async (text: string, what: string) => {
    await copyText(text);
    toast(`${what} copied to clipboard!`);
  };

  const share = async () => {
    const data = { title: `Join ${lobby.name} on Matchup`, text: `Join "${lobby.name}" on Matchup — code ${lobby.code}`, url };
    if (navigator.share) {
      try {
        await navigator.share(data);
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
      }
    }
    await copy(url, "Link");
  };

  const send = (e: FormEvent) => {
    e.preventDefault();
    const r = invite(lobby.id, who);
    if (r === "ok") {
      toast(`Invite sent to ${who.trim()}`);
      setWho("");
      setErr("");
    } else {
      setErr(
        r === "invalid"
          ? "Enter an email address or a username."
          : r === "duplicate"
            ? "They're already in this lobby or invited."
            : "This lobby is full. Raise the member limit in Lobby Settings.",
      );
    }
  };

  const spots = Math.max(0, lobby.maxMembers - lobby.members.length - lobby.invites.length);

  return (
    <div className="sheet sheet-wide">
      <button type="button" className="modal-x" onClick={onClose} aria-label="Close">
        <X size={16} />
      </button>
      <h3>Invite friends</h3>
      <p className="sheet-sub">
        Bring people into <strong>{lobby.name}</strong>. {spots} spot{spots === 1 ? "" : "s"} left.
      </p>
      <div className="chips sheet-tabs" role="tablist">
        <Chip active={tab === "share"} onClick={() => setTab("share")}>
          Link &amp; QR
        </Chip>
        <Chip active={tab === "people"} onClick={() => setTab("people")}>
          By name or email
        </Chip>
      </div>

      {tab === "share" && (
        <div className="share-grid">
          <div className="qr-box">
            {qr ? <img src={qr} alt={`QR code that opens ${url}`} width={200} height={200} /> : <div className="qr-skeleton" />}
            <div className="qr-actions">
              <a className="btn btn-soft btn-sm btn-pill" href={qr || undefined} download={`matchup-${lobby.id}.png`} aria-disabled={!qr}>
                <Download size={14} /> Save QR
              </a>
              <Button size="sm" pill onClick={share}>
                <Share2 size={14} /> Share
              </Button>
            </div>
          </div>
          <div className="share-fields">
            <span className="sheet-label">Invite link</span>
            <div className="copy-field small">
              <span>{inviteDisplay(lobby)}</span>
              <button type="button" className="btn btn-coral btn-sm btn-pill" onClick={() => copy(url, "Link")}>
                <Copy size={13} /> Copy
              </button>
            </div>
            <span className="sheet-label">Session code</span>
            <div className="code-row">
              <div className="code-display" aria-label={`Session code ${lobby.code}`}>
                {lobby.code.slice(0, 3)}
                <i>-</i>
                {lobby.code.slice(3)}
              </div>
              <button type="button" className="btn btn-soft btn-sm btn-pill" onClick={() => copy(lobby.code, "Code")}>
                <Copy size={13} /> Copy
              </button>
              {admin && (
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="Generate a new code"
                  title="Generate a new code"
                  onClick={() => {
                    regen(lobby.id);
                    toast("New code generated — the old one no longer works", "info");
                  }}
                >
                  <RefreshCw size={15} />
                </button>
              )}
            </div>
            <p className="sheet-note">
              <KeyRound size={13} />
              {lobby.linkAccess ? "Anyone with the link or code can join." : "Joining by link or code is turned off in Lobby Settings."}
            </p>
          </div>
        </div>
      )}

      {tab === "people" && (
        <div>
          {admin ? (
            <form className="invite-form" onSubmit={send} noValidate>
              <div className={`field-control ${err ? "err" : ""}`}>
                <span className="field-icon">
                  <Mail size={16} />
                </span>
                <input placeholder="friend@email.com or @username" value={who} onChange={(e) => (setWho(e.target.value), setErr(""))} aria-label="Email or username" data-autofocus />
              </div>
              <Button type="submit" pill>
                Send invite
              </Button>
            </form>
          ) : (
            <p className="sheet-note">Only lobby admins can invite people by name. Share the link or QR instead.</p>
          )}
          {err && <p className="field-error">{err}</p>}
          <h4 className="sheet-h4">Pending invites ({lobby.invites.length})</h4>
          {lobby.invites.length === 0 ? (
            <p className="sheet-note">No pending invites.</p>
          ) : (
            <ul className="row-list">
              {lobby.invites.map((i) => (
                <li key={i.id}>
                  <Avatar name={handleToName(i.to)} size={34} />
                  <span className="row-main">
                    <strong>{i.to}</strong>
                    <small>Invited — waiting to join</small>
                  </span>
                  {admin && (
                    <button type="button" className="link-inline" onClick={() => cancel(lobby.id, i.id)}>
                      Cancel
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Members management                                                  */
/* ------------------------------------------------------------------ */
export function MembersModal({ open, onClose, lobby, userAvatar }: { open: boolean; onClose: () => void; lobby: Lobby; userAvatar?: string }) {
  return (
    <Modal open={open} onClose={onClose} label="Manage members">
      <MembersBody lobby={lobby} onClose={onClose} userAvatar={userAvatar} />
    </Modal>
  );
}

function MembersBody({ lobby, onClose, userAvatar }: { lobby: Lobby; onClose: () => void; userAvatar?: string }) {
  const setRole = useStore((s) => s.setRole);
  const remove = useStore((s) => s.removeMember);
  const transfer = useStore((s) => s.transferOwnership);
  const cancel = useStore((s) => s.cancelInvite);
  const toast = useStore((s) => s.toast);
  const owner = isOwner(lobby);
  const admin = isAdmin(lobby);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [transferTo, setTransferTo] = useState<Member | null>(null);

  const order = { owner: 0, admin: 1, member: 2 } as const;
  const members = [...lobby.members].sort((a, b) => order[a.role] - order[b.role] || a.joinedAt - b.joinedAt);

  const canRemove = (m: Member) => m.id !== "you" && m.role !== "owner" && (owner || (admin && m.role === "member"));

  return (
    <div className="sheet sheet-wide">
      <button type="button" className="modal-x" onClick={onClose} aria-label="Close">
        <X size={16} />
      </button>
      <h3>{admin ? "Manage members" : "Members"}</h3>
      <p className="sheet-sub">
        {lobby.members.length} of {lobby.maxMembers} in <strong>{lobby.name}</strong>
      </p>
      <ul className="row-list members">
        {members.map((m) => {
          const isYou = m.id === "you";
          return (
            <li key={m.id}>
              <Avatar src={isYou ? userAvatar : m.avatar} name={isYou ? "You" : m.name} size={38} status={lobby.ready.includes(m.id) ? "ready" : "away"} />
              <span className="row-main">
                <strong>
                  {m.name}
                  {isYou && m.name !== "You" ? " (you)" : ""}
                </strong>
                <small>{m.fullName ?? (lobby.ready.includes(m.id) ? "Ready to vote" : "Not ready yet")}</small>
              </span>
              <span className={`role-badge role-${m.role}`}>
                {m.role === "owner" && <Crown size={11} />}
                {m.role === "admin" && <ShieldCheck size={11} />}
                {roleLabel(m.role)}
              </span>
              {admin && !isYou && m.role !== "owner" && (
                <span className="row-actions">
                  {confirmRemove === m.id ? (
                    <>
                      <button
                        type="button"
                        className="link-inline danger"
                        onClick={() => {
                          remove(lobby.id, m.id);
                          setConfirmRemove(null);
                          toast(`${m.name} was removed`, "info");
                        }}
                      >
                        Confirm remove
                      </button>
                      <button type="button" className="link-inline muted" onClick={() => setConfirmRemove(null)}>
                        Keep
                      </button>
                    </>
                  ) : (
                    <>
                      {m.role === "member" ? (
                        <button type="button" className="link-inline" onClick={() => (setRole(lobby.id, m.id, "admin"), toast(`${m.name} is now an admin`))}>
                          Make admin
                        </button>
                      ) : (
                        owner && (
                          <button type="button" className="link-inline" onClick={() => (setRole(lobby.id, m.id, "member"), toast(`${m.name} is now a member`, "info"))}>
                            Remove admin
                          </button>
                        )
                      )}
                      {owner && (
                        <button type="button" className="link-inline" onClick={() => setTransferTo(m)}>
                          Make owner
                        </button>
                      )}
                      {canRemove(m) && (
                        <button type="button" className="icon-btn danger" aria-label={`Remove ${m.name}`} onClick={() => setConfirmRemove(m.id)}>
                          <UserMinus size={15} />
                        </button>
                      )}
                    </>
                  )}
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {lobby.invites.length > 0 && (
        <>
          <h4 className="sheet-h4">Pending invites</h4>
          <ul className="row-list">
            {lobby.invites.map((i) => (
              <li key={i.id}>
                <Avatar name={handleToName(i.to)} size={34} />
                <span className="row-main">
                  <strong>{i.to}</strong>
                  <small>Invited</small>
                </span>
                {admin && (
                  <button type="button" className="link-inline" onClick={() => cancel(lobby.id, i.id)}>
                    Cancel
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      <ConfirmCard
        open={!!transferTo}
        onClose={() => setTransferTo(null)}
        title="Transfer ownership?"
        text={`${transferTo?.name ?? "They"} will become the owner. You'll stay on as an admin.`}
        confirmLabel="Transfer"
        cancelLabel="Cancel"
        onConfirm={() => {
          if (transferTo) {
            transfer(lobby.id, transferTo.id);
            toast(`${transferTo.name} is now the owner`);
          }
          setTransferTo(null);
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Lobby settings (admins)                                             */
/* ------------------------------------------------------------------ */
const EMOJIS = ["🎉", "🍕", "🍣", "🌮", "🍔", "☕", "🎬", "🍿", "🎮", "🎲", "🏆", "🥾", "🎤", "🎳", "🏖️", "✨"];

export function LobbySettingsModal({ open, onClose, lobby }: { open: boolean; onClose: () => void; lobby: Lobby }) {
  return (
    <Modal open={open} onClose={onClose} label="Lobby settings">
      <SettingsBody lobby={lobby} onClose={onClose} />
    </Modal>
  );
}

function SettingsBody({ lobby, onClose }: { lobby: Lobby; onClose: () => void }) {
  const update = useStore((s) => s.updateLobby);
  const del = useStore((s) => s.deleteLobby);
  const leave = useStore((s) => s.leaveLobby);
  const toast = useStore((s) => s.toast);
  const nav = useNavigate();
  const owner = isOwner(lobby);
  const [name, setName] = useState(lobby.name);
  const [desc, setDesc] = useState(lobby.description);
  const [kind, setKind] = useState<LobbyKind>(lobby.kind);
  const [emoji, setEmoji] = useState(lobby.emoji);
  const [linkAccess, setLinkAccess] = useState(lobby.linkAccess);
  const [allowFriends, setAllowFriends] = useState(lobby.allowFriends);
  const [locked, setLocked] = useState(lobby.locked);
  const [max, setMax] = useState(lobby.maxMembers);
  const [deadline, setDeadline] = useState(lobby.deadline);
  const [req, setReq] = useState<50 | 75 | 100>(lobby.requiredMatch);
  const [error, setError] = useState("");
  const [danger, setDanger] = useState<"delete" | "leave" | null>(null);

  const minMax = Math.max(2, lobby.members.length + lobby.invites.length);

  const save = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 3) return setError("Give your lobby a title (3+ characters).");
    update(lobby.id, { name: name.trim(), description: desc.trim(), kind, emoji, linkAccess, allowFriends, locked, maxMembers: Math.max(minMax, max), deadline, requiredMatch: req });
    toast("Changes Saved");
    onClose();
  };

  return (
    <form className="sheet sheet-wide" onSubmit={save} noValidate>
      <button type="button" className="modal-x" onClick={onClose} aria-label="Close">
        <X size={16} />
      </button>
      <h3>Lobby settings</h3>

      <label className="sheet-label" htmlFor="ls-name">
        Title
      </label>
      <div className="title-row">
        <span className="emoji-big" aria-hidden>
          {emoji}
        </span>
        <input id="ls-name" className={`sheet-input ${error ? "err" : ""}`} value={name} onChange={(e) => (setName(e.target.value), setError(""))} maxLength={40} data-autofocus />
      </div>
      {error && <p className="field-error">{error}</p>}
      <div className="emoji-row" role="radiogroup" aria-label="Lobby icon">
        {EMOJIS.map((e) => (
          <button key={e} type="button" role="radio" aria-checked={emoji === e} className={`emoji-opt ${emoji === e ? "on" : ""}`} onClick={() => setEmoji(e)}>
            {e}
          </button>
        ))}
      </div>

      <label className="sheet-label" htmlFor="ls-desc">
        Description
      </label>
      <textarea id="ls-desc" className="sheet-input" rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={200} />

      <span className="sheet-label">What are you deciding?</span>
      <div className="kind-picker">
        {LOBBY_KINDS.map((k) => (
          <button key={k.id} type="button" className={`kind-chip ${kind === k.id ? "on" : ""}`} onClick={() => setKind(k.id)}>
            <span aria-hidden>{k.emoji}</span> {k.label}
          </button>
        ))}
      </div>

      <div className="setting-rows">
        <div className="pref">
          <div>
            <strong>Anyone with the link or code can join</strong>
            <small>TURN OFF TO STOP NEW JOINS</small>
          </div>
          <Toggle checked={linkAccess} onChange={setLinkAccess} label="Anyone with the link can join" />
        </div>
        <div className="pref">
          <div>
            <strong>Members can add options</strong>
            <small>ADMINS CAN ALWAYS ADD</small>
          </div>
          <Toggle checked={allowFriends} onChange={setAllowFriends} label="Members can add options" />
        </div>
        <div className="pref">
          <div>
            <strong>Lock lobby</strong>
            <small>FREEZE OPTIONS — VOTING ONLY</small>
          </div>
          <Toggle checked={locked} onChange={setLocked} label="Lock lobby" />
        </div>
        <div className="pref">
          <div>
            <strong>Member limit</strong>
            <small>INCLUDES PENDING INVITES</small>
          </div>
          <div className="stepper">
            <button type="button" aria-label="Fewer members" onClick={() => setMax((m) => Math.max(minMax, m - 1))}>
              −
            </button>
            <output>{Math.max(minMax, max)}</output>
            <button type="button" aria-label="More members" onClick={() => setMax((m) => Math.min(50, m + 1))}>
              +
            </button>
          </div>
        </div>
        <div className="pref">
          <div>
            <strong>Voting deadline</strong>
            <small>SHOWN TO EVERYONE</small>
          </div>
          <input type="time" className="time-input" value={deadline} onChange={(e) => e.target.value && setDeadline(e.target.value)} aria-label="Voting deadline" />
        </div>
        <div className="pref">
          <div>
            <strong>Required match</strong>
            <small>SHARE OF THE GROUP THAT MUST SAY YES</small>
          </div>
          <div className="seg" role="radiogroup" aria-label="Required match">
            {([50, 75, 100] as const).map((p) => (
              <button key={p} type="button" role="radio" aria-checked={req === p} className={req === p ? "on" : ""} onClick={() => setReq(p)}>
                {p}%
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="sheet-actions">
        <Button variant="soft" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit">Save changes</Button>
      </div>

      <div className="danger-zone">
        <h4 className="sheet-h4">Danger zone</h4>
        <div className="danger-row">
          <span>Leave this lobby{owner && lobby.members.length > 1 ? " — ownership passes to another member." : "."}</span>
          <Button variant="soft" size="sm" onClick={() => setDanger("leave")}>
            Leave
          </Button>
        </div>
        {owner && (
          <div className="danger-row">
            <span>Delete the lobby for everyone. This can't be undone.</span>
            <Button variant="danger" size="sm" onClick={() => setDanger("delete")}>
              Delete lobby
            </Button>
          </div>
        )}
      </div>

      <ConfirmCard
        open={danger === "delete"}
        onClose={() => setDanger(null)}
        title="Delete this lobby?"
        text={`“${lobby.name}” and all its options and votes will be removed.`}
        confirmLabel="Delete"
        onConfirm={() => {
          setDanger(null);
          onClose();
          nav("/groups");
          del(lobby.id);
          toast("Lobby deleted", "info");
        }}
      />
      <ConfirmCard
        open={danger === "leave"}
        onClose={() => setDanger(null)}
        title="Leave this lobby?"
        text="You'll need a new invite to come back."
        confirmLabel="Leave"
        onConfirm={() => {
          setDanger(null);
          onClose();
          nav("/groups");
          leave(lobby.id);
          toast("You left the lobby", "info");
        }}
      />
    </form>
  );
}

