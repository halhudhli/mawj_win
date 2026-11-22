// Settings → Legendas, appearance (`SubtitleAppearanceSettings` + `SubtitleFontPicker` of the
// original, with more options): styles ready to use, every font of Windows and imported ones,
// colors, outline, box, shadow, spacing, position, and the style applied to anime (ASS) subtitles.

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { api, errorText } from "../api";
import type { SubtitleFontList, SubtitleSettings } from "../types";
import { ColorField, Row, Slider, Toggle } from "./SettingControls";
import { t } from "../i18n";

/** Shown first when installed. Arial has Helvetica's metrics; Helvetica itself is not in Windows. */
const FEATURED = [
  "Helvetica", "Helvetica Neue", "Arial", "Segoe UI", "Verdana", "Tahoma", "Trebuchet MS", "Calibri", "Candara", "Corbel",
  "Franklin Gothic Medium", "Bahnschrift", "Gadugi", "Roboto", "Inter", "Open Sans", "Noto Sans", "Georgia", "Cambria",
  "Times New Roman", "Consolas", "Comic Sans MS",
];
const BUILT_IN = (): [string, string][] => [["default", t("sa.default")], ["sans", t("sa.sans")], ["serif", t("sa.serif")], ["mono", t("sa.mono")]];

const LOOK: Partial<SubtitleSettings> = {
  fontId: "default", textColor: "#FFFFFFFF", backgroundColor: "#00000000", outlineColor: "#FF000000", outlineEnabled: true, outlineWidth: 2,
  bold: false, italic: false, shadowEnabled: false, shadowOpacity: 75, shadowSize: 2, spacing: 0, blur: 0,
};
const PRESETS: { id: string; label: () => string; look: Partial<SubtitleSettings> }[] = [
  { id: "Padrão", label: () => t("sa.default"), look: LOOK },
  { id: "Streaming", label: () => t("sa.presetStreaming"), look: { ...LOOK, fontId: "system:Arial", bold: true, outlineWidth: 1, shadowEnabled: true } },
  { id: "Anime", label: () => t("sa.presetAnime"), look: { ...LOOK, fontId: "system:Trebuchet MS", bold: true, outlineWidth: 3, shadowEnabled: true, shadowOpacity: 60, shadowSize: 1 } },
  { id: "Amarela clássica", label: () => t("sa.presetYellow"), look: { ...LOOK, fontId: "system:Arial", textColor: "#FFFFE14D", bold: true } },
  { id: "Caixa escura", label: () => t("sa.presetBox"), look: { ...LOOK, fontId: "system:Segoe UI", backgroundColor: "#B3000000", outlineEnabled: false } },
  { id: "Cinema", label: () => t("sa.presetCinema"), look: { ...LOOK, fontId: "system:Georgia", textColor: "#FFF4ECD8", outlineWidth: 1, shadowEnabled: true, shadowOpacity: 85 } },
];

const rgba = (argb: string) => `rgba(${parseInt(argb.slice(3, 5), 16)},${parseInt(argb.slice(5, 7), 16)},${parseInt(argb.slice(7, 9), 16)},${parseInt(argb.slice(1, 3), 16) / 255})`;

function cssFamily(id: string): string {
  if (id.startsWith("system:")) return `"${id.slice(7).replace(/["\\]/g, "")}", Arial, sans-serif`;
  if (id.startsWith("custom-")) return `"${id}", Arial, sans-serif`;
  return id === "serif" ? '"Times New Roman", serif' : id === "mono" ? '"Courier New", monospace' : "Arial, sans-serif";
}

/** An imported file becomes a page font, for the preview only. */
function usePreviewFont(id: string) {
  const [, setLoaded] = useState("");
  useEffect(() => {
    if (!id.startsWith("custom-")) return;
    let face: FontFace | null = null;
    let cancelled = false;
    api.subtitleFontData(id).then(async (bytes) => {
      const next = new FontFace(id, bytes);
      await next.load();
      if (cancelled) return;
      document.fonts.add(next);
      face = next;
      setLoaded(id);
    }).catch(() => {});
    return () => {
      cancelled = true;
      if (face) document.fonts.delete(face);
    };
  }, [id]);
}

interface Props {
  value: SubtitleSettings;
  onChange(change: (s: SubtitleSettings) => SubtitleSettings): void;
}

