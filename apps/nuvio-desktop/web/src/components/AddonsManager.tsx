// Settings → Addons: the active profile's addons, as in the original's AddonsScreen (install from a
// manifest address, enable/disable, order, refresh, configure on the addon's page, delete with
// confirmation). Every action goes through Rust; the manifest addresses never reach the UI.

import { useEffect, useState } from "react";
import { api, errorText } from "../api";
import type { AddonPreview, AddonView, AddonsView } from "../types";
import { typeLabel } from "./PosterCard";
import { t } from "../i18n";
import { backendText } from "../i18n/backend";

type Feedback = { kind: "ok" | "error" | "busy"; text: string } | null;

function AddonLogo({ addon }: { addon: AddonView }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="addon-logo" aria-hidden>
      {addon.logo && !failed ? <img src={addon.logo} alt="" loading="lazy" onError={() => setFailed(true)} /> : addon.name.slice(0, 1).toUpperCase()}
    </div>
  );
}

function Badges({ addon }: { addon: AddonView }) {
  return (
    <div className="chips addon-badges">
      {addon.status === "ok" && <span className="chip badge-ok">{t("addon.active")}</span>}
      {addon.status === "disabled" && <span className="chip">{t("addon.disabled")}</span>}
      {addon.status === "error" && <span className="chip badge-error">{t("addon.unavailable")}</span>}
      {addon.configurable && <span className="chip">{t("addon.configurable")}</span>}
      {addon.tracking && <span className="chip">{t("addon.tracking")}</span>}
      {addon.types.slice(0, 6).map((type) => <span key={type} className="chip muted">{typeLabel(type)}</span>)}
    </div>
  );
}

function Catalogs({ addon }: { addon: AddonView }) {
  const [open, setOpen] = useState(false);
  if (!addon.catalogCount) return null;
  return (
    <div className="addon-catalogs">
      <button className="link" onClick={() => setOpen(!open)} aria-expanded={open}>
        {t("addon.catalogCount", { count: addon.catalogCount })} {open ? "▴" : "▾"}
      </button>
      {open && (
        addon.catalogs.length ? (
          <ul>{addon.catalogs.map((c, i) => <li key={`${c.contentType}-${c.name}-${i}`}>{c.name} <span className="muted small">· {typeLabel(c.contentType)}</span></li>)}</ul>
        ) : (
          <div className="muted small">{t("addon.enableToList")}</div>
        )
      )}
    </div>
  );
}

