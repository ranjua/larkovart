import { campaignUrl } from "./links.ts";
import { randomUUID } from "node:crypto";
import type { z } from "zod";
import { SocialRepository, writeTarget, targetRow } from "./repository.ts";
import { createPostSchema, updateTargetSchema } from "./validation.ts";
import { SocialError, type Connection } from "./types.ts";
import type { InventoryReader } from "./inventory.ts";
import { credentialsFor } from "./credentials.ts";
import { adapterFor } from "./providers/registry.ts";
import { providerConfig } from "./config.ts";
import { providerRequest } from "./http.ts";
import { open, rotate } from "./crypto.ts";
import { credentialContext } from "./oauth.ts";
export async function createDraft(
  repo: SocialRepository,
  input: z.infer<typeof createPostSchema>,
  inventory: InventoryReader,
) {
  if (input.artworkId && !(await inventory(input.artworkId)))
    throw new SocialError(
      "artwork_unavailable",
      "Choose an artwork from this studio.",
      422,
    );
  return repo.createPost(input);
}
export async function editTarget(
  repo: SocialRepository,
  id: string,
  input: z.infer<typeof updateTargetSchema>,
) {
  for (const a of input.target.assetIds) await repo.getAsset(a);
  const old = await repo.getTarget(id);
  if (input.target.provider !== old.provider)
    throw new SocialError(
      "validation_failed",
      "Create a new destination to change platforms.",
      422,
    );
  const post = await repo.getPost(old.postId);
  return repo.updateTarget(id, input.expectedRevision, {
    ...input.target,
    linkUrl: input.target.linkUrl
      ? campaignUrl(
          input.target.linkUrl,
          input.target.provider,
          id,
          post.campaign,
        )
      : null,
  });
}
export async function verifyConnection(
  repo: SocialRepository,
  id: string,
  fetcher: typeof fetch = fetch,
) {
  const c = await repo.getConnection(id),
    credentials = await credentialsFor(repo, c, fetcher);
  const identity = await adapterFor(c.provider).identity({
    connection: c,
    credentials,
    fetcher,
    now: Date.now,
    write: async () => {
      throw new SocialError(
        "unauthorized",
        "Verification cannot publish.",
        403,
      );
    },
  });
  if (identity.externalId !== c.externalId) {
    await repo.client.execute({
      sql: "UPDATE social_connections SET status='reconnect_required' WHERE id=?",
      args: [id],
    });
    throw new SocialError(
      "account_unavailable",
      "Connected account identity changed. Reconnect and select it again.",
      409,
    );
  }
  c.displayName = identity.displayName;
  c.username = identity.username;
  c.lastVerifiedAt = new Date().toISOString();
  await repo.client.execute({
    sql: "UPDATE social_connections SET data=?,updated_at=? WHERE id=? AND connection_generation=?",
    args: [JSON.stringify(c), c.lastVerifiedAt, id, c.generation],
  });
  await repo.audit("identity_read_verified", id);
  return c;
}
export async function disconnect(repo: SocialRepository, id: string) {
  await repo.tx(async (tx) => {
    const c = await repo.getConnection(id, tx);
    await tx.execute({
      sql: "DELETE FROM social_credentials WHERE id=?",
      args: [c.credentialId],
    });
    await tx.execute({
      sql: "DELETE FROM social_provider_artifacts WHERE connection_id=?",
      args: [id],
    });
    await tx.execute({
      sql: "UPDATE social_connections SET status='disconnected',connection_generation=connection_generation+1,updated_at=? WHERE id=?",
      args: [new Date().toISOString(), id],
    });
    const targets = await tx.execute({
      sql: "SELECT * FROM social_targets WHERE connection_id=? AND status NOT IN ('published','test_completed','manually_reported','awaiting_creator','processing','uncertain','canceled')",
      args: [id],
    });
    for (const row of targets.rows) {
      const t = targetRow(row);
      await writeTarget(
        tx,
        { ...t, status: "blocked", lastErrorCode: "account_unavailable" },
        t.revision,
      );
    }
    await tx.execute({
      sql: "UPDATE social_jobs SET state='blocked',last_error_code='account_unavailable' WHERE connection_id=? AND state IN ('ready','retry_wait')",
      args: [id],
    });
  });
  await repo.audit("disconnected", id);
  return {
    localCredentialsRemoved: true,
    providerRevocation:
      "Remove the app in the platform’s account settings to revoke provider-side access as well.",
  };
}
export async function manualResult(
  repo: SocialRepository,
  id: string,
  revision: number,
  permalink: string | null,
) {
  return repo.tx(async (tx) => {
    const t = await repo.getTarget(id, tx);
    if (
      t.revision !== revision ||
      !["manual_ready", "awaiting_creator"].includes(t.status)
    )
      throw new SocialError(
        "revision_conflict",
        "Prepare the approved manual package before recording its native result.",
        409,
      );
    if (permalink) {
      const u = new URL(permalink),
        allowed = {
          instagram: ["www.instagram.com", "instagram.com"],
          facebook: ["www.facebook.com", "facebook.com"],
          pinterest: ["www.pinterest.com", "pinterest.com"],
          tiktok: ["www.tiktok.com", "tiktok.com"],
        };
      if (
        u.protocol !== "https:" ||
        u.username ||
        u.password ||
        !allowed[t.provider].includes(u.hostname)
      )
        throw new SocialError(
          "validation_failed",
          "Use the exact post link from this platform.",
          422,
        );
    }
    await writeTarget(
      tx,
      { ...t, status: "manually_reported", permalink, lastErrorCode: null },
      revision,
    );
    return { status: "manually_reported", verified: false };
  });
}
export async function archivePost(
  repo: SocialRepository,
  id: string,
  revision: number,
) {
  await repo.tx(async (tx) => {
    const p = await repo.getPost(id, tx);
    if (p.revision !== revision)
      throw new SocialError("revision_conflict", "Campaign changed.", 409);
    const active = await tx.execute({
      sql: "SELECT id FROM social_targets WHERE post_id=? AND status IN ('processing','uncertain') LIMIT 1",
      args: [id],
    });
    if (active.rows.length)
      throw new SocialError(
        "provider_uncertain",
        "Resolve in-flight operations before archiving.",
        409,
      );
    await tx.execute({
      sql: "UPDATE social_posts SET archived_at=?,revision=revision+1 WHERE id=? AND revision=?",
      args: [new Date().toISOString(), id, revision],
    });
    await tx.execute({
      sql: "UPDATE social_jobs SET state='canceled' WHERE target_id IN (SELECT id FROM social_targets WHERE post_id=?) AND state IN ('ready','retry_wait','blocked')",
      args: [id],
    });
  });
}
export async function enqueueMetrics(repo: SocialRepository, id: string) {
  const c = await repo.getConnection(id);
  if (c.status !== "connected")
    throw new SocialError(
      "account_unavailable",
      "Connect the account before syncing metrics.",
      403,
    );
  const now = new Date().toISOString(),
    key = `metrics:${id}:${now.slice(0, 13)}`;
  await repo.client.execute({
    sql: "INSERT INTO social_jobs(id,connection_id,kind,operation_key,state,run_at,payload_json,created_at,updated_at) VALUES (?,?,'metrics',?,'ready',?,'{\"schema\":1}',?,?) ON CONFLICT(operation_key) DO NOTHING",
    args: [randomUUID(), id, key, now, now, now],
  });
  return { queued: true };
}
export async function safeRetry(
  repo: SocialRepository,
  id: string,
  revision: number,
) {
  return repo.tx(async (tx) => {
    const t = await repo.getTarget(id, tx);
    if (t.revision !== revision || t.status !== "retry_wait")
      throw new SocialError(
        "provider_uncertain",
        "Only a definitely safe retry can run. Edit blocked content or reconcile uncertain outcomes.",
        409,
      );
    await tx.execute({
      sql: "UPDATE social_jobs SET run_at=?,state='ready' WHERE target_id=? AND state='retry_wait'",
      args: [new Date().toISOString(), id],
    });
  });
}
export async function cleanupSocial(repo: SocialRepository, now = Date.now()) {
  await repo.tx(async (tx) => {
    await tx.execute({
      sql: "DELETE FROM social_provider_artifacts WHERE expires_at<?",
      args: [now],
    });
    for (const [table, column, cutoff] of [
      ["social_oauth_states", "expires_at", now - 86400000],
      ["social_connection_candidates", "expires_at", now - 86400000],
    ] as const)
      await tx.execute({
        sql: `DELETE FROM ${table} WHERE ${column}<?`,
        args: [cutoff],
      });
    await tx.execute({
      sql: "DELETE FROM social_attempts WHERE finished_at IS NOT NULL AND started_at<? AND job_id IN (SELECT id FROM social_jobs WHERE state IN ('done','canceled'))",
      args: [new Date(now - 90 * 86400000).toISOString()],
    });
    await tx.execute({
      sql: "DELETE FROM social_audit_events WHERE created_at<?",
      args: [new Date(now - 90 * 86400000).toISOString()],
    });
    await tx.execute({
      sql: "DELETE FROM social_webhook_events WHERE connection_id IS NOT NULL AND processed_at<?",
      args: [new Date(now - 90 * 86400000).toISOString()],
    });
    await tx.execute({
      sql: "DELETE FROM social_metrics WHERE collected_at<?",
      args: [new Date(now - 365 * 86400000).toISOString()],
    });
    await tx.execute({
      sql: "DELETE FROM social_worker_health WHERE last_started_at<?",
      args: [new Date(now - 7 * 86400000).toISOString()],
    });
    await tx.execute({
      sql: "DELETE FROM social_request_keys WHERE expires_at<?",
      args: [new Date(now).toISOString()],
    });
  });
}
export async function rotateCredentialKeys(repo: SocialRepository) {
  await repo.init();
  const rows = await repo.client.execute(
    "SELECT id,provider,environment,encrypted_payload,generation FROM social_credentials LIMIT 1000",
  );
  let changed = 0;
  for (const r of rows.rows) {
    const context = `${r.environment}:${r.provider}:${r.id}`,
      encrypted = rotate(String(r.encrypted_payload), context);
    const result = await repo.client.execute({
      sql: "UPDATE social_credentials SET encrypted_payload=?,key_version=? WHERE id=? AND generation=? AND encrypted_payload=?",
      args: [
        encrypted,
        process.env.SOCIAL_TOKEN_ACTIVE_KEY || "1",
        r.id,
        r.generation,
        r.encrypted_payload,
      ],
    });
    changed += result.rowsAffected;
  }
  const candidates = await repo.client.execute(
    "SELECT id,provider,encrypted_candidate_payload FROM social_connection_candidates",
  );
  for (const r of candidates.rows) {
    const previous = String(r.encrypted_candidate_payload);
    const next = rotate(
      previous,
      `${(await import("./config.ts")).socialConfig().environment}:${r.provider}:${r.id}`,
    );
    const result = await repo.client.execute({
      sql: "UPDATE social_connection_candidates SET encrypted_candidate_payload=? WHERE id=? AND encrypted_candidate_payload=?",
      args: [next, r.id, previous],
    });
    changed += result.rowsAffected;
  }
  const artifacts = await repo.client.execute(
    "SELECT a.job_id,a.encrypted_payload,c.provider,c.environment FROM social_provider_artifacts a JOIN social_connections c ON c.id=a.connection_id",
  );
  for (const r of artifacts.rows) {
    const previous = String(r.encrypted_payload),
      next = rotate(
        previous,
        `${r.environment}:${r.provider}:artifact:${r.job_id}`,
      );
    const result = await repo.client.execute({
      sql: "UPDATE social_provider_artifacts SET encrypted_payload=? WHERE job_id=? AND encrypted_payload=?",
      args: [next, r.job_id, previous],
    });
    changed += result.rowsAffected;
  }
  return { rotated: changed };
}
export async function recentMedia(
  repo: SocialRepository,
  id: string,
  fetcher: typeof fetch = fetch,
) {
  const c = await repo.getConnection(id),
    credentials = await credentialsFor(repo, c, fetcher);
  const version = (await import("./config.ts")).socialConfig().version;
  const url =
    c.provider === "instagram"
      ? `https://graph.instagram.com/${version}/${c.externalId}/media?fields=id,caption,media_type,permalink,timestamp&limit=25`
      : c.provider === "facebook"
        ? `https://graph.facebook.com/${version}/${c.externalId}/posts?fields=id,message,permalink_url,created_time&limit=25`
        : c.provider === "pinterest"
          ? "https://api.pinterest.com/v5/pins?page_size=25"
          : null;
  if (!url)
    throw new SocialError(
      "policy_restricted",
      "Use TikTok native analytics and export.",
      403,
    );
  const r = await providerRequest(url, credentials.accessToken, { fetcher });
  const items = (r.data || r.items || []).slice(0, 25);
  return items.map((item: Record<string, unknown>) => ({
    id: typeof item.id === "string" ? item.id : "",
    caption: String(
      item.caption || item.message || item.description || "",
    ).slice(0, 2000),
    permalink:
      typeof (item.permalink || item.permalink_url) === "string"
        ? String(item.permalink || item.permalink_url)
        : c.provider === "pinterest" &&
            typeof item.id === "string" &&
            /^\d+$/.test(item.id)
          ? `https://www.pinterest.com/pin/${item.id}/`
          : null,
  }));
}
export async function updatePost(
  repo: SocialRepository,
  id: string,
  revision: number,
  fields: {
    title: string;
    campaign: string;
    intent: import("./types.ts").Intent;
    artworkId: string | null;
  },
  inventory: InventoryReader,
) {
  if (fields.artworkId && !(await inventory(fields.artworkId)))
    throw new SocialError("artwork_unavailable", "Artwork not found.", 422);
  await repo.tx(async (tx) => {
    const old = await repo.getPost(id, tx);
    if (old.revision !== revision)
      throw new SocialError(
        "revision_conflict",
        "Campaign changed. Reload before editing.",
        409,
      );
    const payloadChanged =
      old.intent !== fields.intent || old.artworkId !== fields.artworkId;
    const targets = await tx.execute({
      sql: "SELECT * FROM social_targets WHERE post_id=?",
      args: [id],
    });
    if (payloadChanged) {
      for (const r of targets.rows) {
        const t = targetRow(r);
        if (
          ![
            "draft",
            "approved",
            "scheduled",
            "queued",
            "blocked",
            "failed",
            "retry_wait",
          ].includes(t.status)
        )
          throw new SocialError(
            "provider_uncertain",
            "Create a new campaign to change the purpose or artwork of started/historical destinations.",
            409,
          );
        await writeTarget(
          tx,
          {
            ...t,
            revision: t.revision + 1,
            status: "draft",
            approvedHash: null,
            approvedAt: null,
            approvedRevision: null,
            inventoryFingerprint: null,
            connectionGeneration: null,
          },
          t.revision,
        );
      }
      await tx.execute({
        sql: "UPDATE social_jobs SET state='canceled' WHERE target_id IN (SELECT id FROM social_targets WHERE post_id=?) AND state IN ('ready','retry_wait','blocked')",
        args: [id],
      });
    }
    await tx.execute({
      sql: "UPDATE social_posts SET title=?,campaign=?,intent=?,artwork_id=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?",
      args: [
        fields.title,
        fields.campaign,
        fields.intent,
        fields.artworkId,
        new Date().toISOString(),
        id,
        revision,
      ],
    });
  });
}

