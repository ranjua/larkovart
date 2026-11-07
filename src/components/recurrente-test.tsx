"use client";
import { useState } from "react";
export function RecurrenteTest({ configured }: { configured: boolean }) {
  const [webhook, setWebhook] = useState(false);
  const [id, setId] = useState("");
  const [state, setState] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function run(action: "create" | "check" | "refund") {
    const testId = id || crypto.randomUUID();
    setId(testId);
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/studio/recurrente-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: testId, action }),
      });
      const j = await r.json();
      if (!r.ok) throw Error();
      setState(j.test.state);
      setWebhook(j.signedWebhookReceived === true);
      setUrl(j.test.checkout_url || "");
    } catch {
      setMessage(
        "Test unavailable or needs review. Check credentials; do not retry an uncertain refund.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="integration-panel">
      <h2>Recurrente payment test</h2>
      <p className="studio-note">
        USD 1.00 in the Sandbox only. No artwork is reserved or sold, and no
        label or pickup is created. Delivery setup stays paused.
      </p>
      {!configured && (
        <p>
          Awaiting Recurrente Sandbox TEST key and Sandbox ID in Vercel Preview.
        </p>
      )}
      <button
        className="button button-dark"
        disabled={!configured || busy || !!id}
        onClick={() => run("create")}
      >
        Create sandbox payment test
      </button>
      {url && (
        <a className="text-link" href={url} target="_blank" rel="noreferrer">
          Open Recurrente test checkout ↗
        </a>
      )}
      {id && (
        <button
          className="text-link"
          disabled={busy}
          onClick={() => run("check")}
        >
          Verify test payment / refund
        </button>
      )}
      {state === "paid" && (
        <button
          className="text-link"
          disabled={busy}
          onClick={() => run("refund")}
        >
          Refund USD 1 sandbox payment
        </button>
      )}
      <p>
        Test card: 4242 4242 4242 4242 · any future expiry · any 3-digit CVC.
        Never enter a real card here.
      </p>
      {state && (
        <p role="status">
          Test status: {state} · Signed webhook:{" "}
          {webhook ? "received and verified" : "not yet received"}
        </p>
      )}
      {message && <p role="alert">{message}</p>}
    </section>
  );
}
