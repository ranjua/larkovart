import { timingSafeEqual, createHash } from "node:crypto";
import { socialRepository } from "@/lib/social/repository";
import { socialConfig } from "@/lib/social/config";
import { runSocialTick, scanInventory } from "@/lib/social/worker";
import { readInventory } from "@/lib/social/inventory";
import { socialJson, socialFailure } from "@/lib/social/auth";
import { SocialError } from "@/lib/social/types";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(request: Request) {
  try {
    const secret = process.env.SOCIAL_WORKER_SECRET,
      actual = request.headers.get("authorization") || "";
    if (
      !secret ||
      secret.length < 32 ||
      !timingSafeEqual(
        createHash("sha256").update(actual).digest(),
        createHash("sha256").update(`Bearer ${secret}`).digest(),
      )
    )
      throw new SocialError(
        "unauthorized",
        "Social worker authorization required.",
        401,
      );
    const config = socialConfig();
    if (config.mode !== "hosted" || !config.hostedVerified)
      throw new SocialError(
        "scheduler_inactive",
        "Hosted social scheduling is not configured and verified.",
        503,
      );
    const repo = socialRepository();
    await scanInventory(repo, readInventory);
    return socialJson(
      await runSocialTick(repo, readInventory, { mode: "hosted" }),
    );
  } catch (e) {
    return socialFailure(e);
  }
}