export function SubtitleAppearance({ value: sub, onChange }: Props) {
  const [fonts, setFonts] = useState<SubtitleFontList | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  usePreviewFont(sub.fontId);

  useEffect(() => {
    api.subtitleFonts().then(setFonts, (e) => setError(errorText(e)));
  }, []);

  const featured = useMemo(() => FEATURED.filter((f) => fonts?.system.includes(f)), [fonts]);
  const others = useMemo(() => fonts?.system.filter((f) => !FEATURED.includes(f)) ?? [], [fonts]);
  const imported = fonts?.imported.find((f) => f.id === sub.fontId);
  const missing =
    fonts &&
    ((sub.fontId.startsWith("custom-") && !imported) || (sub.fontId.startsWith("system:") && !fonts.system.includes(sub.fontId.slice(7))));
  const boxed = !sub.backgroundColor.startsWith("#00");
  const set = (patch: Partial<SubtitleSettings>) => onChange((s) => ({ ...s, ...patch }));

  const importFont = async () => {
    setBusy(true);
    setError(null);
    try {
      const font = await api.subtitleFontImport();
      if (font) {
        setFonts(await api.subtitleFonts());
        set({ fontId: font.id });
      }
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const removeFont = async () => {
    if (!imported || !window.confirm(t("sa.removeConfirm", { name: imported.name }))) return;
    try {
      await api.subtitleFontRemove(imported.id);
      set({ fontId: "default" });
      setFonts(await api.subtitleFonts());
    } catch (e) {
      setError(errorText(e));
    }
  };

  const style: CSSProperties = {
    fontFamily: cssFamily(sub.fontId),
    color: rgba(sub.textColor),
    fontSize: `${Math.max(11, sub.fontSizeSp * 1.3)}px`,
    fontWeight: sub.bold ? 700 : 400,
    fontStyle: sub.italic ? "italic" : "normal",
    letterSpacing: `${sub.spacing / 2}px`,
    background: rgba(sub.backgroundColor),
    WebkitTextStroke: !boxed && sub.outlineEnabled ? `${sub.outlineWidth * 1.4}px ${rgba(sub.outlineColor)}` : undefined,
    paintOrder: "stroke fill",
    textShadow: !boxed && sub.shadowEnabled ? `${sub.shadowSize}px ${sub.shadowSize}px ${sub.blur / 2}px rgba(0,0,0,${sub.shadowOpacity / 100})` : undefined,
    bottom: `${8 + sub.bottomOffset / 4}px`,
    textAlign: sub.align,
    ...(sub.align === "left" ? { left: 16, transform: "none" } : sub.align === "right" ? { left: "auto", right: 16, transform: "none" } : {}),
  };

  return (
    <>
      <div className="subtitle-preview subtitle-preview-large" aria-hidden>
        <span style={style} data-testid="subtitle-preview">{t("sa.sample")}<br />{t("sa.sample2")}</span>
      </div>
      <div className="subtitle-presets" aria-label={t("sa.presets")}>
        {PRESETS.map((preset) => (
          <button key={preset.id} className="chip" data-preset={preset.id} onClick={() => set(preset.look)}>{preset.label()}</button>
        ))}
      </div>

      <Row title={t("sa.font")} description={t("sa.fontDesc")}>
        <span className="font-field">
          <select aria-label={t("sa.fontLabel")} data-setting="subtitleFont" value={sub.fontId} style={{ fontFamily: cssFamily(sub.fontId) }} onChange={(e) => set({ fontId: e.target.value })}>
            <optgroup label={t("sa.basic")}>
              {BUILT_IN().map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </optgroup>
            {!!fonts?.imported.length && (
              <optgroup label={t("sa.imported")}>
                {fonts.imported.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </optgroup>
            )}
            {featured.length > 0 && (
              <optgroup label={t("sa.recommended")}>
                {featured.map((f) => <option key={f} value={`system:${f}`} style={{ fontFamily: cssFamily(`system:${f}`) }}>{f}</option>)}
              </optgroup>
            )}
            {others.length > 0 && (
              <optgroup label={t("sa.allWindows")}>
                {others.map((f) => <option key={f} value={`system:${f}`}>{f}</option>)}
              </optgroup>
            )}
            {(missing || !fonts) && !BUILT_IN().some(([id]) => id === sub.fontId) && <option value={sub.fontId}>{sub.fontId.startsWith("system:") ? sub.fontId.slice(7) : t("sa.importedFont")}</option>}
          </select>
          <button className="ghost" data-testid="font-import" disabled={busy} onClick={() => void importFont()}>{busy ? t("sa.importing") : t("sa.import")}</button>
          {imported && <button className="ghost" data-testid="font-remove" onClick={() => void removeFont()}>{t("common.remove")}</button>}
        </span>
      </Row>
      {missing && <p className="muted small">{t("sa.missing")}</p>}
      {error && <div className="row-error">{error}</div>}

      <Row title={t("sa.ass")} description={t("sa.assDesc")}>
        <Toggle label={t("sa.assShort")} checked={sub.overrideAss} onChange={(v) => set({ overrideAss: v })} />
      </Row>
      <Row title={t("sa.size")}><Slider label={t("sa.sizeLabel")} value={sub.fontSizeSp} min={6} max={40} onChange={(v) => set({ fontSizeSp: v })} /></Row>
      <Row title={t("sa.bottom")}><Slider label={t("sa.bottom")} value={sub.bottomOffset} min={0} max={200} onChange={(v) => set({ bottomOffset: v })} /></Row>
      <Row title={t("sa.align")}>
        <select aria-label={t("sa.alignLabel")} value={sub.align} onChange={(e) => set({ align: e.target.value as SubtitleSettings["align"] })}>
          <option value="left">{t("sa.left")}</option>
          <option value="center">{t("sa.center")}</option>
          <option value="right">{t("sa.right")}</option>
        </select>
      </Row>
      <Row title={t("sa.textColor")}><ColorField label={t("sa.textColor")} withOpacity value={sub.textColor} onChange={(v) => set({ textColor: v })} /></Row>
      <Row title={t("sa.bold")}><Toggle label={t("sa.bold")} checked={sub.bold} onChange={(v) => set({ bold: v })} /></Row>
      <Row title={t("sa.italic")}><Toggle label={t("sa.italic")} checked={sub.italic} onChange={(v) => set({ italic: v })} /></Row>
      <Row title={t("sa.spacing")}><Slider label={t("sa.spacing")} value={sub.spacing} min={0} max={10} onChange={(v) => set({ spacing: v })} /></Row>

      <Row title={t("sa.box")} description={t("sa.boxDesc")}>
        <Toggle label={t("sa.box")} checked={boxed} onChange={(v) => set({ backgroundColor: `#${v ? "B3" : "00"}${sub.backgroundColor.slice(3)}` })} />
      </Row>
      {boxed ? (
        <Row title={t("sa.bgColor")}><ColorField label={t("sa.bgColor")} withOpacity value={sub.backgroundColor} onChange={(v) => set({ backgroundColor: v })} /></Row>
      ) : (
        <>
          <Row title={t("sa.outline")}><Toggle label={t("sa.outline")} checked={sub.outlineEnabled} onChange={(v) => set({ outlineEnabled: v })} /></Row>
          {sub.outlineEnabled && (
            <>
              <Row title={t("sa.outlineColor")}><ColorField label={t("sa.outlineColor")} withOpacity value={sub.outlineColor} onChange={(v) => set({ outlineColor: v })} /></Row>
              <Row title={t("sa.outlineWidth")}><Slider label={t("sa.outlineWidth")} value={sub.outlineWidth} min={1} max={5} onChange={(v) => set({ outlineWidth: v })} /></Row>
            </>
          )}
          <Row title={t("sa.shadow")}><Toggle label={t("sa.shadow")} checked={sub.shadowEnabled} onChange={(v) => set({ shadowEnabled: v })} /></Row>
          {sub.shadowEnabled && (
            <>
              <Row title={t("sa.shadowOpacity")}><Slider label={t("sa.shadowOpacity")} value={sub.shadowOpacity} min={0} max={100} unit="%" onChange={(v) => set({ shadowOpacity: v })} /></Row>
              <Row title={t("sa.shadowSize")}><Slider label={t("sa.shadowSize")} value={sub.shadowSize} min={1} max={8} onChange={(v) => set({ shadowSize: v })} /></Row>
            </>
          )}
          <Row title={t("sa.blur")}><Slider label={t("sa.blur")} value={sub.blur} min={0} max={10} onChange={(v) => set({ blur: v })} /></Row>
        </>
      )}
    </>
  );
}
