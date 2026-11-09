import type { Client } from "@libsql/client";
export type SavedKind = "favorite" | "cart";
export async function savedIds(client: Client, userId: string) {
  const r = await client.execute({
    sql: "SELECT artwork_id,kind FROM customer_saved WHERE user_id=? ORDER BY created_at,artwork_id LIMIT 80",
    args: [userId],
  });
  return {
    favorites: r.rows
      .filter((r) => r.kind === "favorite")
      .map((r) => String(r.artwork_id)),
    cart: r.rows
      .filter((r) => r.kind === "cart")
      .map((r) => String(r.artwork_id)),
  };
}
export async function saveItem(
  client: Client,
  userId: string,
  kind: SavedKind,
  id: string,
  present: boolean,
) {
  if (present)
    await client.execute({
      sql: "INSERT INTO customer_saved(user_id,artwork_id,kind,created_at) SELECT ?,?,?,? WHERE (SELECT COUNT(*) FROM customer_saved WHERE user_id=? AND kind=?)<40 ON CONFLICT(user_id,artwork_id,kind) DO NOTHING",
      args: [userId, id, kind, new Date().toISOString(), userId, kind],
    });
  else
    await client.execute({
      sql: "DELETE FROM customer_saved WHERE user_id=? AND artwork_id=? AND kind=?",
      args: [userId, id, kind],
    });
  return savedIds(client, userId);
}
