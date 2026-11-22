// A collection folder (`FolderDetailScreen`): its catalogs as tabs over a grid ("Todos" merges
// them, one item of each in turn, as `rebuildAllTab`), or as rows when the collection is set to
// rows. Pages load as the end of the grid comes near. Opening a title keeps this screen and its
// loaded pages for the way back.

import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorText } from "../api";
import { CatalogRow } from "../components/CatalogRow";
import { PosterCard } from "../components/PosterCard";
import { useWhenVisible } from "../components/useInView";
import type { CollectionView, FolderSource, FolderView, MetaPreview } from "../types";
import { t } from "../i18n";
import { rowTitle } from "../i18n/backend";

interface Props {
  collection: CollectionView;
  folder: FolderView;
  onOpen(item: MetaPreview): void;
  onBack(): void;
}

interface SourceState {
  items: MetaPreview[];
  next: number | null;
  loading: boolean;
  error: string | null;
  started: boolean;
}

const EMPTY: SourceState = { items: [], next: null, loading: false, error: null, started: false };
const sourceId = (s: FolderSource) => `${s.key}#${s.genre ?? ""}`;
const ALL = "__all__";

function merge(lists: MetaPreview[][]): MetaPreview[] {
  const seen = new Set<string>();
  const out: MetaPreview[] = [];
  const longest = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < longest; i++) {
    for (const list of lists) {
      const item = list[i];
      if (!item) continue;
      const key = `${item.contentType}:${item.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push(item);
      }
    }
  }
  return out;
}

export function Folder({ collection, folder, onOpen, onBack }: Props) {
  const sources = folder.sources;
  const rowsMode = collection.viewMode === "ROWS";
  const showAll = collection.showAllTab && sources.length > 1;
  const [tab, setTab] = useState<string>(showAll ? ALL : sources[0] ? sourceId(sources[0]) : ALL);
  const [states, setStates] = useState<Record<string, SourceState>>({});
  const busy = useRef(new Set<string>());

  const load = useCallback(async (source: FolderSource, skip: number | null) => {
    const id = sourceId(source);
    if (busy.current.has(id)) return;
    busy.current.add(id);
    setStates((all) => ({ ...all, [id]: { ...(all[id] ?? EMPTY), loading: true, started: true, error: null } }));
    try {
      const page = await api.catalogPage(source.key, skip, source.genre);
      setStates((all) => {
        const prev = all[id] ?? EMPTY;
        const seen = new Set(prev.items.map((i) => `${i.contentType}:${i.id}`));
        return {
          ...all,
          [id]: {
            ...prev,
            loading: false,
            items: [...prev.items, ...page.items.filter((i) => !seen.has(`${i.contentType}:${i.id}`))],
            next: source.supportsPagination && page.items.length > 0 ? page.nextSkip : null,
          },
        };
      });
    } catch (e) {
      setStates((all) => ({ ...all, [id]: { ...(all[id] ?? EMPTY), loading: false, error: errorText(e) } }));
    } finally {
      busy.current.delete(id);
    }
  }, []);

  const visibleSources = tab === ALL ? sources : sources.filter((s) => sourceId(s) === tab);

  // First page of what the tab shows.
  useEffect(() => {
    if (rowsMode) return;
    for (const s of visibleSources) if (!states[sourceId(s)]?.started) void load(s, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, rowsMode]);

  const loadMore = () => {
    for (const s of visibleSources) {
      const st = states[sourceId(s)];
      if (st && !st.loading && st.next !== null && !st.error) void load(s, st.next);
    }
  };

  const shown = visibleSources.map((s) => states[sourceId(s)] ?? EMPTY);
  const items = tab === ALL ? merge(shown.map((s) => s.items)) : shown[0]?.items ?? [];
  const loading = shown.some((s) => s.loading || !s.started);
  const errors = shown.filter((s) => s.error).map((s) => s.error);
  const sentinel = useWhenVisible<HTMLDivElement>(loadMore, [items.length, tab, loading], "600px");

  const backdrop = folder.backdrop ?? collection.backdrop;

  return (
    <div className="folder-screen">
      <header className={`folder-head ${backdrop ? "with-backdrop" : ""}`} style={backdrop ? { backgroundImage: `url("${backdrop}")` } : undefined}>
        <div className="folder-head-shade">
          <button className="back" onClick={onBack} aria-label={t("common.back")}><span className="flip-rtl">←</span></button>
          <div className="folder-head-title">
            {folder.logo ? <img className="folder-logo" src={folder.logo} alt={folder.title} /> : <h1>{folder.title}</h1>}
            <span className="muted">{collection.title}</span>
          </div>
        </div>
      </header>

      {sources.length === 0 ? (
        <div className="screen-message">
          {folder.skippedSources > 0
            ? t("folder.skippedAll")
            : t("folder.empty")}
        </div>
      ) : rowsMode ? (
        <div className="folder-rows">
          {sources.map((s) => (
            <CatalogRow
              key={sourceId(s)}
              row={{ key: s.key, title: s.label, addonName: s.addonName, contentType: s.contentType, catalogId: "", supportsPagination: s.supportsPagination }}
              genre={s.genre}
              onOpen={onOpen}
            />
          ))}
        </div>
      ) : (
        <>
          {(showAll || sources.length > 1) && (
            <nav className="folder-tabs" aria-label={t("folder.tabs")}>
              {showAll && (
                <button className={`chip ${tab === ALL ? "active" : ""}`} onClick={() => setTab(ALL)}>{t("common.all")}</button>
              )}
              {sources.map((s) => (
                <button key={sourceId(s)} className={`chip ${tab === sourceId(s) ? "active" : ""}`} onClick={() => setTab(sourceId(s))} title={s.addonName}>
                  {rowTitle(s.label)}
                </button>
              ))}
            </nav>
          )}
          <div className="grid folder-grid">
            {items.map((item) => <PosterCard key={`${item.contentType}/${item.id}`} item={item} onOpen={onOpen} />)}
            {loading && items.length === 0 && Array.from({ length: 12 }, (_, i) => <div key={i} className="card skeleton" />)}
          </div>
          {!loading && items.length === 0 && (
            <div className="screen-message">
              {errors.length ? t("row.loadFailed", { error: errors[0] }) : t("folder.noTitles")}
            </div>
          )}
          <div ref={sentinel} className="grid-sentinel" />
        </>
      )}
      {folder.skippedSources > 0 && sources.length > 0 && (
        <p className="muted small folder-note">
          {t("folder.skippedSome", { count: folder.skippedSources })}
        </p>
      )}
    </div>
  );
}
