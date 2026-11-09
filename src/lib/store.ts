import { createClient, type Client } from "@libsql/client";
import { mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { seedArtworks, type Artwork } from "./catalog.ts";

let client: Client | undefined;
let ready: Promise<void> | undefined;
export function db() {
  if (!client) {
    const databaseUrl =
      process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL;
    if (process.env.VERCEL && !databaseUrl)
      throw new Error(
        "Configure an isolated development database for Vercel previews.",
      );
    if (databaseUrl && process.env.DATABASE_ENVIRONMENT !== "development")
      throw new Error("Only development databases are permitted.");
    if (!databaseUrl) mkdirSync(".data", { recursive: true });
    client = createClient({
      url: databaseUrl || "file:.data/studio.db",
      authToken:
        process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN,
    });
  }
  return client;
}
export async function init() {
  if (!ready)
    ready = (async () => {
      await db().batch(
        [
          "CREATE TABLE IF NOT EXISTS artworks (id TEXT PRIMARY KEY, data TEXT NOT NULL, status TEXT NOT NULL, published INTEGER NOT NULL)",
          "CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, artwork_id TEXT NOT NULL, data TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL)",
          "CREATE TABLE IF NOT EXISTS payment_sessions (order_id TEXT PRIMARY KEY, checkout_id TEXT UNIQUE, token_hash TEXT NOT NULL, checkout_url TEXT, expires_at TEXT NOT NULL)",
          "CREATE TABLE IF NOT EXISTS fulfillment (order_id TEXT PRIMARY KEY, state TEXT NOT NULL, data TEXT NOT NULL DEFAULT '{}')",
          "CREATE TABLE IF NOT EXISTS webhook_inbox (id TEXT PRIMARY KEY, state TEXT NOT NULL, received_at TEXT NOT NULL)",
          "CREATE INDEX IF NOT EXISTS orders_artwork_id ON orders(artwork_id)",
          "CREATE TABLE IF NOT EXISTS deleted_artwork_ids (id TEXT PRIMARY KEY, deleted_at TEXT NOT NULL)",
          "CREATE TRIGGER IF NOT EXISTS prevent_deleted_artwork_insert BEFORE INSERT ON artworks WHEN EXISTS(SELECT 1 FROM deleted_artwork_ids WHERE id=NEW.id) BEGIN SELECT RAISE(IGNORE); END",
          "CREATE TRIGGER IF NOT EXISTS protect_ordered_artwork_delete BEFORE DELETE ON artworks WHEN EXISTS(SELECT 1 FROM orders WHERE artwork_id=OLD.id) BEGIN SELECT RAISE(ABORT, 'artwork_has_orders'); END",
          ...seedArtworks.map((a) => ({
            sql: "INSERT OR IGNORE INTO artworks VALUES (?, ?, ?, ?)",
            args: [a.id, JSON.stringify(a), a.status, a.published ? 1 : 0],
          })),
        ],
        "write",
      );
    })().catch((e) => {
      ready = undefined;
      throw e;
    });
  await ready;
}
export async function artworks(includeDrafts = false): Promise<Artwork[]> {
  await init();
  const rows = await db().execute(
    includeDrafts
      ? "SELECT * FROM artworks ORDER BY rowid"
      : "SELECT * FROM artworks WHERE published = 1 ORDER BY rowid",
  );
  return rows.rows.map((r) => ({
    ...JSON.parse(String(r.data)),
    status: r.status,
    published: !!r.published,
  }));
}
export async function artwork(id: string) {
  return (await artworks()).find((a) => a.id === id);
}
export type OrderInput = {
  artworkId: string;
  name: string;
  email: string;
  country: string;
  address: string;
  city: string;
  postal: string;
  phone?: string;
  region?: string;
};
export class StoreError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
// Guatemala is a DEMO shipping zone, not a verified real courier tariff.
export function needsQuote(country: string) {
  return country !== "GT";
}
export async function order(input: OrderInput, quoteOnly = false) {
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      return await createOrder(input, quoteOnly);
    } catch (e) {
      if (!(e instanceof Error) || !("code" in e) || e.code !== "SQLITE_BUSY")
        throw e;
      if (attempt === 5) throw new StoreError("busy", 503);
      await new Promise((resolve) => setTimeout(resolve, 25 * (attempt + 1)));
    }
  }
  throw new StoreError("busy", 503);
}
async function createOrder(input: OrderInput, quoteOnly = false) {
  await init();
  const id = randomUUID();
  const tx = await db().transaction("write");
  try {
    const found = await tx.execute({
      sql: "SELECT * FROM artworks WHERE id = ? AND published = 1",
      args: [input.artworkId],
    });
    const row = found.rows[0];
    if (!row) throw new StoreError("not_found", 404);
    if (row.status !== "available") throw new StoreError("unavailable", 409);
    const a: Artwork = JSON.parse(String(row.data));
    const status =
      quoteOnly || needsQuote(input.country) ? "quote_requested" : "demo_paid";
    // A write transaction serializes concurrent purchases of one original.
    if (status === "demo_paid")
      await tx.execute({
        sql: "UPDATE artworks SET status = 'sold' WHERE id = ?",
        args: [a.id],
      });
    const createdAt = new Date().toISOString();
    const data = {
      ...input,
      title: a.title,
      price: a.price,
      currency: "USD",
      mode: "demo",
      shipping: "not_booked",
    };
    await tx.execute({
      sql: "INSERT INTO orders VALUES (?, ?, ?, ?, ?)",
      args: [id, a.id, JSON.stringify(data), status, createdAt],
    });
    await tx.commit();
    return { id, status, price: a.price };
  } catch (e) {
    await tx.rollback();
    throw e;
  } finally {
    tx.close();
  }
}
export async function studioOrders() {
  await init();
  const r = await db().execute(
    "SELECT o.*, f.state AS fulfillment_state, f.data AS fulfillment_data FROM orders o LEFT JOIN fulfillment f ON f.order_id=o.id ORDER BY o.created_at DESC LIMIT 100",
  );
  return r.rows.map((row) => ({
    ...JSON.parse(String(row.data)),
    id: String(row.id),
    status: String(row.status),
    createdAt: String(row.created_at),
    fulfillmentState: row.fulfillment_state
      ? String(row.fulfillment_state)
      : undefined,
    tracking: row.fulfillment_data
      ? JSON.parse(String(row.fulfillment_data)).shipmentTrackingNumber
      : undefined,
  }));
}
export async function saveArtwork(a: Artwork) {
  await init();
  // Never let a stale editor resurrect a deleted original or reopen a sold one.
  const saved = await db().execute({
    sql: `INSERT INTO artworks VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET data=json_set(excluded.data,'$.photos',json(COALESCE(json_extract(artworks.data,'$.photos'),'[]')),'$.photoRevision',COALESCE(json_extract(artworks.data,'$.photoRevision'),0)), published=excluded.published`,
    args: [a.id, JSON.stringify(a), a.status, a.published ? 1 : 0],
  });
  if (saved.rowsAffected !== 1)
    throw new StoreError(
      "Artwork was permanently deleted. Reload the studio.",
      410,
    );
}

