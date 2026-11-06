import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, Camera } from "lucide-react";
import { dictionaries, isLocale } from "@/lib/i18n";
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
    <>
      <div className="preview-bar">{t.development}</div>
      <header className="site-header">
        <Link href={`/${locale}`} className="wordmark" aria-label="Larkova Art">
          larkova<span>ART & SOUL</span>
        </Link>
        <Navigation locale={locale} />
      </header>
      <main>{children}</main>
      <footer className="site-footer">
        <div className="footer-top">
          <Link className="wordmark" href={`/${locale}`}>
            larkova<span>ART & SOUL</span>
          </Link>
          <p>{t.footer}</p>
          <a
            href="https://www.instagram.com/yuliaartgt"
            target="_blank"
            rel="noreferrer"
          >
            <Camera size={19} />
            <span>Instagram</span>
            <ArrowUpRight size={17} />
          </a>
        </div>
        <div className="footer-bottom">
          <span>
            © {new Date().getFullYear()} Larkova Art. {t.rights}
          </span>
          <span>Guatemala City · Zona 12</span>
          <Link href="/studio">{t.studio} ↗</Link>
        </div>
      </footer>
    </>
  );
}
