import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import type { Transaction } from "@libsql/client";
import { db, init, artwork, StoreError, type OrderInput } from "./store.ts";
import type { Artwork } from "./catalog.ts";
import {
  recurrente,
  type RecurrenteSandbox,
} from "./integrations/recurrente.ts";
import { type ShippingContact } from "./integrations/dhl.ts";

import { shipping, shippingConfigured } from "./shipping.ts";
import type { CourierConnection } from "./shipping-types.ts";

export type SandboxProviders = {
  payment: RecurrenteSandbox;
  courier: CourierConnection;
};
type SavedOrder = OrderInput & {
  title: string;
  price: number;
  currency: "USD";
  mode: "sandbox";
  service: string;
  parcel: NonNullable<Artwork["parcel"]>;
};
export function buyerContact(input: OrderInput): ShippingContact {
  if (!input.phone || input.country === "OTHER")
    throw new StoreError("shipping_details_required", 400);
  return {
    name: input.name,
    email: input.email,
    phone: input.phone,
    address: input.address,
    city: input.city,
    postal: input.postal,
    country: input.country,
    region: input.region,
  };
}
export function hashToken(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
async function write<T>(fn: (tx: Transaction) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 6; attempt++) {
    let tx: Transaction | undefined;
    try {
      tx = await db().transaction("write");
      const value = await fn(tx);
      await tx.commit();
      return value;
    } catch (error) {
      if (tx) await tx.rollback();
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "SQLITE_BUSY" &&
        attempt < 5
      ) {
        await new Promise((r) => setTimeout(r, 25 * (attempt + 1)));
        continue;
      }
      throw error;
    } finally {
      tx?.close();
    }
  }
  throw new StoreError("busy", 503);
}
export async function startSandboxCheckout(
  input: OrderInput,
  locale: string,
  providers: SandboxProviders = { payment: recurrente(), courier: shipping() },
) {
  const a = await artwork(input.artworkId);
  if (!a || a.status !== "available") throw new StoreError("unavailable", 409);
  if (!a.parcel) throw new StoreError("packed_measurements_required", 422);
  const service = await providers.courier.includedService(
    buyerContact(input),
    a.parcel,
    a.price,
  );
  if (!service) throw new StoreError("shipping_quote_required", 422);
  await providers.payment.verifyEnvironment();
  const appUrl = process.env.APP_URL;
  if (!appUrl || !/^https?:\/\//.test(appUrl))
    throw new StoreError("app_url_required", 503);
  const id = randomUUID();
  const token = randomBytes(32).toString("hex");
  const data: SavedOrder = {
    ...input,
    title: a.title,
    price: a.price,
    currency: "USD",
    mode: "sandbox",
    service,
    parcel: a.parcel,
  };
  await write(async (tx) => {
    const held = await tx.execute({
      sql: "UPDATE artworks SET status = 'reserved' WHERE id = ? AND status = 'available' AND published = 1",
      args: [a.id],
    });
    if (held.rowsAffected !== 1) throw new StoreError("unavailable", 409);
    await tx.execute({
      sql: "INSERT INTO orders VALUES (?, ?, ?, 'payment_setup', ?)",
      args: [id, a.id, JSON.stringify(data), new Date().toISOString()],
    });
    await tx.execute({
      sql: "INSERT INTO payment_sessions (order_id, token_hash, expires_at) VALUES (?, ?, ?)",
      args: [
        id,
        hashToken(token),
        new Date(Date.now() + 30 * 60_000).toISOString(),
      ],
    });
  });
  try {
    const checkout = await providers.payment.create({
      orderId: id,
      title: a.title,
      amount: a.price,
      returnUrl: `${appUrl}/${locale}/payment/${id}`,
      cancelUrl: `${appUrl}/${locale}/payment/${id}?cancelled=1`,
    });
    await write(async (tx) => {
      await tx.execute({
        sql: "UPDATE payment_sessions SET checkout_id = ?, checkout_url = ? WHERE order_id = ?",
        args: [checkout.id, checkout.checkout_url!, id],
      });
      await tx.execute({
        sql: "UPDATE orders SET status = 'payment_pending' WHERE id = ?",
        args: [id],
      });
    });
    return { id, token, checkoutUrl: checkout.checkout_url! };
  } catch (error) {
    // A timeout could hide a successful provider write. Do not release inventory
    // or create a replacement checkout that could sell the original twice.
    await write((tx) =>
      tx.execute({
        sql: "UPDATE orders SET status = 'payment_setup_review' WHERE id = ?",
        args: [id],
      }),
    );
    throw error;
  }
}
export async function ownsOrder(id: string, token: string) {
  await init();
  const result = await db().execute({
    sql: "SELECT token_hash FROM payment_sessions WHERE order_id = ?",
    args: [id],
  });
  const stored = result.rows[0]?.token_hash;
  return (
    typeof stored === "string" &&
    stored.length === 64 &&
    timingSafeEqual(
      Buffer.from(stored, "hex"),
      Buffer.from(hashToken(token), "hex"),
    )
  );
}
export async function orderState(id: string) {
  await init();
  const result = await db().execute({
    sql: "SELECT o.*, p.checkout_id FROM orders o JOIN payment_sessions p ON o.id=p.order_id WHERE o.id = ?",
    args: [id],
  });
  const row = result.rows[0];
  if (!row) throw new StoreError("not_found", 404);
  return {
    id,
    status: String(row.status),
    artworkId: String(row.artwork_id),
    checkoutId: row.checkout_id ? String(row.checkout_id) : null,
    data: JSON.parse(String(row.data)) as SavedOrder,
  };
}
export async function reconcilePayment(id: string, payment = recurrente()) {
  const local = await orderState(id);
  if (local.status === "sandbox_paid" || local.status === "payment_expired")
    return local.status;
  if (!local.checkoutId) return local.status;
  const remote = await payment.get(local.checkoutId);
  if (
    remote.id !== local.checkoutId ||
    remote.live_mode !== false ||
    remote.metadata?.order_id !== id
  )
    throw new StoreError("payment_reference_mismatch", 409);
  if (
    remote.status === "paid" &&
    (remote.total_in_cents !== local.data.price || remote.currency !== "USD")
  )
    throw new StoreError("payment_amount_mismatch", 409);
  if (remote.status !== "paid" && remote.status !== "expired")
    return local.status;
  const next = remote.status === "paid" ? "sandbox_paid" : "payment_expired";
  await write(async (tx) => {
    const changed = await tx.execute({
      sql: "UPDATE orders SET status = ? WHERE id = ? AND status IN ('payment_pending','payment_setup','payment_setup_review')",
      args: [next, id],
    });
    if (!changed.rowsAffected) return;
    await tx.execute({
      sql: "UPDATE artworks SET status = ? WHERE id = ? AND status = 'reserved'",
      args: [remote.status === "paid" ? "sold" : "available", local.artworkId],
    });
    if (remote.status === "paid")
      await tx.execute({
        sql: "INSERT OR IGNORE INTO fulfillment (order_id, state) VALUES (?, 'queued')",
        args: [id],
      });
  });
  return next;
}
export async function processFulfillment(
  id: string,
  courier?: CourierConnection,
) {
  const order = await orderState(id);
  if (order.status !== "sandbox_paid")
    throw new StoreError("verified_payment_required", 409);
  if (
    !courier &&
    (!shippingConfigured() || process.env.SHIPPING_AUTO_BOOK_TEST === "false")
  )
    return "queued";
  courier ||= shipping();
  // Atomic claim: ambiguous outcomes are held for review, never blindly retried.
  const claim = await write((tx) =>
    tx.execute({
      sql: "UPDATE fulfillment SET state = 'creating' WHERE order_id = ? AND state = 'queued'",
      args: [id],
    }),
  );
  if (!claim.rowsAffected) return "already_claimed";
  try {
    const receiver = buyerContact(order.data);
    const service = await courier.includedService(
      receiver,
      order.data.parcel,
      order.data.price,
    );
    if (!service) throw new StoreError("shipping_budget_changed", 409);
    const shipment = await courier.shipment({
      orderId: id,
      title: order.data.title,
      amount: order.data.price,
      receiver,
      parcel: order.data.parcel,
      service,
      checkpoint: async (shipment) => {
        await write((tx) =>
          tx.execute({
            sql: "UPDATE fulfillment SET state='test_label_created', data=? WHERE order_id=?",
            args: [JSON.stringify(shipment), id],
          }),
        );
      },
    });
    const state =
      shipment.pickupState === "review_required"
        ? "test_label_created"
        : "test_booked";
    await write((tx) =>
      tx.execute({
        sql: "UPDATE fulfillment SET state=?, data=? WHERE order_id=?",
        args: [state, JSON.stringify(shipment), id],
      }),
    );
    return state;
  } catch {
    await write((tx) =>
      tx.execute({
        sql: "UPDATE fulfillment SET state='review_required' WHERE order_id=? AND state='creating'",
        args: [id],
      }),
    );
    return "review_required";
  }
}
export async function reconcilePending() {
  await init();
  const rows = await db().execute(
    "SELECT id FROM orders WHERE status = 'payment_pending' ORDER BY created_at LIMIT 2",
  );
  const results: { id: string; status: string }[] = [];
  for (const row of rows.rows) {
    const id = String(row.id);
    try {
      const status = await reconcilePayment(id);
      if (status === "sandbox_paid") await processFulfillment(id);
      results.push({ id, status });
    } catch {
      results.push({ id, status: "retry_required" });
    }
  }
  const queued = await db().execute(
    "SELECT order_id FROM fulfillment WHERE state='queued' LIMIT 2",
  );
  for (const row of queued.rows) await processFulfillment(String(row.order_id));
  return results;
}
export async function receiveWebhook(
  messageId: string,
  checkoutId: string,
  payment = recurrente(),
) {
  await init();
  await write((tx) =>
    tx.execute({
      sql: "INSERT OR IGNORE INTO webhook_inbox VALUES (?, 'pending', ?)",
      args: [messageId, new Date().toISOString()],
    }),
  );
  const seen = await db().execute({
    sql: "SELECT state FROM webhook_inbox WHERE id=?",
    args: [messageId],
  });
  if (seen.rows[0]?.state === "processed") return;
  const found = await db().execute({
    sql: "SELECT order_id FROM payment_sessions WHERE checkout_id=?",
    args: [checkoutId],
  });
  if (found.rows[0]) {
    const id = String(found.rows[0].order_id);
    const status = await reconcilePayment(id, payment);
    if (status === "sandbox_paid") await processFulfillment(id);
  }
  await write((tx) =>
    tx.execute({
      sql: "UPDATE webhook_inbox SET state='processed' WHERE id=?",
      args: [messageId],
    }),
  );
}
