// E-mail and password of the Nuvio account, for the screens shown before the app.

import { useState } from "react";
import { api, errorText } from "../api";
import { set as setAccount } from "../account";
import { t } from "../i18n";
import { backendText } from "../i18n/backend";

interface Props {
  onSignedIn(): void;
  /** Offers "Criar conta". */
  signUp?: boolean;
}

export function SignInForm({ onSignedIn, signUp = false }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (creating) {
        const result = await api.accountSignUp(email, password);
        if (!result.signedIn) {
          setNotice(result.message);
          setCreating(false);
          setPassword("");
          return;
        }
        setAccount(await api.accountStatus());
      } else {
        setAccount(await api.accountSignIn(email, password));
      }
      onSignedIn();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const tooShort = creating && password.length < 6;

  return (
    <form className="account-form gate-form" noValidate onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      <label className="field">
        <span>{t("acc.email")}</span>
        <input type="text" dir="ltr" inputMode="email" autoComplete="username" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} data-testid="gate-email" />
      </label>
      <label className="field">
        <span>{creating ? t("acc.passwordMin") : t("acc.password")}</span>
        <input type="password" autoComplete={creating ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} data-testid="gate-password" />
      </label>
      {error && <div className="row-error" role="alert">{error}</div>}
      {notice && <div className="banner" role="status">{backendText(notice)}</div>}
      <button className="primary" type="submit" disabled={busy || !email.trim() || !password || tooShort} data-testid="gate-sign-in">
        {busy ? t("acc.wait") : creating ? t("acc.create") : t("acc.signIn")}
      </button>
      {signUp && (
        <button className="gate-link" type="button" disabled={busy} onClick={() => { setCreating((v) => !v); setError(null); }}>
          {creating ? t("acc.haveAccount") : t("acc.noAccount")}
        </button>
      )}
    </form>
  );
}
