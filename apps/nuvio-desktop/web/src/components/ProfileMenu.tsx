// Profile switcher (sidebar avatar) and profile editor, following the original's rules: up to 6
// profiles, a new one takes the lowest free slot, the primary profile (1) cannot be deleted, deleting
// removes the profile's data (Nuvio Astra keeps a backup), a secondary profile may use the primary
// profile's addons. Avatars come from the Nuvio account's catalog (`get_avatar_catalog`); without
// one, the profile shows its color and initial. PIN: set, changed and removed with the account.

import { useEffect, useRef, useState } from "react";
import { api, errorText } from "../api";
import { useAccount, useAvatars } from "../account";
import type { ProfileInfo, ProfilesView } from "../types";
import { t } from "../i18n";

export function Avatar({ profile, size = 34 }: { profile: Pick<ProfileInfo, "name" | "avatarColorHex"> & { avatarId?: string | null }; size?: number }) {
  const avatars = useAvatars();
  const [broken, setBroken] = useState(false);
  const image = profile.avatarId ? avatars.find((a) => a.id === profile.avatarId) : undefined;
  if (image && !broken) {
    return (
      <span className="avatar avatar-img" aria-hidden style={{ width: size, height: size, background: image.bgColor ?? "transparent" }}>
        <img src={image.imageUrl} alt="" draggable={false} onError={() => setBroken(true)} />
      </span>
    );
  }
  const color = profile.avatarColorHex || "#1E88E5";
  // Light colors (e.g. #E9E8F2) need dark text.
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16) || 0);
  const dark = r * 0.299 + g * 0.587 + b * 0.114 > 160;
  return (
    <span className="avatar" aria-hidden style={{ background: color, color: dark ? "#14161c" : "#fff", width: size, height: size, fontSize: size * 0.42 }}>
      {profile.name.slice(0, 1).toUpperCase() || "?"}
    </span>
  );
}

interface MenuProps {
  view: ProfilesView;
  busy: boolean;
  onSwitch(index: number): void;
  onManage(): void;
  onClose(): void;
}

export function ProfileMenu({ view, busy, onSwitch, onManage, onClose }: MenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const away = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && onClose();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("mousedown", away);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("mousedown", away);
      window.removeEventListener("keydown", esc);
    };
  }, [onClose]);
  return (
    <div className="profile-menu" ref={ref} role="menu" aria-label={t("prof.menu")} data-testid="profile-menu">
      <div className="muted small profile-menu-title">{t("prof.who")}</div>
      {view.profiles.map((p) => {
        const active = p.index === view.active;
        return (
          <button
            key={p.index}
            role="menuitemradio"
            aria-checked={active}
            className={`profile-option ${active ? "active" : ""}`}
            disabled={busy}
            data-profile={p.index}
            onClick={() => (active ? onClose() : onSwitch(p.index))}
          >
            <Avatar profile={p} />
            <span className="profile-option-name">{p.name}</span>
            {p.pinEnabled && <span className="profile-lock" title={t("prof.pinProtected")} aria-label={t("prof.pinProtected")}>🔒</span>}
            {active && <span className="profile-check" aria-label={t("prof.active")}>✓</span>}
          </button>
        );
      })}
      <button className="profile-option manage" onClick={onManage} data-testid="profiles-manage">
        <span className="profile-manage-icon" aria-hidden>✎</span>
        <span>{t("prof.manage")}</span>
      </button>
    </div>
  );
}

interface EditorProps {
  view: ProfilesView;
  onChanged(view: ProfilesView): void;
  onClose(): void;
}

type Editing = { index: number | null; name: string; color: string; usesPrimaryAddons: boolean; avatarId: string | null };

