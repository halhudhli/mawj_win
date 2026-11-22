// Library: Continue watching, saved movies/series and the playback history of the active profile.
// Everything comes from NextGen's own data (Rust); the addons are asked only when a title is opened.
// Large lists render progressively (favorites) or load page by page (history).

import { useEffect, useMemo, useState } from "react";
import { api, errorText } from "../api";
import { ContinueCard, loadContinueWatching } from "../components/ContinueWatching";
import { PosterCard } from "../components/PosterCard";
import { useWhenVisible } from "../components/useInView";
import {
  episodeCode, lastWatched, previewFromLibraryItem, remaining, removeHistory, useLibraryVersion, watchedFor,
} from "../library";
import type { HistoryEntry, LibraryItem, MetaPreview } from "../types";
import { intlLocale, t } from "../i18n";

type Section = "continue" | "favorites" | "history";
const SECTIONS: { id: Section; label: () => string }[] = [
  { id: "continue", label: () => t("library.continue") },
  { id: "favorites", label: () => t("library.favorites") },
  { id: "history", label: () => t("library.history") },
];

/** Local-library sort options of the original (`availableLibrarySortOptions`, LOCAL). */
type Sort = "addedDesc" | "addedAsc" | "titleAsc" | "titleDesc";
const SORTS: { id: Sort; label: () => string }[] = [
  { id: "addedDesc", label: () => t("library.sortAddedDesc") },
  { id: "addedAsc", label: () => t("library.sortAddedAsc") },
  { id: "titleAsc", label: () => t("library.sortTitleAsc") },
  { id: "titleDesc", label: () => t("library.sortTitleDesc") },
];
type Kind = "all" | "movie" | "series";

interface Props {
  onOpen(item: MetaPreview): void;
  onResume(entry: HistoryEntry): void;
  onOpenEntry(entry: HistoryEntry): void;
}

let lastSection: Section = "continue";

export function Library({ onOpen, onResume, onOpenEntry }: Props) {
  const [section, setSection] = useState<Section>(lastSection);
  const select = (s: Section) => {
    lastSection = s;
    setSection(s);
  };
  return (
    <div className="library">
      <header className="library-header">
        <h1>{t("library.title")}</h1>
        <div className="season-tabs" role="tablist" aria-label={t("library.sections")}>
          {SECTIONS.map((s) => (
            <button key={s.id} role="tab" aria-selected={section === s.id} className={`chip ${section === s.id ? "active" : ""}`} data-section={s.id} onClick={() => select(s.id)}>
              {s.label()}
            </button>
          ))}
        </div>
      </header>
      {section === "continue" && <ContinueSection onResume={onResume} />}
      {section === "favorites" && <FavoritesSection onOpen={onOpen} />}
      {section === "history" && <HistorySection onResume={onResume} onOpenEntry={onOpenEntry} />}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="screen-message library-empty" data-testid="library-empty">{children}</div>;
}

function ContinueSection({ onResume }: { onResume(entry: HistoryEntry): void }) {
  const version = useLibraryVersion();
  const [items, setItems] = useState<HistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    return loadContinueWatching(setItems, (e) => setError(errorText(e)));
  }, [version]);
  if (error) return <div className="row-error library-pad">{t("library.progressFailed", { error })}</div>;
  if (!items) return <div className="screen-message">{t("common.loading")}</div>;
  if (!items.length) return <Empty>{t("library.continueEmpty")}</Empty>;
  return (
    <div className="cw-grid" data-testid="library-continue">
      {items.map((e) => (
        <ContinueCard key={e.key} entry={e} onResume={onResume} onRemove={(x) => void removeHistory(x.key)} />
      ))}
    </div>
  );
}

const FAVORITES_STEP = 60;

