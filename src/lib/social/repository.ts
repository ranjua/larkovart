import { campaignUrl } from "./links.ts";
import {
  createClient,
  type Client,
  type Transaction,
  type Row,
} from "@libsql/client";
import { randomUUID } from "node:crypto";
import { db as guardedCommerceDb } from "../store.ts";
import { migrateSocial, transaction, serializedClient } from "./migrations.ts";
import { socialConfig } from "./config.ts";
import { hash, stable, open } from "./crypto.ts";
import { assertTransition } from "./transitions.ts";
import {
  SocialError,
  type Post,
  type Target,
  type Asset,
  type Connection,
  type Job,
  type Metric,
} from "./types.ts";
export type Executor = Pick<Client, "execute"> | Transaction;
const iso = () => new Date().toISOString();
export function decode<T>(value: unknown): T {
  if (typeof value !== "string" || value.length > 8_000_000)
    throw new SocialError(
      "storage_error",
      "Stored social data needs review.",
      503,
    );
  try {
    return JSON.parse(value);
  } catch {
    throw new SocialError(
      "storage_error",
      "Stored social data needs review.",
      503,
    );
  }
}
export function targetRow(r: Row): Target {
  return {
    ...decode<Target>(r.data),
    revision: Number(r.revision),
    status: r.status as Target["status"],
    approvedHash: r.approved_hash as string | null,
  };
}
export function jobRow(r: Row): Job {
  return {
    id: String(r.id),
    targetId: r.target_id as string | null,
    connectionId: r.connection_id as string | null,
    kind: r.kind as Job["kind"],
    operationKey: String(r.operation_key),
    state: r.state as Job["state"],
    runAt: String(r.run_at),
    leaseOwner: r.lease_owner as string | null,
    leaseUntil: r.lease_until === null ? null : Number(r.lease_until),
    fence: Number(r.fence),
    attempts: Number(r.attempts),
    progress: decode(r.payload_json),
    lastErrorCode: r.last_error_code as string | null,
    createdAt: String(r.created_at),
  };
}
export async function writeTarget(
  tx: Executor,
  t: Target,
  expectedRevision: number,
) {
  const current = await tx.execute({
    sql: "SELECT status FROM social_targets WHERE id=? AND revision=?",
    args: [t.id, expectedRevision],
  });
  if (!current.rows[0])
    throw new SocialError("revision_conflict", "Destination changed.", 409);
  assertTransition(current.rows[0].status as Target["status"], t.status);
  const r = await tx.execute({
    sql: "UPDATE social_targets SET revision=?,status=?,scheduled_at=?,approved_hash=?,data=?,updated_at=? WHERE id=? AND revision=?",
    args: [
      t.revision,
      t.status,
      t.scheduledAt,
      t.approvedHash,
      JSON.stringify(t),
      iso(),
      t.id,
      expectedRevision,
    ],
  });
  if (r.rowsAffected !== 1)
    throw new SocialError(
      "revision_conflict",
      "This draft changed. Reload before continuing.",
      409,
    );
}
export class SocialRepository {
  client: Client;
  ready: Promise<void> | undefined;
  constructor(client: Client) {
    this.client = serializedClient(client);
  }
  async init() {
    if (!this.ready)
      this.ready = migrateSocial(this.client).catch((e) => {
        this.ready = undefined;
        throw e;
      });
    await this.ready;
  }
  async tx<T>(fn: (tx: Transaction) => Promise<T>) {
    await this.init();
    return transaction(this.client, fn);
  }
  async getPost(id: string, tx: Executor = this.client): Promise<Post> {
    await this.init();
    const r = await tx.execute({
      sql: "SELECT * FROM social_posts WHERE id=?",
      args: [id],
    });
    const v = r.rows[0];
    if (!v) throw new SocialError("not_found", "Draft not found.", 404);
    return {
      id: String(v.id),
      title: String(v.title),
      artworkId: v.artwork_id as string | null,
      campaign: String(v.campaign),
      intent: v.intent as Post["intent"],
      revision: Number(v.revision),
      archivedAt: v.archived_at as string | null,
      createdAt: String(v.created_at),
      updatedAt: String(v.updated_at),
    };
  }
  async getTarget(id: string, tx: Executor = this.client) {
    await this.init();
    const r = await tx.execute({
      sql: "SELECT * FROM social_targets WHERE id=?",
      args: [id],
    });
    if (!r.rows[0])
      throw new SocialError("not_found", "Destination not found.", 404);
    return targetRow(r.rows[0]);
  }
  async getAsset(id: string) {
    await this.init();
    const r = await this.client.execute({
      sql: "SELECT data FROM social_assets WHERE id=? AND verification_state='verified'",
      args: [id],
    });
    if (!r.rows[0])
      throw new SocialError("media_invalid", "Verified media not found.", 422);
    return decode<Asset>(r.rows[0].data);
  }
  async addAsset(a: Asset) {
    await this.init();
    await this.client.execute({
      sql: "INSERT INTO social_assets(id,storage_key,sha256,verification_state,data,created_at) VALUES (?,?,?,'verified',?,?) ON CONFLICT(storage_key,sha256) DO NOTHING",
      args: [a.id, a.storageKey, a.sha256, JSON.stringify(a), iso()],
    });
    const r = await this.client.execute({
      sql: "SELECT data FROM social_assets WHERE storage_key=? AND sha256=?",
      args: [a.storageKey, a.sha256],
    });
    return decode<Asset>(r.rows[0].data);
  }
  async getConnection(id: string, tx: Executor = this.client) {
    await this.init();
    const r = await tx.execute({
      sql: "SELECT data,status,connection_generation FROM social_connections WHERE id=? AND environment=?",
      args: [id, socialConfig().environment],
    });
    if (!r.rows[0])
      throw new SocialError(
        "account_unavailable",
        "Connection not found in this environment.",
        404,
      );
    return {
      ...decode<Connection>(r.rows[0].data),
      status: r.rows[0].status as Connection["status"],
      generation: Number(r.rows[0].connection_generation),
    };
  }
  async createPost(input: {
    requestId: string;
    title: string;
    artworkId: string | null;
    campaign: string;
    intent: Post["intent"];
    targets: Omit<
      Target,
      | "id"
      | "postId"
      | "revision"
      | "status"
      | "approvedHash"
      | "approvedRevision"
      | "approvedAt"
      | "inventoryFingerprint"
      | "connectionGeneration"
      | "externalOperationId"
      | "externalPostId"
      | "permalink"
      | "lastErrorCode"
      | "createdAt"
      | "updatedAt"
    >[];
  }) {
    return this.tx(async (tx) => {
      const fingerprint = hash(stable(input));
      const old = await tx.execute({
        sql: "SELECT body_hash,resource_id FROM social_request_keys WHERE actor='studio-admin' AND operation='create' AND request_key=?",
        args: [input.requestId],
      });
      if (old.rows[0]) {
        if (old.rows[0].body_hash !== fingerprint)
          throw new SocialError(
            "revision_conflict",
            "Request ID was already used with different content.",
            409,
          );
        return String(old.rows[0].resource_id);
      }
      const id = randomUUID(),
        now = iso();
      await tx.execute({
        sql: "INSERT INTO social_posts VALUES (?,?,?,?,?,?,NULL,?,?)",
        args: [
          id,
          input.title,
          input.artworkId,
          input.campaign,
          input.intent,
          1,
          now,
          now,
        ],
      });
      for (const item of input.targets) {
        if (item.connectionId) {
          const c = await this.getConnection(item.connectionId, tx);
          if (c.provider !== item.provider)
            throw new SocialError(
              "account_unavailable",
              "Connection belongs to another platform.",
              422,
            );
        }
        for (const assetId of item.assetIds) {
          const a = await tx.execute({
            sql: "SELECT id FROM social_assets WHERE id=? AND verification_state='verified'",
            args: [assetId],
          });
          if (!a.rows[0])
            throw new SocialError(
              "media_invalid",
              "Choose verified media.",
              422,
            );
        }
        const t: Target = {
          ...item,
          id: randomUUID(),
          postId: id,
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
          t.linkUrl = campaignUrl(t.linkUrl, t.provider, t.id, input.campaign);
        await tx.execute({
          sql: "INSERT INTO social_targets(id,post_id,provider,connection_id,revision,status,scheduled_at,approved_hash,data,created_at,updated_at) VALUES (?,?,?,?,1,'draft',?,NULL,?,?,?)",
          args: [
            t.id,
            id,
            t.provider,
            t.connectionId,
            t.scheduledAt,
            JSON.stringify(t),
            now,
            now,
          ],
        });
      }
      await tx.execute({
        sql: "INSERT INTO social_request_keys VALUES ('studio-admin','create',?,?,?,?,?)",
        args: [
          input.requestId,
          fingerprint,
          id,
          now,
          new Date(Date.now() + 7 * 86400000).toISOString(),
        ],
      });
      return id;
    });
  }
  async updateTarget(
    id: string,
    expectedRevision: number,
    input: Partial<Target>,
  ) {
    return this.tx(async (tx) => {
      const old = await this.getTarget(id, tx);
      if (old.revision !== expectedRevision)
        throw new SocialError(
          "revision_conflict",
          "This draft changed. Reload before editing.",
          409,
        );
      if (
        [
          "processing",
          "uncertain",
          "published",
          "test_completed",
          "manually_reported",
          "awaiting_creator",
          "canceled",
        ].includes(old.status)
      )
        throw new SocialError(
          "approval_stale",
          "This destination has started or completed. Create a new draft.",
          409,
        );
      if (input.connectionId) {
        const c = await this.getConnection(input.connectionId, tx);
        if (c.provider !== old.provider)
          throw new SocialError(
            "account_unavailable",
            "Wrong platform account.",
            422,
          );
      }
      const next = {
        ...old,
        ...input,
        id: old.id,
        postId: old.postId,
        provider: old.provider,
        revision: old.revision + 1,
        status: "draft" as const,
        approvedHash: null,
        approvedRevision: null,
        approvedAt: null,
        inventoryFingerprint: null,
        connectionGeneration: null,
        lastErrorCode: null,
        updatedAt: iso(),
      };
      await writeTarget(tx, next, old.revision);
      await tx.execute({
        sql: "UPDATE social_targets SET connection_id=?,approved_snapshot=NULL WHERE id=?",
        args: [next.connectionId, id],
      });
      await tx.execute({
        sql: "UPDATE social_jobs SET state='canceled',updated_at=? WHERE target_id=? AND state IN ('ready','retry_wait','blocked')",
        args: [iso(), id],
      });
      return next;
    });
  }
  async audit(
    action: string,
    id: string,
    summary: Record<string, string | number | boolean | null> = {},
  ) {
    await this.init();
    await this.client.execute({
      sql: "INSERT INTO social_audit_events VALUES (?,'studio-admin',?,'social',?,?,?)",
      args: [randomUUID(), action, id, JSON.stringify(summary), iso()],
    });
  }
  async state() {
    await this.init();
    const [
      posts,
      targets,
      assets,
      connections,
      jobs,
      metrics,
      activity,
      health,
      settings,
      candidates,
    ] = await Promise.all(
      [
        "SELECT id FROM social_posts WHERE archived_at IS NULL ORDER BY created_at DESC LIMIT 100",
        "SELECT * FROM social_targets WHERE post_id IN (SELECT id FROM social_posts WHERE archived_at IS NULL) ORDER BY created_at DESC LIMIT 400",
        "SELECT data FROM social_assets WHERE verification_state='verified' ORDER BY created_at DESC LIMIT 100",
        {
          sql: "SELECT data,status,connection_generation FROM social_connections WHERE environment=? ORDER BY created_at DESC LIMIT 40",
          args: [socialConfig().environment],
        },
        "SELECT * FROM social_jobs ORDER BY created_at DESC LIMIT 100",
        "SELECT * FROM social_metrics ORDER BY collected_at DESC LIMIT 200",
        "SELECT action,subject_id,summary_json,created_at FROM social_audit_events ORDER BY created_at DESC LIMIT 100",
        "SELECT * FROM social_worker_health ORDER BY last_started_at DESC LIMIT 10",
        "SELECT * FROM social_settings",
        {
          sql: "SELECT id,provider,external_resource_id,expires_at,encrypted_candidate_payload FROM social_connection_candidates WHERE selected_at IS NULL AND expires_at>? LIMIT 50",
          args: [Date.now()],
        },
      ].map((s) => this.client.execute(s)),
    );
    return {
      posts: await Promise.all(
        posts.rows.map((r) => this.getPost(String(r.id))),
      ),
      targets: targets.rows.map(targetRow),
      assets: assets.rows.map((r) => decode<Asset>(r.data)),
      connections: connections.rows.map((r) => {
        const c = decode<Connection>(r.data);
        return {
          ...c,
          metadata: {
            selected: c.metadata.selected,
            tasks: c.metadata.tasks,
            accessTier: c.metadata.accessTier,
          },
          status: r.status,
          generation: Number(r.connection_generation),
        };
      }),
      jobs: jobs.rows.map(jobRow),
      metrics: metrics.rows,
      activity: activity.rows,
      health: health.rows,
      paused: settings.rows.some(
        (r) => r.key === "paused" && r.value_json === "true",
      ),
      candidates: candidates.rows.map((r) => {
        let displayName = "Managed Page";
        try {
          const item = open<{ identity: { displayName: string } }>(
            String(r.encrypted_candidate_payload),
            `${socialConfig().environment}:${r.provider}:${r.id}`,
          );
          displayName = item.identity.displayName;
        } catch {}
        return {
          id: r.id,
          provider: r.provider,
          external_resource_id: r.external_resource_id,
          expires_at: r.expires_at,
          displayName,
        };
      }),
    };
  }
  async recordMetrics(connectionId: string, metrics: Metric[]) {
    await this.init();
    await this.tx(async (tx) => {
      for (const m of metrics) {
        const snapshot = hash(
          stable({
            connectionId,
            post: m.externalPostId,
            key: m.key,
            day: m.collectedAt.slice(0, 10),
            definition: m.definition,
          }),
        );
        await tx.execute({
          sql: "INSERT INTO social_metrics VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(snapshot_key) DO UPDATE SET value=excluded.value,collected_at=excluded.collected_at,status=excluded.status",
          args: [
            randomUUID(),
            snapshot,
            connectionId,
            m.externalPostId,
            m.key,
            m.value,
            m.unit,
            m.aggregation,
            m.periodStart ?? null,
            m.periodEnd ?? null,
            m.collectedAt,
            m.definition,
            m.value === null ? "unavailable" : "verified",
            JSON.stringify({ endpoint: m.source }),
          ],
        });
      }
    });
  }
}
let singleton: SocialRepository | undefined;
export function socialRepository() {
  if (singleton) return singleton;
  const c = socialConfig();
  const url = process.env.SOCIAL_DATABASE_URL;
  if (
    c.environment === "production" &&
    (!url || process.env.SOCIAL_DATABASE_ENVIRONMENT !== "production")
  )
    throw new SocialError(
      "not_configured",
      "Production social storage requires a separately configured social database.",
      503,
    );
  if (
    url &&
    process.env.SOCIAL_DATABASE_ENVIRONMENT !== c.environment &&
    !(
      c.environment === "preview" &&
      process.env.SOCIAL_DATABASE_ENVIRONMENT === "development"
    )
  )
    throw new SocialError(
      "not_configured",
      "Social database environment does not match.",
      503,
    );
  singleton = new SocialRepository(
    url
      ? createClient({ url, authToken: process.env.SOCIAL_DATABASE_AUTH_TOKEN })
      : (() => {
          guardedCommerceDb();
          const source =
            process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL;
          const local = !source || source.startsWith("file:");
          const socialUrl = local
            ? source
              ? source + ".social"
              : "file:.data/social.db"
            : source;
          return createClient({
            url: socialUrl,
            authToken: local
              ? undefined
              : process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN,
            concurrency: local ? 1 : 4,
          });
        })(),
  );
  return singleton;
}
