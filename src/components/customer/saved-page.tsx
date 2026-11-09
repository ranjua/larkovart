"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { ArrowUpRight, Heart, ShoppingBag } from "lucide-react";
import { customerCopy } from "@/lib/customer/copy";
import { money, type Locale } from "@/lib/i18n";
import { useCustomer } from "./provider";
export function SavedPage({
  locale,
  kind,
}: {
  locale: Locale;
  kind: "favorite" | "cart";
}) {
  const c = useCustomer(),
    t = customerCopy[locale],
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    c.reload().catch(() => {});
  }, [c.reload]);
  const ids = kind === "favorite" ? c.favorites : c.cart;
  const total = ids.reduce((sum, id) => {
    const a = c.state.catalog.find((a) => a.id === id);
    return sum + (a?.status === "available" ? a.price : 0);
  }, 0);
  return (
    <section className="section-wrap saved-page">
      <p className="eyebrow">
        LARKOVA / {kind === "favorite" ? t.favorites : t.cart}
      </p>
      <h1>{kind === "favorite" ? t.favorites : t.cart}</h1>
      {!c.state.user && (
        <p>
          {t.sync}{" "}
          <Link className="text-link" href={`/${locale}/account`}>
            {t.signIn}
            <ArrowUpRight size={16} />
          </Link>
        </p>
      )}
      {kind === "cart" && <p className="customer-note">{t.cartNote}</p>}
      {error && <p role="alert">{error}</p>}
      {!ids.length ? (
        <div className="empty-state">
          {kind === "favorite" ? (
            <Heart size={30} />
          ) : (
            <ShoppingBag size={30} />
          )}
          <h2>{t.empty}</h2>
          <Link className="button button-dark" href={`/${locale}#collection`}>
            {t.browse}
            <ArrowUpRight size={18} />
          </Link>
        </div>
      ) : (
        <>
          <div className="saved-list">
            {ids.map((id) => {
              const a = c.state.catalog.find((a) => a.id === id);
              return (
                <article key={id}>
                  {a && (
                    <Link className="saved-image" href={`/${locale}/art/${id}`}>
                      <img src={a.image} alt={a.title} />
                    </Link>
                  )}
                  <div>
                    <h2>{a?.title || t.notAvailable}</h2>
                    {a && (
                      <p>
                        {a.width} × {a.height} cm ·{" "}
                        {a.status === "available"
                          ? money(a.price, locale)
                          : t.notAvailable}
                      </p>
                    )}
                    <button
                      className="text-link"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        setError("");
                        try {
                          await c.toggle(kind, id, false);
                        } catch {
                          setError(t.error);
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      {t.remove}
                    </button>
                  </div>
                  {a?.status === "available" && (
                    <div>
                      {kind === "cart" ? (
                        <Link
                          className="button button-dark"
                          href={`/${locale}/checkout/${id}`}
                        >
                          {t.checkout}
                          <ArrowUpRight size={18} />
                        </Link>
                      ) : (
                        <button
                          className="button"
                          disabled={busy || c.cart.includes(id)}
                          onClick={async () => {
                            setBusy(true);
                            try {
                              await c.toggle("cart", id, true);
                            } catch {
                              setError(t.notAvailable);
                            } finally {
                              setBusy(false);
                            }
                          }}
                        >
                          {c.cart.includes(id) ? t.saved : t.addCart}
                        </button>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
          {kind === "cart" && (
            <aside className="cart-summary">
              <h2>
                {t.subtotal}
                <strong>{money(total, locale)}</strong>
              </h2>
              <p>{t.totalNote}</p>
              <p>{t.separate}</p>
              <Link href={`/${locale}/policies`}>{t.policies} ↗</Link>
            </aside>
          )}
        </>
      )}
    </section>
  );
}
