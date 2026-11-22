// "Quem está assistindo?": picks a profile before the app shows, asking its PIN when it has one.

import { useState } from "react";
import { api, errorText } from "../api";
import type { ProfilesView } from "../types";
import { PinDialog } from "./PinDialog";
import { Avatar } from "./ProfileMenu";
import { t } from "../i18n";

export function ProfileChooser({ view, onChosen }: { view: ProfilesView; onChosen(view: ProfilesView): void }) {
  const [pinFor, setPinFor] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = async (index: number) => {
    setBusy(true);
    setError(null);
    try {
      onChosen(await api.profileSwitch(index));
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };

  const protectedProfile = view.profiles.find((p) => p.index === pinFor);

  return (
    <>
      <div className="gate-profiles" data-testid="profile-chooser">
        {view.profiles.map((p) => (
          <button key={p.index} className="gate-profile" disabled={busy} data-profile={p.index} onClick={() => (p.pinEnabled ? setPinFor(p.index) : void open(p.index))}>
            <Avatar profile={p} size={72} />
            <span>{p.name}</span>
            {p.pinEnabled && <small>{t("pin.hasPin")}</small>}
          </button>
        ))}
      </div>
      {error && <div className="row-error" role="alert">{error}</div>}
      {protectedProfile && (
        <PinDialog
          profile={protectedProfile}
          onUnlocked={() => {
            setPinFor(null);
            void open(protectedProfile.index);
          }}
          onCancel={() => setPinFor(null)}
        />
      )}
    </>
  );
}
