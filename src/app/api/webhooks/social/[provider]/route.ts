import { boundedBody } from "@/lib/social/body";
import { timingSafeEqual, createHash } from "node:crypto";
import { platformSchema } from "@/lib/social/validation";
import { socialRepository } from "@/lib/social/repository";
import { receiveMetaEvent } from "@/lib/social/webhooks";
import { socialFailure, socialJson } from "@/lib/social/auth";
import { SocialError } from "@/lib/social/types";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  try {
    const p = platformSchema.parse((await params).provider),
      u = new URL(request.url),
      secret = process.env.SOCIAL_META_WEBHOOK_VERIFY_TOKEN;
    if (!["instagram", "facebook"].includes(p) || !secret)
      throw new SocialError(
        "not_configured",
        "Webhook verification is not configured.",
        503,
      );
    const supplied = u.searchParams.get("hub.verify_token") || "";
    if (
      u.searchParams.get("hub.mode") !== "subscribe" ||
      !timingSafeEqual(
        createHash("sha256").update(secret).digest(),
        createHash("sha256").update(supplied).digest(),
      )
    )
      throw new SocialError(
        "unauthorized",
        "Webhook verification failed.",
        403,
      );
    const challenge = u.searchParams.get("hub.challenge");
    if (!challenge || !/^\d{1,100}$/.test(challenge))
      throw new SocialError(
        "validation_failed",
        "Invalid verification challenge.",
        400,
      );
    return new Response(challenge, {
      headers: { "Cache-Control": "no-store", "Content-Type": "text/plain" },
    });
  } catch (e) {
    return socialFailure(e);
  }
}
export async function POST(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  try {
    const raw = await boundedBody(request, 262144);
    return socialJson(
      await receiveMetaEvent(
        socialRepository(),
        platformSchema.parse((await params).provider),
        raw,
        request.headers.get("x-hub-signature-256"),
      ),
    );
  } catch (e) {
    return socialFailure(e);
  }
}
