import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Fingerprint } from "lucide-react";
import { notFound } from "next/navigation";
import { dictionaries, isLocale, money } from "@/lib/i18n";
import { artwork } from "@/lib/store";
import { mediumName } from "@/lib/catalog";
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
  return (
    <section className="section-wrap detail-section">
      <Link className="back-link" href={`/${locale}#collection`}>
        <ArrowLeft size={16} />
        {t.back}
      </Link>
      <div className="detail-grid">
        <ArtViewer art={a} locale={locale} />
        <div className="detail-copy">
          <p className="eyebrow">YULIA LARKOVA / {t[a.category]}</p>
          <h1>{a.title}</h1>
          <p className="edition">
            <Fingerprint size={18} />
            {t.edition}
          </p>
          <p className="detail-description">{a.descriptions[locale]}</p>
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
            <p className="sold-note">{t.unavailable}</p>
          )}
          <p className="fine-print">{t.development}</p>
        </div>
      </div>
    </section>
  );
}
