import { db } from "@/lib/store";
import { reconcileProbeWebhook } from "@/lib/recurrente-probe-webhook";
import { recurrenteWebhookSecret } from "@/lib/integrations/webhook-settings";
import { verifyRecurrenteWebhook } from "@/lib/integrations/webhook";
import { receiveWebhook } from "@/lib/commerce";
export async function POST(request: Request) {
  const secret = await recurrenteWebhookSecret();
  if (
    process.env.PAYMENT_ENVIRONMENT !== "sandbox" ||
    !secret ||
    !process.env.RECURRENTE_SANDBOX_ID
  )
    return Response.json(
      { error: "sandbox_webhook_not_configured" },
      { status: 503 },
    );
  const raw = await request.text();
  if (raw.length > 256_000)
    return Response.json({ error: "payload_too_large" }, { status: 413 });
  let event: ReturnType<typeof verifyRecurrenteWebhook>;
  try {
    event = verifyRecurrenteWebhook(
      raw,
      request.headers,
      secret,
      process.env.RECURRENTE_SANDBOX_ID,
    );
  } catch (error) {
    const diagnostic = error as {
      name?: string;
      issues?: { path: unknown[] }[];
    };
    console.warn(
      "recurrente_webhook_rejected",
      JSON.stringify({
        kind: diagnostic.name || "unknown",
        paths: diagnostic.issues?.map((i) => i.path),
      }),
    );
    return Response.json(
      { error: "invalid_signature_or_environment" },
      { status: 400 },
    );
  }
  try {
    // Reconcile from the provider, not from untrusted success redirects or amounts.
    if (event.checkoutId) {
      await reconcileProbeWebhook(event.id, event.checkoutId);
      await receiveWebhook(event.id, event.checkoutId);
    }
    await db().execute(
      "CREATE TABLE IF NOT EXISTS recurrente_webhook_receipts(message_id TEXT PRIMARY KEY,event_type TEXT NOT NULL,received_at TEXT NOT NULL)",
    );
    await db().execute({
      sql: "INSERT OR IGNORE INTO recurrente_webhook_receipts VALUES(?,?,?)",
      args: [event.id, event.type || "unknown", new Date().toISOString()],
    });
    return Response.json({ received: true });
  } catch {
    return Response.json({ error: "retry_delivery" }, { status: 503 });
  }
}

export const maxDuration = 120;
