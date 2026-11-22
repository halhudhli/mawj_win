// "Melhorar imagem" during playback: level and Anime4K mode, effects, colors, motion. Changes apply
// at once and are saved in the profile by Rust; the watchdog may lower them (`autoChanges`), which
// is told on screen. "Segurar para comparar" shows the original picture while held.

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api";
import type { AnimeModeName, EnhancementName, MotionName, PictureSettings, PlayerSnapshot } from "../types";
import { t, tMaybe } from "../i18n";

// Labels are read when drawn (`label()`), so they follow the interface language.
type Labeled<T> = { value: T; label: () => string; hint: () => string };
const option = <T,>(value: T, key: string): Labeled<T> => ({
  value,
  label: () => tMaybe(key, key),
  hint: () => tMaybe(`${key}Hint`, ""),
});

export const ENHANCEMENTS: Labeled<EnhancementName>[] = [
  option("off", "enh.off"), option("movies", "enh.movies"), option("animeFast", "enh.animeFast"), option("animeQuality", "enh.animeQuality"),
];

export const MOTIONS: Labeled<MotionName>[] = [option("off", "motion.off"), option("steady", "motion.steady"), option("fluid", "motion.fluid")];

export const ANIME_MODES: Labeled<AnimeModeName>[] = [
  option("auto", "mode.auto"), option("a", "mode.a"), option("b", "mode.b"), option("c", "mode.c"),
  option("aa", "mode.aa"), option("bb", "mode.bb"), option("ca", "mode.ca"),
];
/** Short names on the mode buttons ("A", "A+A"). */
const MODE_SHORT: Record<AnimeModeName, () => string> = {
  auto: () => t("mode.auto"), a: () => "A", b: () => "B", c: () => "C", aa: () => "A+A", bb: () => "B+B", ca: () => "C+A",
};

type Effect = "denoise" | "deblur" | "darken" | "thin" | "deband";
const EFFECTS: { key: Effect; label: () => string; hint: () => string }[] = (["deblur", "darken", "thin", "denoise", "deband"] as const).map((key) => ({
  key,
  label: () => tMaybe(`effect.${key}`, key),
  hint: () => tMaybe(`effect.${key}Hint`, ""),
}));
const STEPS = () => [t("step.0"), t("step.1"), t("step.2"), t("step.3")];

type Color = "brightness" | "contrast" | "saturation" | "gamma" | "hue";
const COLORS: { key: Color; label: () => string }[] = (["brightness", "contrast", "saturation", "gamma", "hue"] as const).map((key) => ({
  key,
  label: () => tMaybe(`color.${key}`, key),
}));

const COLOR_PRESETS: { id: string; label: () => string; values: Record<Color, number> }[] = [
  { id: "Natural", label: () => t("preset.natural"), values: { brightness: 0, contrast: 0, saturation: 0, gamma: 0, hue: 0 } },
  { id: "Vívido", label: () => t("preset.vivid"), values: { brightness: 0, contrast: 6, saturation: 16, gamma: 0, hue: 0 } },
  { id: "Cinema", label: () => t("preset.cinema"), values: { brightness: -2, contrast: 8, saturation: -4, gamma: -3, hue: 0 } },
  { id: "Cenas escuras", label: () => t("preset.dark"), values: { brightness: 4, contrast: 2, saturation: 2, gamma: 10, hue: 0 } },
];

export const PLAIN_PICTURE: PictureSettings = {
  mode: "auto", denoise: 0, deblur: 0, thin: 0, darken: 0, deband: 0, brightness: 0, contrast: 0, saturation: 0, gamma: 0, hue: 0,
};

const TABS = [["quality", "enh.tabQuality"], ["effects", "enh.tabEffects"], ["color", "enh.tabColor"], ["motion", "enh.tabMotion"]] as const;
type TabId = (typeof TABS)[number][0];

const samePicture = (a: PictureSettings, b: PictureSettings) => (Object.keys(PLAIN_PICTURE) as (keyof PictureSettings)[]).every((k) => a[k] === b[k]);
/** Dragging a slider sends at most this often. */
const SEND_MS = 120;

