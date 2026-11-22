// Read-only comparison of this computer with the Nuvio account, per profile. Before the first sync it
// is the preview the user reviews before starting it; afterwards it is the check that both sides hold
// the same records ("Comparar com a conta"). Built by Rust from the account's read functions only.

import type { SyncCompare, SyncPreview as Preview } from "../types";
import { when } from "../account";
import { t } from "../i18n";

const KINDS: { key: "addons" | "favorites" | "progress" | "watched"; label: () => string }[] = [
  { key: "addons", label: () => t("sp.addons") },
  { key: "favorites", label: () => t("sp.favorites") },
  { key: "progress", label: () => t("sp.progress") },
  { key: "watched", label: () => t("sp.watched") },
];

function Row({ label, c, note }: { label: string; c: SyncCompare; note?: string }) {
  const dup = c.localDuplicates + c.remoteDuplicates;
  return (
    <tr>
      <th scope="row">{label}{note && <span className="muted small"> · {note}</span>}</th>
      <td>{c.local}</td>
      <td>{c.remote}</td>
      <td>{c.both}</td>
      <td className={c.onlyLocal ? "hl-send" : ""}>{c.onlyLocal}</td>
      <td className={c.onlyRemote ? "hl-receive" : ""}>{c.onlyRemote}</td>
      <td className={c.differing ? "hl-conflict" : ""}>
        {c.differing}
        {c.localNewer > 0 && <span className="muted small">{t("sp.newerHere", { count: c.localNewer })}</span>}
        {dup > 0 && <span className="muted small">{t("sp.duplicates", { count: dup })}</span>}
      </td>
    </tr>
  );
}

export function SyncPreview({ preview }: { preview: Preview }) {
  const first = preview.firstSync;
  return (
    <div className="sync-preview" data-testid="sync-preview" data-first={first ? "1" : "0"}>
      <div className="setting-title">{first ? t("sp.firstTitle") : t("sp.compareTitle")}</div>
      <p className="muted small">
        {t("sp.readOnly", { when: when(preview.generatedAtEpochMs) })}
        {preview.otherAccount && t("sp.otherAccount")}
      </p>
      <dl className="facts account-facts">
        <div className="fact"><dt>{t("sp.profiles")}</dt><dd>{t("sp.profilesValue", { local: preview.profiles.local, remote: preview.profiles.remote })}</dd></div>
        <div className="fact"><dt>{first ? t("sp.toSend") : t("sp.onlyHere")}</dt><dd data-testid="preview-send">{preview.toSend}</dd></div>
        <div className="fact"><dt>{first ? t("sp.toReceive") : t("sp.onlyRemote")}</dt><dd data-testid="preview-receive">{preview.toReceive}</dd></div>
        <div className="fact"><dt>{t("sp.conflicts")}</dt><dd data-testid="preview-conflicts">{preview.conflicts}</dd></div>
        <div className="fact"><dt>{t("sp.pending")}</dt><dd>{preview.pending}</dd></div>
      </dl>
      {preview.entries.map((e) => (
        <div key={e.index} className="sync-preview-profile" data-profile={e.index}>
          <div className="setting-title">
            {t("sp.profileLine", { index: e.index, local: e.localName ?? "—", remote: e.remoteName ?? "—" })}
            {!e.localName && <span className="muted small">{t("sp.createdHere")}</span>}
            {!e.remoteName && <span className="muted small">{t("sp.createdRemote")}</span>}
          </div>
          {e.profileDiffers && <div className="muted small hl-conflict">{t("sp.profileDiffers")}</div>}
          <table className="sync-table">
            <thead>
              <tr><th /><th>{t("sp.colComputer")}</th><th>{t("sp.colAccount")}</th><th>{t("sp.colBoth")}</th><th>{t("sp.colOnlyHere")}</th><th>{t("sp.colOnlyRemote")}</th><th>{t("sp.colDifferent")}</th></tr>
            </thead>
            <tbody>
              {KINDS.map((k) =>
                k.key === "addons" && e.sharesPrimaryAddons ? (
                  <tr key={k.key}><th scope="row">{t("sp.addons")}</th><td colSpan={6} className="muted small">{t("sp.usesPrimary")}</td></tr>
                ) : (
                  <Row key={k.key} label={k.label()} c={e[k.key]} note={k.key === "addons" && e.addonOrderDiffers ? t("sp.orderDiffers") : undefined} />
                ),
              )}
            </tbody>
          </table>
        </div>
      ))}
      {first && (
        <ul className="muted small sync-rules">
          <li>{t("sp.rule1")}</li>
          <li>{t("sp.rule2")}</li>
          <li>{t("sp.rule3")}</li>
          <li>{t("sp.rule4")}</li>
        </ul>
      )}
    </div>
  );
}
