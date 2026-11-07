import { test } from "node:test";
import assert from "node:assert/strict";
import { RecurrenteSandbox } from "../src/lib/integrations/recurrente.ts";
test("Recurrente refunds only a verified matching sandbox checkout with a stable idempotency key", async () => {
  let writes = 0;
  const p = new RecurrenteSandbox(
    { key: "sk_test_fixture", sandboxId: "sbx_fixture" },
    async (url, init) => {
      const path = new URL(String(url)).pathname;
      if (path.endsWith("/test"))
        return Response.json({
          environment: "sandbox",
          sandbox_id: "sbx_fixture",
        });
      if (path.endsWith("/checkouts/ch_fixture"))
        return Response.json({
          id: "ch_fixture",
          status: "paid",
          live_mode: false,
          total_in_cents: 100,
          currency: "USD",
          metadata: { order_id: "test-id" },
          latest_intent: { id: "in_fixture" },
        });
      if (path.endsWith("/refunds")) {
        writes++;
        assert.equal(
          new Headers(init?.headers).get("Idempotency-Key"),
          "refund-test-id",
        );
        assert.deepEqual(JSON.parse(String(init?.body)), {
          intent_id: "in_fixture",
        });
        return Response.json({ id: "re_fixture", status: "succeeded" });
      }
      throw Error("Unexpected call");
    },
  );
  await assert.rejects(
    p.refundCheckout({
      checkoutId: "ch_fixture",
      orderId: "wrong",
      amount: 100,
      idempotencyKey: "refund-test-id",
    }),
  );
  assert.equal(writes, 0);
  await assert.rejects(
    p.refundCheckout({
      checkoutId: "ch_fixture",
      orderId: "test-id",
      amount: 200,
      idempotencyKey: "refund-test-id",
    }),
  );
  assert.equal(writes, 0);
  const refund = await p.refundCheckout({
    checkoutId: "ch_fixture",
    orderId: "test-id",
    amount: 100,
    idempotencyKey: "refund-test-id",
  });
  assert.equal(refund.status, "succeeded");
  assert.equal(writes, 1);
});
