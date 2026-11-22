// Interface texts: Arabic by default, English as the fallback, Portuguese kept (the original's
// language, also used by the automated UI test, whose checks read Portuguese texts).
//
// Every text lives in `strings/*.ts` with its three languages side by side. `t(key, params)` reads
// the current language, then English, then the key itself. A text with a `count` parameter may be
// plural forms (`zero`, `one`, `two`, `few`, `many`, `other`), chosen by the language's rules.
// The language is read once at start; changing it reloads the page, so no text needs to listen.

import { STRINGS, type StringKey } from "./strings";

export type Locale = "ar" | "en" | "pt";
export type Plural = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };
export type Text = string | Plural;
export interface Entry {
  ar: Text;
  en: Text;
  pt: Text;
}

export const LOCALES: { id: Locale; name: string }[] = [
  { id: "ar", name: "العربية" },
  { id: "en", name: "English" },
  { id: "pt", name: "Português" },
];

const STORAGE_KEY = "mawj.locale";
const FALLBACK: Locale = "en";

function stored(): Locale {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === "ar" || v === "en" || v === "pt") return v;
  } catch {
    /* storage unavailable: default language */
  }
  return "ar";
}

let current: Locale = stored();

/** BCP 47 tags for `Intl`: Gregorian calendar and Latin digits in Arabic, so dates, times and
 *  numbers read the same as the video times (01:23:45). */
const INTL_TAGS: Record<Locale, string> = {
  ar: "ar-u-ca-gregory-nu-latn",
  en: "en-GB",
  pt: "pt-BR",
};

export const locale = (): Locale => current;
export const intlLocale = (): string => INTL_TAGS[current];
export const isRtl = (): boolean => current === "ar";
/** +1 in left-to-right layouts, -1 in right-to-left ones (horizontal scrolling, drag direction). */
export const inlineSign = (): 1 | -1 => (isRtl() ? -1 : 1);

/** Applies the language to the document (`lang`, `dir`). Called once before the first render. */
export function applyLocale() {
  const root = document.documentElement;
  root.lang = current;
  root.dir = isRtl() ? "rtl" : "ltr";
}

/** `persist: false` changes the language for this run only (the UI test). */
export function setLocale(next: Locale, { persist = true, reload = true } = {}) {
  if (persist) {
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* not kept: the language applies to this run only */
    }
  }
  if (next === current) return;
  current = next;
  applyLocale();
  if (reload) window.location.reload();
}

type Params = Record<string, string | number | null | undefined>;

const pluralRules = new Map<Locale, Intl.PluralRules>();
function pluralForm(lang: Locale, count: number): Intl.LDMLPluralRule {
  let rules = pluralRules.get(lang);
  if (!rules) {
    rules = new Intl.PluralRules(lang);
    pluralRules.set(lang, rules);
  }
  return rules.select(count);
}

function pick(text: Text | undefined, lang: Locale, params?: Params): string | undefined {
  if (text === undefined) return undefined;
  if (typeof text === "string") return text;
  const count = Number(params?.count ?? 0);
  return text[pluralForm(lang, count)] ?? text.other;
}

function fill(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const value = params[name];
    return value === undefined || value === null ? whole : String(value);
  });
}

export function t(key: StringKey, params?: Params): string {
  const entry: Entry | undefined = STRINGS[key];
  const text = pick(entry?.[current], current, params) ?? pick(entry?.[FALLBACK], FALLBACK, params) ?? key;
  return fill(text, params);
}

/** Like `t`, for keys built at run time (a type, a state): `fallback` when the key is unknown. */
export function tMaybe(key: string, fallback: string, params?: Params): string {
  return key in STRINGS ? t(key as StringKey, params) : fallback;
}

// ---- Formatting shared by every screen ----

export function formatDate(date: Date, options: Intl.DateTimeFormatOptions): string {
  return date.toLocaleDateString(intlLocale(), options);
}
export function formatTime(date: Date, options: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" }): string {
  return date.toLocaleTimeString(intlLocale(), options);
}
export function formatDateTime(date: Date, options: Intl.DateTimeFormatOptions): string {
  return date.toLocaleString(intlLocale(), options);
}
export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return value.toLocaleString(intlLocale(), options);
}
/** Joins a list with the language's comma («، » in Arabic). */
export function joinList(items: string[]): string {
  return items.join(current === "ar" ? "، " : ", ");
}