export function AddonsManager() {
  const [view, setView] = useState<AddonsView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [address, setAddress] = useState("");
  const [preview, setPreview] = useState<AddonPreview | null>(null);
  const [checking, setChecking] = useState(false);
  const [consent, setConsent] = useState(false);

  useEffect(() => {
    api.addonsList().then(setView, (e) => setError(errorText(e)));
  }, []);

  const run = async (key: string | null, busy: string, action: () => Promise<AddonsView>, done: string | ((v: AddonsView) => string)): Promise<boolean> => {
    setBusyKey(key);
    setFeedback({ kind: "busy", text: busy });
    try {
      const v = await action();
      setView(v);
      setFeedback({ kind: "ok", text: typeof done === "string" ? done : done(v) });
      return true;
    } catch (e) {
      setFeedback({ kind: "error", text: errorText(e) });
      return false;
    } finally {
      setBusyKey(null);
    }
  };

  const check = async () => {
    setPreview(null);
    setConsent(false);
    setChecking(true);
    setFeedback({ kind: "busy", text: t("addon.validating") });
    try {
      const p = await api.addonPreview(address);
      setPreview(p);
      setFeedback(null);
    } catch (e) {
      setFeedback({ kind: "error", text: t("addon.installFailed", { error: errorText(e) }) });
    } finally {
      setChecking(false);
    }
  };

  const install = async () => {
    if (!preview) return;
    const name = preview.addon.name;
    if (await run(null, t("addon.installing"), () => api.addonInstall(preview.key, consent), t("addon.installed", { name }))) {
      setPreview(null);
      setAddress("");
    }
  };

  const remove = (a: AddonView) => {
    if (!window.confirm(t("addon.removeConfirm", { name: a.name }))) return;
    void run(a.key, t("addon.removing"), () => api.addonRemove(a.key), t("addon.removed", { name: a.name }));
  };

  const configure = async (a: AddonView) => {
    try {
      await api.addonConfigure(a.key);
      setFeedback({ kind: "ok", text: t("addon.configureOpened", { name: a.name }) });
    } catch (e) {
      setFeedback({ kind: "error", text: errorText(e) });
    }
  };

  if (error) return <div className="row-error">{t("addon.readFailed", { error })}</div>;
  if (!view) return <div className="muted">{t("addon.loading")}</div>;
  const active = view.addons.filter((a) => a.status === "ok").length;
  const catalogs = view.addons.filter((a) => a.enabled).reduce((n, a) => n + a.catalogCount, 0);
  const ro = view.readOnly;

  return (
    <div className="settings-group addons" data-testid="addons">
      <div className="addon-overview">
        <div><b>{view.addons.length}</b><span className="muted small">{t("addon.addons")}</span></div>
        <div><b>{active}</b><span className="muted small">{t("addon.activeCount")}</span></div>
        <div><b>{catalogs}</b><span className="muted small">{t("addon.catalogs")}</span></div>
      </div>

      {ro && <div className="banner">{t("addon.readOnly")}</div>}

      {!ro && (
        <section className="addon-install">
          <h2 className="settings-subtitle">{t("addon.add")}</h2>
          <form className="addon-install-row" noValidate onSubmit={(e) => { e.preventDefault(); void check(); }}>
            <input
              // Text, not `url`: the browser would block addresses without scheme, which the
              // original accepts (https:// is added by Rust, like `normalizeManifestUrl`).
              type="text"
              inputMode="url"
              placeholder={t("addon.urlPlaceholder")}
              aria-label={t("addon.url")}
              dir="ltr"
              data-testid="addon-url"
              value={address}
              onChange={(e) => { setAddress(e.target.value); setPreview(null); }}
              spellCheck={false}
              autoComplete="off"
            />
            <button className="primary" type="submit" disabled={checking || !address.trim()} data-testid="addon-check">
              {checking ? t("addon.checking") : t("addon.check")}
            </button>
          </form>
          {preview && (
            <div className="addon-card preview" data-testid="addon-preview">
              <AddonLogo addon={preview.addon} />
              <div className="addon-main">
                <div className="addon-title">{preview.addon.name} <span className="muted small">{t("addon.version", { version: preview.addon.version })}</span></div>
                <div className="muted small">{preview.addon.host}{preview.addon.configured && t("addon.configured")}</div>
                {preview.addon.description && <p className="addon-desc">{preview.addon.description}</p>}
                <Badges addon={preview.addon} />
                <Catalogs addon={preview.addon} />
                {preview.addon.configurationRequired && <div className="muted small">{t("addon.needsConfig")}</div>}
                {preview.tracking && (
                  <label className="addon-consent">
                    <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} data-testid="addon-consent" />
                    <span>
                      {t("addon.trackingNotice", { name: preview.addon.name })} {t("addon.trackingAgree")}
                    </span>
                  </label>
                )}
                <div className="addon-actions">
                  <button className="primary" onClick={() => void install()} disabled={preview.tracking && !consent} data-testid="addon-install">{t("addon.install")}</button>
                  <button className="chip" onClick={() => setPreview(null)}>{t("common.cancel")}</button>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {feedback && (
        <div className={`addon-feedback ${feedback.kind}`} role="status" data-testid="addon-feedback">{feedback.text}</div>
      )}

      <h2 className="settings-subtitle">{t("addon.installedTitle")}</h2>
      {view.addons.length === 0 ? (
        <div className="muted" data-testid="addons-empty">{t("addon.none")}</div>
      ) : (
        <ul className="addon-list">
          {view.addons.map((a, i) => (
            <li key={a.key} className={`addon-card ${a.enabled ? "" : "off"}`} data-key={a.key} data-status={a.status}>
              <AddonLogo addon={a} />
              <div className="addon-main">
                <div className="addon-title">
                  {a.name} {a.version && <span className="muted small">{t("addon.version", { version: a.version })}</span>}
                </div>
                <div className="muted small">{a.host}{a.configured && t("addon.configured")}</div>
                {a.description && <p className="addon-desc">{a.description}</p>}
                {a.error && <div className="row-error small">{backendText(a.error)}</div>}
                <Badges addon={a} />
                <Catalogs addon={a} />
              </div>
              <div className="addon-side">
                <button
                  role="switch"
                  aria-checked={a.enabled}
                  aria-label={a.enabled ? t("addon.disable", { name: a.name }) : t("addon.enable", { name: a.name })}
                  className={`switch ${a.enabled ? "on" : ""}`}
                  disabled={ro || busyKey === a.key}
                  data-testid="addon-toggle"
                  onClick={() => void run(a.key, a.enabled ? t("addon.disabling") : t("addon.enabling"), () => api.addonSetEnabled(a.key, !a.enabled), a.enabled ? t("addon.disabledDone", { name: a.name }) : t("addon.enabledDone", { name: a.name }))}
                >
                  <span className="knob" />
                </button>
                <div className="addon-buttons">
                  <button className="icon-btn" aria-label={t("addon.moveUp", { name: a.name })} title={t("addon.moveUpShort")} disabled={ro || i === 0 || !!busyKey} onClick={() => void run(a.key, t("addon.reordering"), () => api.addonMove(a.key, -1), t("addon.orderSaved"))}>↑</button>
                  <button className="icon-btn" aria-label={t("addon.moveDown", { name: a.name })} title={t("addon.moveDownShort")} disabled={ro || i === view.addons.length - 1 || !!busyKey} onClick={() => void run(a.key, t("addon.reordering"), () => api.addonMove(a.key, 1), t("addon.orderSaved"))}>↓</button>
                  <button
                    className="icon-btn"
                    aria-label={t("addon.refresh", { name: a.name })}
                    title={t("addon.refreshShort")}
                    disabled={!a.enabled || busyKey === a.key}
                    data-testid="addon-refresh"
                    onClick={() => void run(a.key, t("addon.refreshing", { name: a.name }), () => api.addonRefresh(a.key), (v) => {
                      const now = v.addons.find((x) => x.key === a.key);
                      return now?.status === "ok" ? t("addon.refreshed", { name: now.name, version: now.version }) : `${a.name}: ${now?.error ? backendText(now.error) : t("addon.refreshFailed")}`;
                    })}
                  >
                    ⟳
                  </button>
                  {a.configurable && (
                    <button className="icon-btn" aria-label={t("addon.configure", { name: a.name })} title={t("addon.configureShort")} onClick={() => void configure(a)}>⚙</button>
                  )}
                  <button className="icon-btn danger" aria-label={t("addon.delete", { name: a.name })} title={t("addon.deleteShort")} disabled={ro || !!busyKey} data-testid="addon-remove" onClick={() => remove(a)}>🗑</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
