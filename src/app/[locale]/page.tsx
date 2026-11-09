import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowDown,
  ArrowUpRight,
  PackageCheck,
  Fingerprint,
  Earth,
} from "lucide-react";
import { dictionaries, isLocale, money } from "@/lib/i18n";
import { artworks } from "@/lib/store";
import { ArtGrid } from "@/components/art-grid";
import { HeroContext } from "@/components/hero-context";
import { GalleryMotion } from "@/components/gallery-motion";
import { galleryCopy } from "@/lib/gallery-copy";
import { artworkPhoto, mediumName } from "@/lib/catalog";
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { description: dictionaries[locale].intro };
}
export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = dictionaries[locale];
  const works = await artworks();
  const eligible = works.filter(
    (a) => a.status === "available" && a.category !== "sculptures",
  );
  const featured =
    eligible.find((a) => a.id === "atitlan") ||
    eligible[0] ||
    works.find((a) => a.status === "available") ||
    works[0];
  return (
    <>
      <GalleryMotion />
      <section className="hero section-wrap">
        <div className="hero-copy">
          <p className="eyebrow" data-hero-enter>
            <span className="status-dot" />
            {t.eyebrow}
          </p>
          <h1 data-hero-enter>
            <span>{t.hero1}</span> <em>{t.hero2}</em>
          </h1>
          <p className="hero-intro" data-hero-enter>
            {t.intro}
          </p>
          <Link className="button button-dark" href={`/${locale}#collection`}>
            {t.explore}
            <ArrowUpRight size={19} />
          </Link>
          <div className="hero-foot">
            <span className="fine-line" />
            {t.scroll}
            <ArrowDown size={15} />
          </div>
        </div>
        {featured && (
          <figure className="hero-visual" data-depth data-hero-enter>
            <span className="hero-decoration" aria-hidden="true" />
            <div className="hero-art-topline">
              <span>{t.selected}</span>
              <span aria-hidden="true">01 / L</span>
            </div>
            <Link
              href={`/${locale}/art/${featured.id}`}
              className="hero-original"
              aria-label={`${t.view}: ${featured.title}`}
            >
              <Image
                src={artworkPhoto(featured)}
                alt={featured.title}
                width={900}
                height={900}
                sizes="(max-width: 700px) 90vw, (max-width: 1100px) 55vw, 650px"
                priority
              />
              <span className="hero-image-action">
                <ArrowUpRight size={24} />
              </span>
            </Link>
            <figcaption className="hero-art-label">
              <div>
                <strong>{featured.title}</strong>
                <span>
                  {mediumName(featured, locale)} · {featured.width} ×{" "}
                  {featured.height} cm
                </span>
              </div>
              <div>
                <span>{t[featured.status]}</span>
                {featured.status === "available" && (
                  <strong>{money(featured.price, locale)}</strong>
                )}
              </div>
            </figcaption>
            <div className="hero-provenance">
              <span>{t.edition}</span>
              <span>{t.original}</span>
            </div>
            {featured.category !== "sculptures" && (
              <HeroContext art={featured} locale={locale} />
            )}
          </figure>
        )}
      </section>
      <div className="studio-strip">
        <span>YULIA LARKOVA</span>
        <span>✳</span>
        <span>{t.paintings}</span>
        <span>✳</span>
        <span>{t.drawings}</span>
        <span>✳</span>
        <span>{t.sculptures}</span>
        <span>✳</span>
        <span>GUATEMALA</span>
      </div>
      <section id="collection" className="collection section-wrap">
        <div className="section-heading">
          <span className="section-number" aria-hidden="true">
            01
          </span>
          <div>
            <p className="eyebrow">{t.selected}</p>
            <h2>{t.collectionTitle}</h2>
          </div>
          <p>{t.collectionIntro}</p>
        </div>
        <ArtGrid locale={locale} works={works} />
      </section>
      <section id="artist" className="artist-section">
        <div className="section-wrap artist-grid">
          <div className="artist-image" data-section-enter>
            <Image
              src="/artist.jpg"
              alt={galleryCopy[locale].studioPhoto}
              width={750}
              height={900}
              sizes="(max-width: 800px) 90vw, 40vw"
            />
            <div className="artist-photo-caption">
              <span>Yulia Larkova</span>
              <span>{galleryCopy[locale].studioPhoto}</span>
            </div>
          </div>
          <div className="artist-copy">
            <span className="section-number" aria-hidden="true">
              02 / L
            </span>
            <p className="eyebrow">{t.artistEyebrow}</p>
            <h2>{t.artistTitle}</h2>
            <p>{t.artistBody}</p>
            <p>{t.artistBody2}</p>
            <a
              className="text-link"
              href="https://www.instagram.com/larkova.art/"
              target="_blank"
              rel="noreferrer"
            >
              {t.instagram}
              <ArrowUpRight size={18} />
            </a>
          </div>
        </div>
      </section>
      <section id="delivery" className="delivery section-wrap">
        <span className="section-number" aria-hidden="true">
          03
        </span>
        <p className="eyebrow">{t.deliveryEyebrow}</p>
        <h2>{t.deliveryTitle}</h2>
        <div className="delivery-grid">
          {[
            [Fingerprint, t.delivery1, t.delivery1body],
            [PackageCheck, t.delivery2, t.delivery2body],
            [Earth, t.delivery3, t.delivery3body],
          ].map(([Icon, title, body], i) => {
            const I = Icon as typeof Earth;
            return (
              <div className="delivery-item" key={i}>
                <span className="delivery-icon">
                  <I size={25} strokeWidth={1.3} />
                </span>
                <h3>{String(title)}</h3>
                <p>{String(body)}</p>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