export async function addTarget(
  repo: SocialRepository,
  postId: string,
  revision: number,
  input: z.infer<typeof import("./validation.ts").targetInput>,
) {
  for (const id of input.assetIds) await repo.getAsset(id);
  return repo.tx(async (tx) => {
    const p = await repo.getPost(postId, tx);
    if (p.revision !== revision || p.archivedAt)
      throw new SocialError(
        "revision_conflict",
        "Reload this active campaign before adding a destination.",
        409,
      );
    const existing = await tx.execute({
      sql: "SELECT provider FROM social_targets WHERE post_id=?",
      args: [postId],
    });
    if (
      existing.rows.length >= 4 ||
      existing.rows.some((r) => r.provider === input.provider)
    )
      throw new SocialError(
        "validation_failed",
        "This campaign already has that platform. Edit its version or create a new campaign.",
        422,
      );
    if (input.connectionId) {
      const c = await repo.getConnection(input.connectionId, tx);
      if (c.provider !== input.provider)
        throw new SocialError(
          "account_unavailable",
          "Choose the matching platform account.",
          422,
        );
    }
    const now = new Date().toISOString(),
      id = randomUUID(),
      t: import("./types.ts").Target = {
        ...input,
        id,
        postId,
        revision: 1,
        status: "draft",
        approvedHash: null,
        approvedRevision: null,
        approvedAt: null,
        inventoryFingerprint: null,
        connectionGeneration: null,
        externalOperationId: null,
        externalPostId: null,
        permalink: null,
        lastErrorCode: null,
        createdAt: now,
        updatedAt: now,
      };
    if (t.linkUrl)
      t.linkUrl = campaignUrl(t.linkUrl, t.provider, id, p.campaign);
    await tx.execute({
      sql: "INSERT INTO social_targets(id,post_id,provider,connection_id,revision,status,scheduled_at,approved_hash,data,created_at,updated_at) VALUES (?,?,?,?,1,'draft',?,NULL,?,?,?)",
      args: [
        id,
        postId,
        t.provider,
        t.connectionId,
        t.scheduledAt,
        JSON.stringify(t),
        now,
        now,
      ],
    });
    await tx.execute({
      sql: "UPDATE social_posts SET revision=revision+1,updated_at=? WHERE id=? AND revision=?",
      args: [now, postId, revision],
    });
    return { id };
  });
}
