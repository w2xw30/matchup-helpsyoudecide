import { useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Camera, ChevronRight, Eye, Lock, LogIn, LogOut, Shield, SlidersHorizontal, Trash2, User } from "lucide-react";
import { useStore } from "../store/useStore";
import { useUI } from "../store/ui";
import { Avatar, Button, ConfirmCard, LinkButton, TextField, Toggle } from "../components/ui/ui";

export function Settings() {
  const user = useStore((s) => s.user);
  const settings = useStore((s) => s.settings);
  const theme = useStore((s) => s.theme);
  const updateProfile = useStore((s) => s.updateProfile);
  const setSetting = useStore((s) => s.setSetting);
  const setTheme = useStore((s) => s.setTheme);
  const deleteAccount = useStore((s) => s.deleteAccount);
  const toast = useStore((s) => s.toast);
  const setLogoutOpen = useUI((s) => s.setLogoutOpen);
  const nav = useNavigate();
  const [name, setName] = useState(user.name);
  const [bio, setBio] = useState(user.bio);
  const [avatar, setAvatar] = useState(user.avatar);
  const [nameError, setNameError] = useState("");
  const [delOpen, setDelOpen] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  const save = () => {
    if (name.trim().length < 2) return setNameError("Display name needs at least 2 characters.");
    updateProfile({ name: name.trim(), bio: bio.trim(), avatar });
    setNameError("");
    toast("Changes Saved");
  };

  const pickFile = (f?: File) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) return toast("Please choose an image file", "warn");
    if (f.size > 2_000_000) return toast("Image must be under 2 MB", "warn");
    const r = new FileReader();
    r.onload = () => setAvatar(String(r.result));
    r.readAsDataURL(f);
  };

  return (
    <div className="settings">
      <div className="settings-head">
        <h1>Settings</h1>
        <p>Manage your account and preferences for the ultimate Matchup experience.</p>
      </div>

      {user.guest && (
        <div className="guest-banner">
          <div>
            <strong>You're browsing as a guest</strong>
            <p>Everything works without an account. Log in to put your name on lobbies and keep your profile.</p>
          </div>
          <span className="guest-actions">
            <LinkButton to="/login" state={{ from: "/settings" }} size="sm" pill>
              Log in
            </LinkButton>
            <LinkButton to="/signup" variant="soft" size="sm" pill>
              Sign up
            </LinkButton>
          </span>
        </div>
      )}

      <div className="settings-grid">
        <div className="settings-left">
          <section className="card s-card">
            <div className="s-title">
              <span>
                <User size={16} className="accent" /> Profile
              </span>
              <Button variant="coral" pill onClick={save}>
                Save Changes
              </Button>
            </div>
            <div className="profile-row">
              <div className="avatar-edit">
                <Avatar src={avatar} name={name} size={100} className="square" />
                <button type="button" className="cam" aria-label="Change photo" onClick={() => file.current?.click()}>
                  <Camera size={14} />
                </button>
                <input ref={file} type="file" accept="image/*" hidden onChange={(e) => pickFile(e.target.files?.[0])} />
              </div>
              <div className="profile-fields">
                <TextField label="DISPLAY NAME" value={name} onChange={(e) => setName(e.target.value)} error={nameError} maxLength={40} />
                <div className="field">
                  <div className="field-head">
                    <label htmlFor="bio">BIO</label>
                  </div>
                  <div className="field-control area">
                    <textarea id="bio" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} maxLength={160} />
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="card s-card">
            <div className="s-title">
              <span>
                <Shield size={16} className="accent" fill="currentColor" /> Account &amp; Privacy
              </span>
            </div>
            {!user.guest && <Row to="/settings/security" icon={<Lock size={18} />} title="Password & Security" sub="Update your password and 2FA" />}
            <Row to="/settings/visibility" icon={<Eye size={18} />} title="Profile Visibility" sub="Who can see your polls and groups" />
            <Row danger onClick={() => setDelOpen(true)} icon={<Trash2 size={18} />} title={user.guest ? "Reset Guest Data" : "Delete Account"} sub={user.guest ? "Clear lobbies and settings on this device" : "Permanently remove your data"} />
          </section>
        </div>

        <div className="settings-right">
          <section className="card s-card prefs">
            <div className="s-title">
              <span>
                <SlidersHorizontal size={16} className="accent" /> Preferences
              </span>
            </div>
            <Pref title="Push Notifications" sub="ALERTS FOR NEW POLL ACTIVITY" checked={settings.push} onChange={(v) => setSetting("push", v)} />
            <Pref title="Email Updates" sub="WEEKLY DIGEST AND NEWS" checked={settings.email} onChange={(v) => setSetting("email", v)} />
            <Pref title="Dark Mode" sub="SWITCH TO THE NIGHT THEME" checked={theme === "dark"} onChange={(v) => setTheme(v ? "dark" : "light")} />
          </section>

          <section className="help-card">
            <h3>Need Help?</h3>
            <p>Our support team is here 24/7 for any questions about your Matchup experience.</p>
            <LinkButton to="/support" variant="white" block>
              Contact Support
            </LinkButton>
          </section>

          {user.guest ? (
            <LinkButton to="/login" state={{ from: "/settings" }} variant="soft" block className="logout-btn">
              <LogIn size={17} /> Log in or sign up
            </LinkButton>
          ) : (
            <button type="button" className="logout-btn" onClick={() => setLogoutOpen(true)}>
              <LogOut size={17} /> Logout
            </button>
          )}
        </div>
      </div>

      <ConfirmCard
        open={delOpen}
        onClose={() => setDelOpen(false)}
        title="Warning!"
        text={user.guest ? "Your lobbies, friends and settings on this device will be cleared." : "This process is irreversible."}
        confirmLabel={user.guest ? "Reset" : "Delete"}
        onConfirm={() => {
          setDelOpen(false);
          deleteAccount();
          nav("/");
        }}
      />
    </div>
  );
}

function Row({ to, onClick, icon, title, sub, danger }: { to?: string; onClick?: () => void; icon: ReactNode; title: string; sub: string; danger?: boolean }) {
  const inner = (
    <>
      <span className="row-icon">{icon}</span>
      <span className="row-text">
        <strong>{title}</strong>
        <small>{sub}</small>
      </span>
      <ChevronRight size={16} />
    </>
  );
  return to ? (
    <Link to={to} className={`s-row ${danger ? "danger" : ""}`}>
      {inner}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={`s-row ${danger ? "danger" : ""}`}>
      {inner}
    </button>
  );
}

function Pref({ title, sub, checked, onChange }: { title: string; sub: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="pref">
      <div>
        <strong>{title}</strong>
        <small>{sub}</small>
      </div>
      <Toggle checked={checked} onChange={onChange} label={title} />
    </div>
  );
}
