import {
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "node:crypto";
import { db } from "./store.ts";

export const ADMIN_EMAIL = "larkova.art@gmail.com";
export const OTP_LIFETIME = 10 * 60 * 1000;
export const SESSION_LIFETIME = 8 * 60 * 60 * 1000;
let ready: Promise<unknown> | undefined;
export function authHash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
export function authScope(host: string) {
  return `${process.env.VERCEL_ENV || "development"}:${host.toLowerCase()}`;
}
async function initAuth() {
  if (!ready)
    ready = db()
      .batch(
        [
          "CREATE TABLE IF NOT EXISTS studio_otp_challenges (id TEXT PRIMARY KEY, scope TEXT NOT NULL, code_hash TEXT NOT NULL, expires INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, used INTEGER NOT NULL DEFAULT 0)",
          "CREATE TABLE IF NOT EXISTS studio_otp_limits (id TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL)",
          "CREATE TABLE IF NOT EXISTS studio_otp_sessions (id TEXT PRIMARY KEY, scope TEXT NOT NULL, email TEXT NOT NULL, expires INTEGER NOT NULL)",
        ],
        "write",
      )
      .catch((error) => {
        ready = undefined;
        throw error;
      });
  await ready;
}
export class OtpError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}
function codeHash(challenge: string, code: string, scope: string) {
  const secret = process.env.RESEND_API_KEY;
  if (!secret)
    throw new OtpError(
      "Email sign-in needs connecting. Please contact the site administrator.",
      503,
    );
  return createHmac("sha256", secret)
    .update(`${scope}:${challenge}:${code}`)
    .digest("hex");
}
async function limit(key: string, window: number, max: number, now: number) {
  const bucket = Math.floor(now / window);
  const result = await db().execute({
    sql: "INSERT INTO studio_otp_limits(id,count,expires) VALUES (?,1,?) ON CONFLICT(id) DO UPDATE SET count=count+1 RETURNING count",
    args: [authHash(`${key}:${bucket}`), (bucket + 1) * window],
  });
  if (Number(result.rows[0]?.count) > max)
    throw new OtpError(
      "Too many attempts. Please wait before trying again.",
      429,
    );
}
async function cooldown(now: number) {
  const result = await db().execute({
    sql: "INSERT INTO studio_otp_limits(id,count,expires) VALUES ('admin-send-cooldown',1,?) ON CONFLICT(id) DO UPDATE SET expires=excluded.expires WHERE studio_otp_limits.expires <= ? RETURNING id",
    args: [now + 60000, now],
  });
  if (!result.rows.length)
    throw new OtpError(
      "Please wait 60 seconds before requesting another code.",
      429,
    );
}
export async function requestStudioCode(
  scope: string,
  ip: string,
  fetcher: typeof fetch = fetch,
  now = Date.now(),
) {
  if (!process.env.RESEND_API_KEY)
    throw new OtpError(
      "Email sign-in needs connecting. Please contact the site administrator.",
      503,
    );
  await initAuth();
  await limit(`send-ip:${ip}`, 15 * 60000, 10, now);
  await cooldown(now);
  await limit(`send-hour:${ADMIN_EMAIL}`, 3600000, 6, now);
  await limit(`send-day:${ADMIN_EMAIL}`, 86400000, 20, now);
  const challenge = randomBytes(32).toString("base64url");
  const code = String(randomInt(0, 1000000)).padStart(6, "0");
  const id = authHash(challenge);
  await db().execute({
    sql: "INSERT INTO studio_otp_challenges(id,scope,code_hash,expires) VALUES (?,?,?,?)",
    args: [id, scope, codeHash(challenge, code, scope), now + OTP_LIFETIME],
  });
  try {
    const response = await fetcher("https://api.resend.com/emails", {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(15000),
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `studio-otp-${id}`,
      },
      body: JSON.stringify({
        from:
          process.env.STUDIO_EMAIL_FROM ||
          "Larkova Art <onboarding@resend.dev>",
        to: [ADMIN_EMAIL],
        subject: "Your Larkova Art sign-in code",
        text: `Your Larkova Art admin sign-in code is ${code}.\n\nIt expires in 10 minutes and works once, in the browser where you requested it.\nSign-in site: ${scope.slice(scope.indexOf(":") + 1)}\n\nNever share this code. If you did not request it, ignore this email.`,
      }),
    });
    const result = await response.json();
    if (!response.ok || typeof result.id !== "string")
      throw new Error("Email not accepted");
  } catch {
    await db().execute({
      sql: "UPDATE studio_otp_challenges SET used=1 WHERE id=?",
      args: [id],
    });
    throw new OtpError(
      "Unable to confirm code delivery. Wait 60 seconds and request a new code.",
      502,
    );
  }
  // Only expired authentication records are removed; artwork and orders are untouched.
  await db().batch(
    [
      {
        sql: "DELETE FROM studio_otp_challenges WHERE expires < ?",
        args: [now - 86400000],
      },
      { sql: "DELETE FROM studio_otp_sessions WHERE expires < ?", args: [now] },
      {
        sql: "DELETE FROM studio_otp_limits WHERE expires < ?",
        args: [now - 86400000],
      },
    ],
    "write",
  );
  return challenge;
}
export async function verifyStudioCode(
  challenge: string,
  code: string,
  scope: string,
  ip: string,
  now = Date.now(),
) {
  await initAuth();
  await limit(`verify-ip:${ip}`, 15 * 60000, 30, now);
  if (!/^[A-Za-z0-9_-]{43}$/.test(challenge) || !/^\d{6}$/.test(code))
    throw new OtpError("Code invalid or expired. Request a new code.", 401);
  const id = authHash(challenge);
  const attempt = await db().execute({
    sql: "UPDATE studio_otp_challenges SET attempts=attempts+1 WHERE id=? AND scope=? AND used=0 AND attempts<5 AND expires>? RETURNING code_hash",
    args: [id, scope, now],
  });
  const expected = codeHash(challenge, code, scope);
  if (
    !attempt.rows.length ||
    !timingSafeEqual(
      Buffer.from(String(attempt.rows[0].code_hash)),
      Buffer.from(expected),
    )
  )
    throw new OtpError("Code invalid or expired. Request a new code.", 401);
  const token = randomBytes(32).toString("base64url");
  // An atomic conditional write lets only one concurrent verifier consume a code.
  const result = await db().execute({
    sql: "UPDATE studio_otp_challenges SET used=1 WHERE id=? AND scope=? AND used=0 AND expires>? RETURNING id",
    args: [id, scope, now],
  });
  if (!result.rows.length)
    throw new OtpError("Code already used. Request a new code.", 401);
  await db().execute({
    sql: "INSERT INTO studio_otp_sessions(id,scope,email,expires) VALUES (?,?,?,?)",
    args: [authHash(token), scope, ADMIN_EMAIL, now + SESSION_LIFETIME],
  });
  return token;
}
export async function validStudioSession(
  token: string,
  scope: string,
  now = Date.now(),
) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return false;
  await initAuth();
  const result = await db().execute({
    sql: "SELECT id FROM studio_otp_sessions WHERE id=? AND scope=? AND email=? AND expires>?",
    args: [authHash(token), scope, ADMIN_EMAIL, now],
  });
  return result.rows.length === 1;
}
export async function revokeStudioSession(token: string) {
  await initAuth();
  await db().execute({
    sql: "DELETE FROM studio_otp_sessions WHERE id=?",
    args: [authHash(token)],
  });
}
