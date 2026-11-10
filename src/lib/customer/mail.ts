import { createHash } from "node:crypto";
import { sendCustomerEmail } from "./email-delivery.ts";
import type { Client } from "@libsql/client";
export type CustomerMail = { email: string; code: string; purpose: string };
export type CustomerMailer = (input: CustomerMail) => Promise<void>;
const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function customerMailer(): CustomerMailer {
  return async ({ email, code, purpose }) => {
    if (!/^\d{6}$/.test(code))
      throw new Error("Customer email is not configured");
    const label =
      purpose === "email-verification"
        ? "Verify your email"
        : purpose === "forget-password"
          ? "Reset your password"
          : "Complete your sign-in";
    await sendCustomerEmail({
      to: email,
      subject: "Your Larkova Art account code",
      text: `Your Larkova Art account code is ${code}.\n\n${label}. It expires in 5 minutes. Never share this code. If you did not request it, ignore this email.`,
      html: `<!doctype html><html><body style="margin:0;background:#faf9f6;color:#222923;font-family:Arial,sans-serif"><main style="max-width:500px;margin:32px auto;padding:32px;background:white;border:1px solid #d8d8cd"><p style="font-family:Georgia,serif;font-size:36px;margin:0 0 28px">larkova</p><h1 style="font-size:25px;font-weight:500">Your collection awaits.</h1><p style="line-height:1.7">Use this private code for your Larkova Art account.</p><p style="padding:24px 12px;background:#eae5d9;font:36px monospace;letter-spacing:8px;text-align:center">${code}</p><p>${esc(label)} · Expires in 5 minutes</p><p style="font-size:13px;line-height:1.7">Never share this code. If you did not request it, ignore this email.</p></main></body></html>`,
    });
  };
}

// Run before entering Better Auth's transaction: a second write connection
// inside a verification mail callback would deadlock a local SQLite signup.
export async function customerEmailLimit(
  client: Client,
  email: string,
  purpose: string,
) {
  const key = createHash("sha256")
      .update(email.toLowerCase() + ":" + purpose)
      .digest("hex"),
    now = Date.now();
  const r = await client.execute({
    sql: "INSERT INTO customer_email_limits(id,count,started_at) VALUES (?,1,?) ON CONFLICT(id) DO UPDATE SET count=CASE WHEN started_at<? THEN 1 ELSE count+1 END,started_at=CASE WHEN started_at<? THEN excluded.started_at ELSE started_at END RETURNING count",
    args: [key, now, now - 60000, now - 60000],
  });
  if (Number(r.rows[0].count) > 3)
    throw new Error("Email requests temporarily limited");
}

export async function customerDailyEmailLimit(
  client: Client,
  now = Date.now(),
) {
  // Shared across instances: leave headroom below Gmail's personal-account limit.
  const global = await client.execute({
    sql: "INSERT INTO customer_email_limits(id,count,started_at) VALUES ('global-daily',1,?) ON CONFLICT(id) DO UPDATE SET count=CASE WHEN started_at<? THEN 1 ELSE count+1 END,started_at=CASE WHEN started_at<? THEN excluded.started_at ELSE started_at END RETURNING count",
    args: [now, now - 86400000, now - 86400000],
  });
  if (Number(global.rows[0].count) > 200)
    throw new Error("Email requests temporarily limited");
}
