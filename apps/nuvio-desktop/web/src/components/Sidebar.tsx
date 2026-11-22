// Side navigation: Início, TV, Buscar, Biblioteca; Configurações at the bottom above the profile.
// Line icons (`SidebarIcons.tsx`) in the app icon's palette; the logo at the top is the app's own,
// centered on the same axis as the icons. The sync state is shown in Settings → Conta only.

import type { ReactNode } from "react";
import { t } from "../i18n";
import type { ProfileInfo } from "../types";
import { Avatar } from "./ProfileMenu";
import { HomeLine as HomeIcon, LibraryLine as LibraryIcon, SearchLine as SearchIcon, SettingsLine as SettingsIcon, TvLine as TvIcon } from "./SidebarIcons";

export type Tab = "home" | "tv" | "search" | "library" | "settings";

const ITEMS: { tab: Tab; label: () => string; icon: ReactNode }[] = [
  { tab: "home", label: () => t("nav.home"), icon: <HomeIcon /> },
  { tab: "tv", label: () => t("nav.tv"), icon: <TvIcon /> },
  { tab: "search", label: () => t("nav.search"), icon: <SearchIcon /> },
  { tab: "library", label: () => t("nav.library"), icon: <LibraryIcon /> },
];

interface Props {
  current: Tab;
  onSelect(tab: Tab): void;
  profile: ProfileInfo | null;
  /** Opens the profile switcher. */
  onProfile(): void;
}

export function Sidebar({ current, onSelect, profile, onProfile }: Props) {
  return (
    <nav className="sidebar" aria-label={t("nav.main")}>
      <div className="brand" title={t("app.name")}>
        <img className="brand-logo" src="./nuvio-astra-128.png" alt="" draggable={false} />
        <span className="nav-label">{t("app.name")}</span>
      </div>
      <ul>
        {ITEMS.map((item) => (
          <li key={item.tab}>
            <button
              className={`nav-item ${current === item.tab ? "active" : ""}`}
              aria-current={current === item.tab ? "page" : undefined}
              onClick={() => onSelect(item.tab)}
              data-tab={item.tab}
              title={item.label()}
            >
              <span className="nav-icon" aria-hidden>{item.icon}</span>
              <span className="nav-label">{item.label()}</span>
            </button>
          </li>
        ))}
      </ul>
      <span className="spacer" />
      <div className="sidebar-divider" aria-hidden />
      <button
        className={`nav-item ${current === "settings" ? "active" : ""}`}
        aria-current={current === "settings" ? "page" : undefined}
        onClick={() => onSelect("settings")}
        data-tab="settings"
        title={t("nav.settings")}
      >
        <span className="nav-icon" aria-hidden>
          <SettingsIcon />
        </span>
        <span className="nav-label">{t("nav.settings")}</span>
      </button>
      {profile && (
        <button className="profile-chip" title={t("nav.switchProfile", { name: profile.name })} onClick={onProfile} data-testid="profile-chip" aria-haspopup="menu">
          <span className="profile-ring"><Avatar profile={profile} /></span>
          <span className="nav-label">{profile.name}</span>
        </button>
      )}
    </nav>
  );
}
