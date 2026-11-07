import { verifyRecurrenteWebhook } from "@/lib/integrations/webhook";
import { receiveWebhook } from "@/lib/commerce";
export async function POST(request: Request) {
  if (
    process.env.PAYMENT_ENVIRONMENT !== "sandbox" ||
    !process.env.RECURRENTE_WEBHOOK_SECRET ||
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
      process.env.RECURRENTE_WEBHOOK_SECRET,
      process.env.RECURRENTE_SANDBOX_ID,
    );
  } catch {
    return Response.json(
      { error: "invalid_signature_or_environment" },
      { status: 400 },
    );
  }
  try {
    // Reconcile from the provider, not from untrusted success redirects or amounts.
    if (event.checkoutId) await receiveWebhook(event.id, event.checkoutId);
    return Response.json({ received: true });
  } catch {
    return Response.json({ error: "retry_delivery" }, { status: 503 });
  }
}

export const maxDuration = 120;
