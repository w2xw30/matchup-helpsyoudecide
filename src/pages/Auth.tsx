import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Lock, Mail, User } from "lucide-react";
import { useStore } from "../store/useStore";
import { AuthShell } from "../components/layout/Layout";
import { Button, TextField } from "../components/ui/ui";
import { AppleIcon, GoogleIcon, LogoMark } from "../components/ui/brand";

const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

function Social({ onPick }: { onPick: (provider: string) => void }) {
  return (
    <>
      <div className="divider">
        <span>OR CONTINUE WITH</span>
      </div>
      <div className="social-row">
        <button type="button" className="btn btn-soft btn-md" onClick={() => onPick("Google")}>
          <GoogleIcon size={18} /> Google
        </button>
        <button type="button" className="btn btn-soft btn-md" onClick={() => onPick("Apple")}>
          <AppleIcon size={18} /> Apple
        </button>
      </div>
    </>
  );
}

export function Login() {
  const user = useStore((s) => s.user);
  const login = useStore((s) => s.login);
  const toast = useStore((s) => s.toast);
  const nav = useNavigate();
  const loc = useLocation();
  const from = (loc.state as { from?: string } | null)?.from ?? "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  if (!user.guest) return <Navigate to={from} replace />;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!emailOk(email)) next.email = "Enter a valid email address.";
    if (password.length < 6) next.password = "Password must be at least 6 characters.";
    setErrors(next);
    if (Object.keys(next).length) return;
    login(email.trim());
    nav(from, { replace: true });
  };

  const forgot = () => {
    if (!emailOk(email)) {
      setErrors({ email: "Type your email first and we'll send a reset link." });
      return;
    }
    setErrors({});
    toast("Check your mail to reset your password");
  };

  return (
    <AuthShell>
      <form className="auth-card" onSubmit={submit} noValidate>
        <LogoMark />
        <h1>Welcome Back!</h1>
        <p className="auth-sub">Ready to jump into your next group match?</p>
        <TextField
          label="Email Address"
          icon={<Mail size={18} />}
          type="email"
          placeholder="alex@example.com"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
        />
        <TextField
          label="Password"
          icon={<Lock size={18} />}
          type="password"
          placeholder="••••••••"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          action={
            <button type="button" className="link-sm" onClick={forgot}>
              Forgot?
            </button>
          }
        />
        <Button type="submit" block size="lg">
          Login
        </Button>
        <Social
          onPick={(p) => {
            login("alex@example.com", "Alex Rivera");
            toast(`Signed in with ${p}`);
            nav(from, { replace: true });
          }}
        />
        <p className="auth-foot">
          Don't have an account? <Link to="/signup">Create an account</Link>
        </p>
        <Link to="/" className="auth-skip">
          Continue as guest
        </Link>
      </form>
    </AuthShell>
  );
}

export function Signup() {
  const user = useStore((s) => s.user);
  const login = useStore((s) => s.login);
  const toast = useStore((s) => s.toast);
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string }>({});

  if (!user.guest) return <Navigate to="/" replace />;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (name.trim().length < 2) next.name = "Tell us what to call you.";
    if (!emailOk(email)) next.email = "Enter a valid email address.";
    if (password.length < 6) next.password = "Use at least 6 characters.";
    setErrors(next);
    if (Object.keys(next).length) return;
    login(email.trim(), name.trim());
    toast(`Welcome to the squad, ${name.trim().split(" ")[0]}!`);
    nav("/", { replace: true });
  };

  return (
    <AuthShell>
      <form className="auth-card auth-card-wide" onSubmit={submit} noValidate>
        <LogoMark />
        <h1>Join the Squad</h1>
        <p className="auth-sub">Ready to jump into your next group match?</p>
        <TextField label="Full Name" icon={<User size={18} />} placeholder="Alex Johnson" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} />
        <TextField label="Email Address" icon={<Mail size={18} />} type="email" placeholder="alex@example.com" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
        <TextField label="Password" icon={<Lock size={18} />} toggleable placeholder="••••••••" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} />
        <Button type="submit" block size="lg">
          Sign Up
        </Button>
        <Social
          onPick={(p) => {
            login("alex@example.com", "Alex Rivera");
            toast(`Signed up with ${p}`);
            nav("/", { replace: true });
          }}
        />
        <p className="auth-foot">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
        <Link to="/" className="auth-skip">
          Continue as guest
        </Link>
      </form>
    </AuthShell>
  );
}
