import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowRight, Link2, ScanLine, SearchX, Zap } from "lucide-react";
import { IS_BACKEND } from "../backend/config";
import { joinOnline, lobbyIdForCode, previewLobby, useLobbyPreview } from "../backend/api";
import { isMember } from "../lib/perms";
import type { ScanTarget } from "../lib/scan";
import { useStore } from "../store/useStore";
import { AvatarStack, Button, CodeInput, LinkButton, TextField } from "../components/ui/ui";
import { ScanModal } from "../components/lobby/ScanModal";

export function Join() {
  const nav = useNavigate();
  const lobbies = useStore((s) => s.lobbies);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [linkOpen, setLinkOpen] = useState(false);
  const [link, setLink] = useState("");
  const [shake, setShake] = useState(0);
  const [busy, setBusy] = useState(false);
  const [scan, setScan] = useState(false);

  const digits = code.replace(/\s/g, "");
  const fail = (msg: string) => {
    setError(msg);
    setShake((n) => n + 1);
  };

  const byCode = async (value: string) => {
    if (value.length < 6) return fail("Enter all 6 digits of your session code.");
    setBusy(true);
    try {
      const id = IS_BACKEND ? await lobbyIdForCode(value) : Object.values(lobbies).find((l) => l.code === value)?.id;
      if (!id) return fail("That code doesn't match a live session.");
      nav(`/join/${id}`);
    } catch {
      fail("Couldn't reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const byId = async (id: string) => {
    setBusy(true);
    try {
      const exists = IS_BACKEND ? !!(await previewLobby(id)) : !!lobbies[id];
      if (!exists) return fail("We couldn't find a lobby for that link.");
      nav(`/join/${id}`);
    } catch {
      fail("Couldn't reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const joinByLink = (e: FormEvent) => {
    e.preventDefault();
    const m = link.trim().match(/(?:lobby|join)\/([a-z0-9-]+)/i);
    if (!m) return fail("That doesn't look like a Matchup invite link.");
    void byId(m[1]);
  };

  const onScan = (t: ScanTarget) => {
    setScan(false);
    if (t.kind === "code") void byCode(t.value);
    else void byId(t.value);
  };

  return (
    <div className="center-stage">
      <div className="join-card">
        <h1>Join the Party</h1>
        <p className="join-sub">Enter your unique session code to start matching with friends.</p>
        <div key={shake} className={shake ? "shake" : ""}>
          <CodeInput
            value={code}
            onChange={(v) => {
              setCode(v);
              setError("");
            }}
            error={!!error}
            onEnter={() => void byCode(digits)}
          />
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <Button block size="lg" onClick={() => void byCode(digits)} disabled={busy}>
          Join Session <Zap size={17} />
        </Button>
        <div className="divider divider-plain">
          <span>OR</span>
        </div>
        <Button variant="soft" block size="lg" className="scan-only join-scan" onClick={() => setScan(true)}>
          <ScanLine size={17} /> Scan QR code
        </Button>
        {linkOpen ? (
          <form className="link-form" onSubmit={joinByLink}>
            <TextField
              placeholder="matchup.app/join/friday-night-42x9"
              aria-label="Invite link"
              value={link}
              onChange={(e) => {
                setLink(e.target.value);
                setError("");
              }}
              icon={<Link2 size={18} />}
              autoFocus
            />
            <Button type="submit" variant="primary" disabled={busy}>
              Go
            </Button>
          </form>
        ) : (
          <Button variant="outline" block size="lg" onClick={() => setLinkOpen(true)}>
            <Link2 size={17} /> Join via shared link
          </Button>
        )}
        <p className="join-alt">
          Want to host instead? <Link to="/lobby/new">Create a lobby</Link>
        </p>
      </div>
      <ScanModal open={scan} onClose={() => setScan(false)} onTarget={onScan} />
    </div>
  );
}

function InviteBlocked({ title, text, to, label }: { title: string; text: string; to: string; label: string }) {
  return (
    <div className="invite">
      <SearchX size={40} className="invite-icon" />
      <h1>{title}</h1>
      <p className="invite-sub">{text}</p>
      <div className="invite-actions single">
        <LinkButton to={to} pill size="lg">
          {label}
        </LinkButton>
      </div>
    </div>
  );
}

export function Invite() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const joinLobby = useStore((s) => s.joinLobby);
  const toast = useStore((s) => s.toast);
  const lobby = useStore((s) => s.lobbies[id]);
  const me = lobby?.members.find((m) => m.id === "you");
  const preview = useLobbyPreview(id, !!lobby && isMember(lobby));
  const [nick, setNick] = useState(me && me.name !== "You" ? me.name : "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // What we know about the lobby: the full local copy if we're in it, otherwise the server's public preview.
  const member = isMember(lobby);
  let name = lobby?.name;
  let count = lobby ? lobby.members.length : 0;
  let full = false;
  let closed = false;
  let exists = !!lobby;
  if (!lobby && IS_BACKEND) {
    if (preview.status === "loading") {
      return (
        <div className="invite" role="status">
          <p className="invite-sub">Looking up the lobby…</p>
        </div>
      );
    }
    exists = preview.status === "ready" && !!preview.preview;
    if (preview.preview) {
      name = preview.preview.name;
      count = preview.preview.member_count;
      full = !preview.preview.is_member && preview.preview.member_count >= preview.preview.max_members;
      closed = !preview.preview.is_member && !preview.preview.link_access;
    }
  } else if (lobby) {
    full = !member && lobby.members.length >= lobby.maxMembers;
    closed = !member && !lobby.linkAccess;
  }

  if (!exists) {
    return (
      <InviteBlocked
        title="This invite isn't valid"
        text="The lobby may have been deleted, or the link is mistyped. Ask your host for a fresh link or code."
        to="/join"
        label="Enter a code"
      />
    );
  }
  if (full || closed) {
    return (
      <InviteBlocked
        title={closed ? "This lobby isn't accepting new members" : "This lobby is full"}
        text={`${closed ? "The host turned off joining by link or code." : "The host set a member limit and it has been reached."} Ask them to invite you directly.`}
        to="/"
        label="Back home"
      />
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const n = nick.trim();
    if (n.length < 2) return setError("Pick a nickname with at least 2 characters — your friends will see it.");
    if (IS_BACKEND) {
      setBusy(true);
      const r = await joinOnline(id, n);
      setBusy(false);
      if (r !== "ok") {
        toast(r === "full" ? "That lobby just filled up." : r === "closed" ? "That lobby isn't accepting new members." : "Couldn't join. Try again.", "warn");
        return;
      }
    } else joinLobby(id, n);
    toast(member ? `Welcome back, ${n}!` : `You're in, ${n}!`);
    nav(`/lobby/${id}`);
  };

  const others = lobby ? lobby.members.filter((m) => m.id !== "you") : [];
  const othersCount = lobby ? others.length : count;

  return (
    <div className="invite">
      <h1>
        You've been invited to
        <br />
        <span className="crimson">{name}!</span>
      </h1>
      <p className="invite-sub">Your friends are waiting for you in the lobby. Enter your name below to jump in and start the fun.</p>
      <form className="invite-card" onSubmit={submit} noValidate>
        <TextField
          label="YOUR NICKNAME"
          placeholder="e.g. SunnyGamer"
          value={nick}
          onChange={(e) => {
            setNick(e.target.value);
            setError("");
          }}
          error={error}
          maxLength={20}
          autoFocus
          bare
          required
          aria-required="true"
        />
        <div className="invite-actions single">
          <Button type="submit" pill size="lg" block disabled={busy}>
            {busy ? "Joining…" : member ? "Enter the Lobby" : "Join the Lobby"} <ArrowRight size={16} />
          </Button>
        </div>
      </form>
      <div className="invite-people">
        {others.length > 0 && (
          <AvatarStack
            avatars={others.filter((m) => m.avatar).slice(0, 3).map((m) => m.avatar!)}
            extra={others.length > 3 ? `+${others.length - 3}` : undefined}
            size={32}
          />
        )}
        <span className="eyebrow">
          {othersCount === 0 ? "You'd be the first one in the lobby" : `${othersCount} ${othersCount === 1 ? "person is" : "people are"} already in the lobby`}
        </span>
      </div>
    </div>
  );
}
