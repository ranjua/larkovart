"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function IntegrationPanel({
  payment,
  couriers,
  autoBook,
}: {
  payment: boolean;
  couriers: { id: string; name: string; configured: boolean }[];
  autoBook: boolean;
}) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <section className="integration-panel">
      <div>
        <h2>Payments & courier connections</h2>
        <p className="studio-note">
          Recurrente Sandbox:{" "}
          {payment
            ? "credentials configured; provider verification required"
            : "awaiting sandbox credentials"}
          <br />
          {couriers.map((c) => (
            <span key={c.id}>
              {c.name}:{" "}
              {c.configured
                ? "test credentials configured; account verification pending"
                : c.id === "guatex"
                  ? "request API documentation and test access"
                  : "awaiting test access"}
              <br />
            </span>
          ))}
          Automatic test labels & pickup:{" "}
          {autoBook
            ? "enabled after verified payment"
            : "off; use the order’s test booking button"}
        </p>
      </div>
      <div className="studio-note">
        <p>
          One-time setup: request test API access from each courier. Save
          credentials privately in the preview environment.
        </p>
        <p>
          <a
            href="https://www.forzadelivery.com/gt/"
            target="_blank"
            rel="noreferrer"
          >
            Forza
          </a>{" "}
          ·{" "}
          <a
            href="https://guatex.com/contacto/"
            target="_blank"
            rel="noreferrer"
          >
            Guatex
          </a>{" "}
          ·{" "}
          <a
            href="https://developer.dhl.com/api-reference/dhl-express-mydhl-api"
            target="_blank"
            rel="noreferrer"
          >
            DHL
          </a>{" "}
          ·{" "}
          <a
            href="https://developer.fedex.com/"
            target="_blank"
            rel="noreferrer"
          >
            FedEx
          </a>
        </p>
        <button
          className="text-link"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(
                "Hola. Quiero integrar mi tienda de arte con origen en zona 12, Ciudad de Guatemala. Necesito documentación y acceso API de pruebas para cotizar, generar guías, solicitar recolecciones y rastrear envíos. ¿Pueden habilitarlo y confirmar cómo agrupar varias guías en una recolección diaria?",
              );
              setMessage(
                "Courier access request copied. Send it to your courier representative.",
              );
            } catch {
              setMessage(
                "Request test API access for rates, labels, pickups and tracking from your courier representative.",
              );
            }
          }}
        >
          Copy courier access request
        </button>
        <p>
          Eligible test rates are compared automatically. Labels and pickup
          requests follow verified sandbox payment. Guatex stays disabled until
          its API is verified.
        </p>
      </div>
      <button
        className="button button-dark"
        disabled={busy || !payment}
        onClick={async () => {
          setBusy(true);
          try {
            const r = await fetch("/api/studio/integrations/reconcile", {
              method: "POST",
            });
            const data = await r.json();
            setMessage(
              r.ok
                ? `Reconciliation completed: ${data.results.length} pending orders checked.`
                : "Reconciliation unavailable. Check the sandbox configuration.",
            );
            router.refresh();
          } catch {
            setMessage("Unable to reconcile.");
          } finally {
            setBusy(false);
          }
        }}
      >
        Reconcile sandbox orders
      </button>
      {message && (
        <p className="studio-message" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
export function ShippingActions({
  id,
  state,
  tracking,
}: {
  id: string;
  state?: string;
  tracking?: string;
}) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <div className="shipping-actions">
      <p className="fine-print">
        Sandbox shipping: {state || "awaiting verified payment"}
        {tracking ? ` · ${tracking}` : ""}
      </p>
      {state === "queued" && (
        <button
          className="button button-dark"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const r = await fetch(`/api/studio/orders/${id}/shipping`, {
                method: "POST",
              });
              const d = await r.json();
              setMessage(
                r.ok
                  ? `Test shipping: ${d.state}`
                  : "Courier not configured or unavailable.",
              );
              router.refresh();
            } catch {
              setMessage("Test booking unavailable.");
            } finally {
              setBusy(false);
            }
          }}
        >
          Create test label & pickup
        </button>
      )}
      {["test_booked", "test_label_created"].includes(state || "") && (
        <a className="text-link" href={`/api/studio/orders/${id}/shipping`}>
          Download test label ↗
        </a>
      )}
      {["test_booked", "test_label_created"].includes(state || "") && (
        <button
          className="text-link"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const r = await fetch(`/api/studio/orders/${id}/tracking`, {
                method: "POST",
              });
              setMessage(
                r.ok
                  ? "Tracking response received from the selected courier’s test API. Test tracking fixtures may differ from real delivery."
                  : "Tracking is not available in the test environment.",
              );
            } catch {
              setMessage("Tracking unavailable.");
            } finally {
              setBusy(false);
            }
          }}
        >
          Check test tracking
        </button>
      )}
      {state === "test_label_created" && (
        <p className="studio-note">
          Test label saved. Pickup is unconfirmed; check with the courier before
          scheduling another pickup. The label will not be recreated.
        </p>
      )}
      {state === "review_required" && (
        <p className="studio-note">
          The courier result needs review. Automatic retries are disabled to
          avoid duplicate labels or pickups.
        </p>
      )}
      {message && (
        <p role="status" className="fine-print">
          {message}
        </p>
      )}
    </div>
  );
}
