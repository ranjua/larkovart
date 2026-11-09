"use client";
import Link from "next/link";
import { useState } from "react";
import { Heart, ShoppingBag, UserRound, Check } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { customerCopy } from "@/lib/customer/copy";
import { useCustomer } from "./provider";
export function CustomerLinks({ locale }: { locale: Locale }) {
  const c = useCustomer(),
    t = customerCopy[locale];
  return (
    <nav className="customer-links" aria-label={t.account}>
      <Link href={`/${locale}/account`} aria-label={t.account}>
        <UserRound size={19} />
      </Link>
      <Link
        href={`/${locale}/favorites`}
        aria-label={`${t.favorites} (${c.favorites.length})`}
      >
        <Heart size={19} />
        <span>{c.favorites.length}</span>
      </Link>
      <Link
        href={`/${locale}/cart`}
        aria-label={`${t.cart} (${c.cart.length})`}
      >
        <ShoppingBag size={19} />
        <span>{c.cart.length}</span>
      </Link>
    </nav>
  );
}
export function ItemActions({
  id,
  locale,
  available,
}: {
  id: string;
  locale: Locale;
  available: boolean;
}) {
  const c = useCustomer(),
    t = customerCopy[locale],
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const favorite = c.favorites.includes(id),
    cart = c.cart.includes(id);
  async function change(kind: "favorite" | "cart", present: boolean) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await c.toggle(kind, id, present);
    } catch {
      setError(t.notAvailable);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="item-actions">
      <button
        disabled={busy}
        aria-label={favorite ? t.unsave : t.save}
        aria-pressed={favorite}
        onClick={() => change("favorite", !favorite)}
      >
        <Heart size={17} fill={favorite ? "currentColor" : "none"} />
        <span>{favorite ? t.saved : t.save}</span>
      </button>
      {available && (
        <button
          disabled={busy}
          aria-pressed={cart}
          onClick={() => change("cart", !cart)}
        >
          {cart ? <Check size={17} /> : <ShoppingBag size={17} />}
          <span>{cart ? t.cart : t.addCart}</span>
        </button>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
