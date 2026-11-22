// Shared Library state for every screen: which titles are saved (one small list of keys, read
// once) and a version counter that changes whenever favorites or progress change. Home cards,
// Search results, Details and the Library page all read the same store, so a toggle anywhere shows
// everywhere at once, without asking the addons anything.

import { useEffect, useSyncExternalStore } from "react";
import { api, dataEpoch, onDataEpoch } from "./api";
import { listen } from "./tauri";
import { formatDate, formatTime, isRtl, t } from "./i18n";
import type { HistoryEntry, LibraryItem, MetaDetails, MetaPreview, PlaybackItem, ResumeTarget } from "./types";

/** Identity of a saved title, as in the original (`type` + `id` from the addon). */
export function favoriteKey(contentType: string, id: string): string {
  return `${contentType.trim()}/${id.trim()}`;
}

let keys: Set<string> = new Set();
let loaded: Promise<void> | null = null;
let version = 0;
const listeners = new Set<() => void>();

function emit() {
  version++;
  listeners.forEach((l) => l());
}

/** A setting that changes what counts as watched: the rows are read again. */
export function refreshLibraryViews() {
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Another profile: its own saved items (the previous profile's marks disappear at once).
onDataEpoch((reason) => {
  if (reason !== "profile") return;
  keys = new Set();
  loaded = null;
  emit();
  ensureLoaded();
});

function ensureLoaded() {
  const epoch = dataEpoch();
  loaded ??= api.libraryFavoriteKeys().then(
    (k) => {
      if (epoch !== dataEpoch()) return;
      keys = new Set(k);
      emit();
    },
    () => {
      loaded = null;
    },
  );
}

let progressEvents: (() => void) | null = null;
/** Progress saved by the player (Rust `library-changed`) refreshes the views that show it. */
function ensureProgressEvents() {
  progressEvents ??= listen<null>("library-changed", () => emit());
}

export function useIsFavorite(contentType: string, id: string): boolean {
  useEffect(ensureLoaded, []);
  return useSyncExternalStore(subscribe, () => keys.has(favoriteKey(contentType, id)));
}

/** Changes whenever favorites or progress change (for lists that must re-read). */
export function useLibraryVersion(): number {
  useEffect(() => {
    ensureLoaded();
    ensureProgressEvents();
  }, []);
  return useSyncExternalStore(subscribe, () => version);
}

type FavoriteInput = Omit<LibraryItem, "savedAtEpochMs">;

export function libraryItemFromPreview(item: MetaPreview): FavoriteInput {
  return {
    id: item.id, contentType: item.contentType, name: item.name, poster: item.poster, banner: item.banner,
    logo: item.logo, description: item.description, releaseInfo: item.releaseInfo, imdbRating: item.imdbRating,
    genres: item.genres, posterShape: item.posterShape,
  };
}

export function libraryItemFromDetails(m: MetaDetails): FavoriteInput {
  return {
    id: m.id, contentType: m.contentType, name: m.name, poster: m.poster, banner: m.background, logo: m.logo,
    description: m.description, releaseInfo: m.releaseInfo, imdbRating: m.imdbRating, genres: m.genres,
    posterShape: "Poster",
  };
}

export function previewFromLibraryItem(i: LibraryItem): MetaPreview {
  return {
    id: i.id, contentType: i.contentType, name: i.name, poster: i.poster, banner: i.banner, logo: i.logo,
    posterShape: i.posterShape, description: i.description, releaseInfo: i.releaseInfo, imdbRating: i.imdbRating,
    genres: i.genres, landscapePoster: null, runtime: null,
  };
}

/** Optimistic toggle: the mark changes now, Rust confirms (or the change is undone). */
export async function toggleFavorite(item: FavoriteInput): Promise<boolean> {
  const key = favoriteKey(item.contentType, item.id);
  const was = keys.has(key);
  const flip = (on: boolean) => {
    keys = new Set(keys);
    if (on) keys.add(key);
    else keys.delete(key);
    emit();
  };
  flip(!was);
  try {
    const saved = await api.libraryToggleFavorite(item);
    if (saved === was) flip(saved);
    return saved;
  } catch (e) {
    flip(was);
    throw e;
  }
}

export async function removeFavorite(contentType: string, id: string): Promise<void> {
  const key = favoriteKey(contentType, id);
  keys = new Set(keys);
  keys.delete(key);
  emit();
  try {
    await api.libraryRemoveFavorite(contentType, id);
  } catch (e) {
    loaded = null;
    ensureLoaded();
    throw e;
  }
}

export async function removeHistory(key: string): Promise<void> {
  await api.libraryRemoveHistory(key);
  emit();
}

// ---- Formatting ----
export function clock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

export function remaining(entry: Pick<HistoryEntry, "positionMs" | "durationMs">): string | null {
  if (entry.durationMs <= 0 || entry.positionMs <= 0) return null;
  const minutes = Math.max(1, Math.round((entry.durationMs - entry.positionMs) / 60000));
  return minutes >= 60 ? t("time.leftHours", { hours: Math.floor(minutes / 60), minutes: minutes % 60 }) : t("time.left", { minutes });
}

/** "12:34 watched" with the video time kept in Latin digits and left-to-right order. */
export function watchedFor(ms: number): string {
  return t("time.watched", { time: ltr(clock(ms)) });
}

/** Keeps a time or code ("01:23:45", "S1 E2") in left-to-right order inside right-to-left text. */
export function ltr(text: string): string {
  return isRtl() ? `\u2066${text}\u2069` : text;
}

export function lastWatched(epochMs: number): string {
  if (!epochMs) return "";
  const date = new Date(epochMs);
  const today = new Date();
  const days = Math.round((new Date(today.toDateString()).getTime() - new Date(date.toDateString()).getTime()) / 86400000);
  const time = formatTime(date);
  if (days === 0) return t("time.today", { time });
  if (days === 1) return t("time.yesterday", { time });
  return formatDate(date, { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function episodeCode(e: { season: number | null; episode: number | null }): string {
  return e.season != null && e.episode != null ? t("episode.code", { season: e.season, episode: e.episode }) : "";
}

export function resumeTarget(e: HistoryEntry): ResumeTarget {
  return { videoId: e.videoId, season: e.season, episode: e.episode };
}

/** What `stream_play` records for a movie or one of a series' episodes. */
export function playbackItem(m: MetaDetails, video: { id: string; season: number | null; episode: number | null; title: string; thumbnail: string | null } | null): PlaybackItem {
  return {
    contentType: m.contentType, parentMetaId: m.id, parentMetaType: m.contentType, videoId: video?.id ?? m.id,
    title: m.name, logo: m.logo, poster: m.poster, background: m.background,
    seasonNumber: video?.season ?? null, episodeNumber: video?.episode ?? null,
    episodeTitle: video?.title ?? null, episodeThumbnail: video?.thumbnail ?? null, releaseInfo: m.releaseInfo,
  };
}
