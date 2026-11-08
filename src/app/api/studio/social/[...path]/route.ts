import { cookies } from "next/headers";
import { z } from "zod";
import {
  socialGuard,
  boundedJson,
  socialJson,
  socialFailure,
  privateHeaders,
} from "@/lib/social/auth";
import { socialRepository } from "@/lib/social/repository";
import { readInventory } from "@/lib/social/inventory";
import { redactedConfig, socialConfig } from "@/lib/social/config";
import { platforms, SocialError, type Connection } from "@/lib/social/types";
import {
  targetInput,
  idSchema,
  platformSchema,
  createPostSchema,
  updateTargetSchema,
  revisionSchema,
  manualResultSchema,
  uploadCompleteSchema,
} from "@/lib/social/validation";
import {
  createDraft,
  editTarget,
  verifyConnection,
  disconnect,
  manualResult,
  archivePost,
  enqueueMetrics,
  safeRetry,
  cleanupSocial,
  recentMedia,
  updatePost,
  addTarget,
} from "@/lib/social/service";
import {
  importArtwork,
  signSocialUpload,
  completeSocialUpload,
  assetBytes,
} from "@/lib/social/media";
import { approve, validateTarget } from "@/lib/social/approval";
import { enqueue, cancelTarget } from "@/lib/social/jobs";
import {
  runSocialTick,
  reconcileTarget,
  scanInventory,
} from "@/lib/social/worker";
import {
  startOAuth,
  selectCandidate,
  selectConnection,
} from "@/lib/social/oauth";
import { capabilities } from "@/lib/social/capabilities";
import { manualPackage } from "@/lib/social/export";
import { credentialsFor } from "@/lib/social/credentials";
import { pinterestBoards } from "@/lib/social/providers/pinterest";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
type Params = { params: Promise<{ path: string[] }> };
async function handle(request: Request, { params }: Params) {
  try {
    await socialGuard(request);
    const path = (await params).path,
      repo = socialRepository(),
      method = request.method;
    if (method === "GET") {
      if (path[0] === "status" && path.length === 1) {
        const state = await repo.state();
        const assets = state.assets.map((a) => ({
          ...a,
          url: a.url.startsWith("data:")
            ? `/api/studio/social/assets/${a.id}/download`
            : a.url,
        }));
        return socialJson({
          ...state,
          assets,
          config: redactedConfig(),
          capabilities: Object.fromEntries(
            platforms.map((p) => [
              p,
              capabilities(
                p,
                state.connections.find(
                  (c) => c.provider === p && c.status === "connected",
                ) as Connection | undefined,
              ),
            ]),
          ),
        });
      }
      if (path[0] === "posts") {
        if (path.length === 2) {
          const post = await repo.getPost(idSchema.parse(path[1]));
          const state = await repo.state();
          return socialJson({
            post,
            targets: state.targets.filter((t) => t.postId === post.id),
          });
        }
        return socialJson({ posts: (await repo.state()).posts });
      }
      if (path[0] === "connections" && path.length === 3 && path[2] === "media")
        return socialJson({
          media: await recentMedia(repo, idSchema.parse(path[1])),
        });
      if (path[0] === "connections" && path.length === 1)
        return socialJson({ connections: (await repo.state()).connections });
      if (path[0] === "assets" && path.length === 3 && path[2] === "download") {
        const a = await repo.getAsset(idSchema.parse(path[1]));
        const bytes = await assetBytes(a);
        return new Response(new Uint8Array(bytes), {
          headers: {
            ...privateHeaders,
            "Content-Type": a.mime,
            "Content-Disposition": `attachment; filename="larkova-${a.id}.${a.mime === "image/jpeg" ? "jpg" : a.mime === "video/quicktime" ? "mov" : a.mime.split("/")[1]}"`,
            "X-Content-Type-Options": "nosniff",
          },
        });
      }
      if (path[0] === "assets" && path.length === 1)
        return socialJson({
          assets: (await repo.state()).assets.map((a) => ({
            ...a,
            url: a.apiReady
              ? a.url
              : `/api/studio/social/assets/${a.id}/download`,
          })),
        });
      if (path[0] === "targets" && path.length === 3 && path[2] === "export") {
        const pack = await manualPackage(
          repo,
          idSchema.parse(path[1]),
          readInventory,
        );
        return new Response(JSON.stringify(pack, null, 2), {
          headers: {
            ...privateHeaders,
            "Content-Type": "application/json; charset=utf-8",
            "Content-Disposition": `attachment; filename="larkova-${pack.platform}-${pack.targetId}.json"`,
          },
        });
      }
      if (path[0] === "jobs" && path.length === 1) {
        const state = await repo.state();
        const attempts = await repo.client.execute(
          "SELECT job_id,target_id,step_key,attempt_no,started_at,finished_at,outcome,error_code FROM social_attempts ORDER BY started_at DESC LIMIT 100",
        );
        return socialJson({ jobs: state.jobs, attempts: attempts.rows });
      }
      if (path[0] === "metrics" && path.length === 1)
        return socialJson({ metrics: (await repo.state()).metrics });
      if (path[0] === "boards" && path.length === 1) {
        const id = idSchema.parse(
          new URL(request.url).searchParams.get("connectionId"),
        );
        const c = await repo.getConnection(id);
        if (c.provider !== "pinterest")
          throw new SocialError(
            "validation_failed",
            "Choose a Pinterest connection.",
            422,
          );
        const credential = await credentialsFor(repo, c);
        return socialJson({
          boards: await pinterestBoards({
            connection: c,
            credentials: credential,
            fetcher: fetch,
            now: Date.now,
            write: async () => {
              throw new SocialError(
                "unauthorized",
                "Board lookup cannot publish.",
                403,
              );
            },
          }),
        });
      }
      if (path[0] === "creator-info")
        throw new SocialError(
          "policy_restricted",
          "TikTok native export is available; API creator access is not approved.",
          403,
        );
      throw new SocialError("not_found", "Social resource not found.", 404);
    }
    const body = await boundedJson(request);
    if (
      method === "POST" &&
      path[0] === "posts" &&
      path.length === 3 &&
      path[2] === "targets"
    ) {
      const input = z
        .object({
          expectedRevision: z.number().int().positive(),
          target: targetInput,
        })
        .strict()
        .parse(body);
      return socialJson(
        await addTarget(
          repo,
          idSchema.parse(path[1]),
          input.expectedRevision,
          input.target,
        ),
        201,
      );
    }
    if (method === "POST" && path[0] === "posts" && path.length === 1) {
      const input = createPostSchema.parse(body);
      return socialJson(
        { id: await createDraft(repo, input, readInventory) },
        201,
      );
    }
    if (method === "PATCH" && path[0] === "posts" && path.length === 2) {
      const input = z
        .object({
          expectedRevision: z.number().int().positive(),
          title: z.string().trim().min(1).max(150),
          campaign: z
            .string()
            .regex(/^[a-zA-Z0-9-]*$/)
            .max(80),
          intent: z.enum([
            "availability",
            "portfolio",
            "process",
            "announcement",
          ]),
          artworkId: z
            .string()
            .regex(/^[a-z0-9-]{1,80}$/)
            .nullable(),
        })
        .strict()
        .parse(body);
      await updatePost(
        repo,
        idSchema.parse(path[1]),
        input.expectedRevision,
        input,
        readInventory,
      );
      return socialJson({ ok: true });
    }
    if (method === "PATCH" && path[0] === "targets" && path.length === 2) {
      return socialJson({
        target: await editTarget(
          repo,
          idSchema.parse(path[1]),
          updateTargetSchema.parse(body),
        ),
      });
    }
    if (method === "POST" && path[0] === "assets") {
      if (path.length === 2 && path[1] === "artwork") {
        const input = z
          .object({ artworkId: z.string().regex(/^[a-z0-9-]{1,80}$/) })
          .strict()
          .parse(body);
        const asset = await importArtwork(repo, input.artworkId, readInventory);
        return socialJson(
          {
            asset: {
              ...asset,
              url: asset.apiReady
                ? asset.url
                : `/api/studio/social/assets/${asset.id}/download`,
            },
          },
          201,
        );
      }
      if (path.length === 2 && path[1] === "sign") {
        const input = z
          .object({ kind: z.enum(["image", "video"]) })
          .strict()
          .parse(body);
        return socialJson(await signSocialUpload(repo, input.kind));
      }
      if (path.length === 2 && path[1] === "complete")
        return socialJson({
          asset: await completeSocialUpload(
            repo,
            uploadCompleteSchema.parse(body),
          ),
        });
    }
    if (method === "POST" && path[0] === "connections") {
      if (path.length === 3 && path[2] === "start") {
        z.object({}).strict().parse(body);
        const provider = platformSchema.parse(path[1]),
          result = await startOAuth(repo, provider);
        (await cookies()).set(
          `larkova_social_oauth_${provider}`,
          result.binding,
          {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: 600,
          },
        );
        return socialJson({ url: result.url });
      }
      if (path.length === 2 && path[1] === "select") {
        const input = z
          .object({
            candidateId: idSchema.optional(),
            connectionId: idSchema.optional(),
            externalId: z.string().max(100).optional(),
            accessTier: z.enum(["trial", "standard"]).optional(),
          })
          .strict()
          .parse(body);
        if (input.candidateId) {
          const binding =
            (await cookies()).get("larkova_social_oauth_facebook")?.value || "";
          return socialJson(
            await selectCandidate(repo, input.candidateId, binding),
          );
        }
        if (!input.connectionId || !input.externalId)
          throw new SocialError(
            "validation_failed",
            "Confirm the exact account ID.",
            422,
          );
        return socialJson({
          connection: await selectConnection(
            repo,
            input.connectionId,
            input.externalId,
            input.accessTier,
          ),
        });
      }
      if (path.length === 3 && path[2] === "verify") {
        z.object({}).strict().parse(body);
        return socialJson({
          connection: await verifyConnection(repo, idSchema.parse(path[1])),
        });
      }
      if (path.length === 3 && path[2] === "disconnect") {
        z.object({}).strict().parse(body);
        return socialJson(await disconnect(repo, idSchema.parse(path[1])));
      }
    }
    if (method === "POST" && path[0] === "targets" && path.length === 3) {
      const id = idSchema.parse(path[1]);
      if (path[2] === "validate") {
        const r = await validateTarget(
          repo,
          await repo.getTarget(id),
          readInventory,
        );
        return socialJson({ valid: r.errors.length === 0, errors: r.errors });
      }
      if (path[2] === "reconcile") {
        revisionSchema.parse(body);
        await reconcileTarget(repo, id, readInventory);
        return socialJson({ ok: true });
      }
      if (path[2] === "manual-result") {
        const input = manualResultSchema.parse(body);
        return socialJson(
          await manualResult(repo, id, input.expectedRevision, input.permalink),
        );
      }
      const input = revisionSchema.parse(body);
      if (path[2] === "reset") {
        const t = await repo.getTarget(id);
        if (!["blocked", "failed"].includes(t.status))
          throw new SocialError(
            "provider_uncertain",
            "Only blocked or failed safe content can be reset.",
            409,
          );
        await repo.updateTarget(id, input.expectedRevision, {});
        return socialJson({ ok: true });
      }
      if (path[2] === "approve")
        return socialJson({
          approvedHash: await approve(
            repo,
            id,
            input.expectedRevision,
            readInventory,
          ),
        });
      if (["schedule", "publish"].includes(path[2]))
        return socialJson(
          {
            jobId: await enqueue(
              repo,
              id,
              input.expectedRevision,
              readInventory,
            ),
          },
          202,
        );
      if (path[2] === "cancel") {
        await cancelTarget(repo, id, input.expectedRevision);
        return socialJson({ ok: true });
      }
      if (path[2] === "retry") {
        await safeRetry(repo, id, input.expectedRevision);
        return socialJson({ ok: true });
      }
    }
    if (
      method === "POST" &&
      path[0] === "posts" &&
      path.length === 3 &&
      path[2] === "archive"
    ) {
      const input = revisionSchema.parse(body);
      await archivePost(repo, idSchema.parse(path[1]), input.expectedRevision);
      return socialJson({ ok: true });
    }
    if (method === "POST" && path.join("/") === "jobs/run") {
      z.object({}).strict().parse(body);
      await cleanupSocial(repo);
      await scanInventory(repo, readInventory);
      return socialJson(
        await runSocialTick(repo, readInventory, { mode: "manual" }),
      );
    }
    if (method === "POST" && path.join("/") === "metrics/sync") {
      const input = z.object({ connectionId: idSchema }).strict().parse(body);
      return socialJson(await enqueueMetrics(repo, input.connectionId), 202);
    }
    if (method === "POST" && path.join("/") === "settings") {
      const input = z.object({ paused: z.boolean() }).strict().parse(body);
      await repo.init();
      await repo.client.execute({
        sql: "INSERT INTO social_settings VALUES ('paused',?,?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=excluded.updated_at",
        args: [JSON.stringify(input.paused), new Date().toISOString()],
      });
      return socialJson({ paused: input.paused });
    }
    throw new SocialError("not_found", "Social action not found.", 404);
  } catch (e) {
    return socialFailure(e);
  }
}
export const GET = handle;
export const POST = handle;
export const PATCH = handle;
