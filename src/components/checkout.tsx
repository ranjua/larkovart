"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, Check, Package } from "lucide-react";
import { dictionaries, money, type Locale } from "@/lib/i18n";
import type { Artwork } from "@/lib/catalog";
import type { CountryOption } from "@/lib/countries";
import { paymentCopy } from "@/lib/payment-copy";
export function Checkout({
  art,
  locale,
  sandbox = false,
  countryOptions,
}: {
  art: Artwork;
  locale: Locale;
  sandbox?: boolean;
  countryOptions: CountryOption[];
}) {
  const t = dictionaries[locale];
  const p = paymentCopy[locale];
  const [country, setCountry] = useState("GT");
  const [busy, setBusy] = useState(false);
  const [quoteNeeded, setQuoteNeeded] = useState(sandbox && !art.parcel);
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
      const response = await fetch(
        sandbox && quoteNeeded
          ? "/api/quotes"
          : sandbox
            ? "/api/checkout/sandbox"
            : "/api/orders",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...data, artworkId: art.id, locale }),
        },
      );
      if (!response.ok) {
        if (sandbox && response.status === 422) setQuoteNeeded(true);
        setError(
          response.status === 409
            ? t.conflict
            : sandbox && response.status === 422
              ? p.setup
              : t.error,
        );
        return;
      }
      const result = await response.json();
      if (sandbox && !quoteNeeded) window.location.assign(result.checkoutUrl);
      else setResult(result);
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
        <p className="checkout-intro">{sandbox ? p.intro : t.checkoutIntro}</p>
        <form onSubmit={submit} className="checkout-form">
          <div className="form-row">
            <label>
              {t.name}
              <input
                name="name"
                required
                minLength={2}
                maxLength={sandbox ? 45 : 120}
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
              onChange={(e) => {
                setCountry(e.target.value);
                setQuoteNeeded(sandbox && !art.parcel);
              }}
            >
              {countryOptions.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          {sandbox && (
            <div className="form-row">
              <label>
                {p.phone}
                <input
                  name="phone"
                  type="tel"
                  required
                  minLength={7}
                  maxLength={25}
                />
              </label>
              <label>
                {p.region}
                <input name="region" maxLength={35} />
              </label>
            </div>
          )}
          <label>
            {t.address}
            <input
              name="address"
              required
              minLength={3}
              maxLength={sandbox ? 45 : 240}
              autoComplete="off"
            />
          </label>
          <div className="form-row">
            <label>
              {t.city}
              <input
                name="city"
                required
                minLength={2}
                maxLength={sandbox ? 45 : 100}
              />
            </label>
            <label>
              {t.postal}
              <input name="postal" required maxLength={sandbox ? 12 : 20} />
            </label>
          </div>
          <p className="fine-print">{t.privacy}</p>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="button button-dark full-width" disabled={busy}>
            {busy
              ? t.working
              : sandbox
                ? quoteNeeded
                  ? t.requestQuote
                  : p.pay
                : country === "GT"
                  ? t.demoPay
                  : t.requestQuote}
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
            <strong>
              {sandbox
                ? p.note
                : country === "GT"
                  ? t.deliveryIncluded
                  : t.quote}
            </strong>
            <p>
              {sandbox
                ? p.setup
                : country === "GT"
                  ? t.development
                  : t.quoteNote}
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
