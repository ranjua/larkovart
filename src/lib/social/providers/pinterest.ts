import { assetBytes } from "../media.ts";
import { ProviderError } from "../http.ts";
import { providerRequest } from "../http.ts";
import {
  SocialError,
  type StepResult,
  type Asset,
  type Progress,
} from "../types.ts";
import type { SocialAdapter, ProviderContext } from "./contract.ts";
const root = "https://api.pinterest.com/v5";
const id = (v: unknown) => {
  if (typeof v !== "string" || !/^\d+$/.test(v))
    throw new SocialError(
      "provider_uncertain",
      "Pinterest returned an invalid resource ID.",
      502,
    );
  return v;
};
const read = (path: string, ctx: ProviderContext) =>
  providerRequest(root + path, ctx.credentials.accessToken, {
    fetcher: ctx.fetcher,
  });
export async function pinterestBoards(ctx: ProviderContext) {
  const r = await read("/boards?page_size=50", ctx);
  return (r.items || [])
    .filter(
      (b: { id?: string; owner?: { username?: string } }) =>
        typeof b.id === "string" &&
        b.owner?.username === ctx.connection.username,
    )
    .map((b: { id: string; name?: string }) => ({
      id: b.id,
      name: String(b.name || b.id),
    }));
}
async function verify(
  postId: string,
  boardId: string,
  ctx: ProviderContext,
): Promise<StepResult> {
  const r = await read(`/pins/${id(postId)}`, ctx);
  if (r.id !== postId || r.board_id !== boardId)
    throw new SocialError(
      "provider_uncertain",
      "Pin could not be verified on the selected board.",
      502,
    );
  if (ctx.connection.metadata.accessTier === "trial")
    return { kind: "test_completed", operationId: postId };
  if (ctx.connection.metadata.accessTier !== "standard")
    throw new SocialError(
      "provider_review_required",
      "Pinterest access tier has not been verified.",
      403,
    );
  return {
    kind: "published",
    postId,
    permalink: `https://www.pinterest.com/pin/${postId}/`,
  };
}
async function prepareVideo(
  asset: Asset,
  p: Progress,
  ctx: ProviderContext,
): Promise<StepResult | null> {
  if (!p.mediaId) {
    const body = { media_type: "video" };
    const r = await ctx.write("pin-media-register", body, () =>
      providerRequest(root + "/media", ctx.credentials.accessToken, {
        method: "POST",
        body,
        fetcher: ctx.fetcher,
      }),
    );
    return {
      kind: "next",
      progress: { ...p, mediaId: id(r.media_id) },
      delayMs: 1000,
    };
  }
  if (!p.stage) {
    const artifact = (await ctx.artifact?.()) as
      | {
          media_id?: string;
          upload_url?: string;
          upload_parameters?: Record<string, unknown>;
        }
      | undefined;
    if (
      !artifact ||
      artifact.media_id !== p.mediaId ||
      artifact.upload_url !==
        "https://pinterest-media-upload.s3-accelerate.amazonaws.com/" ||
      !artifact.upload_parameters
    )
      throw new SocialError(
        "provider_uncertain",
        "Pinterest returned an unsupported upload destination. Review the existing media registration.",
        409,
      );
    const params = Object.entries(artifact.upload_parameters),
      allowed = new Set([
        "Content-Type",
        "key",
        "policy",
        "x-amz-algorithm",
        "x-amz-credential",
        "x-amz-date",
        "x-amz-security-token",
        "x-amz-signature",
      ]);
    if (
      params.length > 8 ||
      !params.some(([key]) => key === "policy") ||
      params.some(
        ([key, value]) =>
          !allowed.has(key) ||
          typeof value !== "string" ||
          value.length > 16000,
      )
    )
      throw new SocialError(
        "provider_uncertain",
        "Pinterest upload authorization needs review.",
        409,
      );
    const bytes = await assetBytes(asset, ctx.fetcher);
    const form = new FormData();
    for (const [key, value] of params) form.set(key, String(value));
    form.set(
      "file",
      new Blob([new Uint8Array(bytes)], { type: asset.mime }),
      "original.mp4",
    );
    await ctx.write(
      "pin-media-upload",
      { mediaId: p.mediaId, sha256: asset.sha256 },
      async () => {
        try {
          const r = await ctx.fetcher(artifact.upload_url!, {
            method: "POST",
            body: form,
            redirect: "error",
            signal: AbortSignal.timeout(20000),
          });
          if (r.status !== 204)
            throw new ProviderError(
              "provider_uncertain",
              "Upload acceptance could not be confirmed. Review existing Pinterest media.",
              502,
              false,
              true,
            );
          return { success: true };
        } catch (e) {
          if (e instanceof ProviderError) throw e;
          throw new ProviderError(
            "provider_uncertain",
            "Upload response was interrupted. Do not upload again blindly.",
            502,
            false,
            true,
          );
        }
      },
    );
    return {
      kind: "next",
      progress: { ...p, stage: "uploaded", pollCount: 0 },
      delayMs: 60000,
    };
  }
  const r = await read(`/media/${id(p.mediaId)}`, ctx);
  if (r.media_id !== p.mediaId)
    throw new SocialError(
      "provider_uncertain",
      "Pinterest media identity could not be confirmed.",
      409,
    );
  if (r.status === "succeeded") return null;
  if (r.status === "failed")
    throw new SocialError(
      "media_invalid",
      "Pinterest could not process the existing video.",
      422,
    );
  if (
    !["registered", "processing"].includes(r.status) ||
    (p.pollCount || 0) >= 10
  )
    throw new SocialError(
      "provider_processing",
      "Pinterest processing needs review of the existing media.",
      409,
    );
  return {
    kind: "next",
    progress: { ...p, pollCount: (p.pollCount || 0) + 1 },
    delayMs: 60000,
  };
}
export const pinterestAdapter: SocialAdapter = {
  platform: "pinterest",
  async identity(ctx) {
    const r = await read("/user_account", ctx);
    return {
      externalId: id(r.id),
      displayName: String(r.business_name || r.username || r.id),
      username: String(r.username || ""),
      scopes: ctx.connection.scopes,
      metadata: ctx.connection.metadata,
    };
  },
  async step(t, assets, p, ctx) {
    if (t.options.provider !== "pinterest" || !t.options.boardId)
      throw new SocialError(
        "validation_failed",
        "Choose a Pinterest board.",
        422,
      );
    if (p.postId) return verify(p.postId, t.options.boardId, ctx);
    if (t.format === "video") {
      const next = await prepareVideo(assets[0], p, ctx);
      if (next) return next;
    } else if (t.format !== "image")
      throw new SocialError(
        "unsupported",
        "Use a single image or a video with a cover for API Pins.",
        422,
      );
    const boardId = t.options.boardId;
    const board = await read(`/boards/${id(boardId)}`, ctx);
    if (
      board.id !== boardId ||
      board.owner?.username !== ctx.connection.username
    )
      throw new SocialError(
        "permission_missing",
        "Choose an owned, accessible board.",
        403,
      );
    const body = {
      board_id: t.options.boardId,
      ...(t.options.sectionId ? { board_section_id: t.options.sectionId } : {}),
      title: t.options.title,
      description: t.caption,
      alt_text: t.options.altText,
      link: t.linkUrl,
      media_source:
        t.format === "video"
          ? {
              source_type: "video_id",
              media_id: p.mediaId,
              cover_image_url: assets[1].url,
            }
          : { source_type: "image_url", url: assets[0].url },
    };
    const r = await ctx.write("pin-create", body, () =>
      providerRequest(root + "/pins", ctx.credentials.accessToken, {
        method: "POST",
        body,
        fetcher: ctx.fetcher,
      }),
    );
    return {
      kind: "next",
      progress: { ...p, postId: id(r.id) },
      delayMs: 1000,
    };
  },
  async reconcile(t, p, ctx) {
    return p.postId && t.options.provider === "pinterest"
      ? verify(p.postId, t.options.boardId, ctx)
      : null;
  },
  async metrics(ctx, postId) {
    if (!postId) return [];
    const end = new Date(ctx.now()).toISOString().slice(0, 10),
      start = new Date(ctx.now() - 7 * 86400000).toISOString().slice(0, 10);
    const r = await read(
      `/pins/${id(postId)}/analytics?start_date=${start}&end_date=${end}&metric_types=IMPRESSION,SAVE,PIN_CLICK`,
      ctx,
    );
    return ["IMPRESSION", "SAVE", "PIN_CLICK"].map((key) => ({
      key,
      value:
        typeof r.all?.summary_metrics?.[key] === "number"
          ? r.all.summary_metrics[key]
          : null,
      unit: "count",
      aggregation: "snapshot",
      definition: `pinterest.${key}.7day.v1`,
      source: `/pins/${postId}/analytics?start_date=${start}&end_date=${end}`,
      externalPostId: postId,
      collectedAt: new Date(ctx.now()).toISOString(),
      periodStart: start,
      periodEnd: end,
    }));
  },
};
