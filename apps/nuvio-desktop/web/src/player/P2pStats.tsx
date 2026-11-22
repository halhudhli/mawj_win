// Torrent statistics over the player while a P2P stream plays (`P2pPlayerOverlays`): peers,
// download speed, downloaded data, progress of the file. Hidden with "Ocultar estatísticas do
// torrent"; an error of the engine during playback is always shown.

import { useEffect, useState } from "react";
import { api } from "../api";
import { megabytes, speed } from "../components/TorrentStart";
import { listen } from "../tauri";
import type { P2pStatus } from "../types";
import { t } from "../i18n";
import { backendText } from "../i18n/backend";

export function P2pStats() {
  const [status, setStatus] = useState<P2pStatus | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    api.p2pStatus().then(setStatus, () => {});
    api.settingsGet().then((v) => setHidden(v.settings.p2p.hideTorrentStats), () => {});
    return listen<P2pStatus>("p2p-status", setStatus);
  }, []);

  if (!status) return null;
  if (status.state === "error") {
    return <div className="p2p-stats error" role="alert" data-testid="p2p-stats">{t("p2p.statsError", { error: status.error ? backendText(status.error) : t("p2p.torrentError") })}</div>;
  }
  if (status.state !== "streaming" || hidden) return null;
  return (
    <div className="p2p-stats" data-testid="p2p-stats" title={status.fileName ?? undefined}>
      <span className="p2p-badge">P2P</span>
      <span>{t("p2p.peersCount", { count: status.peers })}</span>
      <span>↓ {speed(status.downloadSpeed)}</span>
      <span>{megabytes(status.downloadedBytes)}</span>
      <span>{Math.floor(status.totalProgress * 100)}%</span>
    </div>
  );
}
