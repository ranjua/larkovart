"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, Check, Package } from "lucide-react";
import { dictionaries, money, type Locale } from "@/lib/i18n";
import type { Artwork } from "@/lib/catalog";
export function Checkout({ art, locale }: { art: Artwork; locale: Locale }) {
  const t = dictionaries[locale];
  const [country, setCountry] = useState("GT");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ id: string; status: string } | null>(
    null,
  );
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, artworkId: art.id }),
      });
      if (!response.ok) {
        setError(response.status === 409 ? t.conflict : t.error);
        return;
      }
      setResult(await response.json());
    } catch {
      setError(t.error);
    } finally {
      setBusy(false);
    }
  }
  if (result)
    return (
      <div className="success-panel">
        <span className="success-check">
          <Check size={32} />
        </span>
        <p className="eyebrow">
          {t.order} · {result.id.slice(0, 8).toUpperCase()}
        </p>
        <h1>
          {result.status === "quote_requested" ? t.thanksQuote : t.thanks}
        </h1>
        <p>{t.thanksBody}</p>
        <Link className="button button-dark" href={`/${locale}`}>
          {t.return}
          <ArrowUpRight size={18} />
        </Link>
      </div>
    );
  return (
    <div className="checkout-grid">
      <div>
        <p className="eyebrow">{t.edition}</p>
        <h1>{t.checkout}</h1>
        <p className="checkout-intro">{t.checkoutIntro}</p>
        <form onSubmit={submit} className="checkout-form">
          <div className="form-row">
            <label>
              {t.name}
              <input
                name="name"
                required
                minLength={2}
                maxLength={120}
                autoComplete="off"
                placeholder="Alex Demo"
              />
            </label>
            <label>
              {t.email}
              <input
                name="email"
                type="email"
                required
                maxLength={180}
                autoComplete="off"
                placeholder="alex@example.com"
              />
            </label>
          </div>
          <label>
            {t.country}
            <select
              name="country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            >
              <option value="GT">{t.guatemala}</option>
              <option value="US">{t.us}</option>
              <option value="OTHER">{t.other}</option>
            </select>
          </label>
          <label>
            {t.address}
            <input
              name="address"
              required
              minLength={3}
              maxLength={240}
              autoComplete="off"
            />
          </label>
          <div className="form-row">
            <label>
              {t.city}
              <input name="city" required minLength={2} maxLength={100} />
            </label>
            <label>
              {t.postal}
              <input name="postal" required maxLength={20} />
            </label>
          </div>
          <p className="fine-print">{t.privacy}</p>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="button button-dark full-width" disabled={busy}>
            {busy ? t.working : country === "GT" ? t.demoPay : t.requestQuote}
            <ArrowUpRight size={18} />
          </button>
        </form>
      </div>
      <aside className="order-summary">
        <Image
          src={art.image}
          alt={art.title}
          width={650}
          height={650}
          sizes="(max-width: 800px) 90vw, 35vw"
        />
        <div className="summary-line">
          <h2>{art.title}</h2>
          <span>{money(art.price, locale)}</span>
        </div>
        <p>
          Yulia Larkova · {art.width} × {art.height} cm
        </p>
        <div className="shipping-note">
          <Package size={20} />
          <div>
            <strong>{country === "GT" ? t.deliveryIncluded : t.quote}</strong>
            <p>{country === "GT" ? t.development : t.quoteNote}</p>
          </div>
        </div>
      </aside>
    </div>
  );
}
