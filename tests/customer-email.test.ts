import { test } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@libsql/client";
import {
  customerEmailDeliveryConfig,
  sendCustomerEmail,
  GMAIL_ADDRESS,
} from "../src/lib/customer/email-delivery.ts";
import { customerDailyEmailLimit } from "../src/lib/customer/mail.ts";
import { customerConfig } from "../src/lib/customer/config.ts";

test("Gmail activates only with a valid dedicated credential and keeps customer auth gating", async () => {
  process.env.CUSTOMER_EMAIL_PROVIDER = "gmail";
  process.env.CUSTOMER_AUTH_SECRET =
    "test-secret-that-is-at-least-32-characters";
  process.env.CUSTOMER_AUTH_ORIGIN = "http://localhost:3000";
  delete process.env.GMAIL_APP_PASSWORD;
  assert.equal(customerConfig().emailReady, false);
  process.env.GMAIL_APP_PASSWORD = "normal-password";
  assert.equal(customerConfig().emailReady, false);
  process.env.GMAIL_APP_PASSWORD = "abcd efgh ijkl mnop";
  assert.equal(customerEmailDeliveryConfig().ready, true);
  assert.equal(customerConfig().emailReady, true);
  delete process.env.CUSTOMER_AUTH_SECRET;
  assert.equal(customerConfig().emailReady, false);
});

test("Gmail uses the fixed sender, requires recipient acceptance and never falls back on failure", async () => {
  process.env.CUSTOMER_EMAIL_PROVIDER = "gmail";
  process.env.GMAIL_APP_PASSWORD = "abcdefghijklmnop";
  const message = {
    to: "collector@example.test",
    subject: "Code",
    text: "Private",
    html: "<p>Private</p>",
  };
  let calls = 0;
  const fetcher: typeof fetch = async () => {
    throw new Error("Unexpected fallback");
  };
  await sendCustomerEmail(message, {
    fetcher,
    gmailSend: async (mail) => {
      calls++;
      assert.equal(mail.from, `Larkova Art <${GMAIL_ADDRESS}>`);
      assert.deepEqual(mail.envelope, {
        from: GMAIL_ADDRESS,
        to: [message.to],
      });
      assert.equal(mail.disableFileAccess, true);
      assert.equal(mail.disableUrlAccess, true);
      assert.equal(JSON.stringify(mail).includes("abcdefghijklmnop"), false);
      return { accepted: [message.to], rejected: [] };
    },
  });
  assert.equal(calls, 1);
  for (const fail of [
    async () => {
      throw new Error("SMTP credentials abcdefghijklmnop");
    },
    async () => ({ accepted: [], rejected: [message.to] }),
  ]) {
    await assert.rejects(
      sendCustomerEmail(message, { fetcher, gmailSend: fail }),
      (error: Error) =>
        error.message === "Customer email delivery was not accepted",
    );
  }
  await assert.rejects(
    sendCustomerEmail({ ...message, to: "one@example.test,two@example.test" }),
  );
  await assert.rejects(
    sendCustomerEmail({
      ...message,
      subject: "Code\r\nBcc: other@example.test",
    }),
  );
});

test("Resend remains available when selected and unknown providers fail closed", async () => {
  process.env.CUSTOMER_EMAIL_PROVIDER = "resend";
  process.env.RESEND_API_KEY = "test-only";
  process.env.CUSTOMER_EMAIL_FROM = "Larkova <art@example.test>";
  await sendCustomerEmail(
    {
      to: "collector@example.test",
      subject: "Code",
      text: "Private",
      html: "<p>Private</p>",
    },
    {
      fetcher: async (url, init) => {
        assert.equal(url, "https://api.resend.com/emails");
        assert.deepEqual(JSON.parse(String(init?.body)).to, [
          "collector@example.test",
        ]);
        assert.ok(new Headers(init?.headers).get("Idempotency-Key"));
        return Response.json({ id: "test-email" });
      },
    },
  );
  process.env.CUSTOMER_EMAIL_PROVIDER = "typo";
  assert.equal(customerEmailDeliveryConfig().ready, false);
});

test("daily budget is shared, atomic and resets after 24 hours", async () => {
  const client = createClient({ url: ":memory:" });
  try {
    await client.execute(
      "CREATE TABLE customer_email_limits(id TEXT PRIMARY KEY,count INTEGER,started_at INTEGER)",
    );
    const now = 1800000000000;
    for (let i = 0; i < 199; i++) await customerDailyEmailLimit(client, now);
    const attempts = await Promise.allSettled([
      customerDailyEmailLimit(client, now),
      customerDailyEmailLimit(client, now),
    ]);
    assert.equal(attempts.filter((x) => x.status === "fulfilled").length, 1);
    await assert.rejects(customerDailyEmailLimit(client, now));
    await customerDailyEmailLimit(client, now + 86400001);
    assert.equal(
      (await client.execute("SELECT count FROM customer_email_limits")).rows[0]
        .count,
      1,
    );
  } finally {
    client.close();
  }
});
