// Settings of the active profile. Only options that NextGen applies for real are shown; each one
// is saved through Rust (`settings_set`, validated into the original's ranges) and read back.
// The original's other settings pages are listed under "Ainda não disponível" (no controls).

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  AccountLine as AccountIcon, AddonsLine as AddonsIcon, AudioLine as AudioIcon, HomeLine as HomeIcon, P2pLine as P2pIcon,
  PendingLine as PendingIcon, PlaybackLine as PlaybackIcon, ProfileDataLine as ProfileDataIcon, SubtitlesLine as SubtitlesIcon, UpdatesLine as UpdatesIcon,
} from "../components/SidebarIcons";
import { api, errorText, onRemoteSettingsChanged } from "../api";
import { AccountPanel } from "../components/AccountPanel";
import { AddonsManager } from "../components/AddonsManager";
import { checkForUpdates, installUpdate, useUpdates } from "../updates";
import { Avatar } from "../components/ProfileMenu";
import { LANGUAGES } from "../languages";
import { p2pConsentText, megabytes } from "../components/TorrentStart";
import { ANIME_MODES, ENHANCEMENTS, MOTIONS } from "../player/EnhanceMenu";
import { Row, Toggle } from "../components/SettingControls";
import { SubtitleAppearance } from "../components/SubtitleAppearance";
import { HeroCatalogs } from "../components/HeroCatalogs";
import { WatchingSettings } from "../components/WatchingSettings";
import { refreshLibraryViews } from "../library";
import type { CatalogChoice, P2pCacheName, P2pProfileName, P2pSettings, PlayerSettings, ProfileSettings, AnimeModeName, EnhancementName, MotionName, ResizeModeName, SettingsView, SubtitleSettings } from "../types";
import { formatDateTime, intlLocale, joinList, locale, LOCALES, setLocale, t, type Locale } from "../i18n";
import { backendText, rowTitle } from "../i18n/backend";

type Section = "account" | "home" | "addons" | "playback" | "p2p" | "audio" | "subtitles" | "language" | "data" | "updates" | "pending";

const SECTIONS: { id: Section; label: () => string; icon: ReactNode }[] = [
  { id: "account", label: () => t("set.account"), icon: <AccountIcon /> },
  { id: "home", label: () => t("set.home"), icon: <HomeIcon /> },
  { id: "addons", label: () => t("set.addons"), icon: <AddonsIcon /> },
  { id: "playback", label: () => t("set.playback"), icon: <PlaybackIcon /> },
  { id: "p2p", label: () => t("set.p2p"), icon: <P2pIcon /> },
  { id: "audio", label: () => t("set.audio"), icon: <AudioIcon /> },
  { id: "subtitles", label: () => t("set.subtitles"), icon: <SubtitlesIcon /> },
  { id: "language", label: () => t("set.language"), icon: <LanguageIcon /> },
  { id: "data", label: () => t("set.data"), icon: <ProfileDataIcon /> },
  { id: "updates", label: () => t("set.updates"), icon: <UpdatesIcon /> },
  { id: "pending", label: () => t("set.pending"), icon: <PendingIcon /> },
];

/** Globe line icon for the interface language (same stroke style as the other section icons). */
function LanguageIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18z" />
    </svg>
  );
}

type Status = { kind: "idle" } | { kind: "saving" } | { kind: "saved"; note?: string } | { kind: "error"; message: string };

// ---------- small controls ----------

/** "<b>Title</b> — text" of the pending list. */
function bold(text: string): ReactNode {
  const m = text.match(/^<b>(.*?)<\/b>(.*)$/s);
  return m ? <><b>{m[1]}</b>{m[2]}</> : text;
}

const PENDING = [
  "pend.home", "pend.details", "pend.watched", "pend.cw", "pend.sources", "pend.player", "pend.next", "pend.skip", "pend.subs",
  "pend.audio", "pend.buffer", "pend.downloads", "pend.debrid", "pend.integrations", "pend.media", "pend.plugins", "pend.collections",
  "pend.account", "pend.app",
] as const;

