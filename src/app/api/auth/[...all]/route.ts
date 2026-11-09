import { customerServer } from "@/lib/customer/server";
import { customerResponse } from "@/lib/customer/response";
import { customerEmailLimit } from "@/lib/customer/mail";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function handle(request: Request) {
  try {
    const path = new URL(request.url).pathname.replace(/^\/api\/auth/, "");
    const postAllowed = new Set([
      "/sign-up/email",
      "/sign-in/email",
      "/sign-in/social",
      "/sign-out",
      "/email-otp/send-verification-otp",
      "/email-otp/verify-email",
      "/email-otp/request-password-reset",
      "/email-otp/reset-password",
      "/two-factor/enable",
      "/two-factor/disable",
      "/two-factor/send-otp",
      "/two-factor/verify-otp",
      "/change-password",
      "/link-social",
      "/delete-user",
    ]);
    let emailForLimit: string | undefined;
    let emailPurpose = "verification";
    if (request.method === "POST") {
      if (!postAllowed.has(path))
        return Response.json(
          { message: "Use the available account controls." },
          { status: 404 },
        );
      const reader = request.body?.getReader();
      let bytes = 0;
      const chunks: Uint8Array[] = [];
      if (reader)
        try {
          for (;;) {
            const r = await reader.read();
            if (r.done) break;
            bytes += r.value.byteLength;
            if (bytes > 32768)
              return Response.json(
                { message: "Request too large" },
                { status: 413 },
              );
            chunks.push(r.value);
          }
        } finally {
          await reader.cancel().catch(() => {});
        }
      const body = Buffer.concat(chunks).toString("utf8");
      let parsed;
      try {
        parsed = JSON.parse(body);
      } catch {
        return Response.json({ message: "Invalid request." }, { status: 400 });
      }
      if (path === "/two-factor/enable" && parsed.method !== "otp")
        return Response.json(
          { message: "Choose email verification." },
          { status: 422 },
        );
      if (
        path === "/email-otp/send-verification-otp" &&
        parsed.type !== "email-verification"
      )
        return Response.json(
          { message: "Use password sign-in or password recovery." },
          { status: 422 },
        );
      if (
        [
          "/sign-up/email",
          "/email-otp/send-verification-otp",
          "/email-otp/request-password-reset",
        ].includes(path) &&
        typeof parsed?.email === "string" &&
        parsed.email.length <= 254
      ) {
        emailForLimit = parsed.email.trim().toLowerCase();
        if (path.includes("password-reset")) emailPurpose = "recovery";
      }
      request = new Request(request, { body });
    } else if (
      ![
        "/get-session",
        "/ok",
        "/callback/google",
        "/error",
        "/verify-email",
      ].includes(path)
    )
      return Response.json({ message: "Not found" }, { status: 404 });

    const s = customerServer();
    await s.ready();
    if (emailForLimit) {
      try {
        await customerEmailLimit(s.client, emailForLimit, emailPurpose);
      } catch {
        return Response.json(
          { message: "Email requests temporarily limited." },
          { status: 429, headers: { "Cache-Control": "no-store" } },
        );
      }
    }
    const response = await s.auth.handler(request);
    return await customerResponse(response);
  } catch {
    return Response.json(
      { message: "Account service is temporarily unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
export const GET = handle;
export const POST = handle;
