import { providerRequest } from "../http.ts";
import { socialConfig } from "../config.ts";
import {
  SocialError,
  type StepResult,
  type Target,
  type Asset,
  type Progress,
} from "../types.ts";
import type { ProviderContext, SocialAdapter } from "./contract.ts";
function base() {
  const v = socialConfig().version;
  if (!v)
    throw new SocialError(
      "not_configured",
      "Set a verified Meta API version.",
      503,
    );
  return `https://graph.facebook.com/${v}`;
}
const safe = (v: string) => {
  if (!/^[0-9_]+$/.test(v))
    throw new SocialError(
      "provider_uncertain",
      "Invalid Page operation ID.",
      502,
    );
  return v;
};
async function read(path: string, fields: string, ctx: ProviderContext) {
  const u = new URL(base() + path);
  u.searchParams.set("fields", fields);
  return providerRequest(u, ctx.credentials.accessToken, {
    fetcher: ctx.fetcher,
  });
}
async function verify(
  postId: string,
  ctx: ProviderContext,
): Promise<StepResult> {
  const r = await read(`/${safe(postId)}`, "id,permalink_url,from", ctx);
  if (r.id !== postId || r.from?.id !== ctx.connection.externalId)
    throw new SocialError(
      "provider_uncertain",
      "The post could not be verified on the selected Page.",
      502,
    );
  return {
    kind: "published",
    postId,
    permalink:
      typeof r.permalink_url === "string" &&
      /^https:\/\/(www\.)?facebook\.com\//.test(r.permalink_url)
        ? r.permalink_url
        : undefined,
  };
}

