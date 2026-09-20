import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link, type LinkProps } from "react-router-dom";
import { Check, Eye, EyeOff, TriangleAlert, X } from "lucide-react";
import { useStore } from "../../store/useStore";

/* ---------- Button ---------- */
type Variant = "primary" | "coral" | "soft" | "outline" | "ghost" | "danger" | "white";
interface BtnProps {
  variant?: Variant;
  size?: "sm" | "md" | "lg" | "xl";
  block?: boolean;
  pill?: boolean;
}
const btnClass = ({ variant = "primary", size = "md", block, pill }: BtnProps, extra?: string) =>
  ["btn", `btn-${variant}`, `btn-${size}`, block && "btn-block", pill && "btn-pill", extra].filter(Boolean).join(" ");

export function Button({ variant, size, block, pill, className, ...rest }: BtnProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" {...rest} className={btnClass({ variant, size, block, pill }, className)} />;
}
export function LinkButton({ variant, size, block, pill, className, ...rest }: BtnProps & LinkProps) {
  return <Link {...rest} className={btnClass({ variant, size, block, pill }, className)} />;
}

/* ---------- Avatar ---------- */
export function Avatar({
  src,
  name = "",
  size = 40,
  status,
  ring,
  className = "",
}: {
  src?: string;
  name?: string;
  size?: number;
  status?: "online" | "offline" | "away" | "ready";
  ring?: string;
  className?: string;
}) {
  const [bad, setBad] = useState(false);
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span className={`avatar ${ring ? "ringed" : ""} ${className}`} style={{ width: size, height: size, ["--ring" as string]: ring }}>
      {src && !bad ? (
        <img src={src} alt={name} onError={() => setBad(true)} />
      ) : (
        <span className="avatar-fallback" style={{ fontSize: size * 0.36 }}>
          {initials}
        </span>
      )}
      {status && <span className={`avatar-dot dot-${status}`} />}
    </span>
  );
}

export function AvatarStack({ avatars, extra, size = 40 }: { avatars: string[]; extra?: string; size?: number }) {
  return (
    <div className="avatar-stack">
      {avatars.map((a, i) => (
        <Avatar key={i} src={a} size={size} className="stack-item" />
      ))}
      {extra && (
        <span className="stack-extra" style={{ width: size, height: size, fontSize: size * 0.28 }}>
          {extra}
        </span>
      )}
    </div>
  );
}

