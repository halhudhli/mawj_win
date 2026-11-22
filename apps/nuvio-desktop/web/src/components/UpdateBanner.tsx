// Discreet bar at the top when a newer version is published: version, what is new (expandable),
// "Atualizar agora" / "Depois". While updating: download progress, signature check, installer.

import { useEffect, useState } from "react";
import { clearInstallError, dismissUpdate, installUpdate, startAutomaticChecks, useUpdates } from "../updates";
import { formatNumber, t } from "../i18n";
import { backendText } from "../i18n/backend";

export function megabytes(n: number) {
  return `${formatNumber(n / 1048576, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MB`;
}

export function UpdateBanner({ automatic }: { automatic: boolean }) {
  const u = useUpdates();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (automatic && u.status?.configured) startAutomaticChecks();
  }, [automatic, u.status?.configured]);

  const a = u.available;
  if (!a || (u.dismissed === a.version && !u.installing)) return null;
  const p = u.installing;
  const pct = p?.total ? Math.min(100, Math.round((p.downloaded / p.total) * 100)) : null;

  return (
    <div className="update-banner" role="status" data-testid="update-banner">
      <div className="update-main">
        <span className="update-dot" aria-hidden />
        <span>
          <b>{t("update.available", { name: t("app.name"), version: a.version })}</b> <span className="muted small">{t("update.current", { version: a.currentVersion })}</span>
        </span>
        {a.notes && !p && (
          <button className="link" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? t("update.hideNotes") : t("update.notes")}</button>
        )}
        <span className="spacer" />
        {!p && (
          <>
            <button className="primary small-btn" onClick={() => void installUpdate()} data-testid="update-now">{t("update.now")}</button>
            <button className="ghost small-btn" onClick={dismissUpdate}>{t("common.later")}</button>
          </>
        )}
        {p && p.phase === "downloading" && (
          <span className="update-progress">
            {t("update.downloading", { progress: pct !== null ? `${pct}%` : megabytes(p.downloaded) })}
            <span className="update-bar"><span style={{ width: `${pct ?? 30}%` }} /></span>
          </span>
        )}
        {p && p.phase === "verifying" && <span>{t("update.verifying")}</span>}
        {p && p.phase === "installing" && <span>{t("update.installing")}</span>}
        {p && p.phase === "error" && (
          <>
            <span className="update-error">{p.error ? backendText(p.error) : null}</span>
            <button className="ghost small-btn" onClick={clearInstallError}>{t("common.close")}</button>
          </>
        )}
      </div>
      {open && a.notes && !p && <pre className="update-notes">{a.notes}</pre>}
    </div>
  );
}
