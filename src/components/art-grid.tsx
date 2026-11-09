"use client";
import { ExhibitionLaunch } from "./exhibition";
import { ItemActions } from "@/components/customer/actions";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { dictionaries, money, type Locale } from "@/lib/i18n";
import { galleryCopy } from "@/lib/gallery-copy";
import {
  artworkPhoto,
  mediumName,
  type Artwork,
  type Category,
} from "@/lib/catalog";
export function ArtGrid({
  works,
  locale,
}: {
  works: Artwork[];
  locale: Locale;
}) {
  const t = dictionaries[locale],
    g = galleryCopy[locale];
  const [filter, setFilter] = useState<"all" | Category>("all");
  const root = useRef<HTMLDivElement>(null),
    positions = useRef(new Map<string, DOMRect>()),
    animations = useRef<Animation[]>([]),
    changed = useRef(false);
  const filtered = works.filter(
      (a) => filter === "all" || a.category === filter,
    ),
    available = filtered.filter((a) => a.status === "available"),
    archive = filtered.filter((a) => a.status !== "available");
  useEffect(() => {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)");
    const stop = () => {
      if (reduce.matches) animations.current.forEach((a) => a.cancel());
    };
    reduce.addEventListener("change", stop);
    return () => reduce.removeEventListener("change", stop);
  }, []);
  function select(next: typeof filter) {
    if (next === filter) return;
    animations.current.forEach((a) => a.cancel());
    positions.current = new Map(
      [
        ...(root.current?.querySelectorAll<HTMLElement>("[data-art-id]") || []),
      ].map((el) => [el.dataset.artId!, el.getBoundingClientRect()]),
    );
    changed.current = true;
    setFilter(next);
  }
  useLayoutEffect(() => {
    if (
      !changed.current ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    root.current
      ?.querySelectorAll<HTMLElement>("[data-art-id]")
      .forEach((el) => {
        const before = positions.current.get(el.dataset.artId!),
          after = el.getBoundingClientRect();
        const keyframes = before
          ? [
              {
                transform: `translate(${before.left - after.left}px,${before.top - after.top}px)`,
              },
              { transform: "translate(0,0)" },
            ]
          : [
              { opacity: 0.4, transform: "translateY(8px)" },
              { opacity: 1, transform: "translateY(0)" },
            ];
        animations.current.push(
          el.animate(keyframes, {
            duration: 240,
            easing: "cubic-bezier(.2,.7,.2,1)",
          }),
        );
      });
    return () => animations.current.forEach((a) => a.cancel());
  }, [filter]);
  function cards(items: Artwork[]) {
    return (
      <div className="art-grid">
        {items.map((a) => (
          <article className="art-card" key={a.id} data-art-id={a.id}>
            <Link
              href={`/${locale}/art/${a.id}`}
              className="art-image"
              aria-label={`${t.view}: ${a.title}`}
            >
              <Image
                src={artworkPhoto(a)}
                alt={a.title}
                width={850}
                height={850}
                sizes="(max-width: 639px) 90vw, (max-width: 1099px) 44vw, 30vw"
              />
              <span className="art-open">
                <span>{t.view}</span>
                <ArrowUpRight size={21} />
              </span>
            </Link>
            <ExhibitionLaunch
              id={a.id}
              locale={locale}
              className="card-gallery-launch"
            />
            <div className="art-card-topline">
              <span aria-hidden="true">
                {String(works.indexOf(a) + 1).padStart(2, "0")} / L
              </span>
              <span className={`availability inline ${a.status}`}>
                <i />
                {t[a.status]}
              </span>
            </div>
            <div className="art-caption">
              <div>
                <h3>
                  <Link href={`/${locale}/art/${a.id}`}>{a.title}</Link>
                </h3>
                <p>
                  {mediumName(a, locale)} · {a.width} × {a.height} cm
                </p>
              </div>
              {a.status === "available" && (
                <span className="art-price">{money(a.price, locale)}</span>
              )}
            </div>
            <ItemActions
              id={a.id}
              locale={locale}
              available={a.status === "available"}
            />
          </article>
        ))}
      </div>
    );
  }
  return (
    <div ref={root} className="collection-gallery">
      <div className="collection-controls">
        <div className="filter-tabs" role="group" aria-label={t.collection}>
          {(["all", "paintings", "drawings", "sculptures"] as const).map(
            (k) => (
              <button
                key={k}
                aria-pressed={filter === k}
                className={filter === k ? "active" : ""}
                onClick={() => select(k)}
              >
                {t[k]}
              </button>
            ),
          )}
        </div>
        <span
          className="work-count"
          role="status"
          aria-live="polite"
          aria-label={t.collection}
        >
          {String(filtered.length).padStart(2, "0")}
        </span>
      </div>
      {!filtered.length ? (
        <div className="empty-state">
          <span aria-hidden="true">✳</span>
          <p>{t.empty}</p>
          <a className="text-link" href="mailto:larkova.art@gmail.com">
            {g.contact}
            <ArrowUpRight size={18} />
          </a>
        </div>
      ) : (
        <>
          {available.length > 0 && (
            <div className="available-collection">{cards(available)}</div>
          )}
          {archive.length > 0 && (
            <section className="collection-archive">
              <div className="archive-heading">
                <h3>{g.archive}</h3>
                <span aria-hidden="true">↘</span>
              </div>
              {cards(archive)}
            </section>
          )}
        </>
      )}
    </div>
  );
}
