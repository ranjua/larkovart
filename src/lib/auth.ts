import { createHmac, timingSafeEqual, createHash } from "node:crypto";
import { cookies } from "next/headers";
const cookieName = "larkovart_studio";
function hash(s: string) {
  return createHash("sha256").update(s).digest();
}
export function checkPassword(password: string) {
  const secret = process.env.STUDIO_PASSWORD;
  return (
    !!secret &&
    secret.length >= 24 &&
    timingSafeEqual(hash(password), hash(secret))
  );
}
function signature(value: string) {
  return createHmac("sha256", process.env.STUDIO_PASSWORD || "")
    .update(value)
    .digest("hex");
}
export async function session() {
  if (!process.env.STUDIO_PASSWORD || process.env.STUDIO_PASSWORD.length < 24)
    return false;
  const token = (await cookies()).get(cookieName)?.value;
  if (!token) return false;
  const [expires, sig] = token.split(".");
  if (
    !expires ||
    !sig ||
    !/^\d+$/.test(expires) ||
    Number(expires) < Date.now()
  )
    return false;
  return timingSafeEqual(hash(sig), hash(signature(expires)));
}
export async function login() {
  const expires = String(Date.now() + 8 * 60 * 60 * 1000);
  (await cookies()).set(cookieName, `${expires}.${signature(expires)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 8 * 60 * 60,
  });
}
export async function logout() {
  (await cookies()).delete(cookieName);
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const expected = new URL(request.url);
  // Next's internal URL can use localhost even when the browser uses 127.0.0.1.
  // Compare the browser Origin against the actual HTTP Host, including its port.
  expected.host = request.headers.get("host") || expected.host;
  if (process.env.VERCEL) {
    const protocol = request.headers.get("x-forwarded-proto");
    if (protocol === "https" || protocol === "http") expected.protocol = protocol;
  }
  return !!origin && origin === expected.origin;
}
