// The app opened on a profile with a PIN. Nothing of the profile is behind this screen, and it has
// ways out: the PIN, a PIN removed in Nuvio (checked by itself and on demand), another profile,
// and signing in to the account the PIN belongs to.

import { useCallback, useEffect, useState } from "react";
import { api, errorText } from "../api";
import { set as setAccount, useAccount } from "../account";
import { PinPad } from "../components/PinPad";
import { ProfileChooser } from "../components/ProfileChooser";
import { Avatar } from "../components/ProfileMenu";
import { SignInForm } from "../components/SignInForm";
import type { ProfilesView } from "../types";
import { t } from "../i18n";

type Mode = "pin" | "profiles" | "account";

interface Props {
  view: ProfilesView;
  /** The lock is gone: the PIN was right, it was removed, or another profile was opened. */
  onOpen(view: ProfilesView): void;
}

export function LockScreen({ view, onOpen }: Props) {
  const account = useAccount();
  const [mode, setMode] = useState<Mode>("pin");
  const [checking, setChecking] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const profile = view.profiles.find((p) => p.index === view.active) ?? view.profiles[0];

  const check = useCallback(
    async (asked: boolean) => {
      if (asked) {
        setChecking(true);
        setNote(null);
      }
      try {
        const next = await api.profilePinRefresh(view.active);
        if (!next.locked) return onOpen(next);
        if (asked) {
          setNote(
            account?.signedIn
              ? t("lock.stillActive")
              : t("lock.signInToConfirm"),
          );
        }
      } catch (e) {
        if (asked) setNote(errorText(e));
      } finally {
        if (asked) setChecking(false);
      }
    },
    [account?.signedIn, onOpen, view.active],
  );

  useEffect(() => {
    void check(false);
    const onFocus = () => void check(false);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [check]);

  const openAccount = async () => {
    setNote(null);
    try {
      if (account?.signedIn) setAccount(await api.accountSignOut());
      setMode("account");
    } catch (e) {
      setNote(errorText(e));
    }
  };

  const unlocked = async () => {
    try {
      onOpen(await api.profilesList());
    } catch (e) {
      setNote(errorText(e));
    }
  };

  if (!profile) return null;

  return (
    <div className="gate" data-testid="lock-screen">
      <div className="gate-card">
        {mode === "pin" && (
          <>
            <Avatar profile={profile} size={72} />
            <h1>{t("pin.enter", { name: profile.name })}</h1>
            <PinPad profile={profile} onUnlocked={() => void unlocked()} />
            {!account?.signedIn && account?.configured && (
              <p className="muted small" data-testid="lock-signed-out">
                {t("lock.signedOut")}
              </p>
            )}
            {note && <p className="gate-note" role="status" data-testid="lock-note">{note}</p>}
            <div className="gate-actions">
              {account?.configured && (
                <button className={account.signedIn ? "ghost" : "primary"} data-testid="lock-account" onClick={() => void openAccount()}>
                  {account.signedIn ? t("lock.otherAccount") : t("lock.signIn")}
                </button>
              )}
              <button className="ghost" disabled={checking} data-testid="lock-recheck" onClick={() => void check(true)}>{checking ? t("pin.checking") : t("pin.removed")}</button>
              {view.profiles.length > 1 && <button className="ghost" data-testid="lock-profiles" onClick={() => setMode("profiles")}>{t("lock.switch")}</button>}
            </div>
          </>
        )}
        {mode === "profiles" && (
          <>
            <h1>{t("prof.who")}</h1>
            <ProfileChooser view={view} onChosen={onOpen} />
            <button className="gate-link" onClick={() => setMode("pin")}>{t("common.back")}</button>
          </>
        )}
        {mode === "account" && (
          <>
            <h1>{t("lock.accountTitle")}</h1>
            <p className="muted">{t("lock.accountHint", { name: profile.name })}</p>
            <SignInForm
              onSignedIn={() => {
                setMode("pin");
                void check(false);
              }}
            />
            <button className="gate-link" data-testid="lock-back" onClick={() => setMode("pin")}>{t("common.back")}</button>
          </>
        )}
      </div>
    </div>
  );
}
