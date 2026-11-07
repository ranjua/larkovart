import { createHash } from "node:crypto";
import { createClient } from "@libsql/client";
import {
  sealWebhookSecret,
  openWebhookSecret,
} from "../src/lib/integrations/webhook-crypto.ts";
const key = process.env.RECURRENTE_SECRET_KEY,
  sandbox = process.env.RECURRENTE_SANDBOX_ID,
  bypass = process.env.RECURRENTE_WEBHOOK_BYPASS,
  base = process.env.RECURRENTE_WEBHOOK_BASE_URL;
if (key && sandbox && bypass && base) {
  if (
    !key.startsWith("sk_test_") ||
    !sandbox.startsWith("sbx_") ||
    process.env.PAYMENT_ENVIRONMENT !== "sandbox" ||
    process.env.DATABASE_ENVIRONMENT !== "development"
  )
    throw Error("Sandbox webhook setup environment rejected.");
  const url = new URL("/api/webhooks/recurrente", base);
  if (url.protocol !== "https:" || !url.hostname.endsWith(".vercel.app"))
    throw Error("Invalid sandbox webhook origin.");
  url.searchParams.set("x-vercel-protection-bypass", bypass);
  const fingerprint = createHash("sha256").update(url.href).digest("hex");
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN || process.env.DATABASE_AUTH_TOKEN,
  });
  const name = "recurrente:webhook:" + sandbox;
  try {
    await client.execute(
      "CREATE TABLE IF NOT EXISTS integration_secrets(name TEXT PRIMARY KEY,state TEXT NOT NULL,value TEXT NOT NULL DEFAULT '{}')",
    );
    const claim = await client.execute({
      sql: "INSERT OR IGNORE INTO integration_secrets(name,state) VALUES(?,'creating')",
      args: [name],
    });
    if (claim.rowsAffected) {
      try {
        const r = await fetch(
          "https://app.recurrente.com/api/webhook_endpoints",
          {
            method: "POST",
            headers: {
              "X-SECRET-KEY": key,
              "Content-Type": "application/json",
            },
            redirect: "error",
            signal: AbortSignal.timeout(20000),
            body: JSON.stringify({
              url: url.href,
              description: "Larkova Art isolated sandbox",
            }),
          },
        );
        if (!r.ok)
          throw Error(
            "Sandbox webhook registration failed (HTTP " + r.status + ").",
          );
        const j = await r.json();
        if (
          typeof j.signingSecret !== "string" ||
          !j.signingSecret.startsWith("whsec_")
        )
          throw Error("Webhook signing secret unavailable.");
        const encrypted = sealWebhookSecret(
          JSON.stringify({
            signingSecret: j.signingSecret,
            endpointId: j.id,
            urlHash: fingerprint,
          }),
          key,
        );
        await client.execute({
          sql: "UPDATE integration_secrets SET state='ready',value=? WHERE name=?",
          args: [encrypted, name],
        });
        console.log(
          "Recurrente sandbox webhook registered; signing secret encrypted in the development database.",
        );
      } catch (error) {
        await client.execute({
          sql: "UPDATE integration_secrets SET state='review' WHERE name=? AND state='creating'",
          args: [name],
        });
        throw error;
      }
    } else {
      const result = await client.execute({
        sql: "SELECT state,value FROM integration_secrets WHERE name=?",
        args: [name],
      });
      const row = result.rows[0];
      if (row?.state !== "ready")
        throw Error(
          "Sandbox webhook setup needs review; no duplicate registration attempted.",
        );
      const stored = JSON.parse(openWebhookSecret(String(row.value), key));
      if (stored.urlHash !== fingerprint)
        throw Error(
          "Sandbox webhook destination changed; review existing registration.",
        );
      console.log(
        "Existing Recurrente sandbox webhook configuration verified; no duplicate endpoint created.",
      );
    }
    const endpointsResponse = await fetch(
      "https://app.recurrente.com/api/webhook_endpoints",
      {
        headers: { "X-SECRET-KEY": key },
        redirect: "error",
        signal: AbortSignal.timeout(20000),
      },
    );
    if (endpointsResponse.ok) {
      const endpoints = await endpointsResponse.json();
      const match = Array.isArray(endpoints)
        ? endpoints.find(
            (e) => e.description === "Larkova Art isolated sandbox",
          )
        : undefined;
      console.log(
        "Recurrente callback endpoint: " +
          JSON.stringify({
            found: !!match,
            disabled: match?.disabled,
            urlMatches:
              typeof match?.url === "string" &&
              createHash("sha256").update(match.url).digest("hex") ===
                fingerprint,
          }),
      );
    }
    const fixtureName = "recurrente:webhook:fixture:" + sandbox;
    const fixture = await client.execute({
      sql: "INSERT OR IGNORE INTO integration_secrets(name,state) VALUES(?,'submitting')",
      args: [fixtureName],
    });
    if (fixture.rowsAffected) {
      const response = await fetch(
        "https://app.recurrente.com/api/test_helpers/webhook_events",
        {
          method: "POST",
          headers: { "X-SECRET-KEY": key, "Content-Type": "application/json" },
          redirect: "error",
          signal: AbortSignal.timeout(20000),
          body: JSON.stringify({
            event_type: "intent.pending",
            data: {
              live_mode: false,
              checkout: null,
              metadata: { integration_case: "larkovart-connectivity" },
            },
          }),
        },
      );
      await client.execute({
        sql: "UPDATE integration_secrets SET state=? WHERE name=?",
        args: [response.ok ? "submitted" : "review", fixtureName],
      });
      console.log(
        response.ok
          ? "Sandbox webhook connectivity fixture submitted. This does not create a payment."
          : "Sandbox webhook fixture needs review; no payment created.",
      );
    }
  } finally {
    client.close();
  }
}
