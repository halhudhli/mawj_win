// First opening: the Nuvio account, the sync right after it and who is watching. Only for a
// computer never linked to an account, once; going on without an account is one click.

import { useCallback, useState } from "react";
import { api, errorText } from "../api";
import { set as setAccount, useAccount } from "../account";
import { ProfileChooser } from "../components/ProfileChooser";
import { SignInForm } from "../components/SignInForm";
import type { ProfilesView } from "../types";
import { t } from "../i18n";
import { backendText } from "../i18n/backend";

type Step =
  | { name: "account" }
  | { name: "syncing" }
  | { name: "confirm"; question: string }
  | { name: "failed"; message: string }
  | { name: "profiles"; view: ProfilesView };

export function Welcome({ onDone }: { onDone(): void }) {
  const account = useAccount();
  const [step, setStep] = useState<Step>({ name: "account" });

  const finish = useCallback(async () => {
    await api.welcomeDone().catch(() => {});
    onDone();
  }, [onDone]);

  const connect = async (confirmOther = false) => {
    setStep({ name: "syncing" });
    try {
      const status = await api.accountConnect(confirmOther);
      setAccount(status);
      if (status.state === "needsReview") {
        setStep({ name: "confirm", question: status.linkQuestion ? backendText(status.linkQuestion) : t("welcome.confirm") });
        return;
      }
      if (status.state === "error" || status.state === "offline") {
        setStep({ name: "failed", message: status.lastError ? backendText(status.lastError) : t("acc.syncNowFailed") });
        return;
      }
      const view = await api.profilesList();
      if (view.profiles.length > 1) setStep({ name: "profiles", view });
      else await finish();
    } catch (e) {
      setStep({ name: "failed", message: errorText(e) });
    }
  };

  const otherAccount = async () => {
    try {
      setAccount(await api.accountSignOut());
      setStep({ name: "account" });
    } catch (e) {
      setStep({ name: "failed", message: errorText(e) });
    }
  };

  return (
    <div className="gate" data-testid="welcome" data-step={step.name}>
      <div className={`gate-card ${step.name === "profiles" ? "wide" : ""}`}>
        <img className="gate-logo" src="./nuvio-astra-128.png" alt="" width={72} height={72} draggable={false} />
        {step.name === "account" && (account?.signedIn ? (
          <>
            <h1>{t("welcome.syncWith")}</h1>
            <p className="muted">{t("welcome.alreadyIn", { email: account.email })}</p>
            <button className="primary" data-testid="welcome-sync" onClick={() => void connect()}>{t("welcome.syncNow")}</button>
            <button className="gate-link" data-testid="welcome-skip" onClick={() => void finish()}>{t("welcome.notNow")}</button>
          </>
        ) : (
          <>
            <h1>{t("welcome.signIn")}</h1>
            <p className="muted">{t("welcome.signInHint")}</p>
            <SignInForm signUp onSignedIn={() => void connect()} />
            <button className="gate-link" data-testid="welcome-skip" onClick={() => void finish()}>{t("welcome.noAccount")}</button>
          </>
        ))}
        {step.name === "syncing" && (
          <>
            <h1>{t("welcome.syncing")}</h1>
            <p className="muted" role="status"><span className="spinner" aria-hidden /> {t("welcome.receiving")}</p>
          </>
        )}
        {step.name === "confirm" && (
          <>
            <h1>{t("welcome.otherData")}</h1>
            <p className="muted">{step.question}</p>
            <div className="gate-actions">
              <button className="primary" data-testid="welcome-confirm" onClick={() => void connect(true)}>{t("welcome.syncThis")}</button>
              <button className="ghost" data-testid="welcome-other" onClick={() => void otherAccount()}>{t("lock.otherAccount")}</button>
            </div>
            <button className="gate-link" onClick={() => void finish()}>{t("welcome.notNow")}</button>
          </>
        )}
        {step.name === "failed" && (
          <>
            <h1>{t("welcome.failedTitle")}</h1>
            <p className="muted">{step.message}</p>
            <div className="gate-actions">
              <button className="primary" onClick={() => void connect()}>{t("common.retry")}</button>
              <button className="ghost" onClick={() => void finish()}>{t("welcome.openApp")}</button>
            </div>
          </>
        )}
        {step.name === "profiles" && (
          <>
            <h1>{t("prof.who")}</h1>
            <ProfileChooser view={step.view} onChosen={() => void finish()} />
          </>
        )}
      </div>
    </div>
  );
}
