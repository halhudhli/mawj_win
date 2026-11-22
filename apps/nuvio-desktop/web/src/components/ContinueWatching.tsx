// Continue watching: started, unfinished movies, the latest episode of each series and, when that
// one is finished, the next episode (the original's rules, computed in Rust). The row draws at
// once from what is known; the episode lists of the next episodes complete it.

import { memo, useEffect, useState } from "react";
import { api } from "../api";
import { episodeCode, lastWatched, remaining, removeHistory, useLibraryVersion, watchedFor } from "../library";
import type { HistoryEntry } from "../types";
import { airDate } from "../player/episodes";
import { t } from "../i18n";

interface CardProps {
  entry: HistoryEntry;
  onResume(entry: HistoryEntry): void;
  onRemove?(entry: HistoryEntry): void;
}

export const ContinueCard = memo(function ContinueCard({ entry, onResume, onRemove }: CardProps) {
  const image = entry.background ?? entry.poster;
  const code = episodeCode(entry);
  const left = remaining(entry);
  const fresh = entry.nextUp && !entry.inProgress;
  return (
    <div className="cw-wrap">
      <button className="cw-card" onClick={() => onResume(entry)} data-key={entry.key} data-next-up={entry.nextUp || undefined} title={fresh ? t("cw.nextOf", { title: entry.title }) : t("cw.resume", { title: entry.title })}>
        <div className="cw-art">
          {image ? <img src={image} alt="" loading="lazy" decoding="async" draggable={false} /> : <span className="card-fallback">{entry.title}</span>}
          <span className="cw-play" aria-hidden>▶</span>
          {entry.nextUp && <span className="cw-badge">{entry.airs ? t("cw.airs", { date: airDate(entry.airs) }) : t("cw.nextEpisode")}</span>}
          {!fresh && (
            <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(entry.fraction * 100)}>
              <div style={{ width: `${Math.max(2, entry.fraction * 100)}%` }} />
            </div>
          )}
        </div>
        <div className="card-title">{entry.title}</div>
        <div className="card-sub">
          {[code && `${code}${entry.episodeTitle ? ` · ${entry.episodeTitle}` : ""}`].filter(Boolean).join("")}
        </div>
        <div className="card-sub">
          {[entry.positionMs > 0 && watchedFor(entry.positionMs), left].filter(Boolean).join(" · ")}
        </div>
        <div className="card-sub">{lastWatched(entry.lastWatchedEpochMs)}</div>
      </button>
      {onRemove && (
        <button className="fav-btn icon" aria-label={t("cw.removeFrom", { title: entry.title })} title={t("common.remove")} data-testid="cw-remove" onClick={() => onRemove(entry)}>
          ✕
        </button>
      )}
    </div>
  );
});

/** Reads the row at once and again when the next episodes are known. */
export function loadContinueWatching(show: (items: HistoryEntry[]) => void, failed?: (e: unknown) => void): () => void {
  let cancelled = false;
  void (async () => {
    try {
      const known = await api.libraryContinueWatching();
      if (cancelled) return;
      show(known);
    } catch (e) {
      if (!cancelled) failed?.(e);
      return;
    }
    try {
      const complete = await api.libraryNextUp();
      if (!cancelled) show(complete);
    } catch {
      /* the addons did not answer: what is known stays */
    }
  })();
  return () => {
    cancelled = true;
  };
}

/** Home row (hidden when empty), like the original's Continue watching section at the top. */
export function ContinueWatchingRow({ onResume }: { onResume(entry: HistoryEntry): void }) {
  const version = useLibraryVersion();
  const [items, setItems] = useState<HistoryEntry[]>([]);
  useEffect(() => loadContinueWatching(setItems), [version]);
  if (!items.length) return null;
  return (
    <section className="row-section" data-testid="home-continue">
      <header className="row-header">
        <h2>{t("cw.title")}</h2>
      </header>
      <div className="row-track">
        {items.map((e) => (
          <ContinueCard key={e.key} entry={e} onResume={onResume} onRemove={(x) => void removeHistory(x.key)} />
        ))}
      </div>
    </section>
  );
}
