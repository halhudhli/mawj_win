//! Nuvio Astra desktop shell (Windows x64): Tauri 2 window + embedded libmpv.
//!
//! The UI talks to Rust only through the typed commands below (no file system, shell or raw
//! network access is exposed to the webview). Stream URLs, headers and tokens stay in Rust.
//! Player state flows back as `player-state` events.
//!
//! Sync commands run on the main thread, which owns the window: every command that creates,
//! moves or destroys a Win32 window is sync for that reason.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod account;
mod api;
mod bench;
mod capture;
mod manage;
mod p2p;
mod pip;
mod selftest;
mod services;
mod streams;
mod watching;
mod trailer;
mod updater;
mod uitest;

use nuvio_core::client::AddonClient;
use nuvio_player::mpv::MpvApi;
use nuvio_player::{LoadRequest, Player, PlayerCommand, PlayerSnapshot, VideoConfig};
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

pub struct AppState {
    api: Mutex<Option<Arc<MpvApi>>>,
    player: Mutex<Option<Player>>,
    session: AtomicU64,
    hwnd: Mutex<isize>,
    pub client: AddonClient,
    pub streams: streams::StreamCache,
    pub video: Mutex<VideoConfig>,
    pub addons: services::addons::AddonContext,
    pub app_store: nuvio_store::nextgen::AppStore,
    /// Watch progress of the current title (saved off the player thread).
    pub progress: services::progress::ProgressTracker,
    /// Manifest loaded by the install preview, installed by `addon_install` without a new request.
    pub pending_addon: Mutex<Option<nuvio_core::manifest::AddonManifest>>,
    /// Nuvio account (session in Rust only) and its sync engine.
    pub account: Arc<nuvio_sync::Engine>,
    /// Wakes the background sync (local changes, profile switch).
    pub sync_wake: Arc<tokio::sync::Notify>,
    pub sync_signals: Arc<account::SyncSignals>,
    /// The picture-in-picture window while it exists (`pip.rs`).
    pub pip: Mutex<Option<tauri::WebviewWindow>>,
    pub pin_gate: Mutex<account::PinGate>,
    /// P2P session (original's Nuvio Engine) of torrent streams.
    pub p2p: Arc<nuvio_p2p::P2pService>,
    /// Stream key and file of the prepared torrent (`torrent_prepare` → `stream_play`).
    pub p2p_prepared: Mutex<Option<(String, nuvio_p2p::PreparedStream)>>,
    /// Player session that plays the P2P stream (its close ends the P2P session).
    pub p2p_session: AtomicU64,
    /// YouTube trailers (resolved on click only).
    pub youtube: nuvio_core::youtube::Extractor,
    /// Update found by the last check (official Tauri updater).
    pub updates: updater::UpdateState,
    /// Program guides of the live channels opened (memory only, bounded).
    pub epg: services::epg::EpgStore,
    /// The movie or episode playing (subtitles, skip buttons).
    pub playing: Mutex<Option<Arc<watching::Playing>>>,
    pub subtitle_choice: Mutex<Option<watching::Choice>>,
    /// Episode lists behind "next episode" in Continue watching.
    pub next_up: services::next_up::Lists,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenRequest {
    pub url: String,
    #[serde(default)]
    pub headers: Vec<(String, String)>,
    #[serde(default)]
    pub start_seconds: f64,
}

#[derive(Debug, Deserialize, Clone, Copy)]
pub struct CssRect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayerInfo {
    pub session: u64,
    pub libmpv_api: String,
}

impl AppState {
    pub fn api(&self) -> Result<Arc<MpvApi>, String> {
        let mut slot = self.api.lock().expect("api lock");
        if let Some(api) = slot.as_ref() {
            return Ok(api.clone());
        }
        let path = nuvio_player::locate_libmpv()
            .ok_or_else(|| "libmpv-2.dll not found (next to the exe or NUVIO_LIBMPV)".to_string())?;
        let api = MpvApi::load(&path).map_err(|e| e.to_string())?;
        *slot = Some(api.clone());
        Ok(api)
    }

    /// Opens a new session, closing the previous one first (one player at a time). Main thread.
    pub fn open(&self, app: &AppHandle, url: String, headers: Vec<(String, String)>, start_seconds: f64) -> Result<PlayerInfo, String> {
        self.open_with_audio(app, url, None, headers, start_seconds)
    }

