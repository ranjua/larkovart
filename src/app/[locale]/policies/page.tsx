import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, dictionaries } from "@/lib/i18n";
import { customerCopy } from "@/lib/customer/copy";
import { policies } from "@/lib/customer/policies";
export default async function PolicyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = customerCopy[locale],
    p = policies[locale];
  return (
    <section className="section-wrap buying-policies">
      <p className="eyebrow">LARKOVA / {t.policies}</p>
      <h1>{t.policyIntro}</h1>
      <p className="customer-note">{p.intro}</p>
      <section>
        <h2>{t.mainPhoto}</h2>
        <p>{p.original}</p>
      </section>
      <section id="shipping">
        <h2>{t.shippingPolicy}</h2>
        <p>{p.shipping}</p>
      </section>
      <section id="returns">
        <h2>{t.returnsPolicy}</h2>
        <p>{p.damage}</p>
        <p>{p.returns}</p>
      </section>
      <section id="privacy">
        <h2>{t.privacy}</h2>
        <p>{p.privacy}</p>
      </section>
      <a className="button button-dark" href="mailto:larkova.art@gmail.com">
        {t.contact} ↗
      </a>
      <Link className="text-link" href={`/${locale}#collection`}>
        {dictionaries[locale].back} ↗
      </Link>
    </section>
  );
}
