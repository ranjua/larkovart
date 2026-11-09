import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, PackageCheck, Fingerprint, Earth } from "lucide-react";
import { dictionaries, isLocale } from "@/lib/i18n";
import { artworks } from "@/lib/store";
import { ArtGrid } from "@/components/art-grid";
import { Exhibition } from "@/components/exhibition";
import { ImmersiveHero } from "@/components/immersive-hero";
import { ArtInspector } from "@/components/art-inspector";
import { experienceCopy } from "@/lib/experience-copy";
import { GalleryMotion } from "@/components/gallery-motion";
import { galleryCopy } from "@/lib/gallery-copy";
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
    <Exhibition works={works} initialId={featured?.id} locale={locale}>
      <div className="experience-home">
        <GalleryMotion />
        <ImmersiveHero works={works} locale={locale} />
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
        <ArtInspector locale={locale} />
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
                03 / L
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
        <div className="experience-pause">
          <span aria-hidden="true">✳</span>
          <p>{experienceCopy[locale].pause}</p>
          <span aria-hidden="true">✳</span>
        </div>
        <section id="delivery" className="delivery section-wrap">
          <span className="section-number" aria-hidden="true">
            04
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
      </div>
    </Exhibition>
  );
}