function FavoritesSection({ onOpen }: { onOpen(item: MetaPreview): void }) {
  const version = useLibraryVersion();
  const [items, setItems] = useState<LibraryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>("addedDesc");
  const [kind, setKind] = useState<Kind>("all");
  const [shown, setShown] = useState(FAVORITES_STEP);

  useEffect(() => {
    let cancelled = false;
    api.libraryFavorites().then((i) => !cancelled && setItems(i), (e) => !cancelled && setError(errorText(e)));
    return () => {
      cancelled = true;
    };
  }, [version]);

  const sorted = useMemo(() => {
    const list = (items ?? []).filter((i) => kind === "all" || (kind === "movie" ? i.contentType === "movie" : i.contentType !== "movie"));
    const byTitle = (a: LibraryItem, b: LibraryItem) => a.name.localeCompare(b.name, intlLocale(), { sensitivity: "base" });
    switch (sort) {
      case "addedAsc": return [...list].sort((a, b) => a.savedAtEpochMs - b.savedAtEpochMs);
      case "titleAsc": return [...list].sort(byTitle);
      case "titleDesc": return [...list].sort((a, b) => byTitle(b, a));
      default: return [...list].sort((a, b) => b.savedAtEpochMs - a.savedAtEpochMs);
    }
  }, [items, sort, kind]);

  // Next batch of cards when the end of the grid comes near (keeps large libraries light).
  const more = useWhenVisible<HTMLDivElement>(() => setShown((s) => Math.min(s + FAVORITES_STEP, sorted.length)), [shown, sorted.length], "600px");

  if (error) return <div className="row-error library-pad">{t("library.favoritesFailed", { error })}</div>;
  if (!items) return <div className="screen-message">{t("common.loading")}</div>;
  if (!items.length) return <Empty>{t("library.favoritesEmpty")}</Empty>;
  const counts = { all: items.length, movie: items.filter((i) => i.contentType === "movie").length, series: items.filter((i) => i.contentType !== "movie").length };
  return (
    <div data-testid="library-favorites">
      <div className="library-toolbar">
        {(["all", "movie", "series"] as const).map((k) => (
          <button key={k} className={`chip ${kind === k ? "active" : ""}`} aria-pressed={kind === k} onClick={() => { setKind(k); setShown(FAVORITES_STEP); }}>
            {k === "all" ? t("common.all") : k === "movie" ? t("type.movie") : t("type.series")} <span className="muted">{counts[k]}</span>
          </button>
        ))}
        <span className="spacer" />
        <label className="muted small" htmlFor="library-sort">{t("library.sort")}</label>
        <select id="library-sort" className="select" value={sort} onChange={(e) => setSort(e.target.value as Sort)} data-testid="library-sort">
          {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label()}</option>)}
        </select>
      </div>
      {sorted.length === 0 ? (
        <Empty>{t("library.noneOfKind")}</Empty>
      ) : (
        <div className="grid library-grid">
          {sorted.slice(0, shown).map((i) => (
            <PosterCard key={`${i.contentType}/${i.id}`} item={previewFromLibraryItem(i)} onOpen={onOpen} showType />
          ))}
        </div>
      )}
      {shown < sorted.length && (
        <div ref={more} className="library-pad">
          <button className="link" onClick={() => setShown((s) => s + FAVORITES_STEP)}>{t("library.showMore", { count: sorted.length - shown })}</button>
        </div>
      )}
    </div>
  );
}

const HISTORY_PAGE = 40;

function HistorySection({ onResume, onOpenEntry }: { onResume(e: HistoryEntry): void; onOpenEntry(e: HistoryEntry): void }) {
  const version = useLibraryVersion();
  const [items, setItems] = useState<HistoryEntry[] | null>(null);
  const [total, setTotal] = useState(0);
  const [next, setNext] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // First page again whenever the library changes (new playback, removal).
  useEffect(() => {
    let cancelled = false;
    api.libraryHistory(0, HISTORY_PAGE).then(
      (p) => {
        if (cancelled) return;
        setItems(p.items);
        setTotal(p.total);
        setNext(p.nextOffset);
      },
      (e) => !cancelled && setError(errorText(e)),
    );
    return () => {
      cancelled = true;
    };
  }, [version]);

  const loadMore = () => {
    if (next === null || busy) return;
    setBusy(true);
    api.libraryHistory(next, HISTORY_PAGE).then(
      (p) => {
        setItems((prev) => {
          const seen = new Set((prev ?? []).map((i) => i.key));
          return [...(prev ?? []), ...p.items.filter((i) => !seen.has(i.key))];
        });
        setTotal(p.total);
        setNext(p.nextOffset);
        setBusy(false);
      },
      (e) => {
        setError(errorText(e));
        setBusy(false);
      },
    );
  };
  const sentinel = useWhenVisible<HTMLDivElement>(loadMore, [items?.length, next]);

  if (error) return <div className="row-error library-pad">{t("library.historyFailed", { error })}</div>;
  if (!items) return <div className="screen-message">{t("common.loading")}</div>;
  if (!items.length) return <Empty>{t("library.historyEmpty")}</Empty>;
  return (
    <div className="history" data-testid="library-history">
      <div className="muted small library-pad">{t("library.historyCount", { count: total })}</div>
      <ul className="history-list">
        {items.map((e) => (
          <li key={e.key} className="history-item" data-key={e.key}>
            <button className="history-open" onClick={() => onOpenEntry(e)} title={t("library.openDetails")}>
              <div className="history-thumb">{e.poster ? <img src={e.poster} alt="" loading="lazy" decoding="async" /> : null}</div>
              <div className="history-text">
                <div className="episode-title">{e.title}</div>
                <div className="muted small">
                  {[episodeCode(e) && `${episodeCode(e)}${e.episodeTitle ? ` · ${e.episodeTitle}` : ""}`, e.metaType === "movie" ? t("type.one.movie") : null].filter(Boolean).join(" ")}
                </div>
                <div className="muted small">
                  {e.completed ? t("time.completed") : [watchedFor(e.positionMs), remaining(e)].filter(Boolean).join(" · ")} · {lastWatched(e.lastWatchedEpochMs)}
                </div>
                {!e.completed && e.durationMs > 0 && (
                  <div className="progress inline"><div style={{ width: `${Math.max(2, e.fraction * 100)}%` }} /></div>
                )}
              </div>
            </button>
            {e.inProgress && <button className="chip" onClick={() => onResume(e)} data-testid="history-resume">{t("library.resume")}</button>}
            <button className="icon-btn" aria-label={t("library.removeFromHistory", { title: e.title })} title={t("library.removeFromHistoryShort")} data-testid="history-remove" onClick={() => void removeHistory(e.key)}>✕</button>
          </li>
        ))}
      </ul>
      {next !== null && (
        <div ref={sentinel} className="library-pad">
          {busy ? <span className="muted">{t("common.loading")}</span> : <button className="link" onClick={loadMore}>{t("library.loadMore", { count: total - (items?.length ?? 0) })}</button>}
        </div>
      )}
    </div>
  );
}
