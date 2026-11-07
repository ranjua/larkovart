import { db } from "../store.ts";
import { openWebhookSecret } from "./webhook-crypto.ts";
export async function recurrenteWebhookSecret() {
  if (process.env.RECURRENTE_WEBHOOK_SECRET)
    return process.env.RECURRENTE_WEBHOOK_SECRET;
  if (!process.env.RECURRENTE_SECRET_KEY || !process.env.RECURRENTE_SANDBOX_ID)
    return null;
  try {
    const result = await db().execute({
      sql: "SELECT value FROM integration_secrets WHERE name=? AND state='ready'",
      args: ["recurrente:webhook:" + process.env.RECURRENTE_SANDBOX_ID],
    });
    if (!result.rows[0]) return null;
    return JSON.parse(
      openWebhookSecret(
        String(result.rows[0].value),
        process.env.RECURRENTE_SECRET_KEY,
      ),
    ).signingSecret as string;
  } catch {
    return null;
  }
}
