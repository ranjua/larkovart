import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { socialRepository } from "@/lib/social/repository";
import { platformSchema } from "@/lib/social/validation";
import { finishOAuth, consumeState } from "@/lib/social/oauth";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  let result = "needs_connection";
  try {
    const provider = platformSchema.parse((await params).provider),
      url = new URL(request.url),
      binding =
        (await cookies()).get(`larkova_social_oauth_${provider}`)?.value || "",
      repo = socialRepository();
    if (url.searchParams.has("error")) {
      await consumeState(
        repo,
        provider,
        url.searchParams.get("state") || "",
        binding,
      );
      result = "denied";
    } else {
      await finishOAuth(
        repo,
        provider,
        url.searchParams.get("state") || "",
        binding,
        url.searchParams.get("code") || "",
      );
      result = "select_account";
    }
  } catch {
    result = "needs_connection";
  }
  // A same-origin document navigation restores the existing Strict Studio session after cross-site OAuth.
  const nonce = randomBytes(18).toString("base64"),
    destination = `/studio/social?connection=${result}`;
  return new Response(
    `<!doctype html><html><head><meta name="referrer" content="no-referrer"><title>Return to Larkova Studio</title></head><body><p>Connection ${result === "select_account" ? "received. Confirm your account in Studio." : "needs attention. Return to Studio to reconnect."}</p><a href="${destination}">Continue to Studio</a><script nonce="${nonce}">location.replace(${JSON.stringify(destination)});</script></body></html>`,
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
        "Content-Security-Policy": `default-src 'none'; script-src 'nonce-${nonce}'; base-uri 'none'; frame-ancestors 'none'`,
      },
    },
  );
}
