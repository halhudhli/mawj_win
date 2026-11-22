import { invoke } from "./tauri";
import { t } from "./i18n";
import { backendText } from "./i18n/backend";
import type {
  EpgView,
  SubtitleFont,
  SubtitleFontList,
  SubtitleList,
  Moments,
  UpdateInfo,
  UpdateStatus,
  P2pStatus,
  TorrentPrepared,
  AddonPreview, AddonsView, Bootstrap, CatalogPage, ChannelList, CssRect, Details, HistoryEntry, HistoryPage, HomeView, LibraryItem,
  AccountStatus, AvatarItem, PinResult, SyncPreview, PlaybackItem, PlayerCommand, ProfilesView, PlayerInfo, PlayerSnapshot, ProfileSettings, SearchSection, SettingsView, StreamGroup,
  TitleProgress,
} from "./types";

// Session caches: the same catalog page or title is asked to the addons once, so scrolling back,
// returning to Home or reopening a title never repeats the request. Failures are not cached.
const pageCache = new Map<string, Promise<CatalogPage>>();
const detailsCache = new Map<string, Promise<Details>>();
const homeListeners = new Set<() => void>();

const remoteSettingsListeners = new Set<() => void>();
/** The account changed settings, the Home layout or the collections (not a change made in this app). */
export function onRemoteSettingsChanged(listener: () => void): () => void {
  remoteSettingsListeners.add(listener);
  return () => remoteSettingsListeners.delete(listener);
}

// Data epoch: changes when the active profile or its addons change. Every cache tied to them is
// dropped, and an answer started before the change is ignored by whoever compares the epoch.
let epoch = 0;
const epochListeners = new Set<(reason: "profile" | "addons") => void>();
export const dataEpoch = () => epoch;
function newEpoch(reason: "profile" | "addons") {
  epoch++;
  pageCache.clear();
  detailsCache.clear();
  epochListeners.forEach((l) => l(reason));
}
export function onDataEpoch(listener: (reason: "profile" | "addons") => void): () => void {
  epochListeners.add(listener);
  return () => epochListeners.delete(listener);
}

// What a sync brought from the account: addon changes reload the addon-based screens (data epoch);
// profile list changes (names, avatars, PIN) only refresh the profile list. Library, progress and
// watched changes arrive as `library-changed` (Library, Details, Continue watching re-read).
const profileListeners = new Set<() => void>();
export function onProfilesChanged(listener: () => void): () => void {
  profileListeners.add(listener);
  return () => profileListeners.delete(listener);
}
/** Reloads every screen of the active profile (after unlocking it with its PIN). */
export function reloadProfileData() {
  newEpoch("profile");
}
export function notifyRemoteChange(_profile: number, changed: string[]) {
  if (changed.includes("addons")) newEpoch("addons");
  if (changed.includes("profiles")) profileListeners.forEach((l) => l());
  if (changed.includes("collections") || changed.includes("home")) {
    pageCache.clear(); // "ocultar não lançados" may have changed
    homeListeners.forEach((l) => l());
  }
  if (["collections", "home", "settings"].some((k) => changed.includes(k))) remoteSettingsListeners.forEach((l) => l());
}

function cached<T>(cache: Map<string, Promise<T>>, key: string, load: () => Promise<T>): Promise<T> {
  let value = cache.get(key);
  if (!value) {
    value = load();
    value.catch(() => cache.delete(key));
    cache.set(key, value);
  }
  return value;
}