    /// `open` with a separate audio URL (trailers).
    pub fn open_with_audio(&self, app: &AppHandle, url: String, audio_url: Option<String>, headers: Vec<(String, String)>, start_seconds: f64) -> Result<PlayerInfo, String> {
        let api = self.api()?;
        self.close();
        let session = self.session.fetch_add(1, Ordering::SeqCst) + 1;
        let emitter = app.clone();
        let profile = self.active_profile();
        let saved_changes = std::sync::atomic::AtomicU32::new(0);
        let sink: nuvio_player::SnapshotSink = Arc::new(move |snapshot: &PlayerSnapshot| {
            let state = emitter.state::<AppState>();
            state.progress.observe(snapshot);
            if saved_changes.swap(snapshot.auto_changes, Ordering::SeqCst) != snapshot.auto_changes {
                // Only what the watchdog lowered.
                let (motion, enhancement, picture) = match snapshot.auto_reason {
                    Some("motion") => (Some(snapshot.motion), None, None),
                    Some("effects") => (None, None, Some(snapshot.picture)),
                    _ => (None, Some(snapshot.enhancement), None),
                };
                services::playback::save_improvements(&state.app_store, profile, motion, enhancement, picture);
            }
            let _ = emitter.emit("player-state", snapshot);
        });
        let load = LoadRequest {
            url,
            headers,
            start_seconds,
            paused: false,
            video: self.video.lock().expect("video lock").clone(),
            audio_url,
        };
        let hwnd = *self.hwnd.lock().expect("hwnd lock");
        let player = Player::open(api.clone(), hwnd, session, &load, sink).map_err(|e| e.to_string())?;
        *self.player.lock().expect("player lock") = Some(player);
        let (major, minor) = api.client_api_version();
        Ok(PlayerInfo { session, libmpv_api: format!("{major}.{minor}") })
    }

    /// Main thread (destroys the video container).
    pub fn close(&self) {
        *self.playing.lock().expect("playing lock") = None;
        // Take it out first so shutdown (which joins threads) runs without holding the lock.
        let player = self.player.lock().expect("player lock").take();
        // Last position of a tracked title (close, switch to another title, app exit).
        if let Some(player) = &player {
            let snapshot = player.snapshot();
            self.progress.finish(Some(&snapshot));
            p2p::on_player_closed(self, snapshot.session);
        }
        // Dropping moves the video back out of the PiP window, which can then go.
        drop(player);
        pip::close_window(self);
    }

    /// Active profile (NextGen `profiles.json`; changed by `profile_switch`).
    pub fn active_profile(&self) -> i64 {
        self.app_store.profiles().map(|p| p.active).unwrap_or(1)
    }