/** Language names in the interface language (Portuguese names of the original as the fallback). */
function languageOptions(): [string, string][] {
  let names: Intl.DisplayNames | null = null;
  try {
    names = new Intl.DisplayNames([intlLocale()], { type: "language" });
  } catch {
    names = null;
  }
  const named = LANGUAGES.map(([code, name]): [string, string] => {
    if (locale() === "pt" || !names) return [code, name];
    try {
      const shown = names.of(code);
      return [code, shown && shown !== code ? shown : name];
    } catch {
      return [code, name];
    }
  });
  return locale() === "pt" ? named : named.sort((a, b) => a[1].localeCompare(b[1], intlLocale()));
}

function LanguageSelect({ value, onChange, special, label }: { value: string | null; onChange(v: string | null): void; special: [string, string][]; label: string }) {
  const known = LANGUAGES.some(([c]) => c.toLowerCase() === (value ?? "").toLowerCase()) || special.some(([c]) => c === (value ?? ""));
  return (
    <select aria-label={label} value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}>
      {special.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
      {!known && value && <option value={value}>{value}</option>}
      {languageOptions().map(([code, name]) => <option key={code} value={code}>{name}</option>)}
    </select>
  );
}

// ---------- page ----------

export function Settings() {
  const [view, setView] = useState<SettingsView | null>(null);
  const [draft, setDraft] = useState<ProfileSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [section, setSection] = useState<Section>("home");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const timer = useRef<number>(0);
  const pending = useRef<{ next: ProfileSettings; note?: string } | null>(null);
  /** Latest settings, including changes not rendered yet (several quick changes in a row). */
  const draftRef = useRef<ProfileSettings | null>(null);
  /** What the draft was based on: only the difference from it is saved. */
  const baseRef = useRef<ProfileSettings | null>(null);
  const profileRef = useRef<number | undefined>(undefined);
  const saving = useRef(false);

  useEffect(() => {
    api.settingsGet().then(
      (v) => {
        setView(v);
        baseRef.current = v.settings;
        profileRef.current = v.profile.index;
        draftRef.current = v.settings;
        setDraft(v.settings);
      },
      (e) => setError(errorText(e)),
    );
  }, []);

  // The account sent something: shown at once. An edit still waiting keeps the screen as it is;
  // its save writes only that edit and returns both.
  useEffect(
    () =>
      onRemoteSettingsChanged(() => {
        api.settingsGet().then((v) => {
          setView(v);
          if (pending.current || saving.current) return;
          baseRef.current = v.settings;
          draftRef.current = v.settings;
          setDraft(v.settings);
        }, () => {});
      }),
    [],
  );

  const flush = useCallback(async () => {
    const job = pending.current;
    if (!job || saving.current) return; // a running save sends it when it ends
    pending.current = null;
    saving.current = true;
    setStatus({ kind: "saving" });
    let ok = false;
    try {
      const watchedBefore = baseRef.current?.player.watchedPercent;
      const saved = await api.settingsSet(job.next, baseRef.current, profileRef.current);
      if (saved.player.watchedPercent !== watchedBefore) refreshLibraryViews();
      ok = true;
      // Rust may have corrected a value or kept one the account sent: show what was stored, unless
      // the user changed something else meanwhile (that change is based on `job.next`, saved next).
      if (draftRef.current === job.next) {
        baseRef.current = saved;
        draftRef.current = saved;
        setDraft(saved);
      } else {
        baseRef.current = job.next;
      }
      if (!pending.current) setStatus({ kind: "saved", note: job.note });
    } catch (e) {
      setStatus({ kind: "error", message: errorText(e) });
    } finally {
      saving.current = false;
    }
    if (ok && pending.current) void flush();
  }, []);

  // Leaving the page (or the app tab) never drops a change still waiting for its debounce.
  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
      void flush();
    },
    [flush],
  );

  /** Applies a change locally and saves it (debounced for sliders and typing). */
  const update = useCallback(
    (change: (s: ProfileSettings) => ProfileSettings, note?: string, delay = 300) => {
      const current = pending.current?.next ?? draftRef.current;
      if (!current) return;
      const next = change(current);
      draftRef.current = next;
      pending.current = { next, note };
      setDraft(next);
      setStatus({ kind: "saving" });
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void flush(), delay);
    },
    [flush],
  );

  const player = (change: (p: PlayerSettings) => PlayerSettings) =>
    update((s) => ({ ...s, player: change(s.player) }), t("set.nextPlayback"));
  const subtitle = (change: (p: SubtitleSettings) => SubtitleSettings) => player((p) => ({ ...p, subtitle: change(p.subtitle) }));

  const resetSection = (what: Section) => {
    if (!view || !draft) return;
    const name = SECTIONS.find((s) => s.id === what)?.label() ?? "";
    if (!window.confirm(t("set.resetConfirm", { section: name, profile: view.profile.name }))) return;
    const d = view.defaults;
    update((s) => {
      switch (what) {
        case "home": return { ...s, home: { ...d.home } };
        case "playback": return { ...s, player: { ...s.player, resizeMode: d.player.resizeMode, decoderPriority: d.player.decoderPriority, nvidiaRtxSuperResolution: d.player.nvidiaRtxSuperResolution, nvidiaRtxHdr: d.player.nvidiaRtxHdr, motionSmoothing: d.player.motionSmoothing, videoEnhancement: d.player.videoEnhancement, picture: { ...d.player.picture }, skipSegmentsEnabled: d.player.skipSegmentsEnabled, autoSkipSegments: [...d.player.autoSkipSegments], nextEpisodeThresholdMode: d.player.nextEpisodeThresholdMode, nextEpisodeThresholdPercent: d.player.nextEpisodeThresholdPercent, nextEpisodeThresholdMinutes: d.player.nextEpisodeThresholdMinutes, watchedPercent: d.player.watchedPercent } };
        case "audio": return { ...s, player: { ...s.player, preferredAudioLanguage: d.player.preferredAudioLanguage, secondaryPreferredAudioLanguage: d.player.secondaryPreferredAudioLanguage } };
        case "subtitles": return { ...s, player: { ...s.player, preferredSubtitleLanguage: d.player.preferredSubtitleLanguage, secondaryPreferredSubtitleLanguage: d.player.secondaryPreferredSubtitleLanguage, subtitle: { ...d.player.subtitle } } };
        default: return s;
      }
    }, t("set.defaultsRestored"), 0);
  };

  if (error) return <div className="screen-message">{t("set.openFailed", { error })}</div>;
  if (!view || !draft) return <div className="screen-message">{t("set.loading")}</div>;
  const p = draft.player;
  const sub = p.subtitle;

  return (
    <div className="settings">
      <nav className="settings-nav" aria-label={t("set.categories")}>
        <div className="settings-profile">
          <Avatar profile={view.profile} />
          <div>
            <div className="setting-title">{view.profile.name}</div>
            <div className="muted small">{t("set.profileSettings")}</div>
          </div>
        </div>
        {SECTIONS.map((s) => (
          <button key={s.id} className={`nav-item ${section === s.id ? "active" : ""}`} data-section={s.id} onClick={() => setSection(s.id)}>
            <span className="nav-icon" aria-hidden>{s.icon}</span>
            <span>{s.label()}</span>
          </button>
        ))}
      </nav>

      <div className="settings-body" key={section}>
        <header className="settings-header">
          <h1>{SECTIONS.find((s) => s.id === section)?.label()}</h1>
          <span className={`save-status ${status.kind}`} role="status" data-testid="save-status">
            {status.kind === "saving" && t("set.saving")}
            {status.kind === "saved" && `${t("set.saved")}${status.note ? ` · ${status.note}` : ""}`}
            {status.kind === "error" && t("common.saveFailed", { error: status.message })}
          </span>
          {["home", "playback", "audio", "subtitles"].includes(section) && (
            <button className="ghost" onClick={() => resetSection(section)}>{t("set.restoreDefaults")}</button>
          )}
        </header>

        {section === "home" && (
          <HomeSection settings={draft} catalogs={view.catalogs} update={update} />
        )}

        {section === "account" && <AccountPanel />}
        {section === "addons" && <AddonsManager />}

        {section === "playback" && (
          <div className="settings-group">
            <Row title={t("set.resizeMode")} description={t("set.resizeModeDesc")}>
              <select aria-label={t("set.resizeMode")} data-setting="resizeMode" value={p.resizeMode} onChange={(e) => player((x) => ({ ...x, resizeMode: e.target.value as ResizeModeName }))}>
                <option value="Fit">{t("player.fit")}</option>
                <option value="Fill">{t("player.fill")}</option>
                <option value="Zoom">{t("player.zoom")}</option>
                <option value="Stretch">{t("player.stretch")}</option>
              </select>
            </Row>
            <Row title={t("set.decoder")} description={t("set.decoderDesc")}>
              <select aria-label={t("set.decoder")} data-setting="decoderPriority" value={p.decoderPriority} onChange={(e) => player((x) => ({ ...x, decoderPriority: Number(e.target.value) }))}>
                <option value={1}>{t("set.decoderHw")}</option>
                <option value={0}>{t("set.decoderHwOnly")}</option>
                <option value={2}>{t("set.decoderSwOnly")}</option>
              </select>
            </Row>
            <Row title={t("set.enhance")} description={t("set.enhanceDesc")}>
              <select aria-label={t("set.enhance")} data-setting="videoEnhancement" value={p.videoEnhancement} onChange={(e) => player((x) => ({ ...x, videoEnhancement: e.target.value as EnhancementName }))}>
                {ENHANCEMENTS.map((o) => <option key={o.value} value={o.value}>{o.label()}</option>)}
              </select>
            </Row>
            <Row title={t("set.animeMode")} description={t("set.animeModeDesc", { hint: ANIME_MODES.find((m) => m.value === p.picture.mode)?.hint() ?? "" })}>
              <select aria-label={t("set.animeMode")} data-setting="animeMode" value={p.picture.mode} onChange={(e) => player((x) => ({ ...x, picture: { ...x.picture, mode: e.target.value as AnimeModeName } }))}>
                {ANIME_MODES.map((o) => <option key={o.value} value={o.value}>{o.label()}</option>)}
              </select>
            </Row>
            <Row title={t("set.motion")} description={t("set.motionDesc")}>
              <select aria-label={t("set.motion")} data-setting="motionSmoothing" value={p.motionSmoothing} onChange={(e) => player((x) => ({ ...x, motionSmoothing: e.target.value as MotionName }))}>
                {MOTIONS.map((o) => <option key={o.value} value={o.value}>{o.label()}</option>)}
              </select>
            </Row>
            <Row title={t("set.rtxSr")} description={t("set.rtxSrDesc")}>
              <Toggle label="NVIDIA RTX Video Super Resolution" checked={p.nvidiaRtxSuperResolution} onChange={(v) => player((x) => ({ ...x, nvidiaRtxSuperResolution: v }))} />
            </Row>
            <Row title={t("set.rtxHdr")} description={t("set.rtxHdrDesc")}>
              <Toggle label="NVIDIA RTX Video HDR" checked={p.nvidiaRtxHdr} onChange={(v) => player((x) => ({ ...x, nvidiaRtxHdr: v }))} />
            </Row>
            <WatchingSettings value={p} onChange={player} />
          </div>
        )}

        {section === "p2p" && <P2pSection settings={draft.p2p} update={(change) => update((s) => ({ ...s, p2p: change(s.p2p) }), t("set.nextTorrent"), 0)} />}

        {section === "audio" && (
          <div className="settings-group">
            <Row title={t("set.audioLang")} description={t("set.deviceLangIs", { languages: joinList(view.deviceLanguages) || t("set.unidentified") })}>
              <LanguageSelect label={t("set.audioLang")} value={p.preferredAudioLanguage} special={[["device", t("set.deviceLang")], ["default", t("set.fileDefault")], ["original", t("set.originalLang")]]} onChange={(v) => player((x) => ({ ...x, preferredAudioLanguage: v ?? "device" }))} />
            </Row>
            <Row title={t("set.audioLang2")} description={t("set.audioLang2Desc")}>
              <LanguageSelect label={t("set.audioLang2")} value={p.secondaryPreferredAudioLanguage} special={[["", t("set.noneM")]]} onChange={(v) => player((x) => ({ ...x, secondaryPreferredAudioLanguage: v }))} />
            </Row>
            <p className="muted small pad-top">{t("set.originalNote")}</p>
          </div>
        )}

        {section === "subtitles" && (
          <div className="settings-group">
            <Row title={t("set.subLang")}>
              <LanguageSelect label={t("set.subLang")} value={p.preferredSubtitleLanguage} special={[["none", t("set.subNone")], ["device", t("set.deviceLang")], ["forced", t("set.subForced")]]} onChange={(v) => player((x) => ({ ...x, preferredSubtitleLanguage: v ?? "none" }))} />
            </Row>
            <Row title={t("set.subLang2")}>
              <LanguageSelect label={t("set.subLang2")} value={p.secondaryPreferredSubtitleLanguage} special={[["", t("set.noneM")]]} onChange={(v) => player((x) => ({ ...x, secondaryPreferredSubtitleLanguage: v }))} />
            </Row>
            <SubtitleAppearance value={sub} onChange={subtitle} />
            <Row title={t("set.sdh")} description={t("set.sdhDesc")}>
              <Toggle label={t("set.sdhShort")} checked={sub.stripSdh} onChange={(v) => subtitle((s) => ({ ...s, stripSdh: v }))} />
            </Row>
          </div>
        )}

        {section === "language" && (
          <div className="settings-group" data-testid="language-settings">
            <Row title={t("set.uiLang")} description={t("set.uiLangDesc")}>
              <select aria-label={t("set.uiLang")} data-setting="uiLanguage" value={locale()} onChange={(e) => setLocale(e.target.value as Locale)}>
                {LOCALES.map((l) => <option key={l.id} value={l.id} lang={l.id}>{l.name}</option>)}
              </select>
            </Row>
          </div>
        )}

        {section === "data" && (
          <div className="settings-group">
            <div className="about" data-testid="about">
              <img src="./nuvio-astra-128.png" alt="" width={56} height={56} draggable={false} />
              <div>
                <div className="about-name">{t("app.name")}</div>
                <div className="muted small">{t("set.version", { version: view.appVersion })}</div>
              </div>
            </div>
            <Row title={t("set.activeProfile")} description={t("set.activeProfileDesc")}>
              <span>{view.profile.name}</span>
            </Row>
            <Row title={t("set.dataDir")} description={t("set.dataDirDesc")}>
              <code className="path" dir="ltr">{view.dataDir}</code>
            </Row>
            {view.migration && (
              <>
                <Row title={t("set.migration")} description={t("set.migrationDesc")}>
                  <span>
                    {t("set.migrationValue", { version: view.migration.version, files: view.migration.backupFiles, profiles: view.migration.profiles, settings: view.migration.settingsProfiles ?? 0 })}
                  </span>
                </Row>
                <Row title={t("set.backup")}><code className="path" dir="ltr">{view.migration.backupDir}</code></Row>
              </>
            )}
          </div>
        )}

        {section === "updates" && <UpdatesSection />}

        {section === "pending" && (
          <div className="settings-group">
            <p className="muted">{t("set.pendingIntro")}</p>
            <ul className="pending-list">
              {PENDING.map((key) => <li key={key}>{bold(t(key))}</li>)}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Atualizações ----------

function UpdatesSection() {
  const u = useUpdates();
  const s = u.status;
  const when = u.lastCheck ? formatDateTime(new Date(u.lastCheck), { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }) : null;
  return (
    <div className="settings-group" data-testid="updates-settings">
      <Row title={t("upd.installed")} description={s?.repository ? t("upd.publishedAt", { repo: s.repository }) : undefined}>
        <span>{s?.currentVersion ?? "…"}</span>
      </Row>
      {s && !s.configured && <p className="muted">{t("upd.notConfigured")}</p>}
      {s?.configured && (
        <>
          <Row title={t("upd.check")} description={t("upd.checkDesc")}>
            <button className="ghost" disabled={u.checking || !!u.installing} onClick={() => void checkForUpdates()} data-testid="update-check">
              {u.checking ? t("upd.checking") : t("upd.checkNow")}
            </button>
          </Row>
          {u.checkError && <div className="row-error">{backendText(u.checkError)}</div>}
          {!u.checking && !u.checkError && u.lastCheck && !u.available && <div className="addon-feedback ok" role="status">{t("upd.latest", { when })}</div>}
          {u.available && (
            <div className="update-card">
              <div className="setting-title">{t("upd.newVersion", { version: u.available.version })}</div>
              {u.available.notes && <pre className="update-notes">{u.available.notes}</pre>}
              <div className="account-actions">
                <button className="primary" disabled={!!u.installing && u.installing.phase !== "error"} onClick={() => void installUpdate()}>
                  {u.installing && u.installing.phase !== "error" ? t("upd.updating") : t("update.now")}
                </button>
              </div>
              {u.installing?.phase === "error" && <div className="row-error">{u.installing.error ? backendText(u.installing.error) : null}</div>}
            </div>
          )}
          <p className="muted small">{t("upd.keeps")}</p>
        </>
      )}
    </div>
  );
}

// ---------- Torrent / P2P ----------

function P2pSection({ settings, update }: { settings: P2pSettings; update(change: (s: P2pSettings) => P2pSettings): void }) {
  const [cache, setCache] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api.p2pCacheSize().then(setCache, () => setCache(null));
  }, []);

  const enable = (on: boolean) => {
    if (on && !window.confirm(p2pConsentText().join("\n\n"))) return;
    update((s) => ({ ...s, enabled: on }));
  };
  const clear = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const freed = await api.p2pClearCache();
      setMessage(t("p2pset.cleared", { size: megabytes(freed) }));
      setCache(await api.p2pCacheSize());
    } catch (e) {
      setMessage(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="settings-group" data-testid="p2p-settings">
      <Row title={t("p2pset.streaming")} description={t("p2pset.streamingDesc")}>
        <Toggle label={t("p2pset.streaming")} checked={settings.enabled} onChange={enable} />
      </Row>
      <Row title={t("p2pset.upload")} description={t("p2pset.uploadDesc")}>
        <Toggle label={t("p2pset.uploadShort")} checked={settings.enableUpload} onChange={(v) => update((s) => ({ ...s, enableUpload: v }))} />
      </Row>
      <Row title={t("p2pset.hideStats")} description={t("p2pset.hideStatsDesc")}>
        <Toggle label={t("p2pset.hideStatsShort")} checked={settings.hideTorrentStats} onChange={(v) => update((s) => ({ ...s, hideTorrentStats: v }))} />
      </Row>
      <Row title={t("p2pset.profile")} description={t("p2pset.profileDesc")}>
        <select aria-label={t("p2pset.profile")} value={settings.torrentProfile} onChange={(e) => update((s) => ({ ...s, torrentProfile: e.target.value as P2pProfileName }))}>
          <option value="SOFT">{t("p2pset.soft")}</option>
          <option value="BALANCED">{t("p2pset.balanced")}</option>
          <option value="FAST">{t("p2pset.fast")}</option>
        </select>
      </Row>
      <Row title={t("p2pset.cacheSize")} description={t("p2pset.cacheSizeDesc")}>
        <select aria-label={t("p2pset.cacheSize")} value={settings.cacheSize} onChange={(e) => update((s) => ({ ...s, cacheSize: e.target.value as P2pCacheName }))}>
          <option value="NONE">{t("p2pset.noCache")}</option>
          <option value="GB_2">{t("p2pset.gb2")}</option>
          <option value="GB_5">5 GB</option>
          <option value="GB_10">10 GB</option>
        </select>
      </Row>
      <Row title={t("p2pset.cacheUsed")} description={t("p2pset.cacheUsedDesc")}>
        <span className="account-actions" style={{ marginBlockStart: 0 }}>
          <span dir="ltr">{cache === null ? "—" : megabytes(cache)}</span>
          <button className="ghost" disabled={busy} onClick={() => void clear()}>{busy ? t("p2pset.clearing") : t("p2pset.clear")}</button>
        </span>
      </Row>
      {message && <div className="addon-feedback ok" role="status">{backendText(message)}</div>}
    </div>
  );
}

// ---------- Início ----------

function HomeSection({ settings, catalogs, update }: {
  settings: ProfileSettings;
  catalogs: CatalogChoice[];
  update(change: (s: ProfileSettings) => ProfileSettings, note?: string, delay?: number): void;
}) {
  const note = t("homeset.updated");
  const home = settings.home;
  // Current order: saved preferences first (by order), then catalogs without one.
  const ordered = [...catalogs].sort((a, b) => {
    const pa = home.items.find((i) => i.key === a.key)?.order ?? Number.MAX_SAFE_INTEGER;
    const pb = home.items.find((i) => i.key === b.key)?.order ?? Number.MAX_SAFE_INTEGER;
    return pa - pb || catalogs.indexOf(a) - catalogs.indexOf(b);
  });
  const pref = (c: CatalogChoice) => home.items.find((i) => i.key === c.key);

  /** Rewrites the preference list in `order`, keeping hero-source flags. Rows not listed now (an
   *  addon that is off or did not answer) keep their saved position, as in the original. */
  const saveCatalogs = (order: CatalogChoice[], patch?: { key: string; enabled?: boolean; customTitle?: string }, delay?: number) =>
    update(
      (s) => ({
        ...s,
        home: {
          ...s.home,
          items: [...order.map((c, index) => {
            const old = s.home.items.find((i) => i.key === c.key);
            const base = { key: c.key, customTitle: old?.customTitle ?? c.customTitle, enabled: old?.enabled ?? c.enabled, heroSourceEnabled: old?.heroSourceEnabled ?? true, order: index };
            return patch && patch.key === c.key ? { ...base, ...(patch.enabled !== undefined && { enabled: patch.enabled }), ...(patch.customTitle !== undefined && { customTitle: patch.customTitle }) } : base;
          }), ...s.home.items.filter((i) => !order.some((c) => c.key === i.key))],
        },
      }),
      note,
      delay,
    );

  const move = (index: number, dir: -1 | 1) => {
    const next = [...ordered];
    const [item] = next.splice(index, 1);
    next.splice(index + dir, 0, item);
    saveCatalogs(next, undefined, 0);
  };

  return (
    <>
      <div className="settings-group">
        <Row title={t("homeset.hero")} description={t("homeset.heroDesc")}>
          <Toggle label={t("homeset.hero")} checked={home.heroEnabled} onChange={(v) => update((s) => ({ ...s, home: { ...s.home, heroEnabled: v } }), note)} />
        </Row>
        {home.heroEnabled && (
          <HeroCatalogs home={home} catalogs={ordered} onChange={(heroCatalogs) => update((s) => ({ ...s, home: { ...s.home, heroCatalogs } }), note, 0)} />
        )}
        <Row title={t("homeset.showType")} description={t("homeset.showTypeDesc")}>
          <Toggle label={t("homeset.showType")} checked={home.showCatalogType} onChange={(v) => update((s) => ({ ...s, home: { ...s.home, showCatalogType: v } }), note)} />
        </Row>
        <Row title={t("homeset.hideUnreleased")} description={t("homeset.hideUnreleasedDesc")}>
          <Toggle label={t("homeset.hideUnreleased")} checked={home.hideUnreleasedContent} onChange={(v) => update((s) => ({ ...s, home: { ...s.home, hideUnreleasedContent: v } }), note)} />
        </Row>
      </div>
      <h2 className="settings-subtitle">{t("homeset.catalogs", { visible: ordered.filter((c) => pref(c)?.enabled ?? c.enabled).length, total: ordered.length })}</h2>
      <p className="muted small">{t("homeset.syncNote")}</p>
      <div className="settings-group catalogs">
        {ordered.map((c, index) => {
          const enabled = pref(c)?.enabled ?? c.enabled;
          const title = pref(c)?.customTitle ?? c.customTitle;
          return (
            <div key={c.key} className={`catalog-pref ${enabled ? "" : "off"}`} data-key={c.key}>
              <Toggle label={t("homeset.show", { name: rowTitle(c.defaultTitle) })} checked={enabled} onChange={(v) => saveCatalogs(ordered, { key: c.key, enabled: v }, 0)} />
              <div className="catalog-pref-text">
                <input
                  className="catalog-title-input"
                  value={title}
                  placeholder={rowTitle(c.defaultTitle)}
                  aria-label={t("homeset.name", { name: rowTitle(c.defaultTitle) })}
                  onChange={(e) => saveCatalogs(ordered, { key: c.key, customTitle: e.target.value }, 600)}
                />
                <span className="muted small">{c.addonName}</span>
              </div>
              <button className="icon-btn" aria-label={t("homeset.up", { name: rowTitle(c.defaultTitle) })} disabled={index === 0} onClick={() => move(index, -1)}>↑</button>
              <button className="icon-btn" aria-label={t("homeset.down", { name: rowTitle(c.defaultTitle) })} disabled={index === ordered.length - 1} onClick={() => move(index, 1)}>↓</button>
            </div>
          );
        })}
      </div>
    </>
  );
}
