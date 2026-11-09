import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
const directory = mkdtempSync(join(tmpdir(), "larkova-art-delete-"));
process.env.DATABASE_URL = `file:${join(directory, "store.db")}`;
process.env.DATABASE_ENVIRONMENT = "development";
const store = await import("../src/lib/store.ts");
const { seedArtworks } = await import("../src/lib/catalog.ts");
const make = (id: string) => ({
  ...seedArtworks[0],
  id,
  title: id,
  status: "available" as const,
  published: true,
});
after(() => {
  store.db().close();
  rmSync(directory, { recursive: true, force: true });
});

test("permanent deletion removes only the requested record and saved references; retries are safe", async () => {
  const art = make("delete-me");
  await store.saveArtwork(art);
  await store
    .db()
    .execute(
      "CREATE TABLE customer_saved(user_id TEXT,artwork_id TEXT,kind TEXT)",
    );
  await store
    .db()
    .execute(
      "INSERT INTO customer_saved VALUES ('fixture','delete-me','favorite'),('fixture','atitlan','cart')",
    );
  assert.ok((await store.deletableArtworkIds()).includes(art.id));
  assert.deepEqual(await store.deleteArtwork(art.id, art.title), {
    id: art.id,
    alreadyDeleted: false,
  });
  assert.equal(await store.artwork(art.id), undefined);
  assert.equal(
    (
      await store
        .db()
        .execute({
          sql: "SELECT count(*) AS n FROM artworks WHERE id=?",
          args: [art.id],
        })
    ).rows[0].n,
    0,
  );
  assert.deepEqual(
    (
      await store.db().execute("SELECT artwork_id FROM customer_saved")
    ).rows.map((r) => r.artwork_id),
    ["atitlan"],
  );
  assert.deepEqual(await store.deleteArtwork(art.id, art.title), {
    id: art.id,
    alreadyDeleted: true,
  });
  await assert.rejects(
    () => store.deleteArtwork("never-existed", "unknown"),
    (e) => e instanceof store.StoreError && e.status === 404,
  );
  await assert.rejects(
    () => store.saveArtwork(art),
    (e) => e instanceof store.StoreError && e.status === 410,
  );
  const retired = await store.db().execute("SELECT * FROM deleted_artwork_ids");
  assert.deepEqual(retired.columns, ["id", "deleted_at"]);
  assert.ok(await store.artwork("atitlan"));
});

test("deleted seed artworks stay deleted across cold starts and legacy upserts", async () => {
  const art = seedArtworks.find((a) => a.id === "gato")!;
  await store.deleteArtwork(art.id, art.title);
  const old = await store
    .db()
    .execute({
      sql: "INSERT INTO artworks VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,published=excluded.published",
      args: [art.id, JSON.stringify(art), "available", 1],
    });
  assert.equal(old.rowsAffected, 0);
  const script =
    "import {init,db} from './src/lib/store.ts';await init();console.log((await db().execute(\"SELECT count(*) AS n FROM artworks WHERE id='gato'\")).rows[0].n);db().close();";
  const cold = spawnSync(
    process.execPath,
    ["--experimental-strip-types", "--input-type=module", "-e", script],
    { cwd: process.cwd(), env: process.env, encoding: "utf8" },
  );
  assert.equal(cold.status, 0, cold.stderr);
  assert.equal(cold.stdout.trim(), "0");
});

test("all order states protect originals, including quotes, canceled and older records", async () => {
  const states = [
    "quote_requested",
    "demo_paid",
    "payment_pending",
    "payment_setup_review",
    "canceled",
    "failed",
    "expired",
  ];
  for (const [i, status] of states.entries()) {
    const art = make("protected-" + i);
    await store.saveArtwork(art);
    await store
      .db()
      .execute({
        sql: "INSERT INTO orders VALUES (?,?,?,?,?)",
        args: ["order-" + i, art.id, "{}", status, "2000-01-01"],
      });
    await assert.rejects(
      () => store.deleteArtwork(art.id, art.title),
      (e) => e instanceof store.StoreError && e.status === 409,
    );
    assert.ok(await store.artwork(art.id));
    assert.ok(!(await store.deletableArtworkIds()).includes(art.id));
    await assert.rejects(() =>
      store
        .db()
        .execute({ sql: "DELETE FROM artworks WHERE id=?", args: [art.id] }),
    );
  }
  assert.equal(
    (await store.db().execute("SELECT count(*) AS n FROM orders")).rows[0].n,
    states.length,
  );
  const art = make("history-over-limit");
  await store.saveArtwork(art);
  await store
    .db()
    .execute({
      sql: "INSERT INTO orders VALUES (?,?,?,?,?)",
      args: ["old-order", art.id, "{}", "quote_requested", "1990-01-01"],
    });
  await store.db().batch(
    Array.from({ length: 105 }, (_, i) => ({
      sql: "INSERT INTO orders VALUES (?,?,?,?,?)",
      args: [
        "recent-" + i,
        "protected-0",
        "{}",
        "quote_requested",
        "2030-01-01",
      ],
    })),
    "write",
  );
  assert.ok(!(await store.studioOrders()).some((o) => o.id === "old-order"));
  assert.ok(!(await store.deletableArtworkIds()).includes(art.id));
  await assert.rejects(
    () => store.deleteArtwork(art.id, art.title),
    (e) => e instanceof store.StoreError && e.status === 409,
  );
});

test("active reservations and changed confirmation titles cannot be deleted", async () => {
  const reserved = {
    ...make("reserved-original"),
    status: "reserved" as const,
  };
  await store.saveArtwork(reserved);
  await assert.rejects(
    () => store.deleteArtwork(reserved.id, reserved.title),
    (e) => e instanceof store.StoreError && e.status === 409,
  );
  const art = make("renamed-original");
  await store.saveArtwork(art);
  await assert.rejects(
    () => store.deleteArtwork(art.id, "old title"),
    (e) => e instanceof store.StoreError && e.status === 409,
  );
  assert.ok(await store.artwork(art.id));
});

test("checkout and permanent deletion cannot both win the same original", async () => {
  for (let i = 0; i < 4; i++) {
    const art = make("racing-original-" + i);
    await store.saveArtwork(art);
    const checkout = () =>
      store.order(
        {
          artworkId: art.id,
          name: "Fixture",
          email: "fixture@example.test",
          country: "US",
          city: "Fixture",
          address: "Fixture",
          postal: "00000",
        },
        true,
      );
    const deletion = () => store.deleteArtwork(art.id, art.title);
    const results = await Promise.allSettled(
      i % 2 ? [deletion(), checkout()] : [checkout(), deletion()],
    );
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    const orders = await store
      .db()
      .execute({
        sql: "SELECT count(*) AS n FROM orders WHERE artwork_id=?",
        args: [art.id],
      });
    assert.equal(
      Boolean(await store.artwork(art.id)),
      Number(orders.rows[0].n) > 0,
    );
  }
});
