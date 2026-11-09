"use client";
import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowUpRight, ArrowLeft, ArrowRight } from "lucide-react";
import { artworkPhoto, mediumName, type Artwork } from "@/lib/catalog";
import { dictionaries, money, type Locale } from "@/lib/i18n";
import { experienceCopy } from "@/lib/experience-copy";
import { HeroContext } from "./hero-context";
import { ExhibitionLaunch, useExhibition } from "./exhibition";
export function ImmersiveHero({
  works,
  locale,
}: {
  works: Artwork[];
  locale: Locale;
}) {
  const exhibition = useExhibition(),
    art = exhibition?.selected;
  const t = dictionaries[locale],
    e = experienceCopy[locale];
  const selections = works.filter((a) => a.status === "available");
  const choices = selections.length ? selections : works;
  const active = choices.findIndex((a) => a.id === art?.id);
  function select(step: number) {
    exhibition?.select(
      choices[(active + step + choices.length) % choices.length].id,
    );
  }
  return (
    <section className="hero experience-hero" aria-label={t.eyebrow}>
      <div className="hero-atmosphere" aria-hidden="true">
        <span className="pigment pigment-one" />
        <span className="pigment pigment-two" />
        <span className="hero-monogram">L.</span>
        <svg className="hero-orbit" viewBox="0 0 1000 900" fill="none">
          <ellipse
            cx="500"
            cy="450"
            rx="425"
            ry="320"
            transform="rotate(-30 500 450)"
            pathLength="1"
          />
          <ellipse
            cx="500"
            cy="450"
            rx="380"
            ry="380"
            transform="rotate(25 500 450)"
            pathLength="1"
          />
        </svg>
      </div>
      <div className="hero-overline">
        <span>{t.eyebrow}</span>
        <span>{t.edition}</span>
      </div>
      <div className="hero-copy">
        <p className="eyebrow" data-hero-enter>
          <span className="status-dot" />
          {e.selected}
        </p>
        <h1 data-hero-enter>
          <span>{t.hero1}</span> <em>{t.hero2}</em>
        </h1>
        <p className="hero-intro" data-hero-enter>
          {t.intro}
        </p>
        <div className="hero-actions">
          <ExhibitionLaunch locale={locale} className="hero-enter" />
          <Link className="hero-collection-link" href={`/${locale}#collection`}>
            {t.explore}
            <ArrowUpRight size={19} />
          </Link>
        </div>
      </div>
      {art && (
        <figure className="hero-visual" data-depth data-hero-enter>
          <div className="hero-art-topline">
            <span>{t.selected}</span>
            <span>
              {String(Math.max(0, active) + 1).padStart(2, "0")} /{" "}
              {String(choices.length).padStart(2, "0")}
            </span>
          </div>
          <div className="hero-art-object">
            <span className="hero-art-halo" aria-hidden="true" />
            <Link
              href={`/${locale}/art/${art.id}`}
              className="hero-original"
              aria-label={`${t.view}: ${art.title}`}
            >
              <Image
                style={{
                  viewTransitionName: exhibition?.isViewing
                    ? "none"
                    : "exhibition-original",
                }}
                src={artworkPhoto(art)}
                alt={art.title}
                width={1000}
                height={1000}
                sizes="(max-width:700px) 90vw, (max-width:1100px) 53vw, 650px"
                priority
              />
              <span className="hero-image-action">
                <ArrowUpRight size={24} />
              </span>
            </Link>
            <span className="hero-art-side" aria-hidden="true">
              LARKOVA / ORIGINALS
            </span>
          </div>
          <figcaption className="hero-art-label" aria-live="polite">
            <div>
              <strong>{art.title}</strong>
              <span>
                {mediumName(art, locale)} · {art.width} × {art.height} cm
              </span>
            </div>
            <div>
              <span>{t[art.status]}</span>
              {art.status === "available" && (
                <strong>{money(art.price, locale)}</strong>
              )}
            </div>
          </figcaption>
          <div className="hero-provenance">
            <span>{t.edition}</span>
            <span>{t.original}</span>
          </div>
          {art.category !== "sculptures" && (
            <HeroContext key={art.id} art={art} locale={locale} />
          )}
        </figure>
      )}
      <div className="hero-bottom">
        <a className="hero-scroll" href="#collection">
          <span className="scroll-line" />
          {t.scroll}
          <ArrowDown size={15} />
        </a>
        {choices.length > 1 && (
          <div className="hero-selector" role="group" aria-label={e.choose}>
            <button onClick={() => select(-1)} aria-label={e.previous}>
              <ArrowLeft size={19} />
            </button>
            {choices.slice(0, 8).map((a, i) => (
              <button
                className="hero-selector-work"
                key={a.id}
                onClick={() => exhibition?.select(a.id)}
                aria-label={`${e.selected}: ${a.title}`}
                aria-pressed={art?.id === a.id}
              >
                <Image
                  src={artworkPhoto(a)}
                  alt=""
                  width={44}
                  height={44}
                  sizes="44px"
                />
                <span>{String(i + 1).padStart(2, "0")}</span>
              </button>
            ))}
            <button onClick={() => select(1)} aria-label={e.next}>
              <ArrowRight size={19} />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