    pub fn with_player<T>(&self, f: impl FnOnce(&Player) -> Result<T, String>) -> Result<T, String> {
        let guard = self.player.lock().expect("player lock");
        let player = guard.as_ref().ok_or_else(|| "no active player".to_string())?;
        f(player)
    }
}

/// Plays an arbitrary URL (test UI). Main thread.
#[tauri::command]
fn player_open(app: AppHandle, state: tauri::State<'_, AppState>, request: OpenRequest) -> Result<PlayerInfo, String> {
    state.open(&app, request.url, request.headers, request.start_seconds)
}

/// Streams of one title from the installed addons (on demand, never in bulk).
#[tauri::command]
async fn streams_search(
    state: tauri::State<'_, AppState>,
    content_type: String,
    id: String,
    profile: Option<i64>,
) -> Result<Vec<streams::StreamGroup>, String> {
    streams::search(&state.client, &state.streams, &content_type, &id, profile).await
}

/// Plays a stream returned by `streams_search`, with its URL and headers as given by the addon.
/// Main thread.
#[tauri::command]
///
/// `progress`: the movie/episode being played (Details, Library), so its position is saved for the
/// active profile; absent for live TV.
fn stream_play(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    key: String,
    start_seconds: Option<f64>,
    progress: Option<nuvio_store::library::PlaybackItem>,
    previous_finished: Option<bool>,
) -> Result<PlayerInfo, String> {
    let stream = state.streams.get(&key).ok_or("unknown stream (search again)")?;
    let torrent = match streams::kind_of(&stream) {
        streams::StreamKind::Direct => false,
        // Prepared by `torrent_prepare`: the engine's local HTTP route of the selected file.
        streams::StreamKind::Torrent => true,
        other => return Err(format!("stream type {other:?} is not playable in this stage")),
    };
    let url = if torrent {
        p2p::prepared_url(&state, &key)?
    } else {
        stream.playable_direct_url().ok_or("stream has no playable URL")?.to_string()
    };

    // The active profile's player settings (Settings → Reprodução / Áudio / Legendas).
    let profile = state.active_profile();
    let settings = state.app_store.profile_settings(profile).map(|s| s.player).unwrap_or_default();
    // Only movies and episodes (they carry `progress`) get the picture improvements.
    *state.video.lock().expect("video lock") = match progress {
        Some(_) => services::playback::video_config(&settings),
        None => services::playback::video_config_unenhanced(&settings),
    };
    let headers = if torrent { Vec::new() } else { stream.playback_request_headers() };
    if previous_finished == Some(true) {
        state.progress.mark_finished();
    }
    let source_url = url.clone();
    let info = state.open(&app, url, headers, start_seconds.unwrap_or(0.0))?;
    let parent_id = progress.as_ref().map(|item| item.parent_meta_id.clone());
    if let Some(item) = &progress {
        let playing = watching::Playing::new(info.session, item, &stream, &source_url);
        *state.playing.lock().expect("playing lock") = Some(Arc::new(playing));
    }
    if torrent {
        state.p2p_session.store(info.session, Ordering::SeqCst);
    }
    if let Some(mut item) = progress {
        // Display names only (no URL): which addon and source were used last time.
        item.provider_name = Some(stream.addon_name.clone());
        item.last_stream_title = stream.name.clone().or_else(|| stream.title.clone());
        state.progress.start(info.session, profile, item, settings.watched_percent);
    }

    let font = services::fonts::mpv_font(&state.app_store, &settings.subtitle.font_id);
    let device = services::playback::device_languages();
    let audio = services::playback::audio_targets(&settings, &device);
    let subtitles = watching::subtitle_languages(&state, parent_id.as_deref(), services::playback::subtitle_targets(&settings, &device));
    let wanted: Vec<String> = subtitles.iter().filter(|language| *language != "forced").cloned().collect();
    for command in services::playback::startup_commands(&settings, &audio, font) {
        let _ = state.with_player(|p| p.execute(&command).map_err(|e| e.to_string()));
    }
    let handle = app.clone();
    let session = info.session;
    std::thread::spawn(move || {
        let state = handle.state::<AppState>();
        services::playback::select_tracks_when_loaded(
            || state.with_player(|p| Ok(p.snapshot())).ok(),
            |command| {
                let _ = state.with_player(|p| p.execute(&command).map_err(|e| e.to_string()));
            },
            session,
            audio,
            subtitles,
            std::time::Duration::from_secs(20),
        );
        if parent_id.is_some() && !wanted.is_empty() {
            // The selection above takes a moment to show in the player's state.
            std::thread::sleep(std::time::Duration::from_millis(700));
            tauri::async_runtime::spawn(watching::select_from_addons(handle.clone(), session, wanted));
        }
    });
    Ok(info)
}

/// Shows the main window maximized the first time (called by the interface after its first paint).
fn show_main_window(window: &tauri::WebviewWindow) {
    if !window.is_visible().unwrap_or(true) {
        let _ = window.maximize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

#[tauri::command]
fn window_ready(window: tauri::WebviewWindow) {
    show_main_window(&window);
}

/// `"selftest"` when the window is driven by the automated player tests (the UI then shows only
/// the video overlay and loads no catalogs), `"uitest"` for the automated UI test (the normal UI
/// plus its driver), `"app"` otherwise.
#[tauri::command]
fn app_mode() -> &'static str {
    if selftest::requested().is_some() {
        "selftest"
    } else if uitest::requested().is_some() {
        "uitest"
    } else {
        "app"
    }
}

#[tauri::command]
fn player_command(state: tauri::State<'_, AppState>, command: PlayerCommand) -> Result<(), String> {
    state.with_player(|p| p.execute(&command).map_err(|e| e.to_string()))?;
    if let PlayerCommand::SetSubtitleTrack { id } = &command {
        watching::track_chosen(&state, id);
    }
    let (motion, enhancement, picture) = match &command {
        PlayerCommand::SetMotion { motion } => (Some(*motion), None, None),
        PlayerCommand::SetEnhancement { enhancement } => (None, Some(*enhancement), None),
        PlayerCommand::SetPicture { picture } => (None, None, Some(*picture)),
        _ => return Ok(()),
    };
    services::playback::save_improvements(&state.app_store, state.active_profile(), motion, enhancement, picture);
    Ok(())
}

/// `rect` in CSS pixels of the webview; `None` = whole window. `scale` = devicePixelRatio.
#[tauri::command]
fn player_video_rect(state: tauri::State<'_, AppState>, rect: Option<CssRect>, scale: f64) -> Result<(), String> {
    state.with_player(|p| {
        p.set_video_rect(rect.map(|r| (r.x * scale, r.y * scale, r.width * scale, r.height * scale)))
            .map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn player_snapshot(state: tauri::State<'_, AppState>) -> Result<PlayerSnapshot, String> {
    state.with_player(|p| Ok(p.snapshot()))
}

#[tauri::command]
fn player_close(state: tauri::State<'_, AppState>) {
    state.close();
}

/// Video settings for the next session (decoder priority, RTX filters), like the original's
/// player settings.
#[tauri::command]
fn player_video_config(state: tauri::State<'_, AppState>, config: VideoConfig) {
    *state.video.lock().expect("video lock") = config;
}

pub fn set_picture_in_picture(app: &AppHandle, state: &AppState, enabled: bool, title: &str) -> Result<(), String> {
    pip::set(app, state, enabled, title)
}

#[tauri::command]
fn window_set_fullscreen(window: tauri::WebviewWindow, fullscreen: bool) -> Result<(), String> {
    window.set_fullscreen(fullscreen).map_err(|e| e.to_string())
}

/// Makes the webview background transparent so the video container below shows through
/// (`ICoreWebView2Controller2::put_DefaultBackgroundColor`, as in player_bridge.cpp).
fn make_webview_transparent(window: &tauri::WebviewWindow) -> tauri::Result<()> {
    window.with_webview(|webview| {
        use webview2_com::Microsoft::Web::WebView2::Win32::{ICoreWebView2Controller2, COREWEBVIEW2_COLOR};
        use windows::core::Interface;
        let controller = webview.controller();
        if let Ok(controller2) = controller.cast::<ICoreWebView2Controller2>() {
            // SAFETY: COM call on the UI thread (with_webview runs on it).
            let _ = unsafe { controller2.SetDefaultBackgroundColor(COREWEBVIEW2_COLOR { R: 0, G: 0, B: 0, A: 0 }) };
        }
    })
}

/// Asks WebView2 to lower its memory use (`ICoreWebView2_19::put_MemoryUsageTargetLevel`).
/// Measured in the player self-test before being used by the app.
pub fn set_webview_low_memory(window: &tauri::WebviewWindow, low: bool) -> tauri::Result<()> {
    window.with_webview(move |webview| {
        use webview2_com::Microsoft::Web::WebView2::Win32::{
            ICoreWebView2_19, COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_LOW, COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_NORMAL,
        };
        use windows::core::Interface;
        // SAFETY: COM calls on the UI thread (with_webview runs on it).
        unsafe {
            if let Ok(core) = webview.controller().CoreWebView2() {
                if let Ok(core19) = core.cast::<ICoreWebView2_19>() {
                    let level = if low { COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_LOW } else { COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_NORMAL };
                    let _ = core19.SetMemoryUsageTargetLevel(level);
                }
            }
        }
    })
}

/// NextGen data store (`%APPDATA%\NuvioNextGen`), migrated once from the current app's data:
/// verified backup first, originals never modified, IDs kept. A failed migration is reported
/// and retried on the next start; the app still opens with what the legacy store provides.
fn open_app_store() -> nuvio_store::nextgen::AppStore {
    let real = nuvio_store::nextgen::default_app_dir().expect("APPDATA");
    // UI test runs work on a copy of the real data (see `uitest::data_dir`).
    let dir = uitest::data_dir(&real).unwrap_or(real);
    let store = nuvio_store::nextgen::AppStore::open(dir).expect(r"data directory (%APPDATA%\NuvioNextGen)");
    match services::addons::legacy_store() {
        Ok(legacy) => match nuvio_store::nextgen::migrate_from_legacy(&store, &legacy) {
            Ok(record) => eprintln!(
                "[nextgen] migration ok: {} backup files, {} profiles, {} live TV favorites, library {} saved / {} progress / {} watched",
                record.backup_files,
                record.profiles,
                record.live_tv_favorites,
                record.library.saved_items,
                record.library.progress_entries,
                record.library.watched_items
            ),
            Err(e) => eprintln!("[nextgen] migration failed (will retry next start): {e}"),
        },
        Err(e) => eprintln!("[nextgen] no legacy data to migrate: {e}"),
    }
    store
}

fn main() {
    let selftest = selftest::requested();
    tauri::Builder::default()
        .manage({
            let client = AddonClient::new().expect("HTTP client");
            let store = open_app_store();
            AppState {
                api: Mutex::new(None),
                player: Mutex::new(None),
                session: AtomicU64::new(0),
                hwnd: Mutex::new(0),
                addons: services::addons::AddonContext::new(client.clone(), store.dir().to_path_buf()),
                client,
                streams: streams::StreamCache::default(),
                video: Mutex::new(VideoConfig::default()),
                progress: services::progress::ProgressTracker::new(store.dir().to_path_buf()),
                pending_addon: Mutex::new(None),
                account: Arc::new(nuvio_sync::Engine::new(
                    store.dir().to_path_buf(),
                    account::server_config(),
                    // Account the original app's data belongs to (read-only), for the first link.
                    services::addons::legacy_store().ok().and_then(|l| l.profiles().ok().flatten()).map(|p| p.user_id).filter(|u| !u.is_empty()),
                )),
                sync_wake: Arc::new(tokio::sync::Notify::new()),
                sync_signals: Default::default(),
                pip: Default::default(),
                pin_gate: Mutex::new(account::PinGate {
                    locked_active: store.profiles().ok().and_then(|p| p.get(p.active).filter(|x| x.pin_enabled).map(|x| x.index)),
                    ..Default::default()
                }),
                app_store: store,
                p2p: Arc::new(nuvio_p2p::P2pService::default()),
                p2p_prepared: Mutex::new(None),
                p2p_session: AtomicU64::new(0),
                youtube: nuvio_core::youtube::Extractor::new().expect("HTTP client"),
                updates: Default::default(),
                epg: Default::default(),
                playing: Mutex::new(None),
                subtitle_choice: Mutex::new(None),
                next_up: Default::default(),
            }
        })
        // Official Tauri 2 updater: public key from tauri.conf.json, endpoint set per build.
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            player_open,
            streams_search,
            stream_play,
            player_command,
            player_video_rect,
            player_snapshot,
            player_close,
            player_video_config,
            account::app_ready,
            account::welcome_needed,
            account::welcome_done,
            account::account_connect,
            account::profile_pin_refresh,
            watching::player_subtitles,
            watching::player_subtitle_load,
            watching::player_subtitle_style,
            watching::player_moments,
            api::library_next_up,
            pip::player_picture_in_picture,
            pip::pip_ready,
            pip::pip_drag,
            api::subtitle_fonts,
            api::subtitle_font_import,
            api::subtitle_font_remove,
            api::subtitle_font_data,
            window_set_fullscreen,
            api::app_bootstrap,
            api::home_rows,
            api::catalog_page,
            api::search_all,
            api::search_stream,
            api::meta_details,
            api::livetv_channels,
            api::livetv_favorites,
            api::livetv_toggle_favorite,
            api::title_streams,
            api::livetv_resolve,
            api::livetv_epg,
            api::livetv_reload,
            api::settings_get,
            api::settings_set,
            api::library_favorite_keys,
            api::library_favorites,
            api::library_toggle_favorite,
            api::library_remove_favorite,
            api::library_continue_watching,
            api::library_history,
            api::library_remove_history,
            api::library_title_progress,
            manage::addons_list,
            manage::addon_preview,
            manage::addon_install,
            manage::addon_set_enabled,
            manage::addon_remove,
            manage::addon_move,
            manage::addon_refresh,
            manage::addon_configure,
            manage::profiles_list,
            manage::profile_switch,
            manage::profile_create,
            manage::profile_update,
            manage::profile_delete,
            account::account_status,
            account::account_sign_in,
            account::account_sign_up,
            account::account_sign_out,
            account::account_sync_now, account::account_sync_preview,
            account::avatars_catalog,
            account::profile_unlock,
            account::profile_pin_set,
            account::profile_pin_clear,
            trailer::trailer_play,
            updater::update_status,
            updater::update_check,
            updater::update_install,
            p2p::torrent_prepare,
            p2p::torrent_stop,
            p2p::p2p_status,
            p2p::p2p_clear_cache,
            p2p::p2p_cache_size,
            app_mode,
            window_ready,
            uitest::uitest_capture,
            uitest::uitest_report,
            uitest::uitest_phase,
            uitest::uitest_player_property,
            uitest::uitest_store_counts,
            uitest::uitest_process_resources,
            uitest::uitest_native_libraries,
            uitest::uitest_seed_collections,
            uitest::uitest_break_display_sync
        ])
        .setup(move |app| {
            let window = WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                .title("موج")
                .inner_size(1280.0, 760.0)
                .min_inner_size(800.0, 480.0)
                // Normal use: created hidden and shown maximized by `window_ready` once the interface
                // has painted (no white/black frame while the webview starts). The automated tests
                // keep the visible fixed-size window they measure.
                .visible(selftest.is_some() || uitest::requested().is_some())
                .build()?;
            if selftest.is_none() && uitest::requested().is_none() {
                // Safety net: show the window even if the interface never reports.
                let handle = app.handle().clone();
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_secs(5));
                    let h = handle.clone();
                    let _ = handle.run_on_main_thread(move || {
                        if let Some(w) = h.get_webview_window("main") {
                            show_main_window(&w);
                        }
                    });
                });
            }
            make_webview_transparent(&window)?;
            let handle = app.handle().clone();
            let signals = app.state::<AppState>().sync_signals.clone();
            app.state::<AppState>().progress.set_notifier(move |_flush| {
                let _ = handle.emit("library-changed", ());
                // Every saved position goes to the account, like the original.
                signals.progress.notify_one();
            });
            if selftest.is_none() && uitest::requested().is_none() {
                account::start_loop(app.handle().clone());
            }
            let hwnd = window.hwnd()?.0 as isize;
            *app.state::<AppState>().hwnd.lock().expect("hwnd lock") = hwnd;
            if uitest::requested().is_some() {
                // Screen captures need the window in front.
                let _ = window.set_always_on_top(true);
            }
            if let Some(request) = selftest.clone() {
                selftest::start(app.handle().clone(), request);
            }
            Ok(())
        })
        .on_window_event(|window, event| match event {
            // The video container is a child window: keep it the size of the main window.
            tauri::WindowEvent::Resized(_) => {
                let _ = window.app_handle().state::<AppState>().with_player(|p| {
                    p.fit_to_host();
                    Ok(())
                });
            }
            // Back to the app: what other devices changed is fetched.
            tauri::WindowEvent::Focused(true) => {
                let app = window.app_handle().clone();
                app.state::<AppState>().sync_signals.focus.notify_one();
                // Coming back from Nuvio: its hero choice shows at once.
                tauri::async_runtime::spawn_blocking(move || account::follow_nuvio(&app));
            }
            // Alt+F4 on PiP: back to the main window (the container must leave it first).
            tauri::WindowEvent::CloseRequested { api, .. } if window.label() == pip::LABEL => {
                api.prevent_close();
                let app = window.app_handle();
                let state = app.state::<AppState>();
                if pip::set(app, &state, false, "").is_err() {
                    pip::close_window(&state);
                }
            }
            tauri::WindowEvent::CloseRequested { api, .. } => {
                if window.label() == "main" && uitest::requested().is_none() && account::send_before_close(window) {
                    api.prevent_close();
                }
            }
            // Release the player (mpv threads, windows, GPU resources) before the app exits.
            // The P2P session (peers, listening socket, engine threads) ends with the app.
            tauri::WindowEvent::Destroyed if window.label() == "main" => {
                let state = window.app_handle().state::<AppState>();
                state.close();
                state.p2p.stop();
            }
            _ => {}
        })
        .run(tauri::generate_context!())
        .expect("error while running Nuvio Astra");
}