export const api = {
  bootstrap: () => invoke<Bootstrap>("app_bootstrap"),
  homeRows: () => invoke<HomeView>("home_rows"),
  /** `genre`: a collection folder's catalog filtered by genre. */
  catalogPage: (key: string, skip: number | null, genre: string | null = null) =>
    cached(pageCache, `${key}#${genre ?? ""}#${skip ?? 0}`, () => invoke<CatalogPage>("catalog_page", { key, skip, genre })),
  search: (query: string) => invoke<SearchSection[]>("search_all", { query }),
  details: (contentType: string, id: string) =>
    cached(detailsCache, `${contentType}/${id}`, () => invoke<Details>("meta_details", { contentType, id })),
  streams: (contentType: string, id: string) => invoke<StreamGroup[]>("title_streams", { contentType, id }),
  settingsGet: () => invoke<SettingsView>("settings_get"),
  /** Saves and returns what was stored (validated by Rust). `previous`: what was loaded before the
   *  edit, so only the edit is written. `profile`: the one edited. Home changes drop the cached pages. */
  async settingsSet(settings: ProfileSettings, previous?: ProfileSettings | null, profile?: number): Promise<ProfileSettings> {
    const saved = await invoke<ProfileSettings>("settings_set", { settings, previous: previous ?? null, profile: profile ?? null });
    pageCache.clear();
    homeListeners.forEach((l) => l());
    return saved;
  },
  /** Home re-reads its rows when the profile's Home settings change. */
  onHomeSettingsChanged(listener: () => void): () => void {
    homeListeners.add(listener);
    return () => homeListeners.delete(listener);
  },
  subtitleFonts: () => invoke<SubtitleFontList>("subtitle_fonts"),
  /** Opens the Windows file dialog; `null` = cancelled. */
  subtitleFontImport: () => invoke<SubtitleFont | null>("subtitle_font_import"),
  subtitleFontRemove: (id: string) => invoke<void>("subtitle_font_remove", { id }),
  subtitleFontData: (id: string) => invoke<ArrayBuffer>("subtitle_font_data", { id }),
  appMode: () => invoke<"app" | "selftest" | "uitest">("app_mode"),
  liveTvChannels: () => invoke<ChannelList>("livetv_channels"),
  liveTvFavorites: () => invoke<string[]>("livetv_favorites"),
  liveTvToggleFavorite: (key: string) => invoke<string[]>("livetv_toggle_favorite", { key }),
  /** Asks only the channel's own addon, only when the user picks the channel. */
  liveTvResolve: (key: string) => invoke<StreamGroup[]>("livetv_resolve", { key }),

  // Addons of the active profile (Settings → Addons). Every change starts a new data epoch.
  addonsList: () => invoke<AddonsView>("addons_list"),
  addonPreview: (address: string) => invoke<AddonPreview>("addon_preview", { address }),
  addonInstall: (key: string, trackingConsent: boolean) => changed("addons", invoke<AddonsView>("addon_install", { key, trackingConsent })),
  addonSetEnabled: (key: string, enabled: boolean) => changed("addons", invoke<AddonsView>("addon_set_enabled", { key, enabled })),
  addonRemove: (key: string) => changed("addons", invoke<AddonsView>("addon_remove", { key })),
  addonMove: (key: string, delta: number) => changed("addons", invoke<AddonsView>("addon_move", { key, delta })),
  addonRefresh: (key: string) => changed("addons", invoke<AddonsView>("addon_refresh", { key })),
  addonConfigure: (key: string) => invoke<void>("addon_configure", { key }),

  // Profiles. A switch closes the player in Rust and starts a new data epoch.
  profilesList: () => invoke<ProfilesView>("profiles_list"),
  /** Asks again whether the PIN was removed in Nuvio. */
  profilePinRefresh: (index: number) => invoke<ProfilesView>("profile_pin_refresh", { index }),
  /** The UI listens to the sync events: Rust starts the first sync. */
  appReady: () => invoke<void>("app_ready"),
  welcomeNeeded: () => invoke<boolean>("welcome_needed"),
  welcomeDone: () => invoke<void>("welcome_done"),
  /** After signing in: receives the account's data and joins it with this computer's. */
  accountConnect: (confirmOther: boolean) => invoke<AccountStatus>("account_connect", { confirmOther }),
  profileSwitch: (index: number) => changed("profile", invoke<ProfilesView>("profile_switch", { index })),
  profileCreate: (name: string, color: string, usesPrimaryAddons: boolean) => invoke<ProfilesView>("profile_create", { name, color, usesPrimaryAddons }),
  /** `avatarId`: an id of the account's catalog, "" for color and initial, undefined to keep it. */
  profileUpdate: (index: number, name: string, color: string, usesPrimaryAddons: boolean, avatarId?: string) =>
    changed("profile", invoke<ProfilesView>("profile_update", { index, name, color, usesPrimaryAddons, avatarId: avatarId ?? null })),
  /** Validates a profile's PIN in Rust (account, or the offline hash) before opening it. */
  profileUnlock: (index: number, pin: string) => invoke<PinResult>("profile_unlock", { index, pin }),
  profilePinSet: (index: number, pin: string, currentPin: string | null) => invoke<ProfilesView>("profile_pin_set", { index, pin, currentPin }),
  profilePinClear: (index: number, currentPin: string | null) => invoke<ProfilesView>("profile_pin_clear", { index, currentPin }),

  // Nuvio account: the session stays in Rust (DPAPI); the UI only sees this status.
  accountStatus: () => invoke<AccountStatus>("account_status"),
  accountSignIn: (email: string, password: string) => invoke<AccountStatus>("account_sign_in", { email, password }),
  accountSignUp: (email: string, password: string) => invoke<{ signedIn: boolean; message: string }>("account_sign_up", { email, password }),
  accountSignOut: () => invoke<AccountStatus>("account_sign_out"),
  accountSyncNow: (confirmLink = false) => invoke<AccountStatus>("account_sync_now", { confirmLink }),
  /** Read-only comparison with the account (nothing is written). */
  accountSyncPreview: () => invoke<SyncPreview>("account_sync_preview"),
  avatarsCatalog: () => invoke<AvatarItem[]>("avatars_catalog"),
  profileDelete: (index: number) => changed("profile", invoke<ProfilesView>("profile_delete", { index })),

  // Library: NextGen's own data, no addon request.
  libraryFavoriteKeys: () => invoke<string[]>("library_favorite_keys"),
  libraryFavorites: () => invoke<LibraryItem[]>("library_favorites"),
  libraryToggleFavorite: (item: Omit<LibraryItem, "savedAtEpochMs">) => invoke<boolean>("library_toggle_favorite", { item }),
  libraryRemoveFavorite: (contentType: string, id: string) => invoke<boolean>("library_remove_favorite", { contentType, id }),
  libraryContinueWatching: () => invoke<HistoryEntry[]>("library_continue_watching"),
  /** The row completed with next episodes (asks the addons for the episode lists it lacks). */
  libraryNextUp: () => invoke<HistoryEntry[]>("library_next_up"),
  libraryHistory: (offset: number, limit: number) => invoke<HistoryPage>("library_history", { offset, limit }),
  libraryRemoveHistory: (key: string) => invoke<boolean>("library_remove_history", { key }),
  libraryTitleProgress: (id: string) => invoke<TitleProgress>("library_title_progress", { id }),

  /** `progress`: the movie/episode, so Rust saves its position (absent for live TV). */
  playStream: (key: string, startSeconds: number | null, progress: PlaybackItem | null = null, previousFinished = false) =>
    invoke<PlayerInfo>("stream_play", { key, startSeconds, progress, previousFinished }),
  playerSubtitles: (session: number) => invoke<SubtitleList>("player_subtitles", { session }),
  playerSubtitleLoad: (session: number, index: number) => invoke<void>("player_subtitle_load", { session, index }),
  playerSubtitleStyle: () => invoke<void>("player_subtitle_style"),
  playerMoments: (session: number) => invoke<Moments>("player_moments", { session }),
  playerCommand: (command: PlayerCommand) => invoke<void>("player_command", { command }).catch(() => {}),
  /** `rect` in CSS pixels; `null` = whole window. */
  playerRect: (rect: CssRect | null) =>
    invoke<void>("player_video_rect", { rect, scale: window.devicePixelRatio }).catch(() => {}),
  playerSnapshot: () => invoke<PlayerSnapshot>("player_snapshot"),
  playerClose: () => invoke<void>("player_close"),
  /** Starts the P2P engine for a torrent stream (rejects with `P2P_CONSENT_REQUIRED` while P2P is off). */
  torrentPrepare: (key: string) => invoke<TorrentPrepared>("torrent_prepare", { key }),
  torrentStop: () => invoke<void>("torrent_stop"),
  /** Program guide of one channel (cached in Rust until the current program ends). */
  liveTvEpg: (key: string, tzOffsetMinutes: number) => invoke<EpgView>("livetv_epg", { key, tzOffsetMinutes }),
  /** Fetches again the manifests and channels of the channel addons (all, or the ones named). */
  liveTvReload: (addonNames: string[] | null) => invoke<ChannelList>("livetv_reload", { addonNames }),
  updateStatus: () => invoke<UpdateStatus>("update_status"),
  /** Asks the release endpoint for a newer version (nothing downloaded). */
  updateCheck: () => invoke<UpdateInfo | null>("update_check"),
  /** Downloads, verifies the signature and runs the installer (the app then closes). */
  updateInstall: () => invoke<void>("update_install"),
  /** Resolves the YouTube trailer (only now, on the user's click) and opens it in the player. */
  trailerPlay: (key: string) => invoke<PlayerInfo>("trailer_play", { key }),
  p2pStatus: () => invoke<P2pStatus>("p2p_status"),
  p2pClearCache: () => invoke<number>("p2p_clear_cache"),
  p2pCacheSize: () => invoke<number>("p2p_cache_size"),
  pictureInPicture: (enabled: boolean, title: string) => invoke<void>("player_picture_in_picture", { enabled, title }),
  setFullscreen: (fullscreen: boolean) => invoke<void>("window_set_fullscreen", { fullscreen }),
};

async function changed<T>(reason: "profile" | "addons", call: Promise<T>): Promise<T> {
  const value = await call;
  newEpoch(reason);
  return value;
}

/** A failure as the user reads it: messages sent by Rust (written in Portuguese, as the original)
 *  are shown in the interface language. */
export function errorText(error: unknown): string {
  const raw = typeof error === "string" ? error : error instanceof Error ? error.message : null;
  return raw === null ? t("app.unknownError") : backendText(raw);
}
