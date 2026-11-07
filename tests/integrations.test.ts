import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { Webhook } from "svix";
import { RecurrenteSandbox } from "../src/lib/integrations/recurrente.ts";
import { DhlSandbox, type Parcel } from "../src/lib/integrations/dhl.ts";
import { verifyRecurrenteWebhook } from "../src/lib/integrations/webhook.ts";
const directory = mkdtempSync(join(tmpdir(), "larkovart-dev-integrations-"));
process.env.DATABASE_URL = `file:${join(directory, "test.db")}`;
process.env.DATABASE_ENVIRONMENT = "development";
process.env.APP_URL = "https://example-preview.vercel.app";
process.env.DHL_AUTO_BOOK_TEST = "false";
const store = await import("../src/lib/store.ts");
const commerce = await import("../src/lib/commerce.ts");
const { seedArtworks } = await import("../src/lib/catalog.ts");
after(() => {
  store.db().close();
  rmSync(directory, { recursive: true, force: true });
});
const buyer = {
  artworkId: "",
  name: "Test Collector",
  email: "collector@example.com",
  phone: "+15005550006",
  country: "US",
  city: "Test City",
  address: "100 Fictional Street",
  postal: "10001",
  region: "NY",
};
const parcel: Parcel = {
  length: 60,
  width: 60,
  height: 10,
  weight: 3,
  netWeight: 2,
  originCountry: "GT",
  hsCode: "970191",
  shippingBudget: 15000,
};
function fixture() {
  const checkouts = new Map<
    string,
    {
      id: string;
      status: string;
      live_mode: boolean;
      metadata: { order_id: string };
      total_in_cents: number;
      currency: string;
      checkout_url: string;
    }
  >();
  const calls: {
    url: string;
    method: string;
    body: Record<string, unknown>;
  }[] = [];
  let shipmentCount = 0;
  const payment = new RecurrenteSandbox(
    { key: "sk_test_unit_fixture", sandboxId: "sbx_unit" },
    async (url, init) => {
      const u = String(url);
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      assert.ok(u.startsWith("https://app.recurrente.com/api/"));
      calls.push({ url: u, method: init?.method || "GET", body });
      if (u.endsWith("/test"))
        return Response.json({
          environment: "sandbox",
          sandbox_id: "sbx_unit",
        });
      if (init?.method === "POST") {
        const id = `ch_${randomUUID()}`;
        const checkout = {
          id,
          status: "unpaid",
          live_mode: false,
          metadata: body.metadata,
          total_in_cents: body.items[0].amount_in_cents,
          currency: "USD",
          checkout_url: `https://app.recurrente.com/s/${id}`,
        };
        checkouts.set(id, checkout);
        return Response.json(checkout);
      }
      return Response.json(
        checkouts.get(decodeURIComponent(u.split("/").at(-1)!)),
      );
    },
  );
  const courier = new DhlSandbox(
    {
      username: "test-user",
      password: "test-password",
      account: "123456789",
      shipper: {
        name: "Development Studio",
        email: "studio@example.com",
        phone: "+50255550123",
        address: "Fictional studio address",
        city: "Guatemala City",
        postal: "01012",
        country: "GT",
      },
    },
    async (url, init) => {
      const u = String(url);
      assert.ok(u.startsWith("https://express.api.dhl.com/mydhlapi/test/"));
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      calls.push({ url: u, method: init?.method || "GET", body });
      if (u.endsWith("/rates"))
        return Response.json({
          products: [
            {
              productCode: "P",
              totalPrice: [{ priceCurrency: "USD", price: 75 }],
            },
          ],
        });
      if (u.endsWith("/shipments")) {
        shipmentCount++;
        return Response.json({
          shipmentTrackingNumber: "1234567890",
          dispatchConfirmationNumber: "TEST-PICKUP",
          documents: [
            {
              typeCode: "label",
              imageFormat: "PDF",
              content: Buffer.from("%PDF-test-fixture").toString("base64"),
            },
          ],
        });
      }
      return Response.json({ shipments: [{ status: "test" }] });
    },
  );
  return { payment, courier, calls, checkouts, shipments: () => shipmentCount };
}
async function newArt(id: string) {
  await store.saveArtwork({
    ...seedArtworks[0],
    id,
    status: "available",
    published: true,
    parcel,
  });
}
test("live payment keys are rejected before any request", () => {
  assert.throws(
    () =>
      new RecurrenteSandbox({
        key: "sk_live_forbidden",
        sandboxId: "sbx_unit",
      }),
    /sandbox_credentials_required/,
  );
});
test("environment mismatch prevents creating a checkout", async () => {
  const methods: string[] = [];
  const client = new RecurrenteSandbox(
    { key: "sk_test_unit", sandboxId: "sbx_unit" },
    async (_url, init) => {
      methods.push(init?.method || "GET");
      return Response.json({ environment: "live", sandbox_id: "sbx_unit" });
    },
  );
  await assert.rejects(
    () =>
      client.create({
        orderId: "unit",
        title: "Test",
        amount: 10000,
        returnUrl: process.env.APP_URL!,
        cancelUrl: process.env.APP_URL!,
      }),
    /sandbox_environment_mismatch/,
  );
  assert.deepEqual(methods, ["GET"]);
});
test("concurrent checkouts reserve one original and create one provider checkout", async () => {
  await newArt("reserve-unit");
  const f = fixture();
  const results = await Promise.allSettled([
    commerce.startSandboxCheckout(
      { ...buyer, artworkId: "reserve-unit" },
      "es",
      f,
    ),
    commerce.startSandboxCheckout(
      { ...buyer, artworkId: "reserve-unit" },
      "es",
      f,
    ),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(f.checkouts.size, 1);
  assert.equal((await store.artwork("reserve-unit"))?.status, "reserved");
});
test("payment is verified server-side, webhooks replay safely, and fulfillment is claimed once", async () => {
  await newArt("paid-unit");
  const f = fixture();
  const started = await commerce.startSandboxCheckout(
    { ...buyer, artworkId: "paid-unit" },
    "en",
    f,
  );
  assert.equal(await commerce.ownsOrder(started.id, started.token), true);
  assert.equal(await commerce.ownsOrder(started.id, "wrong-token"), false);
  const remote = [...f.checkouts.values()][0];
  remote.status = "paid";
  await commerce.receiveWebhook("msg_paid_unit", remote.id, f.payment);
  await commerce.receiveWebhook("msg_paid_unit", remote.id, f.payment);
  assert.equal((await commerce.orderState(started.id)).status, "sandbox_paid");
  assert.equal((await store.artwork("paid-unit"))?.status, "sold");
  await Promise.all([
    commerce.processFulfillment(started.id, f.courier),
    commerce.processFulfillment(started.id, f.courier),
  ]);
  assert.equal(f.shipments(), 1);
  const job = await store.db().execute({
    sql: "SELECT state, data FROM fulfillment WHERE order_id=?",
    args: [started.id],
  });
  assert.equal(job.rows[0].state, "test_booked");
  assert.equal(
    JSON.parse(String(job.rows[0].data)).dispatchConfirmationNumber,
    "TEST-PICKUP",
  );
  const request = f.calls.find((c) => c.url.endsWith("/shipments"))!.body as {
    pickup: { isRequested: boolean };
    content: { packages: { dimensions: { length: number } }[] };
  };
  assert.equal(request.pickup.isRequested, true);
  assert.equal(request.content.packages[0].dimensions.length, 60);
  const content = f.calls.find((c) => c.url.endsWith("/shipments"))!.body
    .content as { exportDeclarations: { lineItems: unknown[] }[] };
  assert.ok(
    Array.isArray(content.exportDeclarations),
    "MyDHL 3.4.1 requires an array of export declarations",
  );
  assert.equal(content.exportDeclarations[0].lineItems.length, 1);
});
test("expired provider checkouts release stock; redirects alone cannot mark it sold", async () => {
  await newArt("expiry-unit");
  const f = fixture();
  const started = await commerce.startSandboxCheckout(
    { ...buyer, artworkId: "expiry-unit" },
    "en",
    f,
  );
  assert.equal(
    await commerce.reconcilePayment(started.id, f.payment),
    "payment_pending",
  );
  assert.equal((await store.artwork("expiry-unit"))?.status, "reserved");
  [...f.checkouts.values()][0].status = "expired";
  assert.equal(
    await commerce.reconcilePayment(started.id, f.payment),
    "payment_expired",
  );
  assert.equal((await store.artwork("expiry-unit"))?.status, "available");
});
test("wrong amounts cannot sell the artwork or enqueue shipping", async () => {
  await newArt("amount-unit");
  const f = fixture();
  const started = await commerce.startSandboxCheckout(
    { ...buyer, artworkId: "amount-unit" },
    "en",
    f,
  );
  const remote = [...f.checkouts.values()][0];
  remote.status = "paid";
  remote.total_in_cents = 1;
  await assert.rejects(
    () => commerce.reconcilePayment(started.id, f.payment),
    /payment_amount_mismatch/,
  );
  assert.equal((await store.artwork("amount-unit"))?.status, "reserved");
  const jobs = await store.db().execute({
    sql: "SELECT * FROM fulfillment WHERE order_id=?",
    args: [started.id],
  });
  assert.equal(jobs.rows.length, 0);
});
test("uncertain checkout writes retain stock for review instead of overselling", async () => {
  await newArt("uncertain-unit");
  const f = fixture();
  f.payment.create = async () => {
    throw new Error("simulated timeout after provider write");
  };
  await assert.rejects(() =>
    commerce.startSandboxCheckout(
      { ...buyer, artworkId: "uncertain-unit" },
      "en",
      f,
    ),
  );
  assert.equal((await store.artwork("uncertain-unit"))?.status, "reserved");
  const orders = await store.studioOrders();
  assert.equal(
    orders.find((o) => o.artworkId === "uncertain-unit")?.status,
    "payment_setup_review",
  );
});
test("shipping cannot silently exceed its budget or invent a currency conversion", async () => {
  const f = fixture();
  assert.equal(
    await f.courier.includedService(
      buyer,
      { ...parcel, shippingBudget: 100 },
      42500,
    ),
    null,
  );
  await newArt("unpacked-unit");
  await store.saveArtwork({
    ...seedArtworks[0],
    id: "unpacked-unit",
    parcel: undefined,
  });
  await assert.rejects(
    () =>
      commerce.startSandboxCheckout(
        { ...buyer, artworkId: "unpacked-unit" },
        "en",
        f,
      ),
    /packed_measurements_required/,
  );
});
test("webhooks require valid raw-body signatures, fresh timestamps, and the expected sandbox", () => {
  const secret = `whsec_${Buffer.from("unit-test-signing-secret").toString("base64")}`;
  const webhook = new Webhook(secret);
  const id = "msg_signed_unit";
  const date = new Date();
  const raw = JSON.stringify({
    live_mode: false,
    sandbox_id: "sbx_unit",
    event_type: "intent.succeeded",
    checkout: { id: "ch_unit" },
  });
  const headers = new Headers({
    "svix-id": id,
    "svix-timestamp": String(Math.floor(date.getTime() / 1000)),
    "svix-signature": webhook.sign(id, date, raw),
  });
  assert.equal(
    verifyRecurrenteWebhook(raw, headers, secret, "sbx_unit").checkoutId,
    "ch_unit",
  );
  assert.throws(() =>
    verifyRecurrenteWebhook(raw + " ", headers, secret, "sbx_unit"),
  );
  assert.throws(() =>
    verifyRecurrenteWebhook(raw, headers, secret, "sbx_other"),
  );
  const live = JSON.stringify({ live_mode: true, sandbox_id: "sbx_unit" });
  headers.set("svix-signature", webhook.sign(id, date, live));
  assert.throws(() =>
    verifyRecurrenteWebhook(live, headers, secret, "sbx_unit"),
  );
  const old = new Date(Date.now() - 3_600_000);
  headers.set("svix-timestamp", String(Math.floor(old.getTime() / 1000)));
  headers.set("svix-signature", webhook.sign(id, old, raw));
  assert.throws(() =>
    verifyRecurrenteWebhook(raw, headers, secret, "sbx_unit"),
  );
});
test("an ambiguous courier result is not retried into a duplicate shipment", async () => {
  await newArt("courier-timeout-unit");
  const f = fixture();
  const started = await commerce.startSandboxCheckout(
    { ...buyer, artworkId: "courier-timeout-unit" },
    "en",
    f,
  );
  [...f.checkouts.values()][0].status = "paid";
  await commerce.reconcilePayment(started.id, f.payment);
  let attempts = 0;
  f.courier.shipment = async () => {
    attempts++;
    throw new Error("simulated timeout after label creation");
  };
  assert.equal(
    await commerce.processFulfillment(started.id, f.courier),
    "review_required",
  );
  assert.equal(
    await commerce.processFulfillment(started.id, f.courier),
    "already_claimed",
  );
  assert.equal(attempts, 1);
});

test("signed Sandbox events accept optional live-mode fields but reject explicit live payloads", () => {
  const secret =
    "whsec_" + Buffer.from("isolated-webhook-fixture-key").toString("base64");
  const wh = new Webhook(secret);
  const id = "msg_native_optional";
  const date = new Date();
  const check = (value: unknown) => {
    const raw = JSON.stringify(value);
    const headers = new Headers({
      "svix-id": id,
      "svix-timestamp": String(Math.floor(date.getTime() / 1000)),
      "svix-signature": wh.sign(id, date, raw),
    });
    return verifyRecurrenteWebhook(raw, headers, secret, "sbx_unit");
  };
  assert.equal(
    check({
      sandbox_id: "sbx_unit",
      event_type: "intent.pending",
      checkout: { id: "ch_fixture" },
    }).checkoutId,
    "ch_fixture",
  );
  assert.throws(() =>
    check({
      sandbox_id: "sbx_unit",
      checkout: { id: "ch_fixture", live_mode: true },
    }),
  );
  assert.throws(() =>
    check({ sandbox_id: "sbx_other", checkout: { id: "ch_fixture" } }),
  );
  assert.throws(() => check({ checkout: { id: "ch_fixture" } }));
});
