// Texts that Rust sends in Portuguese (errors, PIN answers, catalog row titles), shown in the
// interface language. Exact messages are looked up by their Portuguese text; messages with a value
// inside (a status, a nested error) are matched by pattern. Unknown texts are shown as received.

import { locale, t, tMaybe, type Locale } from "./index";
import { backend } from "./strings/backend";

type BackendKey = keyof typeof backend;

let exact: Map<string, BackendKey> | null = null;
function exactMessages(): Map<string, BackendKey> {
  if (!exact) {
    exact = new Map();
    for (const [key, entry] of Object.entries(backend) as [BackendKey, (typeof backend)[BackendKey]][]) {
      if (typeof entry.pt === "string" && !entry.pt.includes("{")) exact.set(entry.pt, key);
    }
  }
  return exact;
}

/** Messages with a value inside; `inner` is translated again (errors wrap other errors). */
const PATTERNS: [RegExp, BackendKey, (m: RegExpMatchArray) => Record<string, string>][] = [
  [/^Erro ao gravar os dados locais: (.*)$/s, "be.storeError", (m) => ({ inner: backendText(m[1]) })],
  [/^Não sincronizado: (.*)$/s, "be.notSynced", (m) => ({ inner: m[1].split("; ").map(syncEntity).join(locale() === "ar" ? "؛ " : "; ") })],
  [/^Bloqueado\. Tente novamente em (\d+)s$/, "be.pinRetry", (m) => ({ seconds: m[1] })],
  [/^o servidor da conta respondeu com erro (\d+): (.*)$/s, "be.httpError", (m) => ({ status: m[1], message: m[2] })],
  [/^O endereço respondeu com erro HTTP (\d+)\.$/, "be.manifestHttp", (m) => ({ status: m[1] })],
  [/^Campo ausente no manifesto: "(.*)"$/, "be.manifestField", (m) => ({ field: m[1] })],
  [/^Não foi possível iniciar o motor P2P: (.*)$/s, "be.p2pStart", (m) => ({ inner: m[1] })],
  [/^YouTube indisponível \((.*)\)$/s, "be.youtubeDown", (m) => ({ inner: m[1] })],
  [/^Não foi possível guardar a fonte: (.*)$/s, "be.fontSave", (m) => ({ inner: m[1] })],
  [/^Sem conexão com o servidor de atualizações \((.*)\)\.$/s, "be.updateOffline", (m) => ({ inner: m[1] })],
  [/^Não foi possível atualizar: (.*)$/s, "be.updateFailed", (m) => ({ inner: m[1] })],
];

/** "coleções: <error>" items of a partial sync. */
function syncEntity(part: string): string {
  const names: Record<string, BackendKey> = { "coleções": "be.entity.collections", "ordem do Início": "be.entity.home", "configurações": "be.entity.settings" };
  const at = part.indexOf(": ");
  const name = at < 0 ? part : part.slice(0, at);
  const key = names[name];
  if (!key) return part;
  return at < 0 ? t(key) : `${t(key)}: ${backendText(part.slice(at + 2))}`;
}

export function backendText(message: string): string {
  if (locale() === "pt") return message;
  const text = message.trim();
  const key = exactMessages().get(text);
  if (key) return t(key);
  for (const [pattern, k, params] of PATTERNS) {
    const m = text.match(pattern);
    if (m) return t(k, params(m));
  }
  return message;
}

// ---- Catalog row titles: "<catalog name> - Filmes" (Rust's `media_type_label`) ----
const TYPE_LABELS: Record<string, string> = { Filmes: "type.movie", "Séries": "type.series", Anime: "type.anime", Canais: "type.channel", TV: "type.tv" };

/** Translates the type suffix Rust adds to catalog names; the catalog's own name stays. */
export function rowTitle(title: string): string {
  if (locale() === "pt") return title;
  const m = title.match(/^(.*) - (Filmes|Séries|Anime|Canais|TV)$/s);
  if (!m) return title;
  return `${m[1]} - ${tMaybe(TYPE_LABELS[m[2]], m[2])}`;
}

/** Rust's media type label ("Filmes", "Séries"…) in the interface language. */
export function mediaTypeLabel(label: string, lang: Locale = locale()): string {
  if (lang === "pt") return label;
  const key = TYPE_LABELS[label];
  return key ? tMaybe(key, label) : label;
}
