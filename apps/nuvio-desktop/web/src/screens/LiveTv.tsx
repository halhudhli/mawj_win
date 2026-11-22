// Live TV: channels from the addons' `tv` catalogs. Layout: search, addon picker and reload on top;
// categories (vertical) | channels of the category (vertical) | preview with the program guide.
// Favorites, preview and fullscreen. A channel's stream is resolved only when the user clicks it, and only
// the addon that listed it is asked (no prefetch, no bulk checks). One player session at a time.

import { useEffect, useMemo, useRef, useState } from "react";
import { api, dataEpoch, errorText, onDataEpoch } from "../api";
import { AddonPicker } from "../components/AddonPicker";
import { EpgGuide } from "../components/EpgGuide";
import { usePlayer } from "../player/PlayerContext";
import { PlayerControls } from "../player/PlayerControls";
import { PlayerSurface } from "../player/PlayerSurface";
import type { Channel, ChannelList } from "../types";
import { intlLocale, t } from "../i18n";
import { backendText } from "../i18n/backend";

const ALL = "__all__";
const FAVORITES = "__favorites__";
// Channels without a category (the addon sent none); shown in the interface language.
const OTHER = "Outros";
const categoryName = (name: string) => (name === OTHER ? t("tv.other") : name);

// Chosen channel addons, remembered between visits: `null` = all of them (including addons that
// appear later), otherwise exactly the checked ones (an empty list shows no channel).
const ADDONS_KEY = "nuvio.livetv.addons.v2";
function loadAddons(): string[] | null {
  try {
    const v = JSON.parse(localStorage.getItem(ADDONS_KEY) ?? "null");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : null;
  } catch {
    return null;
  }
}
function saveAddons(v: string[] | null) {
  try {
    localStorage.setItem(ADDONS_KEY, JSON.stringify(v));
  } catch {
    /* not persisted: still applied for this visit */
  }
}

let channelsCache: ChannelList | null = null;
// Channels belong to the profile's addons: dropped on a profile or addon change.
onDataEpoch(() => {
  channelsCache = null;
});

