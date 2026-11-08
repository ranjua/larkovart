import { randomUUID } from "node:crypto";
import { open, seal } from "./crypto.ts";
import { credentialContext } from "./oauth.ts";
import { SocialError, type Credentials, type Connection } from "./types.ts";
import { providerRequest, ProviderError } from "./http.ts";
import { providerConfig, socialConfig } from "./config.ts";
import type { SocialRepository } from "./repository.ts";
export async function reconnectRequired(repo: SocialRepository, c: Connection) {
  await repo.tx(async (tx) => {
    await tx.execute({
      sql: "UPDATE social_connections SET status='reconnect_required',updated_at=? WHERE id=?",
      args: [new Date().toISOString(), c.id],
    });
    await tx.execute({
      sql: "UPDATE social_jobs SET state='blocked',last_error_code='account_unavailable' WHERE connection_id=? AND state IN ('ready','retry_wait')",
      args: [c.id],
    });
  });
}
export async function credentialsFor(
  repo: SocialRepository,
  c: Connection,
  fetcher: typeof fetch = fetch,
  now = Date.now(),
): Promise<Credentials> {
  if (c.status !== "connected" || c.environment !== socialConfig().environment)
    throw new SocialError(
      "account_unavailable",
      "Reconnect this account in the correct environment.",
      403,
    );
  const result = await repo.client.execute({
    sql: "SELECT * FROM social_credentials WHERE id=? AND provider=? AND environment=?",
    args: [c.credentialId, c.provider, c.environment],
  });
  const row = result.rows[0];
  if (!row)
    throw new SocialError(
      "account_unavailable",
      "Account credentials were disconnected.",
      403,
    );
  if (row.refresh_lease_owner && Number(row.refresh_lease_until) < now) {
    await reconnectRequired(repo, c);
    throw new SocialError(
      "account_unavailable",
      "A previous credential renewal was interrupted. Reconnect safely.",
      503,
    );
  }
  const context = credentialContext(c.provider, c.credentialId),
    old = open<Credentials>(String(row.encrypted_payload), context);
  if (old.expiresAt === null || old.expiresAt > now + 300000) return old;
  if (
    old.expiresAt <= now ||
    c.provider === "facebook" ||
    (c.provider === "pinterest" &&
      (!old.refreshToken ||
        (old.refreshExpiresAt && old.refreshExpiresAt <= now)))
  ) {
    await reconnectRequired(repo, c);
    throw new SocialError(
      "account_unavailable",
      "This credential expired. Reconnect the account.",
      403,
    );
  }
  const owner = randomUUID();
  const lease = await repo.client.execute({
    sql: "UPDATE social_credentials SET refresh_lease_owner=?,refresh_lease_until=? WHERE id=? AND generation=? AND (refresh_lease_until IS NULL OR refresh_lease_until<?) RETURNING id",
    args: [owner, now + 60000, c.credentialId, row.generation, now],
  });
  if (!lease.rows.length)
    throw new SocialError(
      "account_refreshing",
      "Another worker is refreshing this account. Try again shortly.",
      503,
      true,
    );
  try {
    let response;
    if (c.provider === "instagram") {
      const u = new URL("https://graph.instagram.com/refresh_access_token");
      u.search = new URLSearchParams({
        grant_type: "ig_refresh_token",
        access_token: old.accessToken,
      }).toString();
      response = await providerRequest(u, null, { fetcher });
    } else if (c.provider === "pinterest") {
      const app = providerConfig("pinterest");
      if (!app.clientId || !app.clientSecret)
        throw new SocialError(
          "not_configured",
          "Pinterest app settings are missing.",
          503,
        );
      response = await providerRequest(
        "https://api.pinterest.com/v5/oauth/token",
        Buffer.from(`${app.clientId}:${app.clientSecret}`).toString("base64"),
        {
          method: "POST",
          basic: true,
          body: new URLSearchParams({
            grant_type: "refresh_token",
            refresh_token: old.refreshToken!,
          }),
          fetcher,
        },
      );
    } else
      throw new SocialError(
        "account_unavailable",
        "Reconnect this platform.",
        403,
      );
    if (
      typeof response.access_token !== "string" ||
      typeof response.expires_in !== "number" ||
      response.expires_in <= 0
    )
      throw new SocialError(
        "account_unavailable",
        "Credential renewal needs reconnection.",
        503,
      );
    const next: Credentials = {
      accessToken: response.access_token,
      expiresAt: now + response.expires_in * 1000,
      ...(typeof response.refresh_token === "string"
        ? { refreshToken: response.refresh_token }
        : old.refreshToken
          ? { refreshToken: old.refreshToken }
          : {}),
      ...(typeof response.refresh_token_expires_in === "number"
        ? { refreshExpiresAt: now + response.refresh_token_expires_in * 1000 }
        : old.refreshExpiresAt
          ? { refreshExpiresAt: old.refreshExpiresAt }
          : {}),
    };
    const updated = await repo.client.execute({
      sql: "UPDATE social_credentials SET encrypted_payload=?,key_version=?,generation=generation+1,access_expires_at=?,refresh_expires_at=?,refresh_lease_owner=NULL,refresh_lease_until=NULL,updated_at=? WHERE id=? AND generation=? AND refresh_lease_owner=?",
      args: [
        seal(next, context),
        socialConfig().activeKey,
        next.expiresAt,
        next.refreshExpiresAt ?? null,
        new Date(now).toISOString(),
        c.credentialId,
        row.generation,
        owner,
      ],
    });
    if (updated.rowsAffected !== 1) {
      await reconnectRequired(repo, c);
      throw new SocialError(
        "account_unavailable",
        "Credential generation changed during renewal. Reconnect.",
        409,
      );
    }
    return next;
  } catch (error) {
    if (error instanceof ProviderError && error.code === "rate_limited") {
      await repo.client.execute({
        sql: "UPDATE social_credentials SET refresh_lease_owner=NULL,refresh_lease_until=NULL WHERE id=? AND refresh_lease_owner=?",
        args: [c.credentialId, owner],
      });
      throw error;
    }
    await reconnectRequired(repo, c);
    throw new SocialError(
      "account_unavailable",
      "Credential renewal was not confirmed. Reconnect; rotated tokens will not be retried blindly.",
      503,
    );
  }
}
