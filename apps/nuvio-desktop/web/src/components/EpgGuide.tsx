// Program guide of the channel shown in the preview: the program airing now first (with its
// progress), the next ones below; programs already seen this session are above it (scroll up).
// One request when the channel is picked; the next one only when the current program ends.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { api } from "../api";
import type { EpgView } from "../types";
import { formatTime, t } from "../i18n";

const hhmm = (ms: number) => formatTime(new Date(ms));

export function EpgGuide({ channelKey }: { channelKey: string }) {
  const [view, setView] = useState<EpgView | null>(null);
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [reload, setReload] = useState(0);
  const list = useRef<HTMLDivElement>(null);
  const current = useRef<HTMLDivElement>(null);
  const positioned = useRef<string | null>(null);

  // Load for this channel (and again when the current program ends).
  useEffect(() => {
    let alive = true;
    setFailed(false);
    api.liveTvEpg(channelKey, new Date().getTimezoneOffset()).then(
      (v) => alive && setView(v),
      () => alive && setFailed(true),
    );
    return () => {
      alive = false;
    };
  }, [channelKey, reload]);

  useEffect(() => {
    setView(null);
    positioned.current = null;
  }, [channelKey]);

  // Clock for the progress bar; a new request right after the current program ends.
  const airing = view?.programs.find((p) => p.startMs <= now && now < p.endMs) ?? null;
  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(tick);
  }, []);
  useEffect(() => {
    if (!airing) return;
    const wait = Math.max(5_000, airing.endMs - Date.now() + 3_000);
    const timer = window.setTimeout(() => {
      setNow(Date.now());
      setReload((r) => r + 1);
    }, wait);
    return () => window.clearTimeout(timer);
  }, [airing?.endMs]);

  // The program airing now at the top of the list (past ones stay above, reachable by scrolling).
  useLayoutEffect(() => {
    if (!view || positioned.current === channelKey || !list.current) return;
    positioned.current = channelKey;
    list.current.scrollTop = current.current ? current.current.offsetTop - list.current.offsetTop : 0;
  }, [view, channelKey]);

  if (failed) return <div className="epg-empty">{t("epg.failed")}</div>;
  if (!view) return <div className="epg-empty">{t("epg.loading")}</div>;
  if (!view.programs.length) return <div className="epg-empty">{t("epg.none")}</div>;

  return (
    <div className="epg" ref={list} data-testid="epg">
      {view.programs.map((p) => {
        const isNow = p.startMs <= now && now < p.endMs;
        const past = p.endMs <= now;
        const progress = isNow ? Math.min(100, ((now - p.startMs) / (p.endMs - p.startMs)) * 100) : 0;
        return (
          <div key={p.startMs} ref={isNow ? current : undefined} className={`epg-item ${isNow ? "now" : ""} ${past ? "past" : ""}`}>
            <div className="epg-time">
              {hhmm(p.startMs)}
              <span>{hhmm(p.endMs)}</span>
            </div>
            <div className="epg-text">
              <div className="epg-title">
                {isNow && <span className="epg-badge">{t("epg.now")}</span>}
                {p.title}
              </div>
              {isNow && p.description && <div className="epg-desc">{p.description}</div>}
              {isNow && (
                <div className="epg-progress" aria-label={t("epg.shown", { percent: Math.round(progress) })}>
                  <span style={{ width: `${progress}%` }} />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
