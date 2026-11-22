// One Home row. The catalog is requested only when the row comes near the viewport; more pages
// are requested when the user scrolls the row to its end (if the catalog paginates).

import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorText } from "../api";
import type { HomeRow, MetaPreview } from "../types";
import { PosterCard } from "./PosterCard";
import { useInView } from "./useInView";
import { inlineSign, t } from "../i18n";
import { rowTitle } from "../i18n/backend";

interface Props {
  row: HomeRow;
  onOpen(item: MetaPreview): void;
  onLoaded?(row: HomeRow, items: MetaPreview[]): void;
  /** Genre filter (catalogs of a collection folder). */
  genre?: string | null;
}

export function CatalogRow({ row, onOpen, onLoaded, genre = null }: Props) {
  const [ref, inView] = useInView<HTMLElement>();
  const [items, setItems] = useState<MetaPreview[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nextSkip, setNextSkip] = useState<number | null>(null);
  const loading = useRef(false);
  const track = useRef<HTMLDivElement>(null);

  const load = useCallback(
    async (skip: number | null) => {
      if (loading.current) return;
      loading.current = true;
      try {
        const page = await api.catalogPage(row.key, skip, genre);
        setItems((prev) => {
          const seen = new Set((prev ?? []).map((i) => i.id));
          return [...(prev ?? []), ...page.items.filter((i) => !seen.has(i.id))];
        });
        if (skip === null) onLoaded?.(row, page.items);
        setNextSkip(row.supportsPagination && page.items.length > 0 ? page.nextSkip : null);
      } catch (e) {
        if (skip === null) setError(errorText(e));
      } finally {
        loading.current = false;
      }
    },
    [row, onLoaded, genre],
  );

  useEffect(() => {
    if (inView && items === null && error === null) void load(null);
  }, [inView, items, error, load]);

  const onScroll = () => {
    const el = track.current;
    if (el && nextSkip !== null && Math.abs(el.scrollLeft) + el.clientWidth > el.scrollWidth - 600) void load(nextSkip);
  };

  const scrollBy = (dir: number) => track.current?.scrollBy({ left: dir * inlineSign() * track.current.clientWidth * 0.85, behavior: "smooth" });

  // A catalog that answered with nothing is hidden, like the original's empty rows.
  if (items !== null && items.length === 0) return null;

  return (
    <section className="row-section" ref={ref} data-content-type={row.contentType}>
      <header className="row-header">
        <h2>{rowTitle(row.title)}</h2>
        <span className="muted small">{row.addonName}</span>
        <span className="spacer" />
        {items && (
          <>
            <button className="icon-btn" aria-label={t("common.previous")} onClick={() => scrollBy(-1)}>‹</button>
            <button className="icon-btn" aria-label={t("common.next")} onClick={() => scrollBy(1)}>›</button>
          </>
        )}
      </header>
      {error ? (
        <div className="row-error">
          {t("row.loadFailed", { error })}{" "}
          <button className="link" onClick={() => { setError(null); }}>{t("common.retry")}</button>
        </div>
      ) : (
        <div className="row-track" ref={track} onScroll={onScroll}>
          {items
            ? items.map((item) => <PosterCard key={`${item.contentType}/${item.id}`} item={item} onOpen={onOpen} />)
            : Array.from({ length: 8 }, (_, i) => <div key={i} className="card skeleton" />)}
        </div>
      )}
    </section>
  );
}