export async function deletableArtworkIds(): Promise<string[]> {
  await init();
  const result = await db().execute(
    "SELECT a.id FROM artworks a WHERE a.status != 'reserved' AND NOT EXISTS(SELECT 1 FROM orders o WHERE o.artwork_id=a.id)",
  );
  return result.rows.map((row) => String(row.id));
}

// Serialize the order check and deletion with checkout's write transaction.
export async function deleteArtwork(id: string, expectedTitle: string) {
  await init();
  for (let attempt = 0; attempt < 6; attempt++) {
    let tx: import("@libsql/client").Transaction | undefined;
    try {
      tx = await db().transaction("write");
      const found = await tx.execute({
        sql: "SELECT data,status FROM artworks WHERE id=?",
        args: [id],
      });
      const row = found.rows[0];
      if (!row) {
        const retired = await tx.execute({
          sql: "SELECT 1 FROM deleted_artwork_ids WHERE id=?",
          args: [id],
        });
        if (!retired.rows.length)
          throw new StoreError("Artwork not found.", 404);
        await tx.commit();
        return { id, alreadyDeleted: true };
      }
      if (JSON.parse(String(row.data)).title !== expectedTitle)
        throw new StoreError(
          "Artwork changed. Reload the studio before deleting.",
          409,
        );
      const ordered = await tx.execute({
        sql: "SELECT 1 FROM orders WHERE artwork_id=? LIMIT 1",
        args: [id],
      });
      if (ordered.rows.length)
        throw new StoreError(
          "An order exists for this artwork. Hide it from the gallery instead.",
          409,
        );
      if (row.status === "reserved")
        throw new StoreError(
          "A checkout is active. This artwork cannot be deleted.",
          409,
        );
      await tx.execute({
        sql: "INSERT INTO deleted_artwork_ids(id,deleted_at) VALUES (?,?)",
        args: [id, new Date().toISOString()],
      });
      await tx.execute({ sql: "DELETE FROM artworks WHERE id=?", args: [id] });
      // Preview customer collections share this DB. Other stores tolerate a missing catalog ID.
      const saved = await tx.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name='customer_saved'",
      );
      if (saved.rows.length)
        await tx.execute({
          sql: "DELETE FROM customer_saved WHERE artwork_id=?",
          args: [id],
        });
      await tx.commit();
      return { id, alreadyDeleted: false };
    } catch (error) {
      if (tx) await tx.rollback();
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "SQLITE_BUSY"
      ) {
        if (attempt < 5) {
          await new Promise((resolve) =>
            setTimeout(resolve, 25 * (attempt + 1)),
          );
          continue;
        }
        throw new StoreError("Studio is busy. Try deleting again.", 503);
      }
      throw error;
    } finally {
      tx?.close();
    }
  }
  throw new StoreError("Studio is busy. Try deleting again.", 503);
}
