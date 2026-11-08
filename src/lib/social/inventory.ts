import type { Artwork } from "../catalog.ts";
import { hash, stable } from "./crypto.ts";
import { db } from "../store.ts";
export type InventoryReader = (id: string) => Promise<Artwork | null>;
export const readInventory: InventoryReader = async (id) => {
  try {
    const r = await db().execute({
      sql: "SELECT data,status,published FROM artworks WHERE id=?",
      args: [id],
    });
    if (!r.rows[0]) return null;
    return {
      ...JSON.parse(String(r.rows[0].data)),
      status: r.rows[0].status,
      published: !!r.rows[0].published,
    };
  } catch {
    return null;
  }
};
export function inventoryFingerprint(a: Artwork | null) {
  return a
    ? hash(
        stable({
          id: a.id,
          title: a.title,
          price: a.price,
          medium: a.medium,
          width: a.width,
          height: a.height,
          year: a.year,
          status: a.status,
          published: a.published,
        }),
      )
    : null;
}
