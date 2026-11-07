import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { ShippingBroker } from "../src/lib/shipping.ts";
import { ForzaSandbox } from "../src/lib/integrations/forza.ts";
import { FedexSandbox } from "../src/lib/integrations/fedex.ts";
import type {
  CourierAdapter,
  ShipmentInput,
} from "../src/lib/shipping-types.ts";
const sender = {
  name: "Test Studio",
  email: "studio@example.com",
  phone: "+50255550123",
  address: "Fictional address 12",
  city: "Guatemala City",
  postal: "01012",
  country: "GT",
};
const receiver = {
  ...sender,
  name: "Test Collector",
  city: "Guatemala",
  region: "Guatemala",
};
const parcel = {
  length: 80,
  width: 80,
  height: 12,
  weight: 3,
  netWeight: 2,
  originCountry: "GT",
  hsCode: "970191",
  shippingBudget: 5000,
};
const input: ShipmentInput = {
  orderId: "test-order",
  title: "Original painting",
  amount: 20000,
  receiver,
  parcel,
  service: "STD",
};
function adapter(
  id: "forza" | "dhl" | "fedex",
  cents: number,
  currency: "USD" | "GTQ" = "USD",
): CourierAdapter {
  return {
    id,
    supports: () => true,
    quotes: async () => [
      { carrier: id, service: "STD", amountCents: cents, currency },
    ],
    shipment: async () => ({ shipmentTrackingNumber: "test" }),
    tracking: async () => ({}),
  };
}
test("broker compares currencies safely and survives a quote outage", async () => {
  const broken = adapter("fedex", 1);
  broken.quotes = async () => {
    throw Error("offline");
  };
  const providers = [
    adapter("forza", 8000, "GTQ"),
    adapter("dhl", 2000),
    broken,
  ];
  assert.equal(
    await new ShippingBroker(providers).includedService(
      receiver,
      parcel,
      20000,
    ),
    "dhl:STD",
  );
  assert.equal(
    await new ShippingBroker(providers, 8).includedService(
      receiver,
      parcel,
      20000,
    ),
    "forza:STD",
  );
  assert.equal(
    await new ShippingBroker([adapter("dhl", 6000)]).includedService(
      receiver,
      parcel,
      20000,
    ),
    null,
  );
});
test("broker never switches carriers after an ambiguous shipment write", async () => {
  let writes = 0;
  const first = adapter("forza", 100),
    second = adapter("dhl", 200);
  first.shipment = async () => {
    writes++;
    throw Error("timeout");
  };
  second.shipment = async () => {
    writes++;
    return { shipmentTrackingNumber: "wrong" };
  };
  await assert.rejects(
    new ShippingBroker([first, second]).shipment({
      ...input,
      service: "forza:STD",
    }),
  );
  assert.equal(writes, 1);
});
test("Forza signs exact payload, uses pounds, excludes COD, preserves label on pickup failure", async () => {
  const secret = "fictional-test-secret-32-characters";
  const calls: string[] = [];
  let checkpoint = false;
  const client = new ForzaSandbox(
    {
      codApp: "test",
      secret,
      merchantId: 1,
      pickupPointId: 2,
      shipper: sender,
    },
    async (url, init) => {
      assert.ok(
        String(url).startsWith(
          "https://sandbox.apicore.forzadelivery.io:40467/",
        ),
      );
      const envelope = JSON.parse(String(init?.body));
      const raw = Buffer.from(envelope.PayLoad, "base64").toString();
      assert.equal(
        new Headers(init?.headers).get("LauValue"),
        createHmac("sha256", secret).update(raw).digest("base64"),
      );
      const { Method, Params } = JSON.parse(raw);
      calls.push(Method);
      let result: object;
      if (Method === "GetListTownshipByHeaderCode")
        result = {
          ObjectValue: {
            TownshipByHeaderCodes: [
              {
                HeaderCodeTownship: "1",
                TownshipName: "Guatemala",
                ProvinceName: "Guatemala",
              },
            ],
          },
        };
      else if (Method === "GetShippingRatesByHeaderCode") {
        assert.equal(Params.parcels[0].weight, 7);
        assert.equal(Params.parcels[0].length, 80);
        result = {
          ShippingRates: [
            { ServiceShortName: "COD", Price: "1", Currency: "(Q.)" },
            { ServiceShortName: "STD", Price: "35", Currency: "(Q.)" },
          ],
        };
      } else if (Method === "GetServiceByHeaderCodeRequest") {
        assert.equal(Params.COD.CashOnDelivery, false);
        result = { ObjectValue: [{ TrackingNumber: "FD123456", PDF: "cGRm" }] };
      } else {
        assert.equal(checkpoint, true);
        throw Error("pickup timeout");
      }
      return Response.json({
        CodApp: "test",
        PayLoad: Buffer.from(
          JSON.stringify({ Method, StatusCode: 200, ...result }),
        ).toString("base64"),
      });
    },
  );
  assert.deepEqual(await client.quotes(receiver, parcel, 20000), [
    { carrier: "forza", service: "STD", amountCents: 3500, currency: "GTQ" },
  ]);
  const shipment = await client.shipment({
    ...input,
    checkpoint: async (s) => {
      checkpoint = true;
      assert.equal(s.shipmentTrackingNumber, "FD123456");
    },
  });
  assert.equal(shipment.pickupState, "review_required");
  assert.equal(shipment.documents?.[0].content, "cGRm");
  assert.equal(
    calls.filter((c) => c === "GetServiceByHeaderCodeRequest").length,
    1,
  );
});
test("FedEx quotes validate service without buying a label; token reused; pickup failure retains label", async () => {
  const calls: string[] = [];
  let checkpoint = false;
  const client = new FedexSandbox(
    {
      clientId: "test",
      clientSecret: "test",
      account: "123456789",
      shipper: sender,
    },
    async (url, init) => {
      const path = new URL(String(url)).pathname;
      calls.push(path);
      assert.equal(new URL(String(url)).hostname, "apis-sandbox.fedex.com");
      if (path === "/oauth/token")
        return Response.json({ access_token: "test-token", expires_in: 3600 });
      assert.equal(
        new Headers(init?.headers).get("Authorization"),
        "Bearer test-token",
      );
      if (path === "/rate/v1/rates/quotes")
        return Response.json({
          output: {
            rateReplyDetails: [
              {
                serviceType: "INTERNATIONAL_PRIORITY",
                ratedShipmentDetails: [{ totalNetCharge: 30, currency: "USD" }],
              },
            ],
          },
        });
      if (path.endsWith("/validate")) return Response.json({ output: {} });
      if (path === "/ship/v1/shipments")
        return Response.json({
          output: {
            transactionShipments: [
              {
                pieceResponses: [
                  {
                    trackingNumber: "123456789012",
                    packageDocuments: [
                      {
                        contentType: "LABEL",
                        docType: "PDF",
                        encodedLabel: "cGRm",
                      },
                    ],
                  },
                ],
              },
            ],
          },
        });
      if (path === "/pickup/v1/pickups") {
        assert.equal(checkpoint, true);
        throw Error("pickup unavailable");
      }
      throw Error("unexpected call");
    },
  );
  const us = {
    ...receiver,
    country: "US",
    city: "New York",
    region: "NY",
    postal: "10001",
  };
  const quotes = await client.quotes(us, parcel, 20000);
  assert.equal(quotes[0].amountCents, 3000);
  assert.equal(calls.includes("/ship/v1/shipments"), false);
  const shipment = await client.shipment({
    ...input,
    receiver: us,
    service: quotes[0].service,
    checkpoint: async () => {
      checkpoint = true;
    },
  });
  assert.equal(shipment.pickupState, "review_required");
  assert.equal(shipment.shipmentTrackingNumber, "123456789012");
  assert.equal(calls.filter((p) => p === "/oauth/token").length, 1);
});
