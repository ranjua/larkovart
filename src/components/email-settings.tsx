"use client";
import { useState } from "react";
export function EmailSettings({ ready }: { ready: boolean }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function testConnection() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/studio/email-test", {
        method: "POST",
      });
      const result = await response.json();
      setMessage(
        result.message || result.error || "Unable to check email sending.",
      );
    } catch {
      setMessage(
        "Unable to confirm sending. Check your inbox before trying again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="studio-settings">
      <summary>
        Customer emails{" "}
        <span>
          {ready ? "Gmail credential configured" : "Gmail setup pending"}
        </span>
      </summary>
      <p>
        Account verification, password recovery and optional sign-in codes from
        larkova.art@gmail.com.
      </p>
      <button
        type="button"
        className="button"
        disabled={!ready || busy}
        onClick={testConnection}
      >
        {busy ? "Sending test…" : "Send test to my Gmail"}
      </button>
      <p role="status" aria-live="polite">
        {message}
      </p>
    </details>
  );
}
