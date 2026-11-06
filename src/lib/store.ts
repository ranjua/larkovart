import { createClient, type Client } from "@libsql/client";
import { mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { seedArtworks, type Artwork } from "./catalog.ts";

let client: Client | undefined;
let ready: Promise<void> | undefined;
export function db() {
  if (!client) {
    if (process.env.VERCEL && !process.env.DATABASE_URL)
      throw new Error(
        "Configure an isolated development database for Vercel previews.",
      );
    if (
      process.env.DATABASE_URL &&
      process.env.DATABASE_ENVIRONMENT !== "development"
    )
      throw new Error("Only development databases are permitted.");
    if (!process.env.DATABASE_URL) mkdirSync(".data", { recursive: true });
    client = createClient({
      url: process.env.DATABASE_URL || "file:.data/studio.db",
      authToken: process.env.DATABASE_AUTH_TOKEN,
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
export async function order(input: OrderInput) {
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      return await createOrder(input);
    } catch (e) {
      if (!(e instanceof Error) || !("code" in e) || e.code !== "SQLITE_BUSY")
        throw e;
      if (attempt === 5) throw new StoreError("busy", 503);
      await new Promise((resolve) => setTimeout(resolve, 25 * (attempt + 1)));
    }
  }
  throw new StoreError("busy", 503);
}
async function createOrder(input: OrderInput) {
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
    const status = needsQuote(input.country) ? "quote_requested" : "demo_paid";
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
    "SELECT * FROM orders ORDER BY created_at DESC LIMIT 100",
  );
  return r.rows.map((row) => ({
    ...JSON.parse(String(row.data)),
    id: String(row.id),
    status: String(row.status),
    createdAt: String(row.created_at),
  }));
}
export async function saveArtwork(a: Artwork) {
  await init();
  // Never let an edit silently reopen a sold original.
  await db().execute({
    sql: `INSERT INTO artworks VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET data=excluded.data, published=excluded.published`,
    args: [a.id, JSON.stringify(a), a.status, a.published ? 1 : 0],
  });
}
