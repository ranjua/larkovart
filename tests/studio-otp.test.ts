import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
process.env.DATABASE_URL = `file:${join(mkdtempSync(join(tmpdir(), "larkova-otp-")), "test.db")}`;
process.env.DATABASE_ENVIRONMENT = "development";
process.env.RESEND_API_KEY = "re_test_unit_only";
const {
  requestStudioCode,
  verifyStudioCode,
  validStudioSession,
  revokeStudioSession,
  authHash,
  ADMIN_EMAIL,
  SESSION_LIFETIME,
} = await import("../src/lib/studio-otp.ts");
const { db } = await import("../src/lib/store.ts");
let code = "";
let deliveries = 0;
const mail: typeof fetch = async (url, init) => {
  assert.equal(url, "https://api.resend.com/emails");
  const body = JSON.parse(String(init?.body));
  assert.deepEqual(body.to, [ADMIN_EMAIL]);
  code = body.text.match(/code is (\d{6})/)[1];
  deliveries++;
  assert.ok(new Headers(init?.headers).get("Idempotency-Key"));
  return Response.json({ id: "test-email" });
};
const scope = "development:localhost:3210";
const start = 1800000000000;

test("OTP is private, browser-bound, single-use, atomic, and sessions expire/revoke", async () => {
  const challenge = await requestStudioCode(scope, "127.0.0.1", mail, start);
  const row = await db().execute("SELECT * FROM studio_otp_challenges");
  assert.equal(row.rows[0].id, authHash(challenge));
  assert.notEqual(row.rows[0].code_hash, code);
  assert.notEqual(row.rows[0].code_hash, authHash(code));
  const otherBrowser = "x".repeat(43);
  await assert.rejects(
    verifyStudioCode(otherBrowser, code, scope, "127.0.0.1", start + 1),
  );
  await assert.rejects(
    verifyStudioCode(
      challenge,
      code,
      "production:localhost:3210",
      "127.0.0.1",
      start + 1,
    ),
  );
  const verified = await Promise.allSettled([
    verifyStudioCode(challenge, code, scope, "127.0.0.1", start + 2),
    verifyStudioCode(challenge, code, scope, "127.0.0.1", start + 2),
  ]);
  assert.equal(verified.filter((r) => r.status === "fulfilled").length, 1);
  const token = (
    verified.find(
      (r) => r.status === "fulfilled",
    ) as PromiseFulfilledResult<string>
  ).value;
  assert.equal(await validStudioSession(token, scope, start + 3), true);
  assert.equal(await validStudioSession(token, "other", start + 3), false);
  assert.equal(
    await validStudioSession(token, scope, start + SESSION_LIFETIME + 3),
    false,
  );
  assert.equal(
    await validStudioSession("legacy.password.session", scope),
    false,
  );
  await revokeStudioSession(token);
  assert.equal(await validStudioSession(token, scope, start + 4), false);
});

test("resends are throttled, expired codes and five wrong attempts cannot log in", async () => {
  await assert.rejects(
    requestStudioCode(scope, "127.0.0.1", mail, start + 500),
    /60 seconds/,
  );
  const challenge = await requestStudioCode(
    scope,
    "127.0.0.1",
    mail,
    start + 61000,
  );
  const correct = code;
  for (let i = 0; i < 5; i++)
    await assert.rejects(
      verifyStudioCode(
        challenge,
        correct === "000000" ? "111111" : "000000",
        scope,
        "127.0.0.1",
        start + 62000,
      ),
    );
  await assert.rejects(
    verifyStudioCode(challenge, correct, scope, "127.0.0.1", start + 63000),
  );
  const expired = await requestStudioCode(
    scope,
    "127.0.0.1",
    mail,
    start + 122000,
  );
  await assert.rejects(
    verifyStudioCode(
      expired,
      code,
      scope,
      "127.0.0.1",
      start + 122000 + 600001,
    ),
  );
});

test("email outages fail closed and never return a usable challenge", async () => {
  const before = deliveries;
  await assert.rejects(
    requestStudioCode(
      scope,
      "127.0.0.1",
      async () => Response.json({ error: "blocked" }, { status: 403 }),
      start + 183000,
    ),
    /confirm code delivery/,
  );
  assert.equal(deliveries, before);
  const row = await db().execute(
    "SELECT used FROM studio_otp_challenges ORDER BY rowid DESC LIMIT 1",
  );
  assert.equal(row.rows[0].used, 1);
});

test("an absent email key disables sign-in", async () => {
  delete process.env.RESEND_API_KEY;
  await assert.rejects(
    requestStudioCode(scope, "127.0.0.1", mail, start + 244000),
    /needs connecting/,
  );
});
