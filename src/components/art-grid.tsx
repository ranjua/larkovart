"use client";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useState } from "react";
import { dictionaries, money, type Locale } from "@/lib/i18n";
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
  const t = dictionaries[locale];
  const [filter, setFilter] = useState<"all" | Category>("all");
  const filtered = works.filter(
    (a) => filter === "all" || a.category === filter,
  );
  return (
    <>
      <div className="collection-controls">
        <div className="filter-tabs" role="group" aria-label={t.collection}>
          {(["all", "paintings", "drawings", "sculptures"] as const).map(
            (k) => (
              <button
                key={k}
                aria-pressed={filter === k}
                className={filter === k ? "active" : ""}
                onClick={() => setFilter(k)}
              >
                {t[k]}
              </button>
            ),
          )}
        </div>
        <span className="work-count">
          {String(filtered.length).padStart(2, "0")}
        </span>
      </div>
      {filtered.length === 0 ? (
        <div className="empty-state">
          <span>✳</span>
          <p>{t.empty}</p>
        </div>
      ) : (
        <div className="art-grid">
          {filtered.map((a, i) => (
            <article className="art-card" key={a.id}>
              <Link
                href={`/${locale}/art/${a.id}`}
                className={`art-image art-tone-${i % 3}`}
                aria-label={`${t.view}: ${a.title}`}
              >
                <Image
                  src={artworkPhoto(a)}
                  alt={a.title}
                  width={850}
                  height={850}
                  sizes="(max-width: 650px) 100vw, (max-width: 1000px) 50vw, 33vw"
                />
                <span className="art-open">
                  <ArrowUpRight size={23} />
                </span>
                <span
                  className={`availability ${a.status === "sold" ? "sold" : ""}`}
                >
                  <i />
                  {t[a.status]}
                </span>
              </Link>
              <div className="art-caption">
                <div>
                  <h3>
                    <Link href={`/${locale}/art/${a.id}`}>{a.title}</Link>
                  </h3>
                  <p>
                    {mediumName(a, locale)} · {a.width} × {a.height} cm
                  </p>
                </div>
                <span className="art-price">
                  {a.status === "available" ? money(a.price, locale) : "—"}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
