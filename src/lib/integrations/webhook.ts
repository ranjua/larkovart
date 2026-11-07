import { Webhook } from "svix";
import { z } from "zod";
import { IntegrationError } from "./recurrente.ts";
export function verifyRecurrenteWebhook(
  raw: string,
  headers: Headers,
  secret: string,
  sandboxId: string,
) {
  if (!secret || !sandboxId.startsWith("sbx_"))
    throw new IntegrationError("sandbox_webhook_not_configured");
  new Webhook(secret).verify(raw, {
    "svix-id": headers.get("svix-id") || "",
    "svix-timestamp": headers.get("svix-timestamp") || "",
    "svix-signature": headers.get("svix-signature") || "",
  });
  const event = z
    .object({
      live_mode: z.literal(false).optional(),
      sandbox_id: z.literal(sandboxId),
      event_type: z.string().optional(),
      checkout: z
        .object({
          id: z.string().min(1),
          live_mode: z.literal(false).optional(),
        })
        .nullish(),
    })
    .parse(JSON.parse(raw));
  return {
    id: headers.get("svix-id")!,
    checkoutId: event.checkout?.id || null,
    type: event.event_type,
  };
}