async function verifyReel(
  videoId: string,
  ctx: ProviderContext,
): Promise<StepResult> {
  const r = await read(
    `/${safe(videoId)}`,
    "id,status,from,permalink_url",
    ctx,
  );
  if (
    r.id !== videoId ||
    r.from?.id !== ctx.connection.externalId ||
    r.status?.publishing_phase?.publish_status !== "published"
  )
    throw new SocialError(
      "provider_uncertain",
      "The Reel has not been confirmed published on the selected Page. Reconcile the existing video.",
      409,
    );
  return {
    kind: "published",
    postId: videoId,
    permalink:
      typeof r.permalink_url === "string" &&
      /^https:\/\/(www\.)?facebook\.com\//.test(r.permalink_url)
        ? r.permalink_url
        : undefined,
  };
}
async function reelStep(
  t: Target,
  asset: Asset,
  p: Progress,
  ctx: ProviderContext,
): Promise<StepResult> {
  const page = safe(ctx.connection.externalId);
  if (p.stage === "finished" && p.videoId) return verifyReel(p.videoId, ctx);
  if (!p.videoId) {
    const body = { upload_phase: "start" };
    const r = await ctx.write("fb-reel-start", body, () =>
      providerRequest(
        `${base()}/${page}/video_reels`,
        ctx.credentials.accessToken,
        { method: "POST", body, fetcher: ctx.fetcher },
      ),
    );
    const videoId = safe(String(r.video_id));
    const u = new URL(String(r.upload_url));
    if (
      u.origin !== "https://rupload.facebook.com" ||
      u.search ||
      u.hash ||
      u.username ||
      u.password ||
      !new RegExp(`^/video-upload/(v[0-9]+\\.0/)?${videoId}$`).test(u.pathname)
    )
      throw new SocialError(
        "provider_uncertain",
        "Meta returned an unexpected upload destination. Review the existing session.",
        502,
      );
    return {
      kind: "next",
      progress: { ...p, videoId, uploadPath: u.pathname },
      delayMs: 1000,
    };
  }
  if (!p.stage) {
    if (
      !p.uploadPath ||
      !new RegExp(`^/video-upload/(v[0-9]+\\.0/)?${safe(p.videoId)}$`).test(
        p.uploadPath,
      )
    )
      throw new SocialError(
        "provider_uncertain",
        "Existing Reel upload path needs review.",
        409,
      );
    const r = await ctx.write(
      "fb-reel-upload",
      { videoId: p.videoId, source: asset.sha256 },
      () =>
        providerRequest(
          `https://rupload.facebook.com${p.uploadPath}`,
          ctx.credentials.accessToken,
          {
            method: "POST",
            oauth: true,
            headers: { file_url: asset.url },
            fetcher: ctx.fetcher,
          },
        ),
    );
    if (r.success !== true)
      throw new SocialError(
        "provider_uncertain",
        "Video upload acceptance could not be confirmed.",
        502,
      );
    return {
      kind: "next",
      progress: { ...p, stage: "uploaded", pollCount: 0 },
      delayMs: 60000,
    };
  }
  const r = await read(`/${safe(p.videoId)}`, "status", ctx);
  const status = r.status;
  if (
    status?.video_status === "error" ||
    status?.video_status === "expired" ||
    status?.processing_phase?.status === "error" ||
    status?.uploading_phase?.status === "error"
  )
    throw new SocialError(
      "media_invalid",
      "Facebook could not process this existing Reel.",
      422,
    );
  if (
    status?.processing_phase?.status !== "completed" ||
    status?.uploading_phase?.status !== "completed"
  ) {
    if ((p.pollCount || 0) >= 10)
      throw new SocialError(
        "provider_processing",
        "Reel processing took too long. Review the existing video.",
        409,
      );
    return {
      kind: "next",
      progress: { ...p, pollCount: (p.pollCount || 0) + 1 },
      delayMs: 60000,
    };
  }
  const body = {
    video_id: p.videoId,
    upload_phase: "finish",
    video_state: "PUBLISHED",
    description: t.caption,
  };
  const finish = await ctx.write("fb-reel-finish", body, () =>
    providerRequest(
      `${base()}/${page}/video_reels`,
      ctx.credentials.accessToken,
      { method: "POST", body, fetcher: ctx.fetcher },
    ),
  );
  if (finish.success !== true)
    throw new SocialError(
      "provider_uncertain",
      "Reel publication acceptance could not be confirmed.",
      502,
    );
  return {
    kind: "next",
    progress: { ...p, stage: "finished", postId: p.videoId },
    delayMs: 60000,
  };
}
export const facebookAdapter: SocialAdapter = {
  platform: "facebook",
  async identity(ctx) {
    const r = await read(`/${safe(ctx.connection.externalId)}`, "id,name", ctx);
    return {
      externalId: String(r.id),
      displayName: String(r.name || r.id),
      username: "",
      scopes: ctx.connection.scopes,
      metadata: ctx.connection.metadata,
    };
  },
  async step(t, assets, p, ctx) {
    if (
      !ctx.connection.metadata.selected ||
      !ctx.connection.metadata.tasks?.some((s) =>
        ["CREATE_CONTENT", "MANAGE", "PROFILE_PLUS_CREATE_CONTENT"].includes(s),
      )
    )
      throw new SocialError(
        "permission_missing",
        "Choose a Page with content creation permission.",
        403,
      );
    const page = safe(ctx.connection.externalId);
    if (t.format === "video") return reelStep(t, assets[0], p, ctx);
    if (p.postId) return verify(p.postId, ctx);
    if (t.format === "carousel" && (p.photoIds || []).length < assets.length) {
      const i = (p.photoIds || []).length,
        body = { url: assets[i].url, published: false };
      const r = await ctx.write(`fb-photo-${i}`, body, () =>
        providerRequest(
          `${base()}/${page}/photos`,
          ctx.credentials.accessToken,
          { method: "POST", body, fetcher: ctx.fetcher },
        ),
      );
      return {
        kind: "next",
        progress: {
          ...p,
          photoIds: [...(p.photoIds || []), safe(String(r.id))],
        },
        delayMs: 1000,
      };
    }
    if (t.format === "image") {
      const body = { url: assets[0].url, caption: t.caption, published: true };
      const r = await ctx.write("fb-publish-photo", body, () =>
        providerRequest(
          `${base()}/${page}/photos`,
          ctx.credentials.accessToken,
          { method: "POST", body, fetcher: ctx.fetcher },
        ),
      );
      if (!r.post_id)
        throw new SocialError(
          "provider_uncertain",
          "Photo upload returned without a final Page post ID. Check the Page before reposting.",
          409,
        );
      return {
        kind: "next",
        progress: {
          ...p,
          postId: safe(String(r.post_id)),
          photoIds: [safe(String(r.id))],
        },
        delayMs: 1000,
      };
    }
    const body =
      t.format === "carousel"
        ? {
            message: t.caption,
            attached_media: (p.photoIds || []).map((media_fbid) => ({
              media_fbid,
            })),
          }
        : { message: t.caption, ...(t.linkUrl ? { link: t.linkUrl } : {}) };
    const r = await ctx.write("fb-publish-feed", body, () =>
      providerRequest(`${base()}/${page}/feed`, ctx.credentials.accessToken, {
        method: "POST",
        body,
        fetcher: ctx.fetcher,
      }),
    );
    return {
      kind: "next",
      progress: { ...p, postId: safe(String(r.id)) },
      delayMs: 1000,
    };
  },
  async reconcile(t, p, ctx) {
    if (t.format === "video" && p.videoId) return verifyReel(p.videoId, ctx);
    return p.postId ? verify(p.postId, ctx) : null;
  },
  async metrics(ctx, postId) {
    if (!postId) return [];
    const r = await read(`/${safe(postId)}`, "id,shares", ctx);
    return [
      {
        key: "shares",
        value: typeof r.shares?.count === "number" ? r.shares.count : null,
        unit: "count",
        aggregation: "lifetime",
        definition: "facebook.shares.v1",
        source: `/${postId}?fields=shares`,
        externalPostId: postId,
        collectedAt: new Date(ctx.now()).toISOString(),
      },
    ];
  },
};
