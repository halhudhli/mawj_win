// Controls of the picture-in-picture window (`pip-mode` of the original's controls): timeline, play,
// subtitles, audio, volume, time; lock and "back to the app" on top. The video is mpv's window below
// this transparent page. Dragging outside the controls moves the window, a click there pauses, the
// edges resize (Windows). Locked: only the unlock button, on hover, so nothing is hit by accident.

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "../api";
import { invoke, listen } from "../tauri";
import type { PlayerSnapshot } from "../types";
import { formatTime, trackLabel } from "./PlayerControls";
import { useSubtitles } from "./subtitles";
import { t } from "../i18n";

const HIDE_MS = 2600;
const DRAG_PX = 5;

const svg = (children: ReactNode, fill = false) => (
  <svg viewBox="0 0 24 24" fill={fill ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {children}
  </svg>
);

const Icons = {
  play: svg(<path d="M8 5.5v13l10.5-6.5z" />, true),
  pause: svg(<><path d="M8.5 5.5v13" /><path d="M15.5 5.5v13" /></>),
  cc: svg(<><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M10 10.2a2.4 2.4 0 1 0 0 3.6M17.2 10.2a2.4 2.4 0 1 0 0 3.6" /></>),
  audio: svg(<><rect x="6" y="3" width="12" height="18" rx="2.5" /><circle cx="12" cy="14.5" r="3" /><path d="M12 7h.01" /></>),
  volume: svg(<><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z" /><path d="M15.5 9a4 4 0 0 1 0 6" /><path d="M18 6.5a7.5 7.5 0 0 1 0 11" /></>),
  muted: svg(<><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z" /><path d="M16 9.5l5 5" /><path d="M21 9.5l-5 5" /></>),
  lock: svg(<><rect x="5" y="10.5" width="14" height="10" rx="2.5" /><path d="M8 10.5v-3a4 4 0 0 1 8 0v3" /></>),
  unlock: svg(<><rect x="5" y="10.5" width="14" height="10" rx="2.5" /><path d="M8 10.5v-3a4 4 0 0 1 7.8-1.2" /></>),
  back: svg(<><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="M15 15l-6-6M9 13.5V9h4.5" /></>),
};

export function PipView() {
  const [s, setSnapshot] = useState<PlayerSnapshot | null>(null);
  const [shown, setShown] = useState(true);
  const [locked, setLocked] = useState(false);
  const [menu, setMenu] = useState<"subs" | "audio" | null>(null);
  const [seekDraft, setSeekDraft] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const hideTimer = useRef(0);
  const press = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    document.documentElement.classList.add("pip-page");
    const stop = listen<PlayerSnapshot>("player-state", setSnapshot);
    // Paused: no snapshot comes by itself.
    invoke<PlayerSnapshot>("player_snapshot").then((first) => setSnapshot((current) => current ?? first), () => {});
    const ready = window.setTimeout(() => void invoke("pip_ready").catch(() => {}), 30);
    return () => {
      stop();
      window.clearTimeout(ready);
    };
  }, []);

  const poke = useCallback(() => {
    setShown(true);
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      setShown(false);
      setMenu(null);
    }, HIDE_MS);
  }, []);
  useEffect(() => {
    poke();
    const leave = () => {
      window.clearTimeout(hideTimer.current);
      setShown(false);
      setMenu(null);
      setHover(null);
    };
    document.documentElement.addEventListener("pointerleave", leave);
    return () => {
      document.documentElement.removeEventListener("pointerleave", leave);
      window.clearTimeout(hideTimer.current);
    };
  }, [poke]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (locked || (e.target as HTMLElement).tagName === "INPUT") return;
      poke();
      if (e.key === " " || e.key === "k") {
        e.preventDefault();
        void api.playerCommand({ type: "togglePause" });
      } else if (e.key === "ArrowLeft") void api.playerCommand({ type: "seek", seconds: -10, relative: true });
      else if (e.key === "ArrowRight") void api.playerCommand({ type: "seek", seconds: 10, relative: true });
      else if (e.key === "m") void api.playerCommand({ type: "setMute", mute: !s?.mute });
      else if (e.key === "Escape") void api.pictureInPicture(false, "").catch(() => {});
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [locked, poke, s?.mute]);

  const duration = s?.duration ?? 0;
  const time = seekDraft !== null ? seekDraft * duration : s?.timePos ?? 0;
  const position = duration > 0 ? Math.min(1, time / duration) : 0;
  const buffered = duration > 0 ? Math.min(1, Math.max(position, ((s?.timePos ?? 0) + Math.max(0, s?.cacheSeconds ?? 0)) / duration)) : 0;
  const volume = Math.round(s?.volume ?? 100);
  const subtitles = useSubtitles(s, menu === "subs");
  const audio = s?.tracks.filter((track) => track.kind === "audio") ?? [];
  const visible = shown && !locked;

  const commitSeek = () => {
    if (seekDraft !== null) void api.playerCommand({ type: "seek", seconds: seekDraft * duration, relative: false });
    setSeekDraft(null);
  };

  return (
    <div
      className={`pip ${visible ? "pip-shown" : ""} ${locked ? "pip-locked" : ""}`}
      onPointerMove={(e) => {
        poke();
        const start = press.current;
        if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > DRAG_PX) {
          press.current = null;
          void invoke("pip_drag").catch(() => {});
        }
      }}
      onPointerDown={(e) => {
        if (e.button !== 0 || locked || (e.target as HTMLElement).closest("button, input, .pip-menu, .pip-timeline")) return;
        press.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerUp={() => {
        if (!press.current) return;
        press.current = null;
        // Not moved: a click. It closes an open list, else pauses.
        if (menu) setMenu(null);
        else void api.playerCommand({ type: "togglePause" });
      }}
    >
      <div className="pip-chrome" inert={!visible}>
        <div className="pip-top">
          <button className="pip-round" title={t("pip.lock")} aria-label={t("pip.lock")} data-pip="lock" onClick={() => { setMenu(null); setLocked(true); }}>{Icons.lock}</button>
          <button className="pip-round" title={t("pip.back")} aria-label={t("pip.back")} data-pip="back" onClick={() => void api.pictureInPicture(false, "").catch(() => {})}>{Icons.back}</button>
        </div>
        <div className="pip-bottom">
          {duration > 0 && (
            <div
              className="pip-timeline"
              onPointerMove={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                setHover(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)));
              }}
              onPointerLeave={() => setHover(null)}
            >
              <div className="pip-track" />
              <div className="pip-buffered" style={{ width: `${buffered * 100}%` }} />
              <div className="pip-played" style={{ width: `${position * 100}%` }} />
              {hover !== null && <output className="pip-tip" style={{ left: `clamp(22px, ${hover * 100}%, calc(100% - 22px))` }}>{formatTime(hover * duration)}</output>}
              <input
                type="range"
                min={0}
                max={1000}
                value={Math.round(position * 1000)}
                aria-label={t("player.position")}
                data-pip="seek"
                onChange={(e) => setSeekDraft(Number(e.target.value) / 1000)}
                onPointerUp={commitSeek}
                onKeyUp={commitSeek}
              />
            </div>
          )}
          <div className="pip-row">
            <div className="pip-pill">
              <button className="pip-play" aria-label={s?.paused ? t("player.play") : t("player.pause")} data-pip="play" onClick={() => void api.playerCommand({ type: "togglePause" })}>
                {s?.paused ? Icons.play : Icons.pause}
              </button>
              <button className="pip-plain" title={t("subs.title")} aria-label={t("subs.title")} data-pip="subs" disabled={!s?.loaded} onClick={() => setMenu((m) => (m === "subs" ? null : "subs"))}>{Icons.cc}</button>
              <button className="pip-plain" title={t("pip.audio")} aria-label={t("pip.audio")} data-pip="audio" disabled={!audio.length} onClick={() => setMenu((m) => (m === "audio" ? null : "audio"))}>{Icons.audio}</button>
            </div>
            <span className="pip-space" />
            <button className="pip-plain" aria-label={s?.mute ? t("player.unmute") : t("player.mute")} onClick={() => void api.playerCommand({ type: "setMute", mute: !s?.mute })}>
              {s?.mute || volume === 0 ? Icons.muted : Icons.volume}
            </button>
            <input
              className="pip-volume"
              type="range"
              min={0}
              max={200}
              value={volume}
              aria-label={t("player.volume")}
              data-pip="volume"
              style={{ ["--fill" as string]: `${volume / 2}%` }}
              onChange={(e) => void api.playerCommand({ type: "setVolume", volume: Number(e.target.value) })}
            />
            {duration > 0 ? (
              <span className="pip-time" data-pip="time">{formatTime(time)} / {formatTime(duration)}</span>
            ) : s?.loaded ? (
              <span className="live-dot">{t("player.live")}</span>
            ) : null}
          </div>
        </div>
        {menu && (
          <div className="pip-menu" role="menu">
            {menu === "subs" && (
              <button role="menuitemradio" aria-checked={!s?.sid || s.sid === "no"} onClick={() => { void api.playerCommand({ type: "setSubtitleTrack", id: "no" }); setMenu(null); }}>
                {t("player.noSubtitle")}
              </button>
            )}
            {menu === "subs" &&
              subtitles.groups.flatMap((group) =>
                group.choices.map((choice) => (
                  <button
                    key={choice.id}
                    role="menuitemradio"
                    aria-checked={choice.track !== undefined && String(choice.track.id) === s?.sid}
                    disabled={subtitles.loading !== null}
                    onClick={() => void subtitles.choose(choice).then((ok) => ok && setMenu(null))}
                  >
                    {subtitles.loading === choice.id ? t("common.loading") : `${group.name} · ${choice.label}`}
                  </button>
                )),
              )}
            {menu === "subs" && (subtitles.searching || subtitles.error || !subtitles.groups.length) && (
              <span className="pip-menu-note">{subtitles.searching ? t("subs.searchingShort") : subtitles.error ?? t("subs.noneShort")}</span>
            )}
            {menu === "audio" &&
              audio.map((track) => (
                <button
                  key={track.id}
                  role="menuitemradio"
                  aria-checked={String(track.id) === s?.aid}
                  onClick={() => {
                    void api.playerCommand({ type: "setAudioTrack", id: String(track.id) });
                    setMenu(null);
                  }}
                >
                  {trackLabel(track)}
                </button>
              ))}
          </div>
        )}
      </div>
      {locked && (
        <button className={`pip-round pip-unlock ${shown ? "pip-unlock-shown" : ""}`} title={t("pip.unlock")} aria-label={t("pip.unlock")} data-pip="unlock" onClick={() => setLocked(false)}>
          {Icons.unlock}
        </button>
      )}
    </div>
  );
}
