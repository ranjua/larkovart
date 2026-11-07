import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { dictionaries, isLocale } from "@/lib/i18n";
import { artwork } from "@/lib/store";
import { Checkout } from "@/components/checkout";
import { localizedCountries } from "@/lib/countries";
export const dynamic = "force-dynamic";
export default async function CheckoutPage({
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
    <section className="section-wrap checkout-section">
      <Link className="back-link" href={`/${locale}/art/${id}`}>
        <ArrowLeft size={16} />
        {t.back}
      </Link>
      {a.status === "available" ? (
        <Checkout
          art={a}
          locale={locale}
          sandbox={process.env.PAYMENT_PROVIDER === "recurrente"}
          countryOptions={localizedCountries(locale)}
        />
      ) : (
        <div className="empty-state">
          <h1>{t.unavailable}</h1>
          <Link href={`/${locale}#collection`}>{t.return} →</Link>
        </div>
      )}
    </section>
  );
}
