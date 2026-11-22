// Live TV: choose which channel addons are listed. From "Todos", clicking an addon keeps only that
// one; after that each click adds or removes that addon. "Todos" is checked whenever every addon
// is, and clicking it checks them all (or clears them all when they already were). The options are the addons that actually provided channels (addons without TV
// channels, such as metadata-only catalogs, never appear).
//
// `selected`: `null` = every addon (also the ones that appear later), otherwise the chosen names.

import { useEffect, useRef, useState } from "react";
import { t } from "../i18n";

interface Props {
  /** Addon name → number of channels it provides. */
  options: [string, number][];
  selected: string[] | null;
  onChange(next: string[] | null): void;
}

export function AddonPicker({ options, selected, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const names = options.map(([n]) => n);
  const checked = selected === null ? names : names.filter((n) => selected.includes(n));
  const all = names.length > 0 && checked.length === names.length;
  const none = checked.length === 0;

  const label = all ? t("picker.all") : none ? t("picker.none") : checked.length === 1 ? checked[0] : t("picker.count", { count: checked.length });

  const toggleAll = () => onChange(all ? [] : null);
  const toggle = (name: string) => {
    // From "all", picking an addon means "only this one"; otherwise the box toggles that addon.
    const next = all ? [name] : checked.includes(name) ? checked.filter((n) => n !== name) : [...checked, name];
    // Every addon checked: "all" (so addons that appear later are included too).
    onChange(next.length === names.length ? null : next);
  };

  return (
    <div className="addon-picker" ref={box}>
      <button
        className={`addon-picker-button ${all ? "" : "filtered"}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        data-testid="addon-picker"
        disabled={options.length === 0}
      >
        <span className="addon-picker-label">{label}</span>
        <svg viewBox="0 0 12 8" width="12" height="8" aria-hidden><path d="M1 1.5l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {open && (
        <div className="addon-picker-menu" role="listbox" aria-multiselectable="true">
          <div className="addon-picker-title">{t("picker.title")}</div>
          <label className={`addon-picker-option ${all ? "on" : ""}`}>
            <input type="checkbox" checked={all} onChange={toggleAll} />
            <span className="addon-check" aria-hidden />
            <span className="addon-picker-name">{t("common.all")}</span>
            <span className="count">{options.reduce((n, [, c]) => n + c, 0)}</span>
          </label>
          {options.map(([name, count]) => {
            const on = checked.includes(name);
            return (
              <label key={name} className={`addon-picker-option ${on ? "on" : ""}`}>
                <input type="checkbox" checked={on} onChange={() => toggle(name)} />
                <span className="addon-check" aria-hidden />
                <span className="addon-picker-name">{name}</span>
                <span className="count">{count}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
