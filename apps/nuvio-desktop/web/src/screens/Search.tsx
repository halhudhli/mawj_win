// Search: results shown as Home-style horizontal rows, one per catalog (as the original).
//
// Fast as you type:
// - every catalog's results appear as soon as that addon answers (`search_stream` events), the
//   slowest addon no longer holds the others back;
// - while a new query is on its way, the results already loaded for a shorter query are filtered
//   on the spot (typing "vinga" after "ving" shows matches at once);
// - answers of this session are kept in memory: going back to a query is instant;
// - typing is debounced lightly (220 ms); an outdated answer never replaces a newer one.
// Recent searches are remembered (last 12) and shown when the field is empty.

import { useEffect, useMemo, useRef, useState } from "react";
import { dataEpoch, onDataEpoch } from "../api";
import { ResultRow } from "../components/ResultRow";
import { invoke, listen } from "../tauri";
import type { MetaPreview, SearchSection } from "../types";
import { t } from "../i18n";

interface Props {
  onOpen(item: MetaPreview): void;
}

interface Part { requestId: number; order: number; section: SearchSection }
interface Result { sections: { order: number; section: SearchSection }[]; done: boolean }

const DEBOUNCE_MS = 220;
const HISTORY_KEY = "nuvio.search.history";
const HISTORY_MAX = 12;
const CACHE_MAX = 40;

// ---- session state (kept while switching tabs; dropped on a profile/addon change) ----
let lastQuery = "";
const cache = new Map<string, Result>();
onDataEpoch(() => {
  lastQuery = "";
  cache.clear();
});

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

function remember(q: string, r: Result) {
  cache.delete(q);
  cache.set(q, r);
  while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value!);
}

/** Results already loaded for a shorter query, filtered by the new one (shown while it loads). */
function provisional(q: string): { order: number; section: SearchSection }[] | null {
  const nq = norm(q);
  let best: string | null = null;
  for (const k of cache.keys()) if (nq.startsWith(norm(k)) && (!best || k.length > best.length)) best = k;
  if (!best) return null;
  return cache
    .get(best)!
    .sections.map((s) => ({ ...s, section: { ...s.section, items: s.section.items.filter((i) => norm(i.name).includes(nq)) } }))
    .filter((s) => s.section.items.length > 0);
}

function loadHistory(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, HISTORY_MAX) : [];
  } catch {
    return [];
  }
}
function saveHistory(list: string[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
  } catch {
    /* kept for this session only */
  }
}

export function Search({ onOpen }: Props) {
  const [query, setQuery] = useState(lastQuery);
  const [result, setResult] = useState<Result | null>(() => cache.get(lastQuery.trim()) ?? null);
  const [preview, setPreview] = useState<{ order: number; section: SearchSection }[] | null>(null);
  const [history, setHistory] = useState<string[]>(loadHistory);
  const requestId = useRef(0);
  const pending = useRef<{ id: number; q: string; epoch: number; parts: Part[] } | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => input.current?.focus(), []);

  const addHistory = (q: string) => {
    const term = q.trim();
    if (term.length < 2) return;
    setHistory((h) => {
      const next = [term, ...h.filter((x) => norm(x) !== norm(term))].slice(0, HISTORY_MAX);
      saveHistory(next);
      return next;
    });
  };
  const removeHistory = (q: string) =>
    setHistory((h) => {
      const next = h.filter((x) => x !== q);
      saveHistory(next);
      return next;
    });
  const clearHistory = () => {
    setHistory([]);
    saveHistory([]);
  };

  // Streamed answers: kept only for the latest request.
  useEffect(() => {
    const offPart = listen<Part>("search-part", (p) => {
      const cur = pending.current;
      if (!cur || p.requestId !== cur.id || cur.epoch !== dataEpoch()) return;
      cur.parts.push(p);
      const sections = [...cur.parts].sort((a, b) => a.order - b.order).map(({ order, section }) => ({ order, section }));
      setResult({ sections, done: false });
      setPreview(null);
    });
    const offDone = listen<{ requestId: number }>("search-done", (d) => {
      const cur = pending.current;
      if (!cur || d.requestId !== cur.id) return;
      const sections = [...cur.parts].sort((a, b) => a.order - b.order).map(({ order, section }) => ({ order, section }));
      const r = { sections, done: true };
      if (cur.epoch === dataEpoch()) remember(cur.q, r);
      pending.current = null;
      setResult(r);
      setPreview(null);
    });
    return () => {
      offPart();
      offDone();
    };
  }, []);

  useEffect(() => {
    const q = query.trim();
    lastQuery = query;
    if (q.length < 2) {
      pending.current = null;
      setResult(null);
      setPreview(null);
      return;
    }
    const hit = cache.get(q);
    if (hit) {
      pending.current = null;
      setResult(hit);
      setPreview(null);
      return;
    }
    // Instant: filter what is already loaded; the real answer follows.
    setPreview(provisional(q));
    setResult(null);
    const timer = window.setTimeout(() => {
      const id = ++requestId.current;
      pending.current = { id, q, epoch: dataEpoch(), parts: [] };
      invoke("search_stream", { query: q, requestId: id }).catch(() => {
        if (pending.current?.id === id) {
          pending.current = null;
          setResult({ sections: [], done: true });
        }
      });
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

  // A search left on screen for a moment with results goes to the history.
  useEffect(() => {
    if (!result?.done || !result.sections.length) return;
    const q = query;
    const timer = window.setTimeout(() => addHistory(q), 2500);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  const shown = result?.sections.length ? result.sections : preview ?? [];
  const loading = query.trim().length >= 2 && !result?.done;
  const open = (item: MetaPreview) => {
    addHistory(query);
    onOpen(item);
  };
  const empty = useMemo(() => query.trim().length < 2, [query]);

  return (
    <div className="search">
      <div className="search-bar">
        <input
          ref={input}
          type="search"
          placeholder={t("search.placeholder")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addHistory(query)}
          aria-label={t("search.label")}
          data-testid="search-input"
        />
        {loading && <span className="spinner" aria-label={t("search.busy")} />}
      </div>

      {empty && (
        history.length ? (
          <div className="search-history" data-testid="search-history">
            <div className="search-history-head">
              <span>{t("search.recent")}</span>
              <button className="link" onClick={clearHistory}>{t("search.clearHistory")}</button>
            </div>
            <div className="search-history-list">
              {history.map((h) => (
                <span key={h} className="history-chip">
                  <button className="history-term" onClick={() => setQuery(h)}>
                    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
                    {h}
                  </button>
                  <button className="history-remove" aria-label={t("search.removeTerm", { term: h })} onClick={() => removeHistory(h)}>×</button>
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="screen-message muted">{t("search.minLength")}</div>
        )
      )}

      {!empty && result?.done && !result.sections.length && <div className="screen-message">{t("search.nothing", { query: query.trim() })}</div>}

      {!empty &&
        shown.map(({ section }) => (
          <ResultRow key={section.key} title={section.title} addonName={section.addonName} items={section.items} onOpen={open} />
        ))}
    </div>
  );
}
