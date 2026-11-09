import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, Camera } from "lucide-react";
import { dictionaries, isLocale } from "@/lib/i18n";
import { galleryCopy } from "@/lib/gallery-copy";
import { CustomerProvider } from "@/components/customer/provider";
import { CustomerLinks } from "@/components/customer/actions";
import { customerCopy } from "@/lib/customer/copy";
import { Navigation } from "@/components/navigation";
export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = dictionaries[locale];
  return (
    <CustomerProvider>
      <div className="storefront">
        <link
          rel="preload"
          href="/fonts/cormorant-garamond-normal-latin.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        {locale === "ru" && (
          <link
            rel="preload"
            href="/fonts/cormorant-garamond-normal-cyrillic.woff2"
            as="font"
            type="font/woff2"
            crossOrigin="anonymous"
          />
        )}
        {!["zh", "ja"].includes(locale) && (
          <link
            rel="preload"
            href={`/fonts/cormorant-garamond-italic-${locale === "ru" ? "cyrillic" : "latin"}.woff2`}
            as="font"
            type="font/woff2"
            crossOrigin="anonymous"
          />
        )}
        <a className="skip-link" href="#main-content">
          {galleryCopy[locale].skip}
        </a>
        <div className="preview-bar">{t.development}</div>
        <header className="site-header">
          <Link
            href={`/${locale}`}
            className="wordmark"
            aria-label="Larkova Art"
          >
            larkova<span>ART & SOUL</span>
          </Link>
          <Navigation locale={locale} />
          <CustomerLinks locale={locale} />
        </header>
        <main id="main-content" tabIndex={-1}>
          {children}
        </main>
        <footer className="site-footer">
          <span className="footer-mark" aria-hidden="true">
            L.
          </span>
          <div className="footer-top">
            <Link className="wordmark" href={`/${locale}`}>
              larkova<span>ART & SOUL</span>
            </Link>
            <p>{t.footer}</p>
            <a
              href="https://www.instagram.com/larkova.art/"
              target="_blank"
              rel="noreferrer"
            >
              <Camera size={19} />
              <span>Instagram</span>
              <ArrowUpRight size={17} />
            </a>
          </div>
          <a className="footer-email" href="mailto:larkova.art@gmail.com">
            larkova.art@gmail.com <ArrowUpRight size={18} />
          </a>
          <nav
            className="policy-links"
            aria-label={customerCopy[locale].policies}
          >
            <Link href={`/${locale}/policies`}>
              {customerCopy[locale].policies}
            </Link>
            <Link href={`/${locale}/policies#returns`}>
              {customerCopy[locale].returnsPolicy}
            </Link>
            <Link href={`/${locale}/policies#privacy`}>
              {customerCopy[locale].privacy}
            </Link>
          </nav>
          <div className="footer-bottom">
            <span>
              © {new Date().getFullYear()} Larkova Art. {t.rights}
            </span>
            <span>Guatemala City · Zona 12</span>
            <Link href="/studio">{t.studio} ↗</Link>
          </div>
        </footer>
      </div>
    </CustomerProvider>
  );
}