export function LiveTv() {
  const player = usePlayer();
  const [list, setList] = useState<ChannelList | null>(channelsCache);
  const [error, setError] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [category, setCategory] = useState(ALL);
  const [addons, setAddonsState] = useState<string[] | null>(loadAddons);
  const setAddons = (v: string[] | null) => {
    setAddonsState(v);
    saveAddons(v);
  };
  const [query, setQuery] = useState("");
  const [current, setCurrent] = useState<Channel | null>(null);
  const [resolving, setResolving] = useState(false);
  const [channelError, setChannelError] = useState<string | null>(null);
  const [reloading, setReloading] = useState(false);
  const request = useRef(0);

  useEffect(() => {
    const epoch = dataEpoch();
    api.liveTvFavorites().then((f) => epoch === dataEpoch() && setFavorites(f), () => {});
    if (channelsCache) return;
    api.liveTvChannels().then(
      (l) => {
        if (epoch !== dataEpoch()) return; // answer for the previous profile/addons
        channelsCache = l;
        setList(l);
      },
      (e) => setError(errorText(e)),
    );
  }, []);

  const favoriteSet = useMemo(() => new Set(favorites), [favorites]);

  // Addons that provided channels (only those can be chosen), with their channel counts.
  const addonOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of list?.channels ?? []) counts.set(c.addonName, (counts.get(c.addonName) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0], intlLocale()));
  }, [list]);
  // A remembered addon that no longer provides channels is ignored.
  // A remembered choice whose addons no longer provide channels falls back to all of them.
  const activeAddons = useMemo(() => {
    if (addons === null) return null;
    const known = addons.filter((a) => addonOptions.some(([n]) => n === a));
    return addons.length > 0 && known.length === 0 ? null : known;
  }, [addons, addonOptions]);
  // Channels of the chosen addons: categories, counts and favorites are all computed from them.
  const pool = useMemo(
    () => (list?.channels ?? []).filter((c) => activeAddons === null || activeAddons.includes(c.addonName)),
    [list, activeAddons],
  );
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of pool) for (const g of c.genres.length ? c.genres : [OTHER]) counts.set(g, (counts.get(g) ?? 0) + 1);
    // Same order as the full list.
    return (list?.categories ?? []).filter(([name]) => counts.has(name)).map(([name]) => [name, counts.get(name)!] as [string, number]);
  }, [pool, list]);
  const favoriteCount = useMemo(() => pool.filter((c) => favoriteSet.has(c.key)).length, [pool, favoriteSet]);
  useEffect(() => {
    // The chosen category is not offered by the chosen addons: back to "Todos".
    if (category !== ALL && category !== FAVORITES && !categories.some(([n]) => n === category)) setCategory(ALL);
  }, [categories, category]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return pool.filter((c) => {
      if (category === FAVORITES && !favoriteSet.has(c.key)) return false;
      if (category !== ALL && category !== FAVORITES) {
        const cats = c.genres.length ? c.genres : [OTHER];
        if (!cats.includes(category)) return false;
      }
      return !q || c.name.toLowerCase().includes(q) || c.genres.some((g) => g.toLowerCase().includes(q));
    });
  }, [pool, category, query, favoriteSet]);

  const embedded = player.session?.view === "embedded";

  const tune = async (channel: Channel) => {
    const id = ++request.current;
    setCurrent(channel);
    setChannelError(null);
    setResolving(true);
    try {
      const groups = await api.liveTvResolve(channel.key);
      if (id !== request.current) return;
      const stream = groups.flatMap((g) => g.streams).find((s) => s.kind === "direct");
      if (!stream) {
        const reason = groups.find((g) => g.error)?.error;
        setChannelError(reason ? t("tv.addonError", { reason: backendText(reason) }) : t("tv.noStream"));
        return;
      }
      // Leaving fullscreen returns to this preview (FullPlayer uses `returnTo`).
      await player.play(() => api.playStream(stream.key, null), {
        title: channel.name,
        subtitle: channel.addonName,
        live: true,
        view: "embedded",
        returnTo: "embedded",
      });
    } catch (e) {
      if (id === request.current) setChannelError(errorText(e));
    } finally {
      if (id === request.current) setResolving(false);
    }
  };

  const toggleFavorite = async (key: string) => {
    try {
      setFavorites(await api.liveTvToggleFavorite(key));
    } catch (e) {
      setChannelError(t("tv.favoriteFailed", { error: errorText(e) }));
    }
  };

  /** Fetches again the manifests and channels of the chosen channel addons (all when none chosen). */
  const reload = async () => {
    setReloading(true);
    setError(null);
    const epoch = dataEpoch();
    try {
      const l = await api.liveTvReload(activeAddons && activeAddons.length ? activeAddons : null);
      if (epoch !== dataEpoch()) return;
      channelsCache = l;
      setList(l);
    } catch (e) {
      setChannelError(t("tv.reloadFailed", { error: errorText(e) }));
    } finally {
      setReloading(false);
    }
  };

  const categoryTitle = category === ALL ? t("tv.allChannels") : category === FAVORITES ? t("tv.favorites") : categoryName(category);

  const goFullscreen = async () => {
    if (!player.session) return;
    player.setView("full");
    await player.setWindowFullscreen(true);
  };
  if (error) return <div className="screen-message">{t("tv.loadFailed", { error })}</div>;

  return (
    <div className="livetv">
      <header className="livetv-header">
        <div className="search-bar livetv-search">
          <input type="search" placeholder={t("tv.searchPlaceholder")} value={query} onChange={(e) => setQuery(e.target.value)} aria-label={t("tv.searchLabel")} />
          <AddonPicker options={addonOptions} selected={activeAddons} onChange={setAddons} />
          <button
            className={`livetv-reload ${reloading ? "spinning" : ""}`}
            onClick={() => void reload()}
            disabled={reloading || !list}
            title={activeAddons && activeAddons.length ? t("tv.reloadSelected") : t("tv.reloadAll")}
            aria-label={t("tv.reloadAll")}
            data-testid="livetv-reload"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 11a8 8 0 0 0-14.6-4.5L4 8" /><path d="M4 3v5h5" /><path d="M4 13a8 8 0 0 0 14.6 4.5L20 16" /><path d="M20 21v-5h-5" />
            </svg>
          </button>
        </div>
      </header>

      <nav className="livetv-categories" aria-label={t("tv.categories")}>
        <button className={`cat-item ${category === ALL ? "active" : ""}`} onClick={() => setCategory(ALL)}>
          <span className="cat-name">{t("tv.all")}</span> {list && <span className="count">{pool.length}</span>}
        </button>
        <button className={`cat-item ${category === FAVORITES ? "active" : ""}`} onClick={() => setCategory(FAVORITES)}>
          <span className="cat-name">{t("tv.favoritesStar")}</span> <span className="count">{favoriteCount}</span>
        </button>
        <div className="cat-divider" aria-hidden />
        {categories.map(([name, count]) => (
          <button key={name} className={`cat-item ${category === name ? "active" : ""}`} onClick={() => setCategory(name)} title={name}>
            <span className="cat-name">{categoryName(name)}</span> <span className="count">{count}</span>
          </button>
        ))}
      </nav>

      <div className="channel-list" role="list">
        <div className="channel-list-title">
          <span>{categoryTitle}</span>
          <span className="muted small">{t("tv.channelCount", { count: visible.length })}</span>
        </div>
        {!list && <div className="screen-message">{t("tv.loading")}</div>}
        {list && !visible.length && (
          <div className="screen-message muted">
            {!list.channels.length
              ? t("tv.noAddons")
              : activeAddons !== null && activeAddons.length === 0
                ? t("tv.noneSelected")
                : t("tv.noneInFilter")}
          </div>
        )}
        {visible.map((c) => (
          <div key={c.key} role="listitem" className={`channel ${current?.key === c.key ? "active" : ""}`}>
            <button className="channel-main" onClick={() => void tune(c)} onDoubleClick={() => void goFullscreen()}>
              <span className="channel-logo">{c.logo ? <img src={c.logo} alt="" loading="lazy" decoding="async" /> : c.name.slice(0, 2)}</span>
              <span className="channel-text">
                <span className="channel-name">{c.name}</span>
                <span className="muted small">{c.addonName}</span>
              </span>
            </button>
            <button
              className={`fav ${favoriteSet.has(c.key) ? "on" : ""}`}
              aria-label={favoriteSet.has(c.key) ? t("tv.removeFavorite") : t("tv.addFavorite")}
              aria-pressed={favoriteSet.has(c.key)}
              onClick={() => void toggleFavorite(c.key)}
            >
              ★
            </button>
          </div>
        ))}
        {list && list.failedCatalogs > 0 && <div className="muted small pad">{t("tv.failedCatalogs", { count: list.failedCatalogs })}</div>}
      </div>

      <aside className="livetv-preview">
        <PlayerSurface active={embedded} className="preview-hole">
          {!embedded && (
            <div className="hole-placeholder">
              {resolving ? t("tv.tuning") : current ? "" : t("tv.choose")}
            </div>
          )}
          {embedded && (
            <PlayerControls
              snapshot={player.snapshot}
              live
              fullscreen={false}
              onToggleFullscreen={() => void goFullscreen()}
              onClose={() => void player.close()}
            />
          )}
        </PlayerSurface>
        <div className="preview-info">
          {current ? (
            <>
              <div className="preview-title">
                {current.logo && <img src={current.logo} alt="" />}
                <div>
                  <h2>{current.name}</h2>
                  <div className="muted small">{t("tv.source", { addon: current.addonName })}</div>
                </div>
              </div>
              {resolving && <div className="muted">{t("tv.resolving")}</div>}
              {(channelError || player.error) && <div className="row-error">{channelError ?? t("details.playFailed", { error: player.error })}</div>}
              <div className="preview-epg" data-testid="preview-epg">
                <EpgGuide channelKey={current.key} />
              </div>
            </>
          ) : (
            <div className="muted">{t("tv.resolveNote")}</div>
          )}
        </div>
      </aside>
    </div>
  );
}
