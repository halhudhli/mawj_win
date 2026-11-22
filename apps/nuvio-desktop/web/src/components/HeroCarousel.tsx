// Home hero (`HomeHeroSection`): up to 8 featured titles that change by themselves every 8 seconds
// (`HERO_AUTO_SCROLL_INTERVAL_MS`), with arrows and dots to change by hand; a manual change restarts
// the count. Slides cross-fade; only the current one and its neighbours load their artwork. The
// timer stops while the hero is off screen (scrolled away, another screen open, window minimized).

import { useCallback, useEffect, useRef, useState } from "react";
import type { MetaPreview } from "../types";
import { t } from "../i18n";

export const HERO_INTERVAL_MS = 8000;

interface Props {
  items: MetaPreview[];
  onOpen(item: MetaPreview): void;
}

const art = (item: MetaPreview) => item.landscapePoster ?? item.banner ?? item.poster;

export function HeroCarousel({ items, onOpen }: Props) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const ref = useRef<HTMLElement>(null);
  const count = items.length;

  const go = useCallback((delta: number) => setIndex((i) => (i + delta + count) % count), [count]);

  // On screen = intersecting the viewport and the page visible.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let intersecting = true;
    const update = () => setVisible(intersecting && document.visibilityState === "visible");
    const observer = new IntersectionObserver((entries) => {
      intersecting = entries.some((e) => e.isIntersecting);
      update();
    }, { threshold: 0.25 });
    observer.observe(el);
    document.addEventListener("visibilitychange", update);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  // A new timer for every slide: changing by hand restarts the 8 seconds.
  useEffect(() => {
    if (count <= 1 || !visible) return;
    const timer = window.setTimeout(() => go(1), HERO_INTERVAL_MS);
    return () => window.clearTimeout(timer);
  }, [index, count, visible, go]);

  useEffect(() => {
    if (index >= count) setIndex(0);
  }, [index, count]);

  if (!count) return null;
  const near = (i: number) => i === index || i === (index + 1) % count || i === (index - 1 + count) % count;

  return (
    <section className="hero hero-carousel" ref={ref} aria-roledescription={t("hero.carousel")} aria-label={t("hero.label")} data-index={index}>
      {items.map((item, i) => (
        <div
          key={`${item.contentType}/${item.id}`}
          className={`hero-slide ${i === index ? "active" : ""}`}
          style={near(i) && art(item) ? { backgroundImage: `url("${art(item)}")` } : undefined}
          aria-hidden={i !== index}
        >
          <div className="hero-shade">
            {item.logo ? <img className="hero-logo" src={item.logo} alt={item.name} draggable={false} /> : <h1>{item.name}</h1>}
            <div className="meta-line">
              {[item.releaseInfo, item.imdbRating && `★ ${item.imdbRating}`, item.genres.slice(0, 3).join(" · ")].filter(Boolean).join("   ")}
            </div>
            {item.description && <p className="hero-desc">{item.description}</p>}
            <button className="primary" tabIndex={i === index ? 0 : -1} onClick={() => onOpen(item)}>{t("hero.details")}</button>
          </div>
        </div>
      ))}
      {count > 1 && (
        <>
          <button className="hero-arrow prev" aria-label={t("hero.previous")} onClick={() => go(-1)}>
            <svg className="flip-rtl" viewBox="0 0 24 24" aria-hidden><path d="M15 5l-7 7 7 7" /></svg>
          </button>
          <button className="hero-arrow next" aria-label={t("hero.next")} onClick={() => go(1)}>
            <svg className="flip-rtl" viewBox="0 0 24 24" aria-hidden><path d="M9 5l7 7-7 7" /></svg>
          </button>
          <div className="hero-dots" role="tablist" aria-label={t("hero.choose")}>
            {items.map((item, i) => (
              <button
                key={`${item.contentType}/${item.id}`}
                role="tab"
                aria-selected={i === index}
                aria-label={t("hero.item", { index: i + 1, name: item.name })}
                className={`hero-dot ${i === index ? "active" : ""}`}
                onClick={() => setIndex(i)}
              >
                {i === index && visible && <span className="hero-dot-fill" key={index} />}
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
