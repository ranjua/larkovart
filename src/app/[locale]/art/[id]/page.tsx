import { ItemActions } from "@/components/customer/actions";
import { customerCopy } from "@/lib/customer/copy";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Fingerprint } from "lucide-react";
import { notFound } from "next/navigation";
import { dictionaries, isLocale, money } from "@/lib/i18n";
import { artwork, artworks } from "@/lib/store";
import { mediumName } from "@/lib/catalog";
import { ArtGrid } from "@/components/art-grid";
import { ArtViewer } from "@/components/art-viewer";
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { id } = await params;
  const a = await artwork(id);
  return { title: a?.title || "Artwork" };
}
export default async function ArtPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  const a = await artwork(id);
  if (!a) notFound();
  const t = dictionaries[locale];
  const related = (await artworks())
    .filter((work) => work.id !== id && work.status === "available")
    .slice(0, 2);
  return (
    <section className="section-wrap detail-section">
      <Link className="back-link" href={`/${locale}#collection`}>
        <ArrowLeft size={16} />
        {t.back}
      </Link>
      <div className="detail-mobile-title">
        <p className="eyebrow">YULIA LARKOVA / {t[a.category]}</p>
        <h1>{a.title}</h1>
      </div>
      <div className="detail-grid">
        <ArtViewer art={a} locale={locale} />
        <div className="detail-copy">
          <p className="eyebrow">YULIA LARKOVA / {t[a.category]}</p>
          <h1 className="detail-desktop-title">{a.title}</h1>
          <p className="edition">
            <Fingerprint size={18} />
            {t.edition}
          </p>

          <dl className="art-specs">
            <div>
              <dt>{t.medium}</dt>
              <dd>{mediumName(a, locale)}</dd>
            </div>
            <div>
              <dt>{t.size}</dt>
              <dd>
                {a.width} × {a.height} cm
              </dd>
            </div>
            <div>
              <dt>{t.year}</dt>
              <dd>{a.year}</dd>
            </div>
          </dl>
          <span
            className={`availability inline ${a.status === "sold" ? "sold" : ""}`}
          >
            <i />
            {t[a.status]}
          </span>
          {a.status === "available" ? (
            <>
              <p className="detail-price">{money(a.price, locale)}</p>
              <p className="fine-print">{t.priceNote}</p>
              <Link
                className="button button-dark full-width"
                href={`/${locale}/checkout/${id}`}
              >
                {t.own}
                <ArrowUpRight size={19} />
              </Link>
            </>
          ) : (
            <p className="sold-note">
              {a.status === "reserved" ? t.reserved : t.unavailable}
            </p>
          )}
          <ItemActions
            id={a.id}
            locale={locale}
            available={a.status === "available"}
          />
          <Link
            className="text-link buying-policy-link"
            href={`/${locale}/policies`}
          >
            {customerCopy[locale].policies}
            <ArrowUpRight size={16} />
          </Link>
          <p className="fine-print detail-mode-note">{t.development}</p>
          <div className="detail-story">
            <h2>{t.details}</h2>
            <p className="detail-description">{a.descriptions[locale]}</p>
          </div>
        </div>
      </div>
      {related.length > 0 && (
        <section className="related-works">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{t.selected}</p>
              <h2>{t.collectionTitle}</h2>
            </div>
          </div>
          <ArtGrid works={related} locale={locale} />
        </section>
      )}
    </section>
  );
}
