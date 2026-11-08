import type { SocialRepository } from "./repository.ts";
import type { InventoryReader } from "./inventory.ts";
import { assertApproval } from "./approval.ts";
import { SocialError, type Platform } from "./types.ts";
export const instructions: Record<Platform, string> = {
  instagram:
    "Open Instagram as @larkova.art. Create a post/Reel using the downloaded original media in manifest order, paste caption.txt, check crop/colors and visibility, then post. Room mockups must remain labelled. Record the native link in Studio afterward.",
  facebook:
    "Switch to your explicitly chosen Facebook Page in Meta Business Suite. Create a Page post using the original media and caption; review the Page name, link and audience. Publish natively and record the link. Do not publish as a personal profile.",
  pinterest:
    "Open your Pinterest business account, choose the correct board, create an image/video Pin with the title, caption, alt text and verified public artwork URL. Check visibility. Trial API artifacts are creator-only and are not a substitute for native public posting.",
  tiktok:
    "Open TikTok and create a photo post or upload your own original video. Paste the caption, select permitted audio/visibility and review any required commercial-content disclosure. Finish posting in TikTok, then record the link. No private-tool Direct Post automation is enabled.",
};
export async function manualPackage(
  repo: SocialRepository,
  id: string,
  inventory: InventoryReader,
) {
  const t = await repo.getTarget(id);
  if (
    ![
      "approved",
      "manual_ready",
      "manually_reported",
      "scheduled",
      "queued",
    ].includes(t.status)
  )
    throw new SocialError(
      "approval_stale",
      "Approve the exact destination revision before exporting.",
      409,
    );
  const c = await assertApproval(repo, t, inventory);
  return {
    schemaVersion: 1,
    type: "manual-posting-package",
    platform: t.provider,
    status: "not_published_by_export",
    targetId: t.id,
    revision: t.revision,
    approvedHash: t.approvedHash,
    account: c.connection
      ? { id: c.connection.externalId, name: c.connection.displayName }
      : null,
    artwork: c.art
      ? {
          title: c.art.title,
          width: c.art.width,
          height: c.art.height,
          medium: c.art.medium,
          price: c.art.price,
          status: c.art.status,
        }
      : null,
    files: {
      "caption.txt": t.caption,
      "instructions.txt": instructions[t.provider],
      "manifest.json": {
        format: t.format,
        options: t.options,
        link: t.linkUrl,
        scheduledAt: t.scheduledAt,
        timezone: t.timezone,
        media: c.assets.map((a) => ({
          id: a.id,
          sha256: a.sha256,
          mime: a.mime,
          bytes: a.bytes,
          width: a.width,
          height: a.height,
          durationMs: a.durationMs,
          download: `/api/studio/social/assets/${a.id}/download`,
          publicUrl: a.apiReady ? a.url : null,
        })),
      },
    },
  };
}
