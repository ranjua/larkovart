"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function IntegrationPanel({
  payment,
  courier,
  autoBook,
}: {
  payment: boolean;
  courier: boolean;
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
          DHL Express test API:{" "}
          {courier
            ? "credentials configured; checked when quoting"
            : "awaiting test credentials and sender profile"}
          <br />
          Automatic test labels & pickup:{" "}
          {autoBook
            ? "enabled after verified payment"
            : "off; use the order’s test booking button"}
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
      {state === "test_booked" && (
        <a className="text-link" href={`/api/studio/orders/${id}/shipping`}>
          Download test label ↗
        </a>
      )}
      {state === "test_booked" && (
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
                  ? "Tracking response received from the DHL test API. Test tracking fixtures may differ from real delivery."
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
