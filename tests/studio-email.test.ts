import { test } from "node:test";
import assert from "node:assert/strict";
import { studioEmailHtml } from "../src/lib/studio-email.ts";
test("OTP email keeps the code readable and escapes the request host", () => {
  const html = studioEmailHtml("012345", '<script>alert("host")</script>');
  assert.ok(html.includes("012345"));
  assert.ok(html.includes("Expires in 10 minutes"));
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes("<img"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.throws(() => studioEmailHtml("not-a-code", "localhost"));
});
