// Settings → Reprodução: when something counts as watched, skip buttons and the next-episode card
// (the original's "Pular intro" and "Próximo episódio" settings, plus the watched percentage).

import type { PlayerSettings } from "../types";
import { Row, Toggle } from "./SettingControls";
import { formatNumber, t } from "../i18n";

const AUTO_KINDS = (): [string, string][] => [
  ["intro", t("ws.intro")],
  ["recap", t("ws.recap")],
  ["outro", t("ws.outro")],
  ["movie-credits", t("ws.credits")],
];

const decimal = (value: number) => formatNumber(value);

function Range({ label, value, min, max, step, unit, onChange }: { label: string; value: number; min: number; max: number; step: number; unit: string; onChange(v: number): void }) {
  return (
    <span className="slider">
      <input type="range" min={min} max={max} step={step} value={value} aria-label={label} onChange={(e) => onChange(Number(e.target.value))} />
      <output>{decimal(value)}{unit}</output>
    </span>
  );
}

export function WatchingSettings({ value: p, onChange }: { value: PlayerSettings; onChange(change: (p: PlayerSettings) => PlayerSettings): void }) {
  const percentMode = p.nextEpisodeThresholdMode !== "MINUTES_BEFORE_END";
  return (
    <>
      <h3 className="settings-subhead">{t("ws.title")}</h3>
      <Row title={t("ws.watched")} description={t("ws.watchedDesc")}>
        <Range label={t("ws.watched")} value={p.watchedPercent} min={90} max={100} step={1} unit="%" onChange={(v) => onChange((x) => ({ ...x, watchedPercent: v }))} />
      </Row>
      <Row title={t("ws.showNext")} description={t("ws.showNextDesc")}>
        <select aria-label={t("ws.showNext")} value={p.nextEpisodeThresholdMode} onChange={(e) => onChange((x) => ({ ...x, nextEpisodeThresholdMode: e.target.value as PlayerSettings["nextEpisodeThresholdMode"] }))}>
          <option value="PERCENTAGE">{t("ws.byPercent")}</option>
          <option value="MINUTES_BEFORE_END">{t("ws.byMinutes")}</option>
        </select>
      </Row>
      {percentMode ? (
        <Row title={t("ws.percent")}>
          <Range label={t("ws.percent")} value={p.nextEpisodeThresholdPercent} min={97} max={100} step={0.5} unit="%" onChange={(v) => onChange((x) => ({ ...x, nextEpisodeThresholdPercent: v }))} />
        </Row>
      ) : (
        <Row title={t("ws.minutes")}>
          <Range label={t("ws.minutes")} value={p.nextEpisodeThresholdMinutes} min={0} max={3.5} step={0.5} unit={t("ws.minUnit")} onChange={(v) => onChange((x) => ({ ...x, nextEpisodeThresholdMinutes: v }))} />
        </Row>
      )}

      <h3 className="settings-subhead">{t("ws.skipTitle")}</h3>
      <Row title={t("ws.skipButtons")} description={t("ws.skipButtonsDesc")}>
        <Toggle label={t("ws.skipButtons")} checked={p.skipSegmentsEnabled} onChange={(v) => onChange((x) => ({ ...x, skipSegmentsEnabled: v }))} />
      </Row>
      {p.skipSegmentsEnabled &&
        AUTO_KINDS().map(([kind, name]) => (
          <Row key={kind} title={t("ws.autoSkip", { name })}>
            <Toggle
              label={t("ws.autoSkip", { name })}
              checked={p.autoSkipSegments.includes(kind)}
              onChange={(v) => onChange((x) => ({ ...x, autoSkipSegments: [...x.autoSkipSegments.filter((k) => k !== kind), ...(v ? [kind] : [])].sort() }))}
            />
          </Row>
        ))}
    </>
  );
}
