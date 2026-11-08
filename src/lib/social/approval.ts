import { hash, stable } from "./crypto.ts";
import { socialConfig } from "./config.ts";
import { inventoryFingerprint, type InventoryReader } from "./inventory.ts";
import {
  SocialError,
  type Asset,
  type Target,
  type Connection,
  type Post,
} from "./types.ts";
import { SocialRepository, writeTarget } from "./repository.ts";
export const terminal = [
  "published",
  "test_completed",
  "manually_reported",
  "canceled",
  "awaiting_creator",
];
export function validateFormat(
  t: Target,
  assets: Asset[],
  c: Connection | null,
) {
  const errors: string[] = [];
  const api = t.deliveryMode !== "manual";
  if (!t.caption.trim()) errors.push("Write a caption.");
  if (t.options.provider !== t.provider)
    errors.push("Platform options do not match.");
  const limits = {
    instagram: 2200,
    facebook: 5000,
    pinterest: 800,
    tiktok: 2200,
  };
  if (t.caption.length > limits[t.provider])
    errors.push(
      `Caption exceeds this integration’s ${limits[t.provider]} character limit.`,
    );
  if (t.format === "text" && t.provider !== "facebook")
    errors.push("Text-only posts are supported for Facebook Pages.");
  if (t.format !== "text" && assets.length === 0)
    errors.push("Choose verified media.");
  if (t.format === "image" && assets.length !== 1)
    errors.push("Choose one image.");
  if (t.format === "carousel" && (assets.length < 2 || assets.length > 10))
    errors.push("Choose 2–10 images.");
  if (
    t.format === "video" &&
    (assets.length !== (t.provider === "pinterest" ? 2 : 1) ||
      assets[0]?.kind !== "video" ||
      (t.provider === "pinterest" && assets[1]?.kind !== "image"))
  )
    errors.push(
      t.provider === "pinterest"
        ? "Choose the original video first, then one verified cover image."
        : "Choose one verified original video.",
    );
  if (t.format !== "video" && assets.some((a) => a.kind !== "image"))
    errors.push("Choose images for this format.");
  if (t.provider === "pinterest") {
    if (t.options.provider !== "pinterest" || !t.options.title.trim())
      errors.push("Pinterest needs a Pin title.");
    if (api && t.options.provider === "pinterest" && !t.options.boardId)
      errors.push("Choose a Pinterest board.");
    if (api && !t.linkUrl)
      errors.push("Pinterest needs a public artwork destination.");
    if (api && !["image", "video"].includes(t.format))
      errors.push(
        "Pinterest API supports a single image or video with one cover image.",
      );
    if (
      api &&
      t.format === "video" &&
      assets.some(
        (a) =>
          a.kind === "video" &&
          (!["video/mp4", "video/quicktime"].includes(a.mime) ||
            !a.durationMs ||
            a.durationMs < 4000 ||
            a.durationMs > 90000),
      )
    )
      errors.push(
        "Use a verified MP4/MOV between 4 and 90 seconds in this integration.",
      );
  }
  if (
    t.provider === "instagram" &&
    t.format === "carousel" &&
    assets.some(
      (a) =>
        Math.abs(a.width / a.height - assets[0].width / assets[0].height) >
        0.01,
    )
  )
    errors.push(
      "Instagram carousel images must have matching proportions to prevent native cropping of original art.",
    );
  if (api) {
    if (t.deliveryMode === "api_test" && t.provider !== "pinterest")
      errors.push(
        "Creator-only API test mode is supported only for Pinterest Trial; other platforms must not be treated as private test writes.",
      );
    if (assets.some((a) => !a.apiReady))
      errors.push(
        "Upload public, verified source media; local/private media is manual-only.",
      );
    if (
      !c ||
      c.status !== "connected" ||
      c.provider !== t.provider ||
      !c.metadata.selected
    )
      errors.push("Connect and explicitly select this platform account.");
    if (t.provider === "instagram") {
      for (const a of assets) {
        if (
          a.kind === "image" &&
          (a.mime !== "image/jpeg" ||
            a.bytes > 8 * 1024 * 1024 ||
            a.width < 320 ||
            a.width / a.height < 0.8 ||
            a.width / a.height > 1.91)
        )
          errors.push(
            "Instagram API: use a JPEG under 8 MB, width at least 320px, ratio 4:5 to 1.91:1.",
          );
        if (
          a.kind === "video" &&
          (!["video/mp4", "video/quicktime"].includes(a.mime) ||
            !a.durationMs ||
            a.durationMs < 3000 ||
            a.durationMs > 90000)
        )
          errors.push(
            "Use an MP4/MOV Reel between 3 and 90 seconds in this integration.",
          );
      }
      if (c && !c.scopes.includes("instagram_business_content_publish"))
        errors.push("Instagram publishing permission is missing.");
    }
    if (t.provider === "facebook") {
      if (
        t.format === "video" &&
        assets.some(
          (a) =>
            a.width < 540 ||
            a.height < 960 ||
            Math.abs(a.width / a.height - 9 / 16) > 0.01 ||
            !a.durationMs ||
            a.durationMs < 3000 ||
            a.durationMs > 90000 ||
            !a.framesPerSecond ||
            a.framesPerSecond < 24 ||
            a.framesPerSecond > 60,
        )
      )
        errors.push(
          "Facebook Reels need a verified 9:16 video, at least 540 × 960, 3–90 seconds and 24–60 fps. Export other videos manually.",
        );
      if (
        c &&
        (!c.scopes.includes("pages_manage_posts") ||
          !c.metadata.tasks?.some((s) =>
            [
              "CREATE_CONTENT",
              "MANAGE",
              "PROFILE_PLUS_CREATE_CONTENT",
            ].includes(s),
          ))
      )
        errors.push("This Page has not granted content creation access.");
    }
    if (t.provider === "pinterest" && c) {
      if (
        t.deliveryMode === "api_public" &&
        c.metadata.accessTier !== "standard"
      )
        errors.push("Pinterest public posting needs verified Standard access.");
      if (t.deliveryMode === "api_test" && c.metadata.accessTier !== "trial")
        errors.push("Creator-only test posting needs verified Trial access.");
      if (!c.scopes.includes("pins:write"))
        errors.push("Pinterest Pin publishing permission is missing.");
      if (
        assets.some(
          (a) =>
            a.kind === "image" &&
            (!["image/jpeg", "image/png"].includes(a.mime) ||
              a.bytes > 20 * 1024 * 1024),
        )
      )
        errors.push("Pinterest API: use a JPEG or PNG under 20 MB.");
    }
    if (t.provider === "tiktok")
      errors.push(
        "TikTok Direct Post is restricted for private utilities. Use native posting export.",
      );
    if (t.deliveryMode === "api_inbox")
      errors.push(
        "Upload-to-inbox product approval is not configured; use manual export.",
      );
  }
  if (t.scheduledAt && Number.isNaN(Date.parse(t.scheduledAt)))
    errors.push("Choose a valid scheduled time.");
  return errors;
}
export async function targetContext(
  repo: SocialRepository,
  target: Target,
  inventory: InventoryReader,
) {
  const post = await repo.getPost(target.postId);
  const art = post.artworkId ? await inventory(post.artworkId) : null;
  const assets = await Promise.all(
    target.assetIds.map((id) => repo.getAsset(id)),
  );
  const connection = target.connectionId
    ? await repo.getConnection(target.connectionId)
    : null;
  return { post, art, assets, connection };
}
export async function validateTarget(
  repo: SocialRepository,
  t: Target,
  inventory: InventoryReader,
) {
  const context = await targetContext(repo, t, inventory);
  const errors = validateFormat(t, context.assets, context.connection);
  const { post, art } = context;
  if (context.assets.some((a) => a.artworkId && a.artworkId !== post.artworkId))
    errors.push("Selected artwork media belongs to a different original.");
  if (post.archivedAt) errors.push("This campaign is archived.");
  if (
    post.intent === "availability" &&
    (!art || !art.published || art.status !== "available")
  )
    errors.push(
      "This original is no longer published and available. Choose portfolio intent or another artwork.",
    );
  if (
    post.intent === "portfolio" &&
    art &&
    art.status !== "available" &&
    !/(sold|private collection|vendid|colecci[oó]n privada|reservad|no disponible)/i.test(
      t.caption,
    )
  )
    errors.push(
      "Label sold/reserved portfolio work accurately in the caption.",
    );
  if (t.linkUrl) {
    try {
      const u = new URL(t.linkUrl),
        c = socialConfig();
      if (
        u.protocol !== "https:" ||
        u.username ||
        u.password ||
        !c.publicStore ||
        u.origin !== c.publicStore
      )
        errors.push(
          "Choose a verified public storefront link; protected previews are not buyer destinations.",
        );
      if (
        [...u.searchParams].some(
          ([key, value]) =>
            /^(email|phone|name|customer_name|customer_email|access_token|token)$/i.test(
              key,
            ) || /[^\s@]+@[^\s@]+\.[^\s@]+/.test(value),
        )
      )
        errors.push(
          "Public campaign links cannot contain personal contacts or tokens.",
        );
      if (post.artworkId && !u.pathname.endsWith(`/art/${post.artworkId}`))
        errors.push("The destination must match this artwork.");
    } catch {
      errors.push("Invalid public link.");
    }
  }
  return { ...context, errors, fingerprint: inventoryFingerprint(art) };
}
export function approvalPayload(
  t: Target,
  p: Post,
  assets: Asset[],
  connection: Connection | null,
  fingerprint: string | null,
) {
  return {
    schema: 1,
    targetId: t.id,
    revision: t.revision,
    provider: t.provider,
    destination: t.connectionId,
    connectionGeneration: connection?.generation ?? null,
    deliveryMode: t.deliveryMode,
    format: t.format,
    caption: t.caption,
    options: t.options,
    assets: assets.map((a) => ({
      id: a.id,
      sha256: a.sha256,
      width: a.width,
      height: a.height,
      durationMs: a.durationMs,
    })),
    link: t.linkUrl,
    timing: t.scheduledAt
      ? { scheduledAt: t.scheduledAt, timezone: t.timezone }
      : "immediate",
    intent: p.intent,
    artworkId: p.artworkId,
    inventoryFingerprint: fingerprint,
  };
}
export async function approve(
  repo: SocialRepository,
  id: string,
  expectedRevision: number,
  inventory: InventoryReader,
) {
  const t = await repo.getTarget(id);
  if (
    t.revision !== expectedRevision ||
    !["draft", "approved"].includes(t.status)
  )
    throw new SocialError(
      "revision_conflict",
      "Reload this editable revision before approving.",
      409,
    );
  const check = await validateTarget(repo, t, inventory);
  if (check.errors.length)
    throw new SocialError("validation_failed", check.errors.join(" "), 422);
  const snapshot = approvalPayload(
      t,
      check.post,
      check.assets,
      check.connection,
      check.fingerprint,
    ),
    digest = hash(stable(snapshot));
  await repo.tx(async (tx) => {
    const fresh = await repo.getTarget(id, tx);
    if (fresh.revision !== expectedRevision || fresh.status !== t.status)
      throw new SocialError(
        "revision_conflict",
        "Destination changed while approving.",
        409,
      );
    const next = {
      ...t,
      status: "approved" as const,
      approvedHash: digest,
      approvedRevision: t.revision,
      approvedAt: new Date().toISOString(),
      inventoryFingerprint: check.fingerprint,
      connectionGeneration: check.connection?.generation ?? null,
      lastErrorCode: null,
    };
    await writeTarget(tx, next, t.revision);
    await tx.execute({
      sql: "UPDATE social_targets SET approved_snapshot=? WHERE id=?",
      args: [stable(snapshot), id],
    });
  });
  await repo.audit("approved", id, { revision: t.revision });
  return digest;
}
export async function assertApproval(
  repo: SocialRepository,
  t: Target,
  inventory: InventoryReader,
) {
  const check = await validateTarget(repo, t, inventory);
  if (check.errors.length)
    throw new SocialError(
      check.post.intent === "availability"
        ? "artwork_unavailable"
        : "validation_failed",
      check.errors.join(" "),
      422,
    );
  const digest = hash(
    stable(
      approvalPayload(
        t,
        check.post,
        check.assets,
        check.connection,
        check.fingerprint,
      ),
    ),
  );
  if (
    !t.approvedHash ||
    t.approvedRevision !== t.revision ||
    digest !== t.approvedHash
  )
    throw new SocialError(
      "approval_stale",
      "Artwork, account or content changed after approval. Review and approve again.",
      409,
    );
  return check;
}
