// Save/remove a movie or series. The mark comes from the shared Library store, so the same title
// shows the same state on every screen; clicking never asks the addons anything.

import { memo, useState } from "react";
import { libraryItemFromPreview, toggleFavorite, useIsFavorite } from "../library";
import type { LibraryItem, MetaPreview } from "../types";
import { t } from "../i18n";

interface Props {
  item: MetaPreview | Omit<LibraryItem, "savedAtEpochMs">;
  /** `icon`: heart over a card. `pill`: labeled button (Details). */
  variant?: "icon" | "pill";
}

export const FavoriteButton = memo(function FavoriteButton({ item, variant = "icon" }: Props) {
  const on = useIsFavorite(item.contentType, item.id);
  const [failed, setFailed] = useState(false);
  const label = on ? t("fav.remove") : t("fav.add");
  const click = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setFailed(false);
    const input = "landscapePoster" in item ? libraryItemFromPreview(item) : item;
    toggleFavorite(input).catch(() => setFailed(true));
  };
  return (
    <button
      className={`fav-btn ${variant} ${on ? "on" : ""} ${failed ? "failed" : ""}`}
      aria-pressed={on}
      aria-label={label}
      title={failed ? t("fav.failed") : label}
      data-testid="favorite"
      onClick={click}
    >
      <span aria-hidden>{on ? "♥" : "♡"}</span>
      {variant === "pill" && <span>{on ? t("fav.inLibrary") : t("fav.save")}</span>}
    </button>
  );
});
