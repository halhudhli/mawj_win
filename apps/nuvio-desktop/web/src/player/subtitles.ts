// What the subtitle lists of the player and of picture-in-picture show: the file's tracks, then
// the stream's and the addons' subtitles not loaded yet, grouped by language.

import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorText } from "../api";
import type { PlayerSnapshot, SubtitleList, SubtitleOption, Track } from "../types";
import { intlLocale, t } from "../i18n";

// ISO 639-2/B codes, which Intl does not read.
const BIBLIOGRAPHIC: Record<string, string> = {
  fre: "fr", ger: "de", chi: "zh", cze: "cs", dut: "nl", gre: "el", rum: "ro", slo: "sk", per: "fa", alb: "sq", arm: "hy",
  baq: "eu", bur: "my", geo: "ka", ice: "is", mac: "mk", may: "ms", tib: "bo", wel: "cy", pob: "pt-BR",
};
let names: Intl.DisplayNames | null = null;
const displayNames = () => (names ??= new Intl.DisplayNames([intlLocale()], { type: "language" }));

export function canonicalLanguage(code: string | null | undefined): string {
  const raw = code?.trim().replace(/_/g, "-").toLowerCase();
  if (!raw || raw === "und" || raw === "unknown") return "";
  try {
    return Intl.getCanonicalLocales(BIBLIOGRAPHIC[raw] ?? raw)[0];
  } catch {
    return raw; // a name instead of a code ("English")
  }
}

export function languageName(code: string): string {
  if (!code) return t("subs.unknownLanguage");
  let name = code;
  try {
    name = displayNames().of(code) ?? code;
  } catch {
    /* kept as the addon wrote it */
  }
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export interface SubtitleChoice {
  id: string;
  label: string;
  detail: string;
  track?: Track;
  option?: SubtitleOption;
}

export interface SubtitleGroup {
  language: string;
  name: string;
  choices: SubtitleChoice[];
}

/** Preferred languages first, then by name; unknown last. */
export function subtitleGroups(tracks: Track[], options: SubtitleOption[], preferred: string[]): SubtitleGroup[] {
  const groups = new Map<string, SubtitleGroup>();
  const add = (code: string | null, choice: SubtitleChoice) => {
    const language = canonicalLanguage(code);
    if (!groups.has(language)) groups.set(language, { language, name: languageName(language), choices: [] });
    groups.get(language)!.choices.push(choice);
  };
  const subs = tracks.filter((track) => track.kind === "sub");
  for (const track of subs) {
    const detail = [track.external ? t("subs.loaded") : t("subs.inFile"), track.forced && t("subs.forced"), track.codec].filter(Boolean).join(" · ");
    add(track.lang, { id: `track:${track.id}`, label: track.title || t("player.track", { id: track.id }), detail, track });
  }
  const loaded = new Set(subs.filter((track) => track.external).map((track) => track.title));
  for (const o of options) {
    if (!loaded.has(o.title)) add(o.language, { id: `option:${o.index}`, label: o.title, detail: o.source === "Fonte" ? t("subs.fromSource") : t("subs.fromAddon"), option: o });
  }
  const wanted = preferred.map(canonicalLanguage).filter(Boolean);
  const rank = (language: string) => {
    if (!language) return 999;
    const exact = wanted.indexOf(language);
    if (exact >= 0) return exact;
    const base = wanted.findIndex((w) => w.split("-")[0] === language.split("-")[0]);
    return base >= 0 ? 100 + base : 500;
  };
  return [...groups.values()].sort((a, b) => rank(a.language) - rank(b.language) || a.name.localeCompare(b.name, intlLocale()));
}

/** The list of one session, asked when a menu opens. */
export function useSubtitles(snapshot: PlayerSnapshot | null, open: boolean) {
  const session = snapshot?.session;
  const ready = snapshot?.loaded === true;
  const [list, setList] = useState<SubtitleList | null>(null);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preferred, setPreferred] = useState<string[]>([]);
  const current = useRef(session);
  current.current = session;

  useEffect(() => {
    setList(null);
    setError(null);
    setLoading(null);
  }, [session]);

  useEffect(() => {
    if (!open || !ready || session === undefined) return;
    let cancelled = false;
    setSearching(true);
    setError(null);
    api.settingsGet().then((view) => {
      if (cancelled) return;
      const p = view.settings.player;
      setPreferred([p.preferredSubtitleLanguage, p.secondaryPreferredSubtitleLanguage ?? "", ...view.deviceLanguages].filter((l) => l && !["none", "device", "forced"].includes(l)));
    }, () => {});
    api.playerSubtitles(session).then(
      (found) => {
        if (cancelled) return;
        setList(found);
        setSearching(false);
      },
      (e) => {
        if (cancelled) return;
        setError(errorText(e));
        setSearching(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [open, ready, session]);

  const choose = useCallback(
    async (choice: SubtitleChoice | null) => {
      setError(null);
      if (!choice?.option) {
        await api.playerCommand({ type: "setSubtitleTrack", id: choice?.track ? String(choice.track.id) : "no" });
        if (choice) await api.playerCommand({ type: "setSubtitleVisible", visible: true });
        return true;
      }
      if (session === undefined) return false;
      setLoading(choice.id);
      try {
        await api.playerSubtitleLoad(session, choice.option.index);
        return true;
      } catch (e) {
        if (current.current === session) setError(t("subs.loadFailed", { error: errorText(e) }));
        return false;
      } finally {
        if (current.current === session) setLoading(null);
      }
    },
    [session],
  );

  const groups = subtitleGroups(snapshot?.tracks ?? [], list?.options ?? [], preferred);
  return { list, groups, searching, loading, error, choose };
}
