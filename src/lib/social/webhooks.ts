import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";
import { hash, open } from "./crypto.ts";
import { providerConfig, socialConfig } from "./config.ts";
import { SocialError, type Platform, type Connection } from "./types.ts";
import {
  SocialRepository,
  decode,
  targetRow,
  writeTarget,
} from "./repository.ts";
export function verifyMetaBody(
  raw: string | Uint8Array,
  signature: string | null,
  secret: string,
) {
  if (!secret || !signature || !/^sha256=[a-f0-9]{64}$/.test(signature))
    throw new SocialError("unauthorized", "Invalid webhook signature.", 403);
  const expected = createHmac("sha256", secret).update(raw).digest();
  if (!timingSafeEqual(expected, Buffer.from(signature.slice(7), "hex")))
    throw new SocialError("unauthorized", "Invalid webhook signature.", 403);
}
export function verifySignedRequest(value: string, secret: string) {
  const parts = value.split(".");
  if (
    !secret ||
    parts.length !== 2 ||
    !parts.every((p) => /^[A-Za-z0-9_-]+$/.test(p))
  )
    throw new SocialError(
      "unauthorized",
      "Invalid signed platform request.",
      403,
    );
  const signature = Buffer.from(parts[0], "base64url"),
    expected = createHmac("sha256", secret).update(parts[1]).digest();
  if (
    signature.length !== expected.length ||
    !timingSafeEqual(signature, expected)
  )
    throw new SocialError(
      "unauthorized",
      "Invalid signed platform request.",
      403,
    );
  let p;
  try {
    p = JSON.parse(Buffer.from(parts[1], "base64url").toString());
  } catch {
    throw new SocialError(
      "validation_failed",
      "Invalid signed request data.",
      400,
    );
  }
  if (
    p.algorithm !== "HMAC-SHA256" ||
    typeof p.user_id !== "string" ||
    !/^\d+$/.test(p.user_id)
  )
    throw new SocialError(
      "unauthorized",
      "Signed request identity could not be verified.",
      403,
    );
  return { userId: p.user_id };
}
export async function receiveMetaEvent(
  repo: SocialRepository,
  provider: Platform,
  raw: string | Uint8Array,
  signature: string | null,
) {
  if (!["instagram", "facebook"].includes(provider))
    throw new SocialError(
      "unsupported",
      "This provider’s webhook product is not configured.",
      503,
    );
  const secret = process.env.SOCIAL_META_WEBHOOK_APP_SECRET;
  if (!secret)
    throw new SocialError(
      "not_configured",
      "Meta webhook app secret is not configured.",
      503,
    );
  verifyMetaBody(raw, signature, secret);
  let body;
  try {
    body = JSON.parse(
      typeof raw === "string" ? raw : Buffer.from(raw).toString("utf8"),
    );
  } catch {
    throw new SocialError("validation_failed", "Invalid webhook body.", 400);
  }
  if (!Array.isArray(body.entry) || body.entry.length > 100)
    throw new SocialError("validation_failed", "Invalid webhook entries.", 400);
  await repo.init();
  const env = socialConfig().environment;
  let accepted = 0;
  for (const entry of body.entry) {
    if (typeof entry.id !== "string") continue;
    const known = await repo.client.execute({
      sql: "SELECT id FROM social_connections WHERE provider=? AND external_account_id=? AND environment=? AND status='connected'",
      args: [provider, entry.id, env],
    });
    if (!known.rows[0]) continue;
    const key = hash(
      Buffer.concat([Buffer.from(raw), Buffer.from(":" + entry.id)]),
    );
    const r = await repo.client.execute({
      sql: "INSERT INTO social_webhook_events(provider,event_key,connection_id,received_at,state,payload_json,attempts,processed_at) VALUES (?,?,?,?,'processed',?,1,?) ON CONFLICT(provider,event_key) DO NOTHING",
      args: [
        provider,
        key,
        known.rows[0].id,
        new Date().toISOString(),
        JSON.stringify({
          fields: Array.isArray(entry.changes)
            ? entry.changes
                .map((x: { field?: unknown }) =>
                  typeof x.field === "string"
                    ? x.field.slice(0, 80)
                    : "unknown",
                )
                .slice(0, 30)
            : [],
          note: "Receipt only; no publishing authorization",
        }),
        new Date().toISOString(),
      ],
    });
    accepted += r.rowsAffected;
  }
  return { accepted };
}
export async function deleteProviderData(
  repo: SocialRepository,
  provider: Platform,
  signed: string,
) {
  if (!["instagram", "facebook"].includes(provider))
    throw new SocialError(
      "unsupported",
      "Provider deletion callbacks are not configured for this platform.",
      503,
    );
  const secret = providerConfig(provider).clientSecret;
  if (!secret)
    throw new SocialError(
      "not_configured",
      "The provider app secret is required.",
      503,
    );
  const subject = verifySignedRequest(signed, secret);
  await repo.init();
  const eventKey = hash(signed);
  return repo.tx(async (tx) => {
    const old = await tx.execute({
      sql: "SELECT payload_json FROM social_webhook_events WHERE provider=? AND event_key=?",
      args: [provider, eventKey],
    });
    if (old.rows[0])
      return decode<{ confirmationCode: string }>(old.rows[0].payload_json);
    const rows = await tx.execute({
      sql: "SELECT data,id,credential_id FROM social_connections WHERE provider=? AND environment=?",
      args: [provider, socialConfig().environment],
    });
    const code = randomBytes(24).toString("base64url");
    for (const row of rows.rows) {
      const c = decode<Connection>(row.data);
      if (
        c.metadata.authSubjectId !== subject.userId &&
        c.externalId !== subject.userId
      )
        continue;
      const targets = await tx.execute({
        sql: "SELECT * FROM social_targets WHERE connection_id=?",
        args: [row.id],
      });
      for (const targetRowValue of targets.rows) {
        const t = targetRow(targetRowValue);
        const status = [
          "published",
          "test_completed",
          "manually_reported",
          "awaiting_creator",
          "failed",
          "canceled",
        ].includes(t.status)
          ? t.status
          : t.status === "processing"
            ? "uncertain"
            : t.status === "uncertain"
              ? "uncertain"
              : "blocked";
        await writeTarget(
          tx,
          {
            ...t,
            connectionId: null,
            status,
            approvedHash: null,
            approvedRevision: null,
            approvedAt: null,
            externalPostId: null,
            externalOperationId: null,
            permalink: null,
            lastErrorCode: "provider_data_deleted",
          },
          t.revision,
        );
        await tx.execute({
          sql: "UPDATE social_targets SET connection_id=NULL,approved_snapshot=NULL WHERE id=?",
          args: [t.id],
        });
        await tx.execute({
          sql: "UPDATE social_attempts SET external_operation_id=NULL,external_post_id=NULL,provider_request_id=NULL WHERE target_id=?",
          args: [t.id],
        });
      }
      await tx.execute({
        sql: "DELETE FROM social_credentials WHERE id=?",
        args: [row.credential_id],
      });
      await tx.execute({
        sql: "DELETE FROM social_metrics WHERE connection_id=?",
        args: [row.id],
      });
      await tx.execute({
        sql: "DELETE FROM social_provider_artifacts WHERE connection_id=?",
        args: [row.id],
      });
      await tx.execute({
        sql: "UPDATE social_jobs SET state=CASE WHEN state IN ('running','uncertain') THEN 'uncertain' WHEN state IN ('done','canceled') THEN state ELSE 'blocked' END,connection_id=NULL,payload_json='{\"schema\":1}',last_error_code='provider_data_deleted' WHERE connection_id=?",
        args: [row.id],
      });
      await tx.execute({
        sql: "DELETE FROM social_connections WHERE id=?",
        args: [row.id],
      });
    }
    const candidates = await tx.execute({
      sql: "SELECT id,encrypted_candidate_payload FROM social_connection_candidates WHERE provider=?",
      args: [provider],
    });
    for (const r of candidates.rows) {
      try {
        const candidate = open<{
          identity: {
            externalId: string;
            metadata: { authSubjectId?: string };
          };
        }>(
          String(r.encrypted_candidate_payload),
          `${socialConfig().environment}:${provider}:${r.id}`,
        );
        if (
          candidate.identity.externalId === subject.userId ||
          candidate.identity.metadata.authSubjectId === subject.userId
        )
          await tx.execute({
            sql: "DELETE FROM social_connection_candidates WHERE id=?",
            args: [r.id],
          });
      } catch {}
    }
    const now = new Date().toISOString();
    await tx.execute({
      sql: "INSERT INTO social_deletion_requests VALUES (?,'complete',?)",
      args: [hash(code), now],
    });
    await tx.execute({
      sql: "INSERT INTO social_webhook_events VALUES (?,?,NULL,?,'processed',?,1,?)",
      args: [
        provider,
        eventKey,
        now,
        JSON.stringify({ confirmationCode: code }),
        now,
      ],
    });
    return { confirmationCode: code };
  });
}
