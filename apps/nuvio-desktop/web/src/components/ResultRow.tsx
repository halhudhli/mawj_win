// A horizontal row of already loaded titles (Search results), with the same look and controls as
// the Home rows: one line of posters, ‹ › buttons, drag with the mouse.

import { useRef } from "react";
import type { MetaPreview } from "../types";
import { PosterCard } from "./PosterCard";
import { inlineSign, t } from "../i18n";
import { rowTitle } from "../i18n/backend";

interface Props {
  title: string;
  addonName: string;
  items: MetaPreview[];
  onOpen(item: MetaPreview): void;
}

export function ResultRow({ title, addonName, items, onOpen }: Props) {
  const track = useRef<HTMLDivElement>(null);
  const scrollBy = (dir: number) => track.current?.scrollBy({ left: dir * inlineSign() * track.current.clientWidth * 0.85, behavior: "smooth" });
  return (
    <section className="row-section">
      <header className="row-header">
        <h2>{rowTitle(title)}</h2>
        <span className="muted small">{addonName}</span>
        <span className="spacer" />
        <button className="icon-btn" aria-label={t("common.previous")} onClick={() => scrollBy(-1)}>‹</button>
        <button className="icon-btn" aria-label={t("common.next")} onClick={() => scrollBy(1)}>›</button>
      </header>
      <div className="row-track" ref={track}>
        {items.map((item) => <PosterCard key={`${item.contentType}/${item.id}`} item={item} onOpen={onOpen} />)}
      </div>
    </section>
  );
}
