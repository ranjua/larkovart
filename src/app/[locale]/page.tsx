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
import { dictionaries, isLocale } from "@/lib/i18n";
import { artworks } from "@/lib/store";
import { ArtGrid } from "@/components/art-grid";
import { RoomScene } from "@/components/room-scene";
import { artworkPhoto } from "@/lib/catalog";
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
  const featured =
    [...works]
      .reverse()
      .find((a) => a.status === "available" && a.category !== "sculptures") ||
    works[0];
  return (
    <>
      <section className="hero section-wrap">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="status-dot" />
            {t.eyebrow}
          </p>
          <h1>
            {t.hero1}
            <br />
            <em>{t.hero2}</em>
          </h1>
          <p className="hero-intro">{t.intro}</p>
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
          <div className="hero-visual">
            <Link
              href={`/${locale}/art/${featured.id}`}
              className="hero-scene-link"
              aria-label={`${t.view}: ${featured.title}`}
            >
              <RoomScene art={featured} locale={locale} priority />
              <div className="hero-art-label">
                <span>{featured.title}</span>
                <span>
                  {featured.width} × {featured.height} cm{" "}
                  <ArrowUpRight size={17} />
                </span>
              </div>
            </Link>
            <div className="hero-original-card">
              <Image
                src={artworkPhoto(featured)}
                alt={featured.title}
                width={160}
                height={160}
                sizes="90px"
              />
              <div>
                <span>{t.edition}</span>
                <strong>{t.original}</strong>
              </div>
            </div>
          </div>
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
          <div className="artist-image">
            <Image
              src="/artist.jpg"
              alt="Artwork in Yulia Larkova’s studio"
              width={750}
              height={900}
              sizes="(max-width: 800px) 90vw, 40vw"
            />
            <span className="artist-signature">Yulia Larkova</span>
          </div>
          <div className="artist-copy">
            <p className="eyebrow">{t.artistEyebrow}</p>
            <h2>{t.artistTitle}</h2>
            <p>{t.artistBody}</p>
            <p>{t.artistBody2}</p>
            <a
              className="text-link"
              href="https://www.instagram.com/yuliaartgt"
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
