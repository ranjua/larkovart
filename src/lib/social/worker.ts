import { randomUUID } from "node:crypto";
import {
  SocialRepository,
  writeTarget,
  decode,
  jobRow,
  targetRow,
} from "./repository.ts";
import { claimJob, ownsLease, finishJob } from "./jobs.ts";
import { assertApproval } from "./approval.ts";
import { socialConfig } from "./config.ts";
import { credentialsFor, reconnectRequired } from "./credentials.ts";
import { adapterFor } from "./providers/registry.ts";
import { hash, stable, seal, open } from "./crypto.ts";
import { ProviderError } from "./http.ts";
import { assetBytes } from "./media.ts";
import {
  SocialError,
  type Platform,
  type Job,
  type Progress,
  type Target,
  type StepResult,
} from "./types.ts";
import type { InventoryReader } from "./inventory.ts";
import type { SocialAdapter, ProviderContext } from "./providers/contract.ts";
async function paused(repo: SocialRepository) {
  const r = await repo.client.execute(
    "SELECT value_json FROM social_settings WHERE key='paused'",
  );
  return r.rows[0]?.value_json === "true";
}
export async function publishingGate(repo: SocialRepository, target: Target) {
  const config = socialConfig();
  if (!config.enabled || (await paused(repo)))
    throw new SocialError(
      "publishing_paused",
      "Social publishing is paused.",
      403,
    );
  if (target.deliveryMode === "manual") return;
  if (target.deliveryMode === "api_public" && !config.publishEnabled)
    throw new SocialError(
      "publishing_disabled",
      "Public posting is off. Use manual export or finish production setup.",
      403,
    );
  if (target.deliveryMode === "api_test" && !config.testWrites)
    throw new SocialError(
      "publishing_disabled",
      "Test writes need explicit test-environment configuration.",
      403,
    );
  if (target.deliveryMode === "api_inbox")
    throw new SocialError(
      "policy_restricted",
      "TikTok inbox upload is not approved; use manual export.",
      403,
    );
}
function checkpoint(
  progress: Progress,
  step: string,
  result: unknown,
): Progress {
  const r = result as {
    id?: unknown;
    post_id?: unknown;
    video_id?: unknown;
    upload_url?: unknown;
    success?: unknown;
    media_id?: unknown;
  };
  const id = typeof r?.id === "string" && /^[0-9_]+$/.test(r.id) ? r.id : null;
  const post =
    typeof r?.post_id === "string" && /^[0-9_]+$/.test(r.post_id)
      ? r.post_id
      : null;
  const p = { ...progress };
  if (
    step === "pin-media-register" &&
    typeof r.media_id === "string" &&
    /^\d+$/.test(r.media_id)
  )
    p.mediaId = r.media_id;
  else if (step === "pin-media-upload" && r.success === true)
    p.stage = "uploaded";
  else if (
    step === "fb-reel-start" &&
    typeof r.video_id === "string" &&
    /^\d+$/.test(r.video_id)
  ) {
    p.videoId = r.video_id;
    const u = typeof r.upload_url === "string" ? new URL(r.upload_url) : null;
    if (
      u?.origin === "https://rupload.facebook.com" &&
      new RegExp(`^/video-upload/(v[0-9]+\\.0/)?${r.video_id}$`).test(
        u.pathname,
      )
    )
      p.uploadPath = u.pathname;
  } else if (step === "fb-reel-upload" && r.success === true)
    p.stage = "uploaded";
  else if (step === "fb-reel-finish" && r.success === true) {
    p.stage = "finished";
    p.postId = p.videoId;
  } else if (step.startsWith("ig-child-") && id)
    p.children = [...(p.children || []), id];
  else if (step === "ig-container" && id) p.containerId = id;
  else if (step.startsWith("fb-photo-") && id)
    p.photoIds = [...(p.photoIds || []), id];
  else if (step === "fb-publish-photo" && id) {
    p.photoIds = [id];
    if (post) p.postId = post;
  } else if (
    ["ig-publish", "fb-publish-feed", "pin-create"].includes(step) &&
    id
  )
    p.postId = id;
  return p;
}
export function providerContext(
  repo: SocialRepository,
  job: Job,
  target: Target,
  connection: ProviderContext["connection"],
  credentials: ProviderContext["credentials"],
  inventory: InventoryReader,
  fetcher: typeof fetch,
  now: () => number,
): ProviderContext {
  return {
    connection,
    credentials,
    fetcher,
    now,
    artifact: async () => {
      const r = await repo.client.execute({
        sql: "SELECT encrypted_payload FROM social_provider_artifacts WHERE job_id=? AND connection_id=? AND expires_at>?",
        args: [job.id, connection.id, now()],
      });
      if (!r.rows[0])
        throw new SocialError(
          "provider_uncertain",
          "Upload authorization expired. Review the existing media before retrying.",
          409,
        );
      return open(
        String(r.rows[0].encrypted_payload),
        `${socialConfig().environment}:${connection.provider}:artifact:${job.id}`,
      );
    },
    write: async <T>(
      step: string,
      fingerprint: unknown,
      send: () => Promise<T>,
    ): Promise<T> => {
      await publishingGate(repo, target);
      if (!(await ownsLease(repo, job, now())))
        throw new SocialError(
          "lease_lost",
          "Worker lease expired before a platform write.",
          409,
        );
      const fresh = await repo.getTarget(target.id);
      if (fresh.revision !== target.revision || fresh.status !== "processing")
        throw new SocialError(
          "approval_stale",
          "Destination changed before the platform write.",
          409,
        );
      await assertApproval(repo, fresh, inventory);
      const id = randomUUID();
      await repo.client.execute({
        sql: "INSERT INTO social_attempts(id,job_id,target_id,step_key,attempt_no,request_fingerprint,started_at) VALUES (?,?,?,?,?,?,?)",
        args: [
          id,
          job.id,
          target.id,
          step,
          job.attempts,
          hash(stable(fingerprint)),
          new Date(now()).toISOString(),
        ],
      });
      try {
        const value = await send();
        const next = checkpoint(job.progress, step, value);
        await repo.tx(async (tx) => {
          if (step === "pin-media-register")
            await tx.execute({
              sql: "INSERT INTO social_provider_artifacts VALUES (?,?,?,?) ON CONFLICT(job_id) DO UPDATE SET encrypted_payload=excluded.encrypted_payload,expires_at=excluded.expires_at",
              args: [
                job.id,
                connection.id,
                seal(
                  value,
                  `${socialConfig().environment}:${connection.provider}:artifact:${job.id}`,
                ),
                now() + 3600000,
              ],
            });
          const updated = await tx.execute({
            sql: "UPDATE social_jobs SET payload_json=?,updated_at=? WHERE id=? AND lease_owner=? AND fence=? AND state='running'",
            args: [
              JSON.stringify(next),
              new Date(now()).toISOString(),
              job.id,
              job.leaseOwner,
              job.fence,
            ],
          });
          if (updated.rowsAffected !== 1)
            throw new SocialError(
              "lease_lost",
              "The provider may have completed a write after the lease changed. Reconcile it.",
              409,
            );
          await tx.execute({
            sql: "UPDATE social_attempts SET outcome='accepted',finished_at=?,external_operation_id=?,external_post_id=? WHERE id=?",
            args: [
              new Date(now()).toISOString(),
              next.containerId ||
                next.children?.at(-1) ||
                next.photoIds?.at(-1) ||
                next.postId ||
                null,
              next.postId || null,
              id,
            ],
          });
        });
        job.progress = next;
        return value;
      } catch (e) {
        if (e instanceof ProviderError && !e.uncertain)
          await repo.client.execute({
            sql: "UPDATE social_attempts SET outcome='rejected',finished_at=?,error_code=? WHERE id=? AND outcome IS NULL",
            args: [new Date(now()).toISOString(), e.code, id],
          });
        throw e;
      }
    },
  };
}
export async function runSocialTick(
  repo: SocialRepository,
  inventory: InventoryReader,
  options: {
    fetcher?: typeof fetch;
    now?: () => number;
    adapters?: Partial<Record<Platform, SocialAdapter>>;
    mode?: string;
    budgetMs?: number;
  } = {},
) {
  await repo.init();
  const config = socialConfig(),
    mode = options.mode || config.mode,
    now = options.now || Date.now,
    started = Date.now(),
    owner = randomUUID(),
    fetcher = options.fetcher || fetch;
  let count = 0;
  await repo.client.execute({
    sql: "INSERT INTO social_worker_health VALUES (?,?,?,NULL,NULL,0)",
    args: [owner, mode, new Date(now()).toISOString()],
  });
  try {
    if (!config.enabled || (await paused(repo)))
      return { processed: 0, paused: true };
    for (
      let i = 0;
      i < 3 &&
      Date.now() - started < Math.min(options.budgetMs || 25000, 40000);
      i++
    ) {
      const job = await claimJob(repo, owner, now());
      if (!job) break;
      try {
        if (job.kind === "metrics") {
          await syncMetricsJob(repo, job, fetcher, now);
          count++;
          continue;
        }
        const t = await repo.getTarget(job.targetId!);
        if (t.scheduledAt && now() - Date.parse(t.scheduledAt) > 3600000)
          throw new SocialError(
            "schedule_missed",
            "This scheduled post is more than an hour late. Reschedule and approve it.",
            409,
          );
        const check = await assertApproval(repo, t, inventory);
        await publishingGate(repo, t);
        for (const a of check.assets) await assetBytes(a, fetcher);
        if (t.deliveryMode === "manual") {
          await finishJob(repo, job, "done", "manual_ready");
          await repo.audit("manual_package_ready", t.id, {
            revision: t.revision,
          });
          count++;
          continue;
        }
        if (!check.connection)
          throw new SocialError(
            "account_unavailable",
            "Connect this destination.",
            403,
          );
        const credential = await credentialsFor(
          repo,
          check.connection,
          fetcher,
          now(),
        );
        const adapter =
          options.adapters?.[t.provider] || adapterFor(t.provider);
        const ctx = providerContext(
          repo,
          job,
          t,
          check.connection,
          credential,
          inventory,
          fetcher,
          now,
        );
        const result = await adapter.step(t, check.assets, job.progress, ctx);
        await applyResult(repo, job, t, result, now());
        count++;
      } catch (error) {
        const e =
          error instanceof SocialError
            ? error
            : new SocialError(
                "provider_uncertain",
                "The operation was interrupted. Reconcile before reposting.",
                502,
              );
        const unfinished = await repo.client.execute({
          sql: "SELECT id FROM social_attempts WHERE job_id=? AND outcome IS NULL LIMIT 1",
          args: [job.id],
        });
        const uncertain =
          e.code === "provider_uncertain" ||
          unfinished.rows.length > 0 ||
          e.code === "lease_lost" ||
          !!job.progress.postId;
        if (e.code === "account_unavailable" && job.connectionId) {
          const c = await repo.getConnection(job.connectionId);
          await reconnectRequired(repo, c);
        }
        const retry = !uncertain && e.retryable && job.attempts < 5;
        await finishJob(
          repo,
          job,
          uncertain ? "uncertain" : retry ? "retry_wait" : "blocked",
          uncertain ? "uncertain" : retry ? "retry_wait" : "blocked",
          { lastErrorCode: e.code },
          job.progress,
          new Date(
            now() + Math.min(300000, 30000 * 2 ** Math.min(job.attempts, 4)),
          ).toISOString(),
        ).catch(() => {});
        await repo.audit("job_stopped", job.id, {
          code: e.code,
          uncertain: !!uncertain,
        });
        count++;
      }
    }
    return { processed: count, mode };
  } finally {
    await repo.client.execute({
      sql: "UPDATE social_worker_health SET last_completed_at=?,processed_count=? WHERE worker_id=?",
      args: [new Date(now()).toISOString(), count, owner],
    });
  }
}
async function applyResult(
  repo: SocialRepository,
  job: Job,
  t: Target,
  r: StepResult,
  now: number,
) {
  if (r.kind === "next") {
    await finishJob(
      repo,
      job,
      "ready",
      "processing",
      {
        externalOperationId:
          r.progress.containerId ||
          r.progress.postId ||
          r.progress.photoIds?.at(-1) ||
          r.progress.children?.at(-1) ||
          null,
      },
      r.progress,
      new Date(now + r.delayMs).toISOString(),
    );
    return;
  }
  if (r.kind === "published") {
    await finishJob(repo, job, "done", "published", {
      externalPostId: r.postId,
      permalink: r.permalink || null,
      lastErrorCode: null,
    });
    await repo.audit("public_post_verified", t.id, { postId: r.postId });
    return;
  }
  if (r.kind === "test_completed") {
    await finishJob(repo, job, "done", "test_completed", {
      externalOperationId: r.operationId,
      lastErrorCode: null,
    });
    return;
  }
  await finishJob(repo, job, "done", "awaiting_creator", {
    externalOperationId: r.operationId,
  });
}
async function syncMetricsJob(
  repo: SocialRepository,
  job: Job,
  fetcher: typeof fetch,
  now: () => number,
) {
  const c = await repo.getConnection(job.connectionId!);
  const credentials = await credentialsFor(repo, c, fetcher, now());
  const ctx: ProviderContext = {
    connection: c,
    credentials,
    fetcher,
    now,
    write: async () => {
      throw new SocialError("unauthorized", "Metrics cannot publish.", 403);
    },
  };
  const targets = await repo.client.execute({
    sql: "SELECT * FROM social_targets WHERE connection_id=? AND status='published' AND id>? ORDER BY id LIMIT 10",
    args: [c.id, job.progress.metricsCursor || ""],
  });
  for (const row of targets.rows) {
    const t = targetRow(row);
    if (t.externalPostId)
      await repo.recordMetrics(
        c.id,
        await adapterFor(c.provider).metrics(ctx, t.externalPostId),
      );
  }
  await repo.client.execute({
    sql: "UPDATE social_jobs SET state=?,payload_json=?,lease_owner=NULL,lease_until=NULL,updated_at=? WHERE id=? AND fence=? AND lease_owner=?",
    args: [
      targets.rows.length === 10 ? "ready" : "done",
      JSON.stringify({
        ...job.progress,
        metricsCursor: targets.rows.at(-1)?.id || job.progress.metricsCursor,
      }),
      new Date(now()).toISOString(),
      job.id,
      job.fence,
      job.leaseOwner,
    ],
  });
}
export async function reconcileTarget(
  repo: SocialRepository,
  id: string,
  inventory: InventoryReader,
  fetcher: typeof fetch = fetch,
) {
  const t = await repo.getTarget(id);
  if (t.status !== "uncertain" || !t.connectionId)
    throw new SocialError(
      "provider_uncertain",
      "Only uncertain API operations can be reconciled.",
      409,
    );
  const rows = await repo.client.execute({
    sql: "SELECT * FROM social_jobs WHERE target_id=? AND state='uncertain' ORDER BY created_at DESC LIMIT 1",
    args: [id],
  });
  if (!rows.rows[0])
    throw new SocialError("not_found", "Uncertain job not found.", 404);
  const job = jobRow(rows.rows[0]);
  const c = await repo.getConnection(t.connectionId),
    credentials = await credentialsFor(repo, c, fetcher);
  const result = await adapterFor(t.provider).reconcile(t, job.progress, {
    connection: c,
    credentials,
    fetcher,
    now: Date.now,
    write: async () => {
      throw new SocialError(
        "unauthorized",
        "Reconciliation is read-only.",
        403,
      );
    },
  });
  if (!result || result.kind === "next")
    throw new SocialError(
      "provider_uncertain",
      "No unique read-only publication evidence exists. Check the native account; automatic reposting stays disabled.",
      409,
    );
  await repo.tx(async (tx) => {
    const fresh = await repo.getTarget(id, tx);
    if (fresh.status !== "uncertain")
      throw new SocialError(
        "revision_conflict",
        "Outcome already changed.",
        409,
      );
    await writeTarget(
      tx,
      {
        ...fresh,
        status:
          result.kind === "published"
            ? "published"
            : result.kind === "test_completed"
              ? "test_completed"
              : "awaiting_creator",
        externalPostId: result.kind === "published" ? result.postId : null,
        externalOperationId:
          result.kind === "published"
            ? fresh.externalOperationId
            : result.operationId,
        permalink:
          result.kind === "published" ? result.permalink || null : null,
        lastErrorCode: null,
      },
      fresh.revision,
    );
    await tx.execute({
      sql: "UPDATE social_jobs SET state='done' WHERE id=? AND state='uncertain'",
      args: [job.id],
    });
  });
}
export async function scanInventory(
  repo: SocialRepository,
  inventory: InventoryReader,
) {
  await repo.init();
  const rows = await repo.client.execute(
    "SELECT * FROM social_targets WHERE status IN ('approved','scheduled','queued','processing','published','manually_reported') LIMIT 400",
  );
  let blocked = 0;
  for (const row of rows.rows) {
    const t = targetRow(row),
      p = await repo.getPost(t.postId);
    if (p.intent !== "availability" || !p.artworkId) continue;
    const a = await inventory(p.artworkId);
    if (a?.published && a.status === "available") continue;
    if (["published", "manually_reported"].includes(t.status)) {
      await repo.audit("historical_availability_review", t.id, {
        reason: "artwork_unavailable",
      });
      continue;
    }
    if (t.status === "processing") continue;
    await repo.tx(async (tx) => {
      const current = await repo.getTarget(t.id, tx);
      if (!["approved", "scheduled", "queued"].includes(current.status)) return;
      await writeTarget(
        tx,
        { ...current, status: "blocked", lastErrorCode: "artwork_unavailable" },
        current.revision,
      );
      await tx.execute({
        sql: "UPDATE social_jobs SET state='blocked',last_error_code='artwork_unavailable' WHERE target_id=? AND state IN ('ready','retry_wait')",
        args: [t.id],
      });
    });
    blocked++;
  }
  return { blocked };
}
