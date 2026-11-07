import { cookies } from "next/headers";
import {
  login,
  logout,
  sameOrigin,
  challengeCookie,
  cookieOptions,
} from "@/lib/auth";
import {
  authScope,
  OtpError,
  requestStudioCode,
  verifyStudioCode,
  OTP_LIFETIME,
} from "@/lib/studio-otp";
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return Response.json({ error: "invalid_origin" }, { status: 403 });
  try {
    const body = await request.text();
    if (body.length > 1024)
      return Response.json({ error: "invalid_request" }, { status: 400 });
    const input = JSON.parse(body);
    // No email address or password supplied by a caller can change the recipient or log in.
    if (
      !input ||
      typeof input !== "object" ||
      Object.keys(input).some((key) => !["action", "code"].includes(key))
    )
      return Response.json(
        { error: "Use the email sign-in code." },
        { status: 400 },
      );
    const scope = authScope(
      request.headers.get("host") || new URL(request.url).host,
    );
    const ip = process.env.VERCEL
      ? (
          request.headers.get("x-vercel-forwarded-for") ||
          request.headers.get("x-forwarded-for") ||
          "unknown"
        )
          .split(",")[0]
          .trim()
      : "local";
    if (input.action === "request") {
      const challenge = await requestStudioCode(scope, ip);
      (await cookies()).set(challengeCookie, challenge, {
        ...cookieOptions,
        maxAge: OTP_LIFETIME / 1000,
      });
      return Response.json(
        {
          ok: true,
          message: "Code sent to your admin email. It expires in 10 minutes.",
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    if (input.action === "verify" && typeof input.code === "string") {
      const challenge = (await cookies()).get(challengeCookie)?.value || "";
      const token = await verifyStudioCode(challenge, input.code, scope, ip);
      await login(token);
      return Response.json(
        { ok: true },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    return Response.json(
      { error: "Use the email sign-in code." },
      { status: 400 },
    );
  } catch (error) {
    if (error instanceof OtpError)
      return Response.json(
        { error: error.message },
        {
          status: error.status,
          headers: {
            "Cache-Control": "no-store",
            ...(error.status === 429 ? { "Retry-After": "60" } : {}),
          },
        },
      );
    return Response.json(
      { error: "Unable to sign in. Please try again." },
      { status: 400 },
    );
  }
}
export async function DELETE(request: Request) {
  if (!sameOrigin(request))
    return Response.json({ error: "invalid_origin" }, { status: 403 });
  await logout();
  return Response.json({ ok: true });
}
