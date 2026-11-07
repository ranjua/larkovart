import { createHmac, timingSafeEqual } from "node:crypto";
import { receiveWebhook } from "@/lib/commerce";
import { payment } from "@/lib/payments";
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || process.env.PAYMENT_ENVIRONMENT !== "sandbox")
    return Response.json(
      { error: "sandbox_webhook_unconfigured" },
      { status: 503 },
    );
  const raw = await request.text();
  if (raw.length > 256000)
    return Response.json({ error: "too_large" }, { status: 413 });
  const fields = (request.headers.get("stripe-signature") || "")
    .split(",")
    .map((s) => s.split("="));
  const timestamp = fields.find(([k]) => k === "t")?.[1];
  if (
    !timestamp ||
    !/^\d+$/.test(timestamp) ||
    Math.abs(Date.now() / 1000 - Number(timestamp)) > 300
  )
    return Response.json({ error: "invalid_signature" }, { status: 400 });
  const expected = createHmac("sha256", secret)
    .update(timestamp + "." + raw)
    .digest();
  const valid = fields
    .filter(([k]) => k === "v1")
    .some(([, v]) => {
      if (!/^[a-f0-9]{64}$/i.test(v || "")) return false;
      return timingSafeEqual(expected, Buffer.from(v, "hex"));
    });
  if (!valid)
    return Response.json({ error: "invalid_signature" }, { status: 400 });
  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  if (event.livemode !== false || typeof event.id !== "string")
    return Response.json({ error: "sandbox_event_required" }, { status: 400 });
  if (
    ![
      "checkout.session.completed",
      "checkout.session.async_payment_succeeded",
      "checkout.session.expired",
    ].includes(event.type)
  )
    return Response.json({ received: true });
  if (
    typeof event.data?.object?.id !== "string" ||
    !event.data.object.id.startsWith("cs_test_")
  )
    return Response.json({ error: "invalid_checkout" }, { status: 400 });
  try {
    await receiveWebhook(
      "stripe:" + event.id,
      event.data.object.id,
      payment("stripe"),
    );
    return Response.json({ received: true });
  } catch {
    return Response.json({ error: "retry_delivery" }, { status: 503 });
  }
}
export const maxDuration = 120;
