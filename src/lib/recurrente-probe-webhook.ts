import { db } from "./store.ts";
import { recurrente } from "./integrations/recurrente.ts";
export async function reconcileProbeWebhook(
  messageId: string,
  checkoutId: string,
) {
  await db().execute(
    "CREATE TABLE IF NOT EXISTS recurrente_probes (id TEXT PRIMARY KEY, state TEXT NOT NULL, checkout_id TEXT, checkout_url TEXT, refund_id TEXT)",
  );
  const rows = await db().execute({
    sql: "SELECT id FROM recurrente_probes WHERE checkout_id=?",
    args: [checkoutId],
  });
  if (!rows.rows[0]) return;
  const id = String(rows.rows[0].id),
    checkout = await recurrente().get(checkoutId);
  if (
    checkout.metadata?.order_id !== id ||
    checkout.total_in_cents !== 100 ||
    checkout.currency !== "USD"
  )
    throw Error("Probe payment reference mismatch");
  await db().execute({
    sql: "UPDATE recurrente_probes SET state=? WHERE id=? AND state IN ('unpaid','paid','expired')",
    args: [checkout.status, id],
  });
  await db().execute(
    "CREATE TABLE IF NOT EXISTS recurrente_probe_events(message_id TEXT PRIMARY KEY,probe_id TEXT NOT NULL)",
  );
  await db().execute({
    sql: "INSERT OR IGNORE INTO recurrente_probe_events VALUES (?,?)",
    args: [messageId, id],
  });
}
