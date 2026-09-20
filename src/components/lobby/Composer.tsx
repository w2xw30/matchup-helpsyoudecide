import { useEffect, useRef, useState, type FormEvent } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { KIND_META, POPULAR, guessVisual, type ItemKind } from "../../lib/catalog";
import { searchSuggestions, type Suggestion } from "../../lib/wiki";
import { fileToDataUrl } from "../../lib/image";
import type { Lobby, LobbyItem } from "../../data/mock";
import { useStore } from "../../store/useStore";
import { Button, Modal } from "../ui/ui";
import { ItemThumb } from "./visual";

const KINDS = Object.keys(KIND_META) as ItemKind[];

function KindPicker({ value, onChange }: { value: ItemKind; onChange: (k: ItemKind) => void }) {
  return (
    <div className="kind-picker" role="radiogroup" aria-label="Category">
      {KINDS.map((k) => (
        <button key={k} type="button" role="radio" aria-checked={value === k} className={`kind-chip ${value === k ? "on" : ""}`} onClick={() => onChange(k)}>
          {KIND_META[k].label}
        </button>
      ))}
    </div>
  );
}

function PhotoButton({ image, onChange }: { image?: string; onChange: (v?: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const toast = useStore((s) => s.toast);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          setBusy(true);
          try {
            onChange(await fileToDataUrl(f));
          } catch (err) {
            toast(err instanceof Error ? err.message : "Couldn't use that image", "warn");
          } finally {
            setBusy(false);
          }
        }}
      />
      <Button variant="soft" size="sm" pill onClick={() => ref.current?.click()} disabled={busy}>
        {busy ? <Loader2 size={14} className="spin" /> : <ImagePlus size={14} />} {image ? "Change photo" : "Upload photo"}
      </Button>
      {image && (
        <button type="button" className="link-inline" onClick={() => onChange(undefined)}>
          Remove photo
        </button>
      )}
    </>
  );
}

/** "Add an option" panel: type → instant emoji guess → live photo suggestions → optional upload. */
export function Composer({ lobby, disabled, onAdded }: { lobby: Lobby; disabled?: boolean; onAdded?: () => void }) {
  const addItem = useStore((s) => s.addItem);
  const toast = useStore((s) => s.toast);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<ItemKind | null>(null);
  const [image, setImage] = useState<string | undefined>();
  const [emoji, setEmoji] = useState<string | undefined>();
  const [note, setNote] = useState("");
  const [price, setPrice] = useState("");
  const [details, setDetails] = useState(false);
  const [res, setRes] = useState<{ q: string; list: Suggestion[]; failed: boolean }>({ q: "", list: [], failed: false });
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [fromSuggestion, setFromSuggestion] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);

  const fallback: ItemKind = lobby.kind === "mixed" ? "other" : lobby.kind;
  const guess = guessVisual(title, fallback);
  const effKind = kind ?? guess.kind;
  const effEmoji = emoji ?? (kind && kind !== guess.kind ? KIND_META[kind].emoji : guess.emoji);
  const preview = { title, image, emoji: effEmoji, kind: effKind };

  const q = title.trim();
  const active = q.length >= 2 && picked !== q;
  const loading = active && res.q !== q;
  const sugs = active && res.q === q ? res.list : [];
  const failed = active && res.q === q && res.failed;

  // Debounced lookup; the previous request is aborted so slow responses can't overwrite newer ones.
  useEffect(() => {
    if (!active) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        setRes({ q, list: await searchSuggestions(q, lobby.kind, ctrl.signal), failed: false });
      } catch (e) {
        if ((e as Error).name !== "AbortError") setRes({ q, list: [], failed: true });
      }
    }, 280);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, active, lobby.kind]);

  const reset = () => {
    setTitle("");
    setKind(null);
    setImage(undefined);
    setEmoji(undefined);
    setNote("");
    setPrice("");
    setPicked(null);
    setFromSuggestion(false);
    setError("");
  };

  const choose = (s: Suggestion) => {
    setTitle(s.title);
    setPicked(s.title);
    setImage(s.image);
    setEmoji(s.emoji);
    setKind(s.kind);
    setFromSuggestion(true);
    setNote((n) => n || (s.desc ? s.desc[0].toUpperCase() + s.desc.slice(1) : ""));
    setOpen(false);
  };

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const t = title.trim();
    if (t.length < 2) {
      setError("Give the option a name (2+ characters).");
      input.current?.focus();
      return;
    }
    if (lobby.items.some((i) => i.title.toLowerCase() === t.toLowerCase())) {
      setError("That option is already in the lobby.");
      return;
    }
    const item = addItem(lobby.id, { title: t, kind: effKind, emoji: effEmoji, image, note, price });
    if (item) {
      toast(`"${item.title}" added to the lobby`);
      onAdded?.();
      reset();
      input.current?.focus();
    }
  };

  const popular = POPULAR[lobby.kind].filter((p) => !lobby.items.some((i) => i.title.toLowerCase() === p.toLowerCase())).slice(0, 6);

  return (
    <form className="composer" onSubmit={submit} noValidate>
      <div className="composer-head">
        <h3>Add an Option</h3>
        <span className="composer-hint">Type anything — we'll find a picture.</span>
      </div>

      <div className="composer-row">
        <ItemThumb item={preview} size={52} round={false} />
        <div className="combo">
          <input
            ref={input}
            className={error ? "err" : ""}
            placeholder={lobby.kind === "movie" ? "e.g. Interstellar" : lobby.kind === "game" ? "e.g. Catan" : "What should we do tonight?"}
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setPicked(null);
              if (fromSuggestion) {
                // the photo/category belonged to the suggestion the user just edited away from
                setImage(undefined);
                setEmoji(undefined);
                setKind(null);
                setFromSuggestion(false);
              }
              setOpen(true);
              setError("");
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
            maxLength={60}
            aria-label="Option name"
            aria-expanded={open}
            autoComplete="off"
            disabled={disabled}
          />
          {open && title.trim().length >= 2 && (
            <ul className="suggest" role="listbox">
              {loading && sugs.length === 0 && (
                <li className="suggest-note">
                  <Loader2 size={14} className="spin" /> Looking for pictures…
                </li>
              )}
              {sugs.map((s) => (
                <li key={s.title}>
                  <button type="button" role="option" aria-selected={false} onMouseDown={(e) => e.preventDefault()} onClick={() => choose(s)}>
                    <ItemThumb item={{ title: s.title, image: s.image, emoji: s.emoji, kind: s.kind }} size={36} round={false} />
                    <span className="suggest-text">
                      <strong>{s.title}</strong>
                      {s.desc && <small>{s.desc}</small>}
                    </span>
                    {s.image && <span className="suggest-tag">Photo</span>}
                  </button>
                </li>
              ))}
              {!loading && sugs.length === 0 && (
                <li className="suggest-note">{failed ? "Can't reach the photo service — an emoji will do." : "No photo found — we'll use an emoji, or upload your own."}</li>
              )}
            </ul>
          )}
        </div>
        <Button type="submit" pill disabled={disabled}>
          Add to Lobby
        </Button>
      </div>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}

      {title.trim().length >= 2 && (
        <div className="composer-more">
          <KindPicker
            value={effKind}
            onChange={(k) => {
              setKind(k);
              setEmoji(undefined);
            }}
          />
          <div className="composer-actions">
            <PhotoButton
              image={image}
              onChange={(v) => {
                setImage(v);
                setFromSuggestion(false);
              }}
            />
            <button type="button" className="link-inline" onClick={() => setDetails((d) => !d)}>
              {details ? "Hide details" : "Add note or price"}
            </button>
          </div>
          {details && (
            <div className="composer-details">
              <input placeholder="Note (optional) — why this one?" value={note} onChange={(e) => setNote(e.target.value)} maxLength={140} aria-label="Note" />
              <input placeholder="Price e.g. $12" value={price} onChange={(e) => setPrice(e.target.value)} maxLength={12} aria-label="Price" />
            </div>
          )}
        </div>
      )}

      {popular.length > 0 && title.trim().length < 2 && (
        <div className="popular">
          <span>Try:</span>
          {popular.map((p) => {
            return (
              <button
                key={p}
                type="button"
                className="pop-chip"
                onClick={() => {
                  setTitle(p);
                  setOpen(true);
                  input.current?.focus();
                }}
              >
                {p}
              </button>
            );
          })}
        </div>
      )}
    </form>
  );
}

