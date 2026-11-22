import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { api } from "./api";
import { invoke } from "./tauri";
import { App } from "./App";
import { PipView } from "./player/PipView";
import { PlayerProvider } from "./player/PlayerContext";
import { SelftestView } from "./player/SelftestView";
import { runUiTest } from "./uitest/driver";
import { installDesktopFeel } from "./desktopFeel";
import { applyLocale, setLocale } from "./i18n";
// Arabic interface font, bundled with the app (no request to the internet).
import "@fontsource/ibm-plex-sans-arabic/arabic-400.css";
import "@fontsource/ibm-plex-sans-arabic/arabic-500.css";
import "@fontsource/ibm-plex-sans-arabic/arabic-600.css";
import "@fontsource/ibm-plex-sans-arabic/arabic-700.css";
import "./styles.css";

applyLocale();

// The automated player tests get only the video overlay: no catalogs are loaded, so their
// measurements are not mixed with addon traffic.
function Root() {
  const [mode, setMode] = useState<"app" | "selftest" | "uitest" | null>(null);
  useEffect(() => {
    api.appMode().then((m) => {
      // The automated UI test reads the original's Portuguese texts: that run uses Portuguese,
      // without changing the language kept for normal use.
      if (m === "uitest") setLocale("pt", { persist: false, reload: false });
      setMode(m);
    }, () => setMode("app"));
  }, []);
  useEffect(() => {
    if (mode === "uitest") void runUiTest();
    // Interface mounted: the (hidden) window is shown maximized now. A timer, not an animation
    // frame: frames may not run while the window is still hidden.
    if (mode !== null) window.setTimeout(() => void invoke("window_ready").catch(() => {}), 30);
  }, [mode]);
  if (mode === null) return null;
  if (mode === "selftest") return <SelftestView />;
  return (
    <PlayerProvider>
      <App />
    </PlayerProvider>
  );
}

installDesktopFeel();
// The picture-in-picture window loads this same page and shows only its controls (`pip.rs`).
const pip = (window as { __NUVIO_PIP__?: boolean }).__NUVIO_PIP__ === true;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {pip ? <PipView /> : <Root />}
  </StrictMode>,
);
