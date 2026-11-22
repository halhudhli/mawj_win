// 4-digit PIN entry (`PinEntryDialog` of the original): the keyboard works wherever the focus is,
// and the keys on screen work without it. The check happens in Rust (`profile_unlock`: the account
// first, the offline hash otherwise); this only collects the digits.

import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorText } from "../api";
import type { ProfileInfo } from "../types";
import { t } from "../i18n";
import { backendText } from "../i18n/backend";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "back"];

export function PinPad({ profile, onUnlocked }: { profile: ProfileInfo; onUnlocked(): void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Refs: two keys can arrive before a render.
  const typed = useRef("");
  const checking = useRef(false);
  const done = useRef(onUnlocked);
  done.current = onUnlocked;

  const press = useCallback(
    async (key: string) => {
      if (checking.current) return;
      const next = key === "back" ? typed.current.slice(0, -1) : `${typed.current}${key}`.slice(0, 4);
      typed.current = next;
      setPin(next);
      setError(null);
      if (next.length < 4 || key === "back") return;
      checking.current = true;
      setBusy(true);
      try {
        const result = await api.profileUnlock(profile.index, next);
        if (result.unlocked) return done.current();
        setError(result.message ? backendText(result.message) : t("be.pinWrong"));
      } catch (e) {
        setError(errorText(e));
      } finally {
        typed.current = "";
        checking.current = false;
        setPin("");
        setBusy(false);
      }
    },
    [profile.index],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      const key = /^[0-9]$/.test(e.key) ? e.key : e.key === "Backspace" ? "back" : null;
      if (!key) return;
      e.preventDefault();
      e.stopPropagation();
      if (!e.repeat) void press(key);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [press]);

  return (
    <div className="pin-pad" data-testid="pin-pad">
      <div className="pin-dots" dir="ltr" role="status" aria-label={t("pin.digits", { count: pin.length })} data-filled={pin.length}>
        {[0, 1, 2, 3].map((i) => <span key={i} className={`pin-dot ${i < pin.length ? "filled" : ""} ${error ? "error" : ""}`} />)}
      </div>
      <div className="pin-message" aria-live="polite">
        {error ? <span className="pin-error" role="alert">{error}</span> : busy ? t("pin.checking") : ""}
      </div>
      <div className="pin-keys" dir="ltr">
        {KEYS.map((key, i) =>
          key ? (
            <button key={key} className="pin-key" data-pin-key={key} aria-label={key === "back" ? t("pin.erase") : key} onClick={() => void press(key)}>
              {key === "back" ? "⌫" : key}
            </button>
          ) : (
            <span key={`empty-${i}`} />
          ),
        )}
      </div>
    </div>
  );
}
