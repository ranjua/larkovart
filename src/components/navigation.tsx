"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Globe2, Menu, X } from "lucide-react";
import { dictionaries, languageNames, locales, type Locale } from "@/lib/i18n";
export function Navigation({ locale }: { locale: Locale }) {
  const t = dictionaries[locale];
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-Hans" : locale;
    document.cookie = `larkovart_locale=${locale};path=/;max-age=31536000;SameSite=Lax`;
  }, [locale]);
  return (
    <>
      <nav
        className={open ? "main-nav open" : "main-nav"}
        aria-label={t.collection}
      >
        <Link onClick={() => setOpen(false)} href={`/${locale}#collection`}>
          {t.collection}
        </Link>
        <Link onClick={() => setOpen(false)} href={`/${locale}#artist`}>
          {t.about}
        </Link>
        <Link onClick={() => setOpen(false)} href={`/${locale}#delivery`}>
          {t.shipping}
        </Link>
      </nav>
      <div className="nav-actions">
        <label className="language">
          <Globe2 size={16} />
          <select
            aria-label="Language / Idioma"
            value={locale}
            onChange={(e) => {
              setOpen(false);
              router.push(path.replace(/^\/[^/]+/, `/${e.target.value}`));
            }}
          >
            {locales.map((l) => (
              <option key={l} value={l}>
                {languageNames[l]}
              </option>
            ))}
          </select>
        </label>
        <button
          className="menu-button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
    </>
  );
}
