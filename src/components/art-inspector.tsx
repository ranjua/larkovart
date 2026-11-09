"use client";
import Image from "next/image";
import Link from "next/link";
import { useRef, useState, type CSSProperties } from "react";
import { ArrowUpRight, MoveUpRight, Plus, RotateCcw } from "lucide-react";
import { artworkPhoto, type Artwork } from "@/lib/catalog";
import { type Locale } from "@/lib/i18n";
import { experienceCopy } from "@/lib/experience-copy";
import { ExhibitionLaunch, useExhibition } from "./exhibition";
function InspectorImage({ art, locale }: { art: Artwork; locale: Locale }) {
  const [zoom, setZoom] = useState(100);
  const frame = useRef<HTMLDivElement>(null);
  const e = experienceCopy[locale];
  function reset(value: number) {
    setZoom(value);
    frame.current?.style.setProperty("--pan-x", "0%");
    frame.current?.style.setProperty("--pan-y", "0%");
  }
  return (
    <div className="inspector-work">
      <div
        className="inspection-frame"
        ref={frame}
        style={{ "--inspect-scale": zoom / 100 } as CSSProperties}
        onPointerMove={(event) => {
          if (event.pointerType !== "mouse" || zoom === 100) return;
          const box = event.currentTarget.getBoundingClientRect();
          event.currentTarget.style.setProperty(
            "--pan-x",
            `${(0.5 - (event.clientX - box.left) / box.width) * (zoom / 100 - 1) * 100}%`,
          );
          event.currentTarget.style.setProperty(
            "--pan-y",
            `${(0.5 - (event.clientY - box.top) / box.height) * (zoom / 100 - 1) * 100}%`,
          );
        }}
      >
        <Image
          className="inspection-image"
          src={artworkPhoto(art)}
          alt={art.title}
          width={1000}
          height={1000}
          sizes="(max-width:800px) 90vw, 52vw"
        />
        <div className="inspection-corners" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </div>
        <span className="inspection-magnification">
          {(zoom / 100).toFixed(1)}×
        </span>
      </div>
      <div className="inspection-controls">
        <button
          onClick={() => reset(zoom === 100 ? 180 : 100)}
          aria-pressed={zoom > 100}
        >
          <Plus size={16} />
          {e.zoom}
        </button>
        <label>
          <span className="sr-only">{e.zoomLabel}</span>
          <input
            type="range"
            min="100"
            max="250"
            step="10"
            value={zoom}
            onChange={(event) => reset(Number(event.target.value))}
            aria-valuetext={`${(zoom / 100).toFixed(1)}×`}
          />
        </label>
        <button aria-label={e.reset} onClick={() => reset(100)}>
          <RotateCcw size={17} />
        </button>
      </div>
      <p className="inspection-disclosure">{e.detail}</p>
    </div>
  );
}
export function ArtInspector({ locale }: { locale: Locale }) {
  const exhibition = useExhibition(),
    art = exhibition?.selected,
    e = experienceCopy[locale];
  if (!art) return null;
  return (
    <section className="art-inspector" id="closer">
      <div className="section-wrap inspector-grid">
        <div className="inspector-copy">
          <span className="section-number">02 / L</span>
          <p className="eyebrow">{e.chapter}</p>
          <h2>{e.closer}</h2>
          <p>{e.closerBody}</p>
          <span className="inspector-gesture">
            <MoveUpRight size={20} />
            {e.move}
          </span>
          <Link href={`/${locale}/art/${art.id}`} className="text-link">
            {art.title}
            <ArrowUpRight size={18} />
          </Link>
          <ExhibitionLaunch id={art.id} locale={locale} />
        </div>
        <InspectorImage key={art.id} art={art} locale={locale} />
      </div>
      <span className="inspector-letter" aria-hidden="true">
        a.
      </span>
    </section>
  );
}
