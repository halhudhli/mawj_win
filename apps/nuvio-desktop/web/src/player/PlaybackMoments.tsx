// "Pular abertura / recapitulação / encerramento" and the next-episode card, at the moments Rust
// computes from chapters, IntroDB and AniSkip (`nuvio_core::skip`). Rules of the original's
// player: a kind chosen in the settings skips by itself once, never what was already passed when
// resuming nor where the user just seeked.

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api";
import type { MetaVideo, Moment, Moments, PlayerSnapshot } from "../types";
import { airDate, episodeTitle, hasAired, reachedEnd } from "./episodes";
import { t } from "../i18n";

const NOTHING: Moments = { segments: [], nextEpisodeAt: null };
/** The button stays this long, then returns with the controls. */
const BUTTON_MS = 10_000;
const NOTICE_MS = 3_000;
/** A jump larger than this between two updates is a seek. */
const SEEK_JUMP_S = 3;

const keyOf = (m: Moment) => `${m.kind}:${m.start}:${m.end}`;

function skipLabel(m: Moment): string {
  if (m.toPostCredits) return t("skip.postCredits");
  switch (m.kind) {
    case "intro": return t("skip.intro");
    case "recap": return t("skip.recap");
    case "outro": return t("skip.outro");
    case "movie-credits": return t("skip.credits");
    default: return t("skip.generic");
  }
}

const SKIPPED: Partial<Record<Moment["kind"], () => string>> = {
  intro: () => t("skipped.intro"),
  recap: () => t("skipped.recap"),
  outro: () => t("skipped.outro"),
  "movie-credits": () => t("skipped.credits"),
};

/** The moments of a session, asked again when the duration or the chapters change. */
export function useMoments(snapshot: PlayerSnapshot | null, enabled: boolean): Moments {
  const [found, setFound] = useState<{ session: number; moments: Moments } | null>(null);
  const session = snapshot?.session;
  const ready = enabled && snapshot?.loaded === true && snapshot.duration > 0;
  const length = Math.round((snapshot?.duration ?? 0) / 5);
  const chapters = snapshot?.chapters.length ?? 0;
  useEffect(() => {
    if (!ready || session === undefined) return;
    let cancelled = false;
    api.playerMoments(session).then((moments) => !cancelled && setFound({ session, moments }), () => {});
    return () => {
      cancelled = true;
    };
  }, [ready, session, length, chapters]);
  return found && found.session === session ? found.moments : NOTHING;
}

export function reachedNextEpisode(snapshot: PlayerSnapshot | null, moments: Moments): boolean {
  if (!snapshot) return false;
  return reachedEnd(snapshot) || (moments.nextEpisodeAt !== null && snapshot.timePos > 0 && snapshot.timePos >= moments.nextEpisodeAt);
}

interface Props {
  snapshot: PlayerSnapshot;
  moments: Moments;
  next: MetaVideo | null;
  /** The sources panel is open: nothing is drawn over it. */
  covered: boolean;
  chromeVisible: boolean;
  onNext(): void;
}

/** Remounted for each session (keyed by it). */
export function PlaybackMoments({ snapshot: s, moments, next, covered, chromeVisible, onNext }: Props) {
  const [freshKey, setFreshKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const startedAt = useRef<number | null>(null);
  const lastPosition = useRef<number | null>(null);
  const seekPoints = useRef<number[]>([]);
  const ownTarget = useRef<number | null>(null);
  const autoDone = useRef(new Set<string>());

  const time = s.timePos;
  const active = s.loaded && !s.ended ? moments.segments.find((m) => time >= m.start && time < m.end - 0.3) ?? null : null;
  const activeKey = active ? keyOf(active) : null;

  const skip = useCallback(
    (moment: Moment) => {
      // Just before the end: reaching it then finishes the episode as usual.
      const target = Math.min(moment.target, Math.max(0, s.duration - 0.3));
      autoDone.current.add(keyOf(moment));
      ownTarget.current = target;
      void api.playerCommand({ type: "seek", seconds: target, relative: false });
    },
    [s.duration],
  );

  useEffect(() => {
    if (!s.loaded || time <= 0) return;
    if (startedAt.current === null) startedAt.current = time;
    const before = lastPosition.current;
    lastPosition.current = time;
    if (before !== null && Math.abs(time - before) > SEEK_JUMP_S * Math.max(1, s.speed)) {
      if (ownTarget.current !== null && Math.abs(time - ownTarget.current) < 5) ownTarget.current = null;
      else seekPoints.current.push(before, time);
    }
    if (!active?.auto || s.paused || s.buffering || covered || autoDone.current.has(keyOf(active))) return;
    if (active.end <= startedAt.current || seekPoints.current.some((p) => p >= active.start && p < active.end)) return;
    skip(active);
    setNotice(SKIPPED[active.kind]?.() ?? null);
  }, [time, active, covered, skip, s.loaded, s.paused, s.buffering, s.speed]);

  useEffect(() => {
    setFreshKey(activeKey);
    if (!activeKey) return;
    const timer = window.setTimeout(() => setFreshKey(null), BUTTON_MS);
    return () => window.clearTimeout(timer);
  }, [activeKey]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!active || covered) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "s" && !e.ctrlKey && !(e.target as HTMLElement).closest?.("input, select")) skip(active);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, covered, skip]);

  if (covered || s.pictureInPicture) return null;
  const showSkip = active !== null && (freshKey === activeKey || chromeVisible);
  const showCard = next !== null && reachedNextEpisode(s, moments) && (!dismissed || reachedEnd(s));
  const aired = next ? hasAired(next.released) : false;

  return (
    <>
      {notice && <div className="enhance-notice" role="status" data-testid="skip-notice">{notice}</div>}
      <div className={`player-moments ${chromeVisible ? "raised" : ""}`}>
        {showSkip && (
          <button className="skip-button" data-testid="skip-button" data-kind={active.kind} title={`${skipLabel(active)} (S)`} onClick={() => skip(active)}>
            {skipLabel(active)}
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 5.5v13l9-6.5z" />
              <path d="M18.5 5v14" />
            </svg>
          </button>
        )}
        {showCard && (
          <div className="next-card" data-testid="next-card">
            <button className="next-card-main" disabled={!aired} onClick={onNext} data-testid="next-card-play">
              <span className="next-card-thumb">
                {next.thumbnail && <img src={next.thumbnail} alt="" draggable={false} />}
                {aired && <span aria-hidden>▶</span>}
              </span>
              <span className="next-card-text">
                <small>{t("player.nextEpisode")}</small>
                <b>{episodeTitle(next)}</b>
                <em>{aired ? t("next.chooseSource") : t("player.notAired", { date: airDate(next.released) })}</em>
              </span>
            </button>
            {!reachedEnd(s) && <button className="next-card-close" aria-label={t("next.dismiss")} onClick={() => setDismissed(true)}>✕</button>}
          </div>
        )}
      </div>
    </>
  );
}
