"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Globe2, Menu, X } from "lucide-react";
import { dictionaries, languageNames, locales, type Locale } from "@/lib/i18n";
import { galleryCopy } from "@/lib/gallery-copy";
export function Navigation({ locale }: { locale: Locale }) {
  const t = dictionaries[locale],
    g = galleryCopy[locale],
    path = usePathname(),
    router = useRouter();
  const [open, setOpen] = useState(false),
    menu = useRef<HTMLDetailsElement>(null),
    summary = useRef<HTMLElement>(null),
    nav = useRef<HTMLElement>(null),
    closing = useRef<Animation | null>(null);
  const close = () => {
    closing.current?.cancel();
    closing.current = null;
    if (menu.current) menu.current.open = false;
    setOpen(false);
  };
  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-Hans" : locale;
    document.cookie = `larkovart_locale=${locale};path=/;max-age=31536000;SameSite=Lax`;
  }, [locale]);
  useEffect(() => {
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && menu.current?.open) {
        close();
        summary.current?.focus();
      }
    };
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("keydown", escape);
      closing.current?.cancel();
    };
  }, []);
  const links = (
    <>
      <Link onClick={close} href={`/${locale}#collection`}>
        {t.collection}
      </Link>
      <Link onClick={close} href={`/${locale}#artist`}>
        {t.about}
      </Link>
      <Link onClick={close} href={`/${locale}#delivery`}>
        {t.shipping}
      </Link>
    </>
  );
  return (
    <>
      <nav className="main-nav desktop-nav" aria-label={t.collection}>
        {links}
      </nav>
      <div className="nav-actions">
        <label className="language">
          <Globe2 size={16} />
          <select
            aria-label="Language / Idioma"
            value={locale}
            onChange={(e) => {
              close();
              router.push(
                path.replace(/^\/[^/]+/, `/${e.target.value}`) +
                  window.location.search +
                  window.location.hash,
              );
            }}
          >
            {locales.map((l) => (
              <option key={l} value={l}>
                {languageNames[l]}
              </option>
            ))}
          </select>
        </label>
        <details
          className="mobile-menu"
          ref={menu}
          onToggle={(e) => {
            const value = e.currentTarget.open;
            setOpen(value);
            if (
              value &&
              !matchMedia("(prefers-reduced-motion: reduce)").matches
            )
              nav.current?.animate(
                [
                  { opacity: 0.2, transform: "translateY(-8px)" },
                  { opacity: 1, transform: "translateY(0)" },
                ],
                { duration: 180, easing: "ease-out" },
              );
          }}
        >
          <summary
            role="button"
            ref={summary}
            className="menu-button"
            aria-label={open ? g.closeMenu : g.openMenu}
            onClick={(e) => {
              if (!menu.current?.open) return;
              if (closing.current) {
                e.preventDefault();
                closing.current.cancel();
                closing.current = null;
                return;
              }
              if (
                !matchMedia("(prefers-reduced-motion: reduce)").matches &&
                nav.current
              ) {
                e.preventDefault();
                const a = nav.current.animate(
                  [
                    { opacity: 1, transform: "translateY(0)" },
                    { opacity: 0, transform: "translateY(-6px)" },
                  ],
                  { duration: 150, easing: "ease-in" },
                );
                closing.current = a;
                a.onfinish = close;
              }
            }}
          >
            <Menu className="menu-open-icon" size={23} />
            <X className="menu-close-icon" size={23} />
          </summary>
          <nav
            ref={nav}
            className="main-nav mobile-nav"
            aria-label={t.collection}
          >
            {links}
          </nav>
        </details>
      </div>
    </>
  );
}
