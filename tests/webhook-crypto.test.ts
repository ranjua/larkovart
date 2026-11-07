import { test } from "node:test";
import assert from "node:assert/strict";
import {
  sealWebhookSecret,
  openWebhookSecret,
} from "../src/lib/integrations/webhook-crypto.ts";
test("stored webhook secrets are authenticated, encrypted and unique", () => {
  const a = sealWebhookSecret("private-signing-secret", "test-key"),
    b = sealWebhookSecret("private-signing-secret", "test-key");
  assert.notEqual(a, b);
  assert.ok(!a.includes("private-signing-secret"));
  assert.equal(openWebhookSecret(a, "test-key"), "private-signing-secret");
  assert.throws(() => openWebhookSecret(a, "wrong-key"));
  const j = JSON.parse(a);
  j.data = Buffer.from("tampered").toString("base64");
  assert.throws(() => openWebhookSecret(JSON.stringify(j), "test-key"));
});
