import { boundedBody } from "@/lib/social/body";
import { platformSchema } from "@/lib/social/validation";
import { socialRepository } from "@/lib/social/repository";
import { deleteProviderData } from "@/lib/social/webhooks";
import { socialConfig } from "@/lib/social/config";
import { socialFailure, socialJson } from "@/lib/social/auth";
import { SocialError } from "@/lib/social/types";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  try {
    const raw = (await boundedBody(request, 8192)).toString("utf8");
    const signed = new URLSearchParams(raw).get("signed_request");
    if (!signed)
      throw new SocialError(
        "unauthorized",
        "Signed platform request required.",
        403,
      );
    const origin = socialConfig().origin;
    if (!origin)
      throw new SocialError(
        "not_configured",
        "A canonical callback origin is required.",
        503,
      );
    const result = await deleteProviderData(
      socialRepository(),
      platformSchema.parse((await params).provider),
      signed,
    );
    return socialJson({
      url: `${origin}/social/data-deletion/status/${result.confirmationCode}`,
      confirmation_code: result.confirmationCode,
    });
  } catch (e) {
    return socialFailure(e);
  }
}