/* ---------- Fields ---------- */
interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  icon?: ReactNode;
  error?: string;
  action?: ReactNode;
  toggleable?: boolean;
  bare?: boolean;
}
export function TextField({ label, icon, error, action, toggleable, bare, className = "", id, ...rest }: FieldProps) {
  const auto = useId();
  const fid = id ?? auto;
  const [show, setShow] = useState(false);
  const type = toggleable ? (show ? "text" : "password") : rest.type;
  return (
    <div className={`field ${error ? "has-error" : ""} ${className}`}>
      {(label || action) && (
        <div className="field-head">
          {label && <label htmlFor={fid}>{label}</label>}
          {action}
        </div>
      )}
      <div className={`field-control ${bare ? "bare" : ""}`}>
        {icon && <span className="field-icon">{icon}</span>}
        <input id={fid} {...rest} type={type} aria-invalid={!!error} />
        {toggleable && (
          <button type="button" className="field-eye" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"}>
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
      {error && <p className="field-error" role="alert">{error}</p>}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className={`toggle ${checked ? "on" : ""}`} onClick={() => onChange(!checked)}>
      <span className="toggle-knob" />
    </button>
  );
}

export function Chip({ active, children, onClick }: { active?: boolean; children: ReactNode; onClick?: () => void }) {
  return (
    <button type="button" className={`chip ${active ? "active" : ""}`} onClick={onClick} aria-pressed={active}>
      {children}
    </button>
  );
}

/* ---------- Toasts ---------- */
export function ToastHost() {
  const toasts = useStore((s) => s.toasts);
  const dismiss = useStore((s) => s.dismissToast);
  return createPortal(
    <div className="toast-host" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.tone}`} role="status" onClick={() => dismiss(t.id)}>
          <span className="toast-icon">{t.tone === "warn" ? <TriangleAlert size={16} /> : <Check size={16} strokeWidth={3} />}</span>
          {t.message}
        </div>
      ))}
    </div>,
    document.body,
  );
}

/* ---------- Modal ---------- */
const modalStack: object[] = [];

export function Modal({ open, onClose, children, label }: { open: boolean; onClose: () => void; children: ReactNode; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const token = {};
    modalStack.push(token);
    const onKey = (e: KeyboardEvent) => {
      if (modalStack[modalStack.length - 1] !== token) return; // only the top-most modal reacts
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && ref.current) {
        const f = ref.current.querySelectorAll<HTMLElement>("button, a[href], input, [tabindex]:not([tabindex='-1'])");
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    ref.current?.querySelector<HTMLElement>("[data-autofocus], button, a[href], input")?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      modalStack.splice(modalStack.indexOf(token), 1);
      if (modalStack.length === 0) document.body.style.overflow = "";
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={label} ref={ref}>
        {children}
      </div>
    </div>,
    document.body,
  );
}

/* ---------- Confirm cards (Logout / Delete / Success) ---------- */
export function ConfirmCard({
  open,
  onClose,
  tone = "warn",
  title,
  text,
  confirmLabel,
  cancelLabel = "Back",
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  tone?: "warn" | "success";
  title: string;
  text: string;
  confirmLabel: string;
  cancelLabel?: string | null;
  onConfirm: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} label={title}>
      <div className="confirm-card">
        <span className={`confirm-icon ${tone}`}>{tone === "warn" ? <TriangleAlert size={26} /> : <Check size={28} strokeWidth={3} />}</span>
        <h3>{title}</h3>
        <p>{text}</p>
        <div className="confirm-actions">
          {cancelLabel && (
            <Button variant="soft" onClick={onClose} data-autofocus>
              {cancelLabel}
            </Button>
          )}
          <Button
            variant={tone === "warn" ? "coral" : "primary"}
            onClick={() => {
              onConfirm();
            }}
          >
            {confirmLabel}
          </Button>
        </div>
        <button type="button" className="modal-x" onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>
      </div>
    </Modal>
  );
}

/* ---------- Code input (000-000) ---------- */
export function CodeInput({
  value,
  onChange,
  error,
  onEnter,
}: {
  value: string;
  onChange: (v: string) => void;
  error?: boolean;
  onEnter?: () => void;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(6, " ").split("");
  const setAt = (i: number, d: string) => {
    const arr = value.padEnd(6, " ").split("");
    arr[i] = d;
    onChange(arr.join("").replace(/ +$/, ""));
  };
  return (
    <div className={`code-input ${error ? "error" : ""}`} role="group" aria-label="Session code">
      {digits.map((d, i) => (
        <span key={i} className="code-cell-wrap">
          {i === 3 && <span className="code-dash">-</span>}
          <input
            ref={(el) => {
              refs.current[i] = el;
            }}
            className="code-cell"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={1}
            placeholder="0"
            aria-label={`Digit ${i + 1}`}
            value={d.trim()}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "");
              if (!v) return;
              setAt(i, v[v.length - 1]);
              refs.current[i + 1]?.focus();
            }}
            onKeyDown={(e) => {
              if (e.key === "Backspace") {
                e.preventDefault();
                if (d.trim()) setAt(i, " ");
                else if (i > 0) {
                  setAt(i - 1, " ");
                  refs.current[i - 1]?.focus();
                }
              } else if (e.key === "ArrowLeft") refs.current[i - 1]?.focus();
              else if (e.key === "ArrowRight") refs.current[i + 1]?.focus();
              else if (e.key === "Enter") onEnter?.();
            }}
            onPaste={(e) => {
              const t = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
              if (!t) return;
              e.preventDefault();
              onChange(t);
              refs.current[Math.min(t.length, 5)]?.focus();
            }}
            onFocus={(e) => e.target.select()}
          />
        </span>
      ))}
    </div>
  );
}
