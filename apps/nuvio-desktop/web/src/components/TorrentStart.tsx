// Starting a torrent source (as the original's player does before playback): the P2P notice the
// first time (P2P is off until accepted, per profile), then the engine's phases with peers and
// speed until the selected file can be read; "Cancelar" ends the P2P session. The video itself
// opens in the normal player.

import { useEffect, useRef, useState } from "react";
import { api, errorText } from "../api";
import { listen } from "../tauri";
import type { P2pStatus, StreamEntry, TorrentPrepared } from "../types";
import { formatNumber, t } from "../i18n";

/** The P2P notice, one paragraph per line. */
export const p2pConsentText = () =>
  (["p2p.consent1", "p2p.consent2", "p2p.consent3", "p2p.consent4", "p2p.consent5", "p2p.consent6", "p2p.consent7"] as const).map((k) => t(k));

const PHASES: Record<string, () => string> = {
  engine: () => t("p2p.phaseEngine"),
  metadata: () => t("p2p.phaseMetadata"),
  preparing: () => t("p2p.phasePreparing"),
};

const decimal = (value: number, digits: number) => formatNumber(value, { minimumFractionDigits: digits, maximumFractionDigits: digits });

export function speed(bytes: number): string {
  if (bytes >= 1_048_576) return `${decimal(bytes / 1_048_576, 1)} MB/s`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB/s`;
  return `${bytes} B/s`;
}

export function megabytes(bytes: number): string {
  return bytes >= 1_073_741_824 ? `${decimal(bytes / 1_073_741_824, 2)} GB` : `${decimal(bytes / 1_048_576, 1)} MB`;
}

interface Props {
  stream: StreamEntry;
  onReady(file: TorrentPrepared): void;
  onCancel(): void;
}

export function TorrentStart({ stream, onReady, onCancel }: Props) {
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<P2pStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const live = useRef(true);

  useEffect(() => listen<P2pStatus>("p2p-status", (s) => live.current && setStatus(s)), []);
  useEffect(
    () => () => {
      live.current = false;
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setConsent(false);
    api.torrentPrepare(stream.key).then(
      (file) => !cancelled && onReady(file),
      (e) => {
        if (cancelled) return;
        const text = errorText(e);
        if (text.includes("P2P_CONSENT_REQUIRED")) setConsent(true);
        else if (text !== "cancelado") setError(text);
      },
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream.key, attempt]);

  const cancel = () => {
    void api.torrentStop();
    onCancel();
  };

  const accept = async () => {
    try {
      const view = await api.settingsGet();
      await api.settingsSet({ ...view.settings, p2p: { ...view.settings.p2p, enabled: true } }, view.settings, view.profile.index);
      setAttempt((a) => a + 1);
    } catch (e) {
      setError(errorText(e));
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="torrent-title" data-testid="torrent-start">
      <div className="modal torrent-start">
        {consent ? (
          <>
            <h2 id="torrent-title">{t("p2p.title")}</h2>
            <div className="p2p-consent">{p2pConsentText().map((l, i) => <p key={i}>{l}</p>)}</div>
            <div className="account-actions">
              <button className="primary" onClick={() => void accept()} data-testid="p2p-accept">{t("p2p.enable")}</button>
              <button className="ghost" onClick={onCancel}>{t("common.cancel")}</button>
            </div>
          </>
        ) : (
          <>
            <h2 id="torrent-title">{stream.name || "Torrent"}</h2>
            {error ? (
              <div className="row-error" data-testid="torrent-error">{t("p2p.startFailed", { error })}</div>
            ) : (
              <>
                <div className="torrent-phase" data-testid="torrent-phase">
                  <span className="spinner" aria-hidden /> {PHASES[status?.phase || "engine"]?.() ?? t("p2p.connecting")}
                </div>
                <dl className="facts account-facts">
                  <div className="fact"><dt>{t("p2p.peers")}</dt><dd>{t("p2p.peersValue", { peers: status?.peers ?? 0, seeds: status?.seeds ?? 0 })}</dd></div>
                  <div className="fact"><dt>{t("p2p.speed")}</dt><dd dir="ltr">{speed(status?.downloadSpeed ?? 0)}</dd></div>
                </dl>
                <p className="muted small">{t("p2p.note")}</p>
              </>
            )}
            <div className="account-actions">
              {error && <button className="primary" onClick={() => setAttempt((a) => a + 1)}>{t("common.retry")}</button>}
              <button className="ghost" onClick={cancel} data-testid="torrent-cancel">{t("common.cancel")}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
