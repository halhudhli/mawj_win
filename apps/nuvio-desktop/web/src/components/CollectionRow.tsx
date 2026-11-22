// A collection on Home (`HomeCollectionRowSection`): a row of folder cards (image, GIF/WebP, short
// video or emoji). Covers stand still and animate only under the pointer or with keyboard focus.
//
// Still = the cover, else the animation itself. Any image may be animated (the URL does not always
// tell), so every still is drawn once on a canvas, which shows its first frame and never moves. The
// animated file is requested only on hover, unless it is the only cover.

import { memo, useEffect, useRef, useState } from "react";
import type { CollectionView, FolderView } from "../types";
import { useInView } from "./useInView";
import { inlineSign, t } from "../i18n";

const VIDEO = /\.(mp4|webm|m4v|mov)(\?|#|$)/i;

/** First frame of an image, cropped like `object-fit: cover` at the card's real pixels. */
function FrozenImage({ src, hidden, onFail }: { src: string; hidden: boolean; onFail(): void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const fail = useRef(onFail);
  fail.current = onFail;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const image = new Image(); // never in the page, so its animation never advances
    const draw = () => {
      const width = Math.round(canvas.clientWidth * window.devicePixelRatio);
      const height = Math.round(canvas.clientHeight * window.devicePixelRatio);
      if (!image.complete || !image.naturalWidth || !width || !height) return;
      if (canvas.dataset.drawn === `${src}|${width}x${height}`) return;
      canvas.width = width;
      canvas.height = height;
      const g = canvas.getContext("2d");
      if (!g) return;
      const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
      const w = image.naturalWidth * scale;
      const h = image.naturalHeight * scale;
      g.imageSmoothingQuality = "high";
      g.drawImage(image, (width - w) / 2, (height - h) / 2, w, h);
      canvas.dataset.drawn = `${src}|${width}x${height}`;
    };
    image.onload = draw;
    image.onerror = () => fail.current();
    image.src = src;
    // The card has no size while Home is hidden.
    const resize = new ResizeObserver(draw);
    resize.observe(canvas);
    return () => {
      resize.disconnect();
      image.onload = image.onerror = null;
    };
  }, [src]);

  return <canvas className={`folder-still ${hidden ? "covered" : ""}`} ref={ref} />;
}

export function FolderCover({ folder, active }: { folder: FolderView; active: boolean }) {
  const [ref, near] = useInView<HTMLDivElement>();
  const [playing, setPlaying] = useState(false);
  const [stillFailed, setStillFailed] = useState(false);
  const [animationFailed, setAnimationFailed] = useState(false);
  const still = folder.stillImage ?? folder.image;
  const animated = folder.image ?? folder.stillImage;

  useEffect(() => {
    if (!active) {
      setPlaying(false);
      setAnimationFailed(false);
    }
  }, [active]);

  return (
    <div className="folder-art" ref={ref}>
      {near && still && !stillFailed && (VIDEO.test(still) ? (
        // `#t=` makes the paused video show its first frame.
        <video className={`folder-still ${playing ? "covered" : ""}`} src={still.includes("#") ? still : `${still}#t=0.001`} muted playsInline preload="metadata" onError={() => setStillFailed(true)} />
      ) : (
        <FrozenImage src={still} hidden={playing} onFail={() => setStillFailed(true)} />
      ))}
      {(!still || stillFailed) && !playing && (
        <span className="folder-fallback">{folder.emoji || folder.title.slice(0, 2).toUpperCase()}</span>
      )}
      {active && animated && !animationFailed && (VIDEO.test(animated) ? (
        <video className="folder-anim" src={animated} autoPlay muted loop playsInline onPlaying={() => setPlaying(true)} onError={() => setAnimationFailed(true)} />
      ) : (
        <img className="folder-anim" src={animated} alt="" draggable={false} onLoad={() => setPlaying(true)} onError={() => setAnimationFailed(true)} />
      ))}
    </div>
  );
}

const FolderCard = memo(function FolderCard({ folder, onOpen }: { folder: FolderView; onOpen(folder: FolderView): void }) {
  const [active, setActive] = useState(false);
  const open = () => {
    // Home is hidden under the folder, so the pointer never "leaves" the card.
    setActive(false);
    onOpen(folder);
  };
  return (
    <div className={`card-wrap ${folder.shape}`}>
      <button
        className={`card folder-card ${folder.shape}`}
        onClick={open}
        onPointerEnter={() => setActive(true)}
        onPointerLeave={() => setActive(false)}
        onFocus={(e) => e.currentTarget.matches(":focus-visible") && setActive(true)}
        onBlur={() => setActive(false)}
        title={folder.title}
        data-folder={folder.id}
      >
        <div className="card-art">
          <FolderCover folder={folder} active={active} />
        </div>
        {!folder.hideTitle && <div className="card-title">{folder.title}</div>}
      </button>
    </div>
  );
});

interface Props {
  title: string;
  collection: CollectionView;
  onOpenFolder(collection: CollectionView, folder: FolderView): void;
}

export function CollectionRow({ title, collection, onOpenFolder }: Props) {
  const track = useRef<HTMLDivElement>(null);
  const scrollBy = (dir: number) => track.current?.scrollBy({ left: dir * inlineSign() * track.current.clientWidth * 0.85, behavior: "smooth" });
  return (
    <section className="row-section collection-row" data-collection={collection.id}>
      <header className="row-header">
        <h2>{title}</h2>
        <span className="spacer" />
        <button className="icon-btn" aria-label={t("common.previous")} onClick={() => scrollBy(-1)}>‹</button>
        <button className="icon-btn" aria-label={t("common.next")} onClick={() => scrollBy(1)}>›</button>
      </header>
      <div className="row-track" ref={track}>
        {collection.folders.map((folder) => (
          <FolderCard key={folder.id} folder={folder} onOpen={(f) => onOpenFolder(collection, f)} />
        ))}
      </div>
    </section>
  );
}