export function EnhanceMenu({ snapshot }: { snapshot: PlayerSnapshot }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<TabId>("quality");
  const [chosenMotion, setMotion] = useState<MotionName | null>(null);
  const [chosenLevel, setLevel] = useState<EnhancementName | null>(null);
  const [chosenPicture, setPicture] = useState<PictureSettings | null>(null);
  const [comparing, setComparing] = useState(false);
  const unsent = useRef<PictureSettings | null>(null);
  const timer = useRef(0);
  const comparingNow = useRef(false);

  // What the player reports replaces the local choice (also when the watchdog lowered it). The
  // picture keeps it longer: confirmations of a slider arrive behind the hand.
  useEffect(() => setMotion(null), [snapshot.motion, snapshot.autoChanges]);
  useEffect(() => setLevel(null), [snapshot.enhancement, snapshot.autoChanges]);
  useEffect(() => setPicture(null), [snapshot.autoChanges]);

  const send = useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = 0;
    if (unsent.current) void api.playerCommand({ type: "setPicture", picture: unsent.current });
    unsent.current = null;
  }, []);

  const compare = useCallback((active: boolean) => {
    if (comparingNow.current === active) return;
    comparingNow.current = active;
    setComparing(active);
    void api.playerCommand({ type: "setCompare", active });
  }, []);

  useEffect(() => {
    if (!comparing) return;
    const release = () => compare(false);
    window.addEventListener("pointerup", release);
    window.addEventListener("blur", release);
    return () => {
      window.removeEventListener("pointerup", release);
      window.removeEventListener("blur", release);
    };
  }, [comparing, compare]);

  useEffect(
    () => () => {
      send();
      compare(false);
    },
    [send, compare],
  );

  const motion = chosenMotion ?? snapshot.motion;
  const level = chosenLevel ?? snapshot.enhancement;
  const picture = chosenPicture ?? snapshot.picture;
  const anime = level === "animeFast" || level === "animeQuality";
  const changed = level !== "off" || !samePicture(picture, { ...PLAIN_PICTURE, mode: picture.mode });
  const native = snapshot.height >= window.innerHeight * window.devicePixelRatio * 0.9;

  const change = (next: PictureSettings) => {
    setPicture(next);
    unsent.current = next;
    if (!timer.current) timer.current = window.setTimeout(send, SEND_MS);
  };

  return (
    <div className="pc-enhance">
      <button
        className={`pc-icon ${motion !== "off" || changed ? "pc-on" : ""}`}
        aria-label={t("enh.button")}
        title={t("enh.button")}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
          <circle cx="16" cy="7" r="2" />
          <circle cx="8" cy="17" r="2" />
        </svg>
      </button>
      {open && (
        <div className="pc-enhance-menu">
          <div className="pc-tabs" role="tablist">
            {TABS.map(([id, label]) => (
              <button key={id} role="tab" aria-selected={tab === id} className={`pc-tab ${tab === id ? "active" : ""}`} data-tab-id={id} onClick={() => setTab(id)}>{t(label)}</button>
            ))}
          </div>
          <div className="pc-tab-body">
            {tab === "quality" && (
              <>
                {ENHANCEMENTS.map((option) => (
                  <button
                    key={option.value}
                    className={`pc-level ${level === option.value ? "active" : ""}`}
                    data-level={option.value}
                    aria-pressed={level === option.value}
                    onClick={() => {
                      setLevel(option.value);
                      void api.playerCommand({ type: "setEnhancement", enhancement: option.value });
                    }}
                  >
                    <b>{option.label()}</b>
                    <small>{option.hint()}</small>
                  </button>
                ))}
                {anime && (
                  <>
                    <span className="pc-enhance-title">{t("enh.animeMode")}</span>
                    <div className="pc-modes">
                      {ANIME_MODES.map((option) => (
                        <button
                          key={option.value}
                          className={`pc-level ${picture.mode === option.value ? "active" : ""}`}
                          data-mode={option.value}
                          aria-pressed={picture.mode === option.value}
                          title={option.hint()}
                          onClick={() => change({ ...picture, mode: option.value })}
                        >
                          {MODE_SHORT[option.value]()}
                        </button>
                      ))}
                    </div>
                    <p className="pc-enhance-note">{ANIME_MODES.find((m) => m.value === picture.mode)?.hint()}</p>
                    {snapshot.width > 2048 ? (
                      <p className="pc-enhance-note">{t("enh.over1080")}</p>
                    ) : native ? (
                      <p className="pc-enhance-note">{t("enh.native")}</p>
                    ) : null}
                  </>
                )}
              </>
            )}

            {tab === "effects" && (
              <>
                {EFFECTS.map((effect) => (
                  <div className="pc-effect" key={effect.key}>
                    <span><b>{effect.label()}</b><small>{effect.hint()}</small></span>
                    <div className="pc-steps">
                      {STEPS().map((label, value) => (
                        <button key={label} className={`pc-level ${picture[effect.key] === value ? "active" : ""}`} data-effect={`${effect.key}:${value}`} aria-pressed={picture[effect.key] === value} onClick={() => change({ ...picture, [effect.key]: value })}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <button className="pc-reset" data-reset="effects" onClick={() => change({ ...picture, denoise: 0, deblur: 0, thin: 0, darken: 0, deband: 0 })}>{t("enh.resetEffects")}</button>
              </>
            )}

            {tab === "color" && (
              <>
                <div className="pc-modes pc-presets">
                  {COLOR_PRESETS.map((preset) => {
                    const active = COLORS.every((c) => picture[c.key] === preset.values[c.key]);
                    return (
                      <button key={preset.id} className={`pc-level ${active ? "active" : ""}`} data-preset={preset.id} aria-pressed={active} onClick={() => change({ ...picture, ...preset.values })}>
                        {preset.label()}
                      </button>
                    );
                  })}
                </div>
                {COLORS.map(({ key, label }) => (
                  <label className="pc-color" key={key}>
                    <span>{label()}</span>
                    <input type="range" min={-50} max={50} value={picture[key]} data-color={key} onChange={(e) => change({ ...picture, [key]: Number(e.target.value) })} onPointerUp={send} />
                    <output>{picture[key]}</output>
                  </label>
                ))}
              </>
            )}

            {tab === "motion" && MOTIONS.map((option) => (
              <button
                key={option.value}
                className={`pc-level ${motion === option.value ? "active" : ""}`}
                data-motion={option.value}
                aria-pressed={motion === option.value}
                onClick={() => {
                  setMotion(option.value);
                  void api.playerCommand({ type: "setMotion", motion: option.value });
                }}
              >
                <b>{option.label()}</b>
                <small>{option.hint()}</small>
              </button>
            ))}
          </div>
          {changed && tab !== "motion" && (
            <button
              className={`pc-compare ${comparing ? "active" : ""}`}
              data-compare=""
              onPointerDown={() => {
                send();
                compare(true);
              }}
            >
              {comparing ? t("enh.showingOriginal") : t("enh.holdOriginal")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Shown over the video (also with the controls hidden) when the watchdog lowered something. */
export function EnhanceNotice({ snapshot }: { snapshot: PlayerSnapshot | null }) {
  const changes = snapshot?.autoChanges ?? 0;
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!changes) {
      setShown(false);
      return;
    }
    setShown(true);
    const timer = window.setTimeout(() => setShown(false), 7000);
    return () => window.clearTimeout(timer);
  }, [changes]);

  if (!shown || !snapshot) return null;
  const level = ENHANCEMENTS.find((e) => e.value === snapshot.enhancement)?.label();
  return (
    <div className="enhance-notice" role="status">
      {snapshot.autoReason === "motion"
        ? t("enh.autoMotion")
        : snapshot.autoReason === "effects"
          ? t("enh.autoEffects")
          : t("enh.autoLevel", { level })}
    </div>
  );
}
