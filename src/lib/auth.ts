import { cookies, headers } from "next/headers";
import {
  authScope,
  revokeStudioSession,
  validStudioSession,
  SESSION_LIFETIME,
} from "./studio-otp.ts";
export const sessionCookie = "larkovart_studio_otp";
export const challengeCookie = "larkovart_studio_challenge";
export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
};
export async function session() {
  const token = (await cookies()).get(sessionCookie)?.value;
  if (!token) return false;
  return validStudioSession(
    token,
    authScope((await headers()).get("host") || ""),
  );
}
export async function login(token: string) {
  const jar = await cookies();
  jar.set(sessionCookie, token, {
    ...cookieOptions,
    maxAge: SESSION_LIFETIME / 1000,
  });
  jar.delete(challengeCookie);
  jar.delete("larkovart_studio");
}
export async function logout() {
  const jar = await cookies();
  const token = jar.get(sessionCookie)?.value;
  if (token) await revokeStudioSession(token);
  jar.delete(sessionCookie);
  jar.delete(challengeCookie);
  jar.delete("larkovart_studio");
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const expected = new URL(request.url);
  expected.host = request.headers.get("host") || expected.host;
  if (process.env.VERCEL) {
    const protocol = request.headers.get("x-forwarded-proto");
    if (protocol === "https" || protocol === "http")
      expected.protocol = protocol;
  }
  return !!origin && origin === expected.origin;
}
