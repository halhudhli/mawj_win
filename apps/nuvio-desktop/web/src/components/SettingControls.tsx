// Controls shared by the Settings sections.

import type { ReactNode } from "react";
import { t } from "../i18n";

export function Row({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <div className="setting-row">
      <div className="setting-text">
        <div className="setting-title">{title}</div>
        {description && <div className="muted small">{description}</div>}
      </div>
      <div className="setting-control">{children}</div>
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange(v: boolean): void; label: string }) {
  return (
    <button role="switch" aria-checked={checked} aria-label={label} className={`switch ${checked ? "on" : ""}`} onClick={() => onChange(!checked)}>
      <span className="knob" />
    </button>
  );
}

export function Slider({ value, min, max, onChange, unit, label }: { value: number; min: number; max: number; onChange(v: number): void; unit?: string; label: string }) {
  return (
    <span className="slider">
      <input type="range" min={min} max={max} value={value} aria-label={label} onChange={(e) => onChange(Number(e.target.value))} />
      <output>{value}{unit}</output>
    </span>
  );
}

/** `#AARRGGBB` ⇄ color input (`#rrggbb`) + optional opacity. */
export function ColorField({ value, onChange, withOpacity, label }: { value: string; onChange(v: string): void; withOpacity?: boolean; label: string }) {
  const alpha = value.slice(1, 3);
  const rgb = `#${value.slice(3, 9).toLowerCase()}`;
  const opacity = Math.round((parseInt(alpha, 16) / 255) * 100);
  const hex2 = (n: number) => Math.round(n).toString(16).padStart(2, "0").toUpperCase();
  return (
    <span className="color-field">
      <input type="color" value={rgb} aria-label={label} onChange={(e) => onChange(`#${alpha}${e.target.value.slice(1).toUpperCase()}`)} />
      {withOpacity && (
        <Slider label={t("sa.opacity", { label })} value={opacity} min={0} max={100} unit="%" onChange={(o) => onChange(`#${hex2((o / 100) * 255)}${value.slice(3)}`)} />
      )}
    </span>
  );
}
