// The next episode's sources over the video, which keeps playing until one is chosen (the
// original's episode sources panel).

import { useEffect, useState } from "react";
import { api } from "../api";
import { StreamList } from "../components/StreamList";
import { TorrentStart } from "../components/TorrentStart";
import { clock, ltr, playbackItem } from "../library";
import type { MetaVideo, StreamEntry } from "../types";
import { episodeTitle, type EpisodeContext } from "./episodes";
import { usePlayer } from "./PlayerContext";
import { t } from "../i18n";

interface Props {
  context: EpisodeContext;
  next: MetaVideo;
  /** The current episode reached its end (credits): it counts as watched when the next one starts. */
  finished(): boolean;
  onClose(): void;
}

export function NextEpisodePanel({ context, next, finished, onClose }: Props) {
  const player = usePlayer();
  const { meta } = context;
  const [torrent, setTorrent] = useState<StreamEntry | null>(null);
  const [starting, setStarting] = useState(false);
  const [resumeAt, setResumeAt] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.libraryTitleProgress(meta.id).then((progress) => {
      const saved = progress.entries.find((e) => e.season === next.season && e.episode === next.episode);
      if (!cancelled && saved?.inProgress) setResumeAt(saved.positionMs);
    }, () => {});
    return () => {
      cancelled = true;
    };
  }, [meta.id, next]);

  // Preparing a torrent: only its own Cancel ends it.
  useEffect(() => {
    if (!torrent) return;
    const block = (e: KeyboardEvent) => e.key === "Escape" && e.stopPropagation();
    window.addEventListener("keydown", block, true);
    return () => window.removeEventListener("keydown", block, true);
  }, [torrent]);

  const play = async (stream: StreamEntry, prepared = false) => {
    if (starting) return;
    if (stream.kind === "torrent" && !prepared) {
      void api.playerCommand({ type: "setPaused", paused: true });
      setTorrent(stream);
      return;
    }
    setStarting(true);
    const start = resumeAt !== null ? resumeAt / 1000 : null;
    const previousFinished = finished();
    const ok = await player.play(() => api.playStream(stream.key, start, playbackItem(meta, next), previousFinished), {
      title: meta.name,
      subtitle: episodeTitle(next),
      view: "full",
      returnTo: null,
      episode: { meta, video: next },
      torrent: stream.kind === "torrent",
    });
    if (ok) return onClose();
    setStarting(false);
    if (stream.kind === "torrent") void api.torrentStop();
  };

  const cancelTorrent = () => {
    setTorrent(null);
    // A torrent that was playing lost its session when the next one was prepared.
    if (player.session?.torrent) void player.close();
    else void api.playerCommand({ type: "setPaused", paused: false });
  };

  return (
    <div className="next-panel-layer" data-testid="next-panel">
      <button className="next-panel-outside" aria-label={t("details.closeSources")} tabIndex={-1} onClick={onClose} />
      <aside className="next-panel" aria-label={t("next.panel")}>
        <header className="sources-header">
          <div>
            <h2>{t("player.nextEpisode")}</h2>
            <div className="muted small">
              {episodeTitle(next)}
              {resumeAt !== null && t("next.resumeFrom", { time: ltr(clock(resumeAt)) })}
            </div>
          </div>
          <button className="icon-btn" aria-label={t("details.closeSources")} onClick={onClose}>✕</button>
        </header>
        <div className="sources-body">
          {player.error && <div className="row-error">{t("details.playFailed", { error: player.error })}</div>}
          {starting ? (
            <div className="muted"><span className="spinner" aria-hidden /> {t("next.opening")}</div>
          ) : (
            <StreamList contentType={meta.contentType} id={next.id} onPlay={(stream) => void play(stream)} />
          )}
        </div>
      </aside>
      {torrent && (
        <TorrentStart
          stream={torrent}
          onCancel={cancelTorrent}
          onReady={() => {
            const stream = torrent;
            setTorrent(null);
            void play(stream, true);
          }}
        />
      )}
    </div>
  );
}
