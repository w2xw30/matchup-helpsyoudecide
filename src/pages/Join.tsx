import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowRight, Link2, SearchX, Zap } from "lucide-react";
import { isMember } from "../lib/perms";
import { useStore } from "../store/useStore";
import { AvatarStack, Button, CodeInput, LinkButton, TextField } from "../components/ui/ui";

export function Join() {
  const nav = useNavigate();
  const lobbies = useStore((s) => s.lobbies);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [linkOpen, setLinkOpen] = useState(false);
  const [link, setLink] = useState("");
  const [shake, setShake] = useState(0);

  const digits = code.replace(/\s/g, "");
  const fail = (msg: string) => {
    setError(msg);
    setShake((n) => n + 1);
  };

  const joinByCode = () => {
    if (digits.length < 6) return fail("Enter all 6 digits of your session code.");
    const match = Object.values(lobbies).find((l) => l.code === digits);
    if (!match) return fail("That code doesn't match a live session.");
    nav(`/join/${match.id}`);
  };

  const joinByLink = (e: FormEvent) => {
    e.preventDefault();
    const m = link.trim().match(/(?:lobby|join)\/([a-z0-9-]+)/i);
    if (!m) return fail("That doesn't look like a Matchup invite link.");
    if (!lobbies[m[1]]) return fail("We couldn't find a lobby for that link.");
    nav(`/join/${m[1]}`);
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
            onEnter={joinByCode}
          />
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <Button block size="lg" onClick={joinByCode}>
          Join Session <Zap size={17} />
        </Button>
        <div className="divider divider-plain">
          <span>OR</span>
        </div>
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
            <Button type="submit" variant="primary">
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
  const [nick, setNick] = useState(me && me.name !== "You" ? me.name : "");
  const [error, setError] = useState("");

  if (!lobby) {
    return (
      <div className="invite">
        <SearchX size={40} className="invite-icon" />
        <h1>This invite isn't valid</h1>
        <p className="invite-sub">The lobby may have been deleted, or the link is mistyped. Ask your host for a fresh link or code.</p>
        <div className="invite-actions single">
          <LinkButton to="/join" pill size="lg">
            Enter a code
          </LinkButton>
        </div>
      </div>
    );
  }

  const member = isMember(lobby);
  const full = !member && lobby.members.length >= lobby.maxMembers;
  const closed = !member && !lobby.linkAccess;
  if (full || closed) {
    return (
      <div className="invite">
        <SearchX size={40} className="invite-icon" />
        <h1>{closed ? "This lobby isn't accepting new members" : "This lobby is full"}</h1>
        <p className="invite-sub">{closed ? "The host turned off joining by link or code." : "The host set a member limit and it has been reached."} Ask them to invite you directly.</p>
        <div className="invite-actions single">
          <LinkButton to="/" pill size="lg">
            Back home
          </LinkButton>
        </div>
      </div>
    );
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const n = nick.trim();
    if (n.length < 2) return setError("Pick a nickname with at least 2 characters — your friends will see it.");
    joinLobby(id, n);
    toast(member ? `Welcome back, ${n}!` : `You're in, ${n}!`);
    nav(`/lobby/${id}`);
  };

  const others = lobby.members.filter((m) => m.id !== "you");

  return (
    <div className="invite">
      <h1>
        You've been invited to
        <br />
        <span className="crimson">{lobby.name}!</span>
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
          <Button type="submit" pill size="lg" block>
            {member ? "Enter the Lobby" : "Join the Lobby"} <ArrowRight size={16} />
          </Button>
        </div>
      </form>
      <div className="invite-people">
        {others.length > 0 && <AvatarStack avatars={others.filter((m) => m.avatar).slice(0, 3).map((m) => m.avatar!)} extra={others.length > 3 ? `+${others.length - 3}` : undefined} size={32} />}
        <span className="eyebrow">
          {others.length === 0 ? "You'd be the first one in the lobby" : `${others.length} ${others.length === 1 ? "person is" : "people are"} already in the lobby`}
        </span>
      </div>
    </div>
  );
}
