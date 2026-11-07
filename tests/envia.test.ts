import { test } from "node:test";
import assert from "node:assert/strict";
import { EnviaSandbox } from "../src/lib/integrations/envia.ts";
const contact = {
  name: "Test Collector",
  email: "test@example.com",
  phone: "+50255550123",
  address: "Fictional address",
  city: "Guatemala",
  region: "GU",
  country: "GT",
  postal: "01012",
};
const parcel = {
  length: 62,
  width: 62,
  height: 14,
  weight: 4,
  netWeight: 1.2,
  originCountry: "GT",
  hsCode: "970199",
  shippingBudget: 2000,
};
const origin = {
  name: "Test Sender",
  phone: "+50255550123",
  street: "Fictional origin",
  city: "Guatemala",
  state: "GU",
  country: "GT",
  postalCode: "01012",
};
test("Envia compares Guatemala sandbox door-to-door quotes and preserves currency", async () => {
  const calls: string[] = [];
  const client = new EnviaSandbox("fixture", async (url, init) => {
    const u = new URL(String(url));
    calls.push(u.pathname);
    assert.ok(
      ["queries.test.envia.com", "api-test.envia.com"].includes(u.hostname),
    );
    assert.equal(
      new Headers(init?.headers).get("Authorization"),
      "Bearer fixture",
    );
    if (u.pathname === "/all-addresses")
      return Response.json({ data: [{ address_id: 1, address: origin }] });
    if (u.pathname.startsWith("/available-carrier/"))
      return Response.json({ data: [{ code: "cargoexpreso" }] });
    const b = JSON.parse(String(init?.body));
    assert.equal(b.packages[0].weight, 4);
    assert.equal(b.packages[0].dimensions.length, 62);
    assert.equal(b.settings.currency, "USD");
    return Response.json({
      data: [
        {
          carrier: "cargoexpreso",
          service: "standard",
          totalPrice: 45,
          currency: "GTQ",
          dropOff: 0,
        },
        {
          carrier: "cargoexpreso",
          service: "branch",
          totalPrice: 20,
          currency: "GTQ",
          dropOff: 2,
        },
      ],
    });
  });
  const rates = await client.quotes(contact, parcel, 10000);
  assert.equal(rates.length, 1);
  assert.equal(rates[0].amountCents, 4500);
  assert.equal(rates[0].currency, "GTQ");
  assert.equal(rates[0].service, "cargoexpreso|standard");
  assert.ok(!calls.includes("/ship/generate/"));
});
test("Envia refuses an absent or ambiguous sender instead of inventing a pickup address", async () => {
  const c = new EnviaSandbox("fixture", async () =>
    Response.json({ data: [] }),
  );
  await assert.rejects(
    c.quotes(contact, parcel, 10000),
    /envia_unique_guatemala_origin_required/,
  );
});
test("Envia checkpoints generated label before pickup and never recreates it on pickup timeout", async () => {
  let checkpoint = 0,
    generates = 0;
  const c = new EnviaSandbox("fixture", async (url, init) => {
    const u = new URL(String(url));
    if (u.pathname === "/all-addresses")
      return Response.json({ data: [{ address_id: 1, address: origin }] });
    if (u.pathname === "/ship/generate/") {
      generates++;
      return Response.json({
        data: [
          {
            carrier: "cargoexpreso",
            service: "standard",
            trackingNumber: "GT12345",
            label: "https://shipping.envia.com/test.pdf",
          },
        ],
      });
    }
    if (u.hostname === "shipping.envia.com") return new Response("%PDF-test");
    if (u.pathname === "/ship/pickup/") {
      assert.equal(checkpoint, 2);
      throw Error("timeout");
    }
    throw Error("Unexpected request");
  });
  const r = await c.shipment({
    orderId: "order-1",
    title: "Painting",
    receiver: contact,
    parcel,
    amount: 10000,
    service: "cargoexpreso|standard",
    checkpoint: async () => {
      checkpoint++;
    },
  });
  assert.equal(generates, 1);
  assert.equal(r.pickupState, "review_required");
  assert.equal(r.documents?.length, 1);
});
