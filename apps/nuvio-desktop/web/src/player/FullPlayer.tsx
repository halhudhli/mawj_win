// Whole-window player: the video uses the full client area (rect `null`) and the controls fade
// out after 3 s without mouse movement. Keyboard: Space, ←/→, ↑/↓, F, M, Esc.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
import { listen } from "../tauri";
import { usePlayer } from "./PlayerContext";
import { P2pStats } from "./P2pStats";
import { EnhanceNotice } from "./EnhanceMenu";
import { PlayerControls } from "./PlayerControls";
import { airDate, episodeTitle, hasAired, nextEpisode } from "./episodes";
import { NextEpisodePanel } from "./NextEpisodePanel";
import { PlaybackMoments, reachedNextEpisode, useMoments } from "./PlaybackMoments";
import { SubtitleMenu } from "./SubtitleMenu";
import { t } from "../i18n";

export function FullPlayer() {
  const player = usePlayer();
  const { session, snapshot } = player;
  const [visible, setVisible] = useState(true);
  const [pip, setPip] = useState(false);
  const hideTimer = useRef<number>(0);
  const live = session?.live === true;
  const moments = useMoments(snapshot, !live);
  const episode = session?.episode;
  const next = useMemo(() => (episode ? nextEpisode(episode) : null), [episode]);
  const nextAired = next !== null && hasAired(next.released);
  const [choosingNext, setChoosingNext] = useState(false);
  // Another episode started: its panel is gone.
  useEffect(() => setChoosingNext(false), [episode]);
  const openNext = useCallback(() => {
    if (!nextAired) return;
    if (player.session && snapshot?.pictureInPicture) void api.pictureInPicture(false, "").catch(() => {});
    setChoosingNext(true);
  }, [nextAired, player.session, snapshot?.pictureInPicture]);

  useEffect(() => {
    void api.playerRect(null);
  }, []);

  const leave = useCallback(async () => {
    if (player.windowFullscreen) await player.setWindowFullscreen(false);
    if (session?.returnTo) player.setView(session.returnTo);
    else await player.close();
  }, [player, session]);

  const toggleFullscreen = useCallback(() => {
    if (session?.returnTo && player.windowFullscreen) void leave();
    else void player.setWindowFullscreen(!player.windowFullscreen);
  }, [leave, player, session]);

  const poke = useCallback(() => {
    setVisible(true);
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setVisible(false), 3000);
  }, []);
  useEffect(() => {
    poke();
    return () => window.clearTimeout(hideTimer.current);
  }, [poke]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "SELECT") return;
      if (choosingNext) {
        if (e.key === "Escape") setChoosingNext(false);
        return;
      }
      poke();
      switch (e.key) {
        case " ": case "k": e.preventDefault(); void api.playerCommand({ type: "togglePause" }); break;
        case "ArrowLeft": if (!live) void api.playerCommand({ type: "seek", seconds: -10, relative: true }); break;
        case "ArrowRight": if (!live) void api.playerCommand({ type: "seek", seconds: 10, relative: true }); break;
        case "ArrowUp": void api.playerCommand({ type: "setVolume", volume: Math.min(200, (snapshot?.volume ?? 100) + 5) }); break;
        case "ArrowDown": void api.playerCommand({ type: "setVolume", volume: Math.max(0, (snapshot?.volume ?? 100) - 5) }); break;
        case "m": void api.playerCommand({ type: "setMute", mute: !snapshot?.mute }); break;
        case "f": toggleFullscreen(); break;
        case "n": openNext(); break;
        case "Escape": void leave(); break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [choosingNext, leave, live, openNext, poke, snapshot, toggleFullscreen]);

  // Also changed from the PiP window itself, or by closing it.
  useEffect(() => listen<boolean>("player-pip", setPip), []);

  const togglePip = async () => {
    try {
      await api.pictureInPicture(!pip, session?.title ?? t("app.name"));
      setPip(!pip);
    } catch {
      /* the player reports its own error state */
    }
  };

  return (
    <div className={`full-player ${visible || choosingNext ? "" : "chrome-hidden"}`} onMouseMove={poke}>
      <div className="full-player-top">
        <button className="back" onClick={() => void leave()} aria-label={t("common.back")}><span className="flip-rtl">←</span></button>
        <div>
          <div className="full-player-title">{session?.title}</div>
          {session?.subtitle && <div className="muted">{session.subtitle}</div>}
        </div>
        <P2pStats />
      </div>
      {pip && (
        <div className="pip-placeholder" data-testid="pip-placeholder">
          <p>{t("player.pipPlaying")}</p>
          <button className="ghost" onClick={() => void togglePip()}>{t("player.pipBack")}</button>
        </div>
      )}
      <EnhanceNotice key={`notice-${snapshot?.session}`} snapshot={snapshot} />
      <PlayerControls
        snapshot={snapshot}
        live={live}
        fullscreen={player.windowFullscreen}
        onToggleFullscreen={toggleFullscreen}
        onPictureInPicture={() => void togglePip()}
        subtitles={snapshot ? <SubtitleMenu key={`subtitles-${snapshot.session}`} snapshot={snapshot} /> : undefined}
        next={
          next
            ? {
                label: nextAired ? `${episodeTitle(next)} (N)` : t("player.notAired", { date: airDate(next.released) }),
                disabled: !nextAired,
                open: openNext,
              }
            : undefined
        }
      />
      {snapshot && !live && !pip && (
        <PlaybackMoments
          key={`moments-${snapshot.session}`}
          snapshot={snapshot}
          moments={moments}
          next={next}
          covered={choosingNext}
          chromeVisible={visible}
          onNext={openNext}
        />
      )}
      {choosingNext && episode && next && (
        <NextEpisodePanel
          key={next.id}
          context={episode}
          next={next}
          finished={() => reachedNextEpisode(snapshot, moments)}
          onClose={() => setChoosingNext(false)}
        />
      )}
    </div>
  );
}
