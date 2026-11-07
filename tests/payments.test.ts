import { test } from "node:test";
import assert from "node:assert/strict";
import { StripeSandbox, PaypalSandbox } from "../src/lib/payments.ts";
test("Stripe rejects live keys and preserves amount, reference and idempotency", async () => {
  assert.throws(() => new StripeSandbox("sk_live_example"));
  const p = new StripeSandbox("sk_test_fixture", async (url, init) => {
    assert.ok(
      String(url).startsWith("https://api.stripe.com/v1/checkout/sessions"),
    );
    assert.equal(
      new Headers(init?.headers).get("Idempotency-Key"),
      "original-1",
    );
    const b = new URLSearchParams(String(init?.body));
    assert.equal(b.get("line_items[0][price_data][unit_amount]"), "7500");
    return Response.json({
      id: "cs_test_fixture",
      livemode: false,
      payment_status: "unpaid",
      amount_total: 7500,
      currency: "usd",
      metadata: { order_id: "original-1" },
      url: "https://checkout.stripe.com/test",
    });
  });
  const c = await p.create({
    orderId: "original-1",
    title: "Original",
    amount: 7500,
    returnUrl: "https://example.com/ok",
    cancelUrl: "https://example.com/cancel",
  });
  assert.equal(c.live_mode, false);
  assert.equal(c.total_in_cents, 7500);
  assert.equal(c.status, "unpaid");
});
test("Stripe refuses a live-mode response even with a test key", async () => {
  const p = new StripeSandbox("sk_test_fixture", async () =>
    Response.json({ livemode: true }),
  );
  await assert.rejects(p.get("cs_test_fixture"));
});
test("PayPal captures approved sandbox orders with a stable retry key and verifies capture amount", async () => {
  let captured = false;
  const p = new PaypalSandbox("fixture", "fixture", async (url, init) => {
    assert.equal(new URL(String(url)).hostname, "api-m.sandbox.paypal.com");
    if (String(url).endsWith("/oauth2/token"))
      return Response.json({ access_token: "fixture" });
    if (String(url).endsWith("/capture")) {
      assert.equal(
        new Headers(init?.headers).get("PayPal-Request-Id"),
        "capture-TESTORDER123",
      );
      captured = true;
      return Response.json({
        id: "TESTORDER123",
        status: "COMPLETED",
        purchase_units: [
          {
            custom_id: "original-1",
            payments: {
              captures: [
                {
                  status: "COMPLETED",
                  amount: { value: "75.00", currency_code: "USD" },
                },
              ],
            },
          },
        ],
      });
    }
    return Response.json({
      id: "TESTORDER123",
      status: "APPROVED",
      purchase_units: [
        {
          custom_id: "original-1",
          amount: { value: "75.00", currency_code: "USD" },
        },
      ],
    });
  });
  const c = await p.get("TESTORDER123", {
    orderId: "original-1",
    amount: 7500,
  });
  assert.equal(captured, true);
  assert.equal(c.status, "paid");
  assert.equal(c.total_in_cents, 7500);
  assert.equal(c.metadata?.order_id, "original-1");
});