export function ItemEditor({ lobby, item, onClose }: { lobby: Lobby; item: LobbyItem | null; onClose: () => void }) {
  return (
    <Modal open={!!item} onClose={onClose} label="Edit option">
      {item && <EditorBody lobby={lobby} item={item} onClose={onClose} />}
    </Modal>
  );
}

function EditorBody({ lobby, item, onClose }: { lobby: Lobby; item: LobbyItem; onClose: () => void }) {
  const updateItem = useStore((s) => s.updateItem);
  const toast = useStore((s) => s.toast);
  const [title, setTitle] = useState(item.title);
  const [kind, setKind] = useState<ItemKind>(item.kind);
  const [emoji, setEmoji] = useState(item.emoji);
  const [image, setImage] = useState(item.image);
  const [note, setNote] = useState(item.note ?? "");
  const [price, setPrice] = useState(item.price ?? "");
  const [error, setError] = useState("");
  const save = (e: FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (t.length < 2) return setError("Give the option a name (2+ characters).");
    if (lobby.items.some((i) => i.id !== item.id && i.title.toLowerCase() === t.toLowerCase())) return setError("Another option already has that name.");
    updateItem(lobby.id, item.id, { title: t, kind, emoji, image, note, price });
    toast("Changes Saved");
    onClose();
  };
  return (
    <form className="sheet" onSubmit={save} noValidate>
      <button type="button" className="modal-x" onClick={onClose} aria-label="Close">
        <X size={16} />
      </button>
      <h3>Edit option</h3>
      <div className="editor-top">
        <ItemThumb item={{ title, image, emoji, kind }} size={72} round={false} />
        <div className="editor-photo">
          <PhotoButton image={image} onChange={setImage} />
        </div>
      </div>
      <label className="sheet-label" htmlFor="ed-title">
        Name
      </label>
      <input id="ed-title" className={`sheet-input ${error ? "err" : ""}`} value={title} onChange={(e) => (setTitle(e.target.value), setError(""))} maxLength={60} data-autofocus />
      {error && <p className="field-error">{error}</p>}
      <span className="sheet-label">Category</span>
      <KindPicker
        value={kind}
        onChange={(k) => {
          setKind(k);
          if (!image) setEmoji(KIND_META[k].emoji);
        }}
      />
      <label className="sheet-label" htmlFor="ed-note">
        Note
      </label>
      <input id="ed-note" className="sheet-input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={140} />
      <label className="sheet-label" htmlFor="ed-price">
        Price
      </label>
      <input id="ed-price" className="sheet-input" value={price} onChange={(e) => setPrice(e.target.value)} maxLength={12} />
      <div className="sheet-actions">
        <Button variant="soft" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit">Save</Button>
      </div>
    </form>
  );
}
