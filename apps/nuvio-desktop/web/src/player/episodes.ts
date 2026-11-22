// The episode after the one playing (`PlayerNextEpisodeRules.resolveNextEpisode`): the following
// entry of the addon's list by season and episode.

import type { MetaDetails, MetaVideo, PlayerSnapshot } from "../types";
import { formatDate, t } from "../i18n";

/** What a session started from Details knows about its episode. */
export interface EpisodeContext {
  meta: MetaDetails;
  video: MetaVideo;
}

export function nextEpisode({ meta, video }: EpisodeContext): MetaVideo | null {
  if (video.season == null || video.episode == null) return null;
  const list = meta.videos
    .filter((v) => v.season != null && v.episode != null)
    .sort((a, b) => a.season! - b.season! || a.episode! - b.episode!);
  const at = list.findIndex((v) => v.season === video.season && v.episode === video.episode);
  if (at < 0) return null;
  return list.slice(at + 1).find((v) => v.season !== video.season || v.episode !== video.episode) ?? null;
}

/** An end of file at the end of the video; a dropped connection reports one anywhere (same rule as
 *  Rust's progress tracker). */
export function reachedEnd(s: PlayerSnapshot): boolean {
  return s.ended && (s.duration <= 0 || s.timePos + Math.max(10, s.duration * 0.02) >= s.duration);
}

/** `hasEpisodeAired`: a date up to today; without a date it counts as out. */
export function hasAired(released: string | null): boolean {
  const day = released?.trim().slice(0, 10);
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return true;
  return day <= new Date().toISOString().slice(0, 10);
}

export function airDate(released: string | null): string {
  const day = released?.trim().slice(0, 10);
  return day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? formatDate(new Date(`${day}T12:00:00`), { day: "2-digit", month: "2-digit", year: "numeric" }) : t("cw.dateTbd");
}

export function episodeTitle(video: MetaVideo): string {
  const code = video.season != null && video.episode != null ? t("episode.code", { season: video.season, episode: video.episode }) : "";
  return [code, video.title].filter(Boolean).join(" · ");
}
