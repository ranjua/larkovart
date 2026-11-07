"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Check, Clock3 } from "lucide-react";
import { dictionaries, type Locale } from "@/lib/i18n";
import { paymentCopy } from "@/lib/payment-copy";
export function PaymentResult({ id, locale }: { id: string; locale: Locale }) {
  const [status, setStatus] = useState("checking");
  const [busy, setBusy] = useState(false);
  const t = dictionaries[locale];
  const p = paymentCopy[locale];
  async function verify() {
    setBusy(true);
    try {
      const response = await fetch(`/api/payments/${id}/verify`, {
        method: "POST",
      });
      if (response.ok) setStatus((await response.json()).status);
      else setStatus("verification_pending");
    } catch {
      setStatus("verification_pending");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    let active = true;
    fetch(`/api/payments/${id}/verify`, { method: "POST" })
      .then(async (r) => {
        if (active)
          setStatus(r.ok ? (await r.json()).status : "verification_pending");
      })
      .catch(() => {
        if (active) setStatus("verification_pending");
      });
    return () => {
      active = false;
    };
  }, [id]);
  const paid = status === "sandbox_paid";
  return (
    <section className="section-wrap">
      <div className="success-panel">
        <span className="success-check">
          {paid ? <Check size={32} /> : <Clock3 size={32} />}
        </span>
        <p className="eyebrow">
          {t.order} · {id.slice(0, 8).toUpperCase()}
        </p>
        <h1>
          {paid
            ? p.paid
            : status === "checking"
              ? p.pending
              : status === "payment_expired"
                ? p.expired
                : p.review}
        </h1>
        <p>{p.note}</p>
        {!paid && status !== "payment_expired" && (
          <button
            className="button button-dark"
            disabled={busy}
            onClick={verify}
          >
            {busy ? t.working : p.verify}
          </button>
        )}
        <p>
          <Link className="text-link" href={`/${locale}#collection`}>
            {t.return} →
          </Link>
        </p>
      </div>
    </section>
  );
}
