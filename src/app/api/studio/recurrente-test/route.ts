import { z } from "zod";
import { sameOrigin, session } from "@/lib/auth";
import { db, init } from "@/lib/store";
import { recurrente } from "@/lib/integrations/recurrente";
export const maxDuration = 120;
const inputSchema = z.object({
  action: z.enum(["create", "check", "refund"]),
  id: z.uuid(),
});
export async function POST(request: Request) {
  if (!sameOrigin(request) || !(await session()))
    return Response.json({ error: "unauthorized" }, { status: 403 });
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json({ error: "invalid_request" }, { status: 400 });
  const { id, action } = parsed.data;
  try {
    await init();
    await db().execute(
      "CREATE TABLE IF NOT EXISTS recurrente_probes (id TEXT PRIMARY KEY, state TEXT NOT NULL, checkout_id TEXT, checkout_url TEXT, refund_id TEXT)",
    );
    const provider = recurrente();
    await provider.verifyEnvironment();
    if (action === "create") {
      const created = await db().execute({
        sql: "INSERT OR IGNORE INTO recurrente_probes(id,state) VALUES(?,'creating')",
        args: [id],
      });
      if (created.rowsAffected) {
        try {
          const url = new URL(request.url);
          url.host = request.headers.get("host") || url.host;
          if (process.env.VERCEL) url.protocol = "https:";
          const checkout = await provider.create({
            orderId: id,
            title: "Larkova Art sandbox integration test — no artwork sold",
            amount: 100,
            returnUrl: url.origin + "/studio",
            cancelUrl: url.origin + "/studio",
          });
          await db().execute({
            sql: "UPDATE recurrente_probes SET state='unpaid',checkout_id=?,checkout_url=? WHERE id=?",
            args: [checkout.id, checkout.checkout_url!, id],
          });
        } catch {
          await db().execute({
            sql: "UPDATE recurrente_probes SET state='creation_review' WHERE id=?",
            args: [id],
          });
          throw Error("creation_review");
        }
      }
    }
    const result = await db().execute({
      sql: "SELECT * FROM recurrente_probes WHERE id=?",
      args: [id],
    });
    const row = result.rows[0];
    if (!row) return Response.json({ error: "not_found" }, { status: 404 });
    if (action === "check" && row.checkout_id) {
      const c = await provider.get(String(row.checkout_id));
      if (
        c.metadata?.order_id !== id ||
        c.total_in_cents !== 100 ||
        c.currency !== "USD"
      )
        throw Error("reference_mismatch");
      await db().execute({
        sql: "UPDATE recurrente_probes SET state=? WHERE id=? AND state IN ('unpaid','paid','expired')",
        args: [c.status, id],
      });
    }
    if (action === "refund") {
      const claimed = await db().execute({
        sql: "UPDATE recurrente_probes SET state='refunding' WHERE id=? AND state='paid' AND refund_id IS NULL",
        args: [id],
      });
      if (claimed.rowsAffected) {
        try {
          const refund = await provider.refundCheckout({
            checkoutId: String(row.checkout_id),
            orderId: id,
            amount: 100,
            idempotencyKey: "probe-" + id,
          });
          await db().execute({
            sql: "UPDATE recurrente_probes SET state=?,refund_id=? WHERE id=?",
            args: ["refund_" + refund.status, refund.id, id],
          });
        } catch {
          await db().execute({
            sql: "UPDATE recurrente_probes SET state='refund_review' WHERE id=?",
            args: [id],
          });
          throw Error("refund_review");
        }
      }
    }
    if (action === "check" && row.refund_id) {
      const refund = await provider.getRefund(String(row.refund_id));
      if (refund.id !== row.refund_id) throw Error("refund_reference_mismatch");
      await db().execute({
        sql: "UPDATE recurrente_probes SET state=? WHERE id=?",
        args: ["refund_" + refund.status, id],
      });
    }
    await db().execute(
      "CREATE TABLE IF NOT EXISTS recurrente_probe_events(message_id TEXT PRIMARY KEY,probe_id TEXT NOT NULL)",
    );
    const received = await db().execute({
      sql: "SELECT message_id FROM recurrente_probe_events WHERE probe_id=? LIMIT 1",
      args: [id],
    });
    const current = await db().execute({
      sql: "SELECT id,state,checkout_url FROM recurrente_probes WHERE id=?",
      args: [id],
    });
    return Response.json({
      test: current.rows[0],
      signedWebhookReceived: received.rows.length > 0,
      sandbox: true,
      amount: "USD 1.00",
      inventoryChanged: false,
      shippingCreated: false,
    });
  } catch {
    return Response.json(
      { error: "recurrente_test_unavailable_or_review_required" },
      { status: 503 },
    );
  }
}