export function ProfilesDialog({ view, onChanged, onClose }: EditorProps) {
  const [editing, setEditing] = useState<Editing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!editing) return;
    setBusy(true);
    setError(null);
    try {
      const v = editing.index === null
        ? await api.profileCreate(editing.name, editing.color, editing.usesPrimaryAddons)
        : await api.profileUpdate(editing.index, editing.name, editing.color, editing.usesPrimaryAddons, editing.avatarId ?? "");
      onChanged(v);
      setEditing(null);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!editing || editing.index === null) return;
    const name = view.profiles.find((p) => p.index === editing.index)?.name ?? editing.name;
    if (!window.confirm(t("prof.deleteConfirm", { name }))) return;
    setBusy(true);
    setError(null);
    try {
      onChanged(await api.profileDelete(editing.index));
      setEditing(null);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={t("prof.manage")} data-testid="profiles-dialog">
        <header className="modal-header">
          <h2>{editing ? (editing.index === null ? t("prof.add") : t("prof.edit")) : t("prof.manage")}</h2>
          <button className="icon-btn" aria-label={t("common.close")} onClick={onClose} disabled={busy}>✕</button>
        </header>

        {!editing && (
          <>
            <div className="profiles-grid">
              {view.profiles.map((p) => (
                <button key={p.index} className="profile-tile" onClick={() => setEditing({ index: p.index, name: p.name, color: p.avatarColorHex, usesPrimaryAddons: p.usesPrimaryAddons, avatarId: p.avatarId })} data-profile={p.index}>
                  <Avatar profile={p} size={64} />
                  <span>{p.name}</span>
                  <span className="muted small">{p.index === view.active ? t("prof.activeShort") : p.index === 1 ? t("prof.primary") : t("prof.number", { index: p.index })}</span>
                </button>
              ))}
              {view.profiles.length < view.max && (
                <button className="profile-tile add" onClick={() => setEditing({ index: null, name: "", color: view.colors[view.profiles.length % view.colors.length], usesPrimaryAddons: false, avatarId: null })} data-testid="profile-add">
                  <span className="avatar add" aria-hidden style={{ width: 64, height: 64 }}>+</span>
                  <span>{t("prof.create")}</span>
                  <span className="muted small">{t("prof.slots", { count: view.profiles.length, max: view.max })}</span>
                </button>
              )}
            </div>
            <p className="muted small">{t("prof.ownData")}</p>
          </>
        )}

        {editing && (
          <form className="profile-form" onSubmit={(e) => { e.preventDefault(); void save(); }}>
            <div className="profile-form-head">
              <Avatar profile={{ name: editing.name || "?", avatarColorHex: editing.color, avatarId: editing.avatarId }} size={72} />
              <input
                aria-label={t("prof.name")}
                placeholder={t("prof.name")}
                value={editing.name}
                maxLength={40}
                autoFocus
                data-testid="profile-name"
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
            </div>
            <div className="muted small">{t("prof.color")}</div>
            <div className="color-swatches" role="radiogroup" aria-label={t("prof.color")}>
              {view.colors.map((c) => (
                <button
                  type="button"
                  key={c}
                  role="radio"
                  aria-checked={editing.color.toUpperCase() === c}
                  aria-label={c}
                  className={`swatch ${editing.color.toUpperCase() === c ? "active" : ""}`}
                  style={{ background: c }}
                  onClick={() => setEditing({ ...editing, color: c })}
                />
              ))}
            </div>
            {editing.index !== null && <AvatarPicker value={editing.avatarId} onChange={(avatarId) => setEditing({ ...editing, avatarId })} />}
            {editing.index !== null && (
              <PinSection profile={view.profiles.find((p) => p.index === editing.index)!} onChanged={onChanged} />
            )}
            {editing.index !== 1 && (
              <label className="setting-row profile-primary">
                <div className="setting-text">
                  <div className="setting-title">{t("prof.usePrimary")}</div>
                  <div className="muted small">{t("prof.usePrimaryDesc")}</div>
                </div>
                <input type="checkbox" checked={editing.usesPrimaryAddons} onChange={(e) => setEditing({ ...editing, usesPrimaryAddons: e.target.checked })} />
              </label>
            )}
            {error && <div className="row-error">{error}</div>}
            <div className="modal-actions">
              {editing.index !== null && editing.index > 1 && (
                <button type="button" className="chip danger" onClick={() => void remove()} disabled={busy} data-testid="profile-delete">{t("prof.delete")}</button>
              )}
              <span className="spacer" />
              <button type="button" className="chip" onClick={() => { setEditing(null); setError(null); }} disabled={busy}>{t("common.back")}</button>
              <button type="submit" className="primary" disabled={busy || !editing.name.trim()} data-testid="profile-save">{busy ? t("common.saving") : t("common.save")}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

/** Avatars of the account's catalog (`get_avatar_catalog`, by category and order). */
function AvatarPicker({ value, onChange }: { value: string | null; onChange(id: string | null): void }) {
  const avatars = useAvatars();
  const account = useAccount();
  if (!avatars.length) {
    return <div className="muted small">{account?.configured ? t("prof.avatarsLater") : t("prof.avatarsOff")}</div>;
  }
  return (
    <div className="avatar-picker" role="radiogroup" aria-label={t("prof.avatar")}>
      <button type="button" role="radio" aria-checked={!value} className={`avatar-choice none ${!value ? "active" : ""}`} onClick={() => onChange(null)} title={t("prof.colorInitial")}>Aa</button>
      {avatars.map((a) => (
        <button type="button" key={a.id} role="radio" aria-checked={value === a.id} title={a.displayName} className={`avatar-choice ${value === a.id ? "active" : ""}`} style={{ background: a.bgColor ?? undefined }} onClick={() => onChange(a.id)} data-avatar={a.id}>
          <img src={a.imageUrl} alt={a.displayName} loading="lazy" />
        </button>
      ))}
    </div>
  );
}

/** PIN of a profile: set / change / remove through the account (`set_profile_pin`, `clear_profile_pin`). */
function PinSection({ profile, onChanged }: { profile: ProfileInfo; onChanged(view: ProfilesView): void }) {
  const account = useAccount();
  const [mode, setMode] = useState<"idle" | "set" | "clear">("idle");
  const [current, setCurrent] = useState("");
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const digits = (v: string) => v.replace(/\D/g, "").slice(0, 4);
  const reset = () => { setMode("idle"); setCurrent(""); setPin(""); setConfirm(""); setError(null); };

  if (!account?.signedIn) {
    return (
      <div className="setting-row">
        <div className="setting-text">
          <div className="setting-title">{t("pin.lock")}</div>
          <div className="muted small">{profile.pinEnabled ? `${t("pin.protected")} ` : ""}{t("pin.signInToChange")}</div>
        </div>
      </div>
    );
  }

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      if (mode === "set") {
        if (pin.length !== 4 || pin !== confirm) throw new Error(pin.length !== 4 ? t("pin.mustBe4") : t("pin.mismatch"));
        onChanged(await api.profilePinSet(profile.index, pin, profile.pinEnabled ? current : null));
      } else {
        onChanged(await api.profilePinClear(profile.index, current || null));
      }
      reset();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pin-section" data-testid="pin-section">
      <div className="setting-title">{t("pin.lock")}</div>
      <div className="muted small">{profile.pinEnabled ? t("pin.protected") : t("pin.addHint")}</div>
      {mode === "idle" && (
        <div className="account-actions">
          <button type="button" className="chip" onClick={() => setMode("set")}>{profile.pinEnabled ? t("pin.change") : t("pin.set")}</button>
          {profile.pinEnabled && <button type="button" className="chip danger" onClick={() => setMode("clear")}>{t("pin.removeLock")}</button>}
        </div>
      )}
      {mode !== "idle" && (
        <div className="pin-fields">
          {profile.pinEnabled && <input inputMode="numeric" type="password" placeholder={t("pin.current")} aria-label={t("pin.current")} value={current} onChange={(e) => setCurrent(digits(e.target.value))} />}
          {mode === "set" && (
            <>
              <input inputMode="numeric" type="password" placeholder={t("pin.newPlaceholder")} aria-label={t("pin.new")} value={pin} onChange={(e) => setPin(digits(e.target.value))} />
              <input inputMode="numeric" type="password" placeholder={t("pin.repeat")} aria-label={t("pin.repeat")} value={confirm} onChange={(e) => setConfirm(digits(e.target.value))} />
            </>
          )}
          <button type="button" className="primary" disabled={busy} onClick={() => void save()}>{busy ? t("common.saving") : mode === "set" ? t("pin.save") : t("pin.remove")}</button>
          <button type="button" className="chip" onClick={reset}>{t("common.cancel")}</button>
        </div>
      )}
      {error && <div className="row-error">{error}</div>}
    </div>
  );
}
