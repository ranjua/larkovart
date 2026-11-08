import { providerRequest } from "../http.ts";
import { socialConfig } from "../config.ts";
import {
  SocialError,
  type Target,
  type Asset,
  type Progress,
  type StepResult,
  type Metric,
} from "../types.ts";
import type { ProviderContext, SocialAdapter } from "./contract.ts";
function base() {
  const version = socialConfig().version;
  if (!version)
    throw new SocialError(
      "not_configured",
      "Set a supported, verified Meta Graph API version.",
      503,
    );
  return `https://graph.instagram.com/${version}`;
}
const id = (v: unknown) => {
  if (typeof v !== "string" || !/^\d+$/.test(v))
    throw new SocialError(
      "provider_uncertain",
      "The platform did not return a valid operation ID.",
      502,
    );
  return v;
};
async function get(path: string, ctx: ProviderContext, fields: string) {
  const u = new URL(base() + path);
  u.searchParams.set("fields", fields);
  return providerRequest(u, ctx.credentials.accessToken, {
    fetcher: ctx.fetcher,
  });
}
async function confirmed(
  postId: string,
  ctx: ProviderContext,
): Promise<StepResult> {
  const result = await get(`/${id(postId)}`, ctx, "id,permalink,media_type");
  if (result.id !== postId)
    throw new SocialError(
      "provider_uncertain",
      "Published media identity could not be confirmed.",
      502,
    );
  return {
    kind: "published",
    postId,
    permalink:
      typeof result.permalink === "string" &&
      result.permalink.startsWith("https://www.instagram.com/")
        ? result.permalink
        : undefined,
  };
}
export const instagramAdapter: SocialAdapter = {
  platform: "instagram",
  async identity(ctx) {
    const response = await get("/me", ctx, "user_id,username");
    const r = response.data?.[0] || response;
    const externalId = id(r.user_id || r.id);
    return {
      externalId,
      displayName: String(r.username || externalId),
      username: String(r.username || ""),
      scopes: ctx.connection.scopes,
      metadata: { selected: true },
    };
  },
  async step(
    t: Target,
    assets: Asset[],
    p: Progress,
    ctx: ProviderContext,
  ): Promise<StepResult> {
    const account = id(ctx.connection.externalId);
    if (p.postId) return confirmed(p.postId, ctx);
    if (!p.containerId) {
      if (
        t.format === "carousel" &&
        (p.children || []).length < assets.length
      ) {
        const i = (p.children || []).length;
        const body = { image_url: assets[i].url, is_carousel_item: true };
        const r = await ctx.write(`ig-child-${i}`, body, () =>
          providerRequest(
            `${base()}/${account}/media`,
            ctx.credentials.accessToken,
            { method: "POST", body, fetcher: ctx.fetcher },
          ),
        );
        return {
          kind: "next",
          progress: { ...p, children: [...(p.children || []), id(r.id)] },
          delayMs: 1000,
        };
      }
      if (t.format === "carousel") {
        for (const child of p.children || []) {
          const status = await get(`/${id(child)}`, ctx, "status_code");
          if (status.status_code === "IN_PROGRESS") {
            if ((p.pollCount || 0) >= 5)
              throw new SocialError(
                "provider_processing",
                "A carousel child is still processing. Review the existing upload before retrying.",
                409,
              );
            return {
              kind: "next",
              progress: { ...p, pollCount: (p.pollCount || 0) + 1 },
              delayMs: 60000,
            };
          }
          if (status.status_code !== "FINISHED")
            throw new SocialError(
              "media_invalid",
              "Instagram could not process a carousel child.",
              422,
            );
        }
      }
      const body: Record<string, unknown> =
        t.format === "carousel"
          ? {
              media_type: "CAROUSEL",
              children: p.children?.join(","),
              caption: t.caption,
            }
          : t.format === "video"
            ? {
                media_type: "REELS",
                video_url: assets[0].url,
                caption: t.caption,
              }
            : {
                image_url: assets[0].url,
                caption: t.caption,
                alt_text:
                  t.options.provider === "instagram"
                    ? t.options.altText
                    : undefined,
              };
      const r = await ctx.write("ig-container", body, () =>
        providerRequest(
          `${base()}/${account}/media`,
          ctx.credentials.accessToken,
          { method: "POST", body, fetcher: ctx.fetcher },
        ),
      );
      return {
        kind: "next",
        progress: { ...p, containerId: id(r.id), pollCount: 0 },
        delayMs: 60000,
      };
    }
    const status = await get(`/${id(p.containerId)}`, ctx, "status_code");
    if (status.status_code === "IN_PROGRESS") {
      if ((p.pollCount || 0) >= 5)
        throw new SocialError(
          "provider_processing",
          "Processing took too long. Reconcile this existing operation.",
          409,
        );
      return {
        kind: "next",
        progress: { ...p, pollCount: (p.pollCount || 0) + 1 },
        delayMs: 60000,
      };
    }
    if (status.status_code === "PUBLISHED")
      throw new SocialError(
        "provider_uncertain",
        "The container was already published; check the native profile before any retry.",
        409,
      );
    if (status.status_code !== "FINISHED")
      throw new SocialError(
        "media_invalid",
        "Instagram could not process this container.",
        422,
      );
    const body = { creation_id: p.containerId };
    const r = await ctx.write("ig-publish", body, () =>
      providerRequest(
        `${base()}/${account}/media_publish`,
        ctx.credentials.accessToken,
        { method: "POST", body, fetcher: ctx.fetcher },
      ),
    );
    return {
      kind: "next",
      progress: { ...p, postId: id(r.id) },
      delayMs: 1000,
    };
  },
  async reconcile(t, p, ctx) {
    if (p.postId) return confirmed(p.postId, ctx);
    if (!p.containerId) return null;
    const r = await get(`/${id(p.containerId)}`, ctx, "status_code");
    if (r.status_code === "ERROR" || r.status_code === "EXPIRED")
      throw new SocialError(
        "media_invalid",
        "This existing Instagram container failed or expired.",
        422,
      );
    return null;
  },
  async metrics(ctx, postId) {
    if (!postId) return [];
    const r = await get(`/${id(postId)}`, ctx, "id,like_count,comments_count");
    return ["like_count", "comments_count"].map(
      (key) =>
        ({
          key,
          value: typeof r[key] === "number" ? r[key] : null,
          unit: "count",
          aggregation: "lifetime",
          definition: `instagram.${key}.v1`,
          source: `/${postId}?fields=${key}`,
          externalPostId: postId,
          collectedAt: new Date(ctx.now()).toISOString(),
        }) as Metric,
    );
  },
};
