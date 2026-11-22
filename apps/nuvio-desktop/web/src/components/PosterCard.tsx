import { memo } from "react";
import type { MetaPreview } from "../types";
import { FavoriteButton } from "./FavoriteButton";
import { t } from "../i18n";

interface Props {
  item: MetaPreview;
  onOpen(item: MetaPreview): void;
  /** Shows "Filme"/"Série" on the art (Library grid). */
  showType?: boolean;
}

export function typeLabel(contentType: string): string {
  const type = contentType.toLowerCase();
  if (type === "movie") return t("type.one.movie");
  if (type === "series" || type === "tv" || type === "show") return t("type.one.series");
  if (type === "anime") return t("type.one.anime");
  return contentType;
}

/** Poster with native lazy loading/decoding: off-screen images are not downloaded. The favorite
 *  heart is a sibling of the card button (no nested buttons). */
export const PosterCard = memo(function PosterCard({ item, onOpen, showType = false }: Props) {
  const shape = item.posterShape === "Landscape" ? "landscape" : item.posterShape === "Square" ? "square" : "poster";
  const image = shape === "landscape" ? item.landscapePoster ?? item.poster : item.poster;
  return (
    <div className={`card-wrap ${shape}`}>
      <button className={`card ${shape}`} onClick={() => onOpen(item)} title={item.name} data-id={item.id} data-content-type={item.contentType}>
        <div className="card-art">
          {image ? <img src={image} alt="" loading="lazy" decoding="async" draggable={false} /> : <span className="card-fallback">{item.name}</span>}
          {showType && <span className="card-type">{typeLabel(item.contentType)}</span>}
        </div>
        <div className="card-title">{item.name}</div>
        {item.releaseInfo && <div className="card-sub">{item.releaseInfo}</div>}
      </button>
      <FavoriteButton item={item} />
    </div>
  );
});
