import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowRight, Link2, Zap } from "lucide-react";
import { DEFAULT_LOBBY_ID, av } from "../data/mock";
import { useStore } from "../store/useStore";
import { AvatarStack, Button, CodeInput, TextField } from "../components/ui/ui";

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
    if (digits === "000000") return fail("That code doesn't match a live session.");
    const match = Object.values(lobbies).find((l) => l.code === digits);
    nav(`/join/${match?.id ?? DEFAULT_LOBBY_ID}`);
  };

  const joinByLink = (e: FormEvent) => {
    e.preventDefault();
    const m = link.trim().match(/(?:lobby|join)\/([a-z0-9-]+)/i);
    if (!m) return fail("That doesn't look like a Matchup invite link.");
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
              placeholder="matchup.app/lobby/friday-night-42x9"
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
      </div>
    </div>
  );
}

export function Invite() {
  const { id = DEFAULT_LOBBY_ID } = useParams();
  const nav = useNavigate();
  const ensure = useStore((s) => s.ensureLobby);
  const joinLobby = useStore((s) => s.joinLobby);
  const user = useStore((s) => s.user);
  const toast = useStore((s) => s.toast);
  const lobby = useStore((s) => s.lobbies[id]);
  const [nick, setNick] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    ensure(id);
  }, [id, ensure]);

  const name = lobby?.invitedName ?? "The Friday Hangout";
  const inLobby = lobby ? lobby.squad.length - 1 : 8;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const n = nick.trim() || user?.name.split(" ")[0] || "";
    if (n.length < 2) return setError("Pick a nickname with at least 2 characters.");
    joinLobby(id, n);
    toast(`You're in, ${n}!`);
    nav(`/lobby/${id}`);
  };

  return (
    <div className="invite">
      <h1>
        You've been invited to<br />
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
          bare
        />
        <div className="invite-actions">
          <Button type="submit" pill size="lg">
            Join the Lobby <ArrowRight size={16} />
          </Button>
          <Button variant="soft" pill size="lg" onClick={() => nav("/")}>
            I'll decide later
          </Button>
        </div>
      </form>
      <div className="invite-people">
        <AvatarStack avatars={[av(5), av(2), av(3)]} extra="+8" size={32} />
        <span className="eyebrow">{inLobby + 4} people are already in the lobby</span>
      </div>
    </div>
  );
}
