import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const directory = mkdtempSync(join(tmpdir(), "larkovart-dev-test-"));
process.env.DATABASE_URL = `file:${join(directory, "test.db")}`;
process.env.DATABASE_ENVIRONMENT = "development";
const store = await import("../src/lib/store.ts");
const { seedArtworks } = await import("../src/lib/catalog.ts");
const buyer = {
  name: "Test Collector",
  email: "collector@example.com",
  country: "GT",
  address: "Test street 1",
  city: "Guatemala",
  postal: "01012",
};
after(() => {
  store.db().close();
  rmSync(directory, { recursive: true, force: true });
});
test("only one concurrent buyer can purchase an original", async () => {
  const results = await Promise.allSettled([
    store.order({ ...buyer, artworkId: "atitlan" }),
    store.order({ ...buyer, artworkId: "atitlan" }),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  const failure = results.find(
    (r) => r.status === "rejected",
  ) as PromiseRejectedResult;
  assert.equal(failure.reason.status, 409);
  assert.equal((await store.artwork("atitlan"))?.status, "sold");
  assert.equal(
    (await store.studioOrders()).filter((o) => o.artworkId === "atitlan")
      .length,
    1,
  );
});
test("international quote requests do not charge or consume stock", async () => {
  const r = await store.order({ ...buyer, country: "US", artworkId: "mar" });
  assert.equal(r.status, "quote_requested");
  assert.equal((await store.artwork("mar"))?.status, "available");
  const stored = (await store.studioOrders()).find((o) => o.id === r.id)!;
  assert.equal(stored.mode, "demo");
  assert.equal(stored.shipping, "not_booked");
});
test("sold originals cannot be bought or reopened by editing metadata", async () => {
  await assert.rejects(
    () => store.order({ ...buyer, artworkId: "peonea" }),
    (e) => e instanceof store.StoreError && e.status === 409,
  );
  const a = seedArtworks.find((a) => a.id === "peonea")!;
  await store.saveArtwork({ ...a, status: "available", price: 80000 });
  assert.equal((await store.artwork("peonea"))?.status, "sold");
});
test("drafts cannot be checked out until published", async () => {
  await store.saveArtwork({
    ...seedArtworks[0],
    id: "test-draft",
    status: "available",
    published: false,
  });
  assert.equal(await store.artwork("test-draft"), undefined);
  await assert.rejects(
    () => store.order({ ...buyer, artworkId: "test-draft" }),
    (e) => e instanceof store.StoreError && e.status === 404,
  );
  await store.saveArtwork({
    ...seedArtworks[0],
    id: "test-draft",
    status: "available",
    published: true,
  });
  assert.equal((await store.artwork("test-draft"))?.status, "available");
});
test("prices are taken from the catalog rather than the submitted order", async () => {
  const result = await store.order({
    ...buyer,
    artworkId: "gato",
    price: 1,
  } as Parameters<typeof store.order>[0]);
  assert.equal(result.price, 10000);
});
test("a local quote request never simulates payment or consumes the original", async () => {
  const result = await store.order({ ...buyer, artworkId: "mar" }, true);
  assert.equal(result.status, "quote_requested");
  assert.equal((await store.artwork("mar"))?.status, "available");
});
