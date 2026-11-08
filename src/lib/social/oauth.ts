import { randomBytes, randomUUID } from "node:crypto";
import { hash, seal, open } from "./crypto.ts";
import { socialConfig, providerConfig } from "./config.ts";
import {
  SocialError,
  type Platform,
  type Credentials,
  type Connection,
} from "./types.ts";
import { providerRequest } from "./http.ts";
import {
  SocialRepository,
  decode,
  writeTarget,
  targetRow,
} from "./repository.ts";
import { adapterFor } from "./providers/registry.ts";
import type { Identity, ProviderContext } from "./providers/contract.ts";
export const scopesFor = (p: Platform) =>
  ({
    instagram: [
      "instagram_business_basic",
      "instagram_business_content_publish",
    ],
    facebook: [
      "pages_show_list",
      "pages_read_engagement",
      "pages_manage_posts",
    ],
    pinterest: [
      "user_accounts:read",
      "boards:read",
      "boards:write",
      "pins:read",
      "pins:write",
    ],
    tiktok: [],
  })[p];
export function credentialContext(provider: Platform, id: string) {
  return `${socialConfig().environment}:${provider}:${id}`;
}
export function callbackUrl(provider: Platform) {
  const origin = socialConfig().origin;
  if (!origin)
    throw new SocialError(
      "not_configured",
      "Set the exact social OAuth callback origin in Vercel.",
      503,
    );
  return `${origin}/api/social/oauth/${provider}/callback`;
}
export async function startOAuth(repo: SocialRepository, provider: Platform) {
  if (provider === "tiktok")
    throw new SocialError(
      "policy_restricted",
      "Use TikTok manual export. Private-tool Direct Post is not eligible.",
      403,
    );
  const c = socialConfig(),
    p = providerConfig(provider);
  if (!c.enabled || !p.clientId || !p.clientSecret)
    throw new SocialError(
      "not_configured",
      `Add the ${provider} developer app settings before connecting.`,
      503,
    );
  if ((provider === "instagram" || provider === "facebook") && !c.version)
    throw new SocialError(
      "not_configured",
      "Pin a supported Meta Graph API version before connecting.",
      503,
    );
  const state = randomBytes(32).toString("base64url"),
    binding = randomBytes(32).toString("base64url"),
    redirect = callbackUrl(provider);
  const stateHash = hash(state);
  seal({ probe: true }, credentialContext(provider, stateHash));
  await repo.init();
  await repo.client.execute({
    sql: "INSERT INTO social_oauth_states VALUES (?,?,?,?,NULL,?,?,NULL,?,?)",
    args: [
      stateHash,
      provider,
      provider === "instagram"
        ? "instagram_login"
        : provider === "facebook"
          ? "facebook_page_login"
          : "pinterest_oauth",
      hash(binding),
      redirect,
      Date.now() + 600000,
      c.environment,
      new Date().toISOString(),
    ],
  });
  const url = new URL(
    provider === "instagram"
      ? "https://www.instagram.com/oauth/authorize"
      : provider === "facebook"
        ? `https://www.facebook.com/${c.version}/dialog/oauth`
        : "https://www.pinterest.com/oauth/",
  );
  url.search = new URLSearchParams({
    client_id: p.clientId,
    redirect_uri: redirect,
    response_type: "code",
    scope: scopesFor(provider).join(","),
    state,
  }).toString();
  return { url: url.href, binding };
}
export async function consumeState(
  repo: SocialRepository,
  provider: Platform,
  state: string,
  binding: string,
  now = Date.now(),
) {
  if (
    !/^[A-Za-z0-9_-]{43}$/.test(state) ||
    !/^[A-Za-z0-9_-]{43}$/.test(binding)
  )
    throw new SocialError(
      "unauthorized",
      "OAuth browser binding is missing. Start again from Studio.",
      403,
    );
  await repo.init();
  const r = await repo.client.execute({
    sql: "UPDATE social_oauth_states SET consumed_at=? WHERE state_hash=? AND provider=? AND browser_binding_hash=? AND environment=? AND consumed_at IS NULL AND expires_at>? AND redirect_uri=? RETURNING *",
    args: [
      now,
      hash(state),
      provider,
      hash(binding),
      socialConfig().environment,
      now,
      callbackUrl(provider),
    ],
  });
  if (!r.rows[0])
    throw new SocialError(
      "unauthorized",
      "OAuth request expired or was already used. Start again.",
      403,
    );
  return r.rows[0];
}
function tokenObject(r: Record<string, unknown>): Credentials {
  if (typeof r.access_token !== "string" || r.access_token.length < 8)
    throw new SocialError(
      "account_unavailable",
      "The platform did not return a usable credential. Reconnect.",
      502,
    );
  return {
    accessToken: r.access_token,
    ...(typeof r.refresh_token === "string"
      ? { refreshToken: r.refresh_token }
      : {}),
    expiresAt:
      typeof r.expires_in === "number"
        ? Date.now() + r.expires_in * 1000
        : null,
    ...(typeof r.refresh_token_expires_in === "number"
      ? { refreshExpiresAt: Date.now() + r.refresh_token_expires_in * 1000 }
      : {}),
  };
}
function bareContext(
  connection: Connection,
  credentials: Credentials,
  fetcher: typeof fetch,
): ProviderContext {
  return {
    connection,
    credentials,
    fetcher,
    now: Date.now,
    write: async () => {
      throw new SocialError(
        "unauthorized",
        "OAuth does not authorize publishing.",
        403,
      );
    },
  };
}
export async function storeConnection(
  repo: SocialRepository,
  p: Platform,
  identity: Identity,
  credentials: Credentials,
) {
  const env = socialConfig().environment;
  return repo.tx(async (tx) => {
    const existing = await tx.execute({
      sql: "SELECT * FROM social_connections WHERE provider=? AND external_account_id=? AND environment=?",
      args: [p, identity.externalId, env],
    });
    const id = existing.rows[0] ? String(existing.rows[0].id) : randomUUID(),
      credentialId = randomUUID(),
      now = new Date().toISOString();
    const generation = existing.rows[0]
      ? Number(existing.rows[0].connection_generation) + 1
      : 1;
    const conn: Connection = {
      id,
      provider: p,
      externalId: identity.externalId,
      displayName: identity.displayName,
      username: identity.username,
      status: "connected",
      credentialId,
      generation,
      scopes: identity.scopes,
      metadata: { ...identity.metadata, selected: false },
      environment: env,
      lastVerifiedAt: now,
      createdAt: existing.rows[0] ? String(existing.rows[0].created_at) : now,
    };
    const encrypted = seal(credentials, credentialContext(p, credentialId));
    await tx.execute({
      sql: "INSERT INTO social_credentials(id,provider,environment,encrypted_payload,key_version,generation,access_expires_at,refresh_expires_at,created_at,updated_at) VALUES (?,?,?,?,?,1,?,?,?,?)",
      args: [
        credentialId,
        p,
        env,
        encrypted,
        socialConfig().activeKey,
        credentials.expiresAt,
        credentials.refreshExpiresAt ?? null,
        now,
        now,
      ],
    });
    await tx.execute({
      sql: "INSERT INTO social_connections(id,provider,external_account_id,environment,credential_id,status,connection_generation,data,created_at,updated_at) VALUES (?,?,?,?,?,'connected',?,?,?,?) ON CONFLICT(provider,external_account_id,environment) DO UPDATE SET credential_id=excluded.credential_id,status=excluded.status,connection_generation=excluded.connection_generation,data=excluded.data,updated_at=excluded.updated_at",
      args: [
        id,
        p,
        identity.externalId,
        env,
        credentialId,
        generation,
        JSON.stringify(conn),
        conn.createdAt,
        now,
      ],
    });
    if (existing.rows[0])
      await tx.execute({
        sql: "DELETE FROM social_credentials WHERE id=?",
        args: [existing.rows[0].credential_id],
      });
    const pending = await tx.execute({
      sql: "SELECT * FROM social_targets WHERE connection_id=? AND status NOT IN ('published','test_completed','manually_reported','canceled','uncertain','processing')",
      args: [id],
    });
    for (const row of pending.rows) {
      const t = targetRow(row);
      await writeTarget(
        tx,
        { ...t, status: "blocked", lastErrorCode: "approval_stale" },
        t.revision,
      );
    }
    await tx.execute({
      sql: "UPDATE social_jobs SET state='blocked',last_error_code='approval_stale' WHERE connection_id=? AND state IN ('ready','retry_wait')",
      args: [id],
    });
    return {
      id,
      displayName: conn.displayName,
      username: conn.username,
      provider: p,
      externalId: conn.externalId,
      requiresSelection: true,
    };
  });
}
export async function finishOAuth(
  repo: SocialRepository,
  provider: Platform,
  state: string,
  binding: string,
  code: string,
  fetcher: typeof fetch = fetch,
) {
  await consumeState(repo, provider, state, binding);
  if (!code || code.length > 4096)
    throw new SocialError(
      "unauthorized",
      "Authorization code missing. Start the connection again.",
      403,
    );
  const app = providerConfig(provider),
    config = socialConfig();
  if (!app.clientId || !app.clientSecret)
    throw new SocialError(
      "not_configured",
      "Developer app settings are missing.",
      503,
    );
  let creds: Credentials,
    actualScopes: string[] = [];
  const temp: Connection = {
    id: "",
    provider,
    externalId: "",
    displayName: "",
    username: "",
    status: "connected",
    credentialId: "",
    generation: 1,
    scopes: [],
    metadata: {},
    environment: config.environment,
    lastVerifiedAt: null,
    createdAt: new Date().toISOString(),
  };
  if (provider === "instagram") {
    const r = await providerRequest(
      "https://api.instagram.com/oauth/access_token",
      null,
      {
        method: "POST",
        body: new URLSearchParams({
          client_id: app.clientId,
          client_secret: app.clientSecret,
          grant_type: "authorization_code",
          redirect_uri: callbackUrl(provider),
          code,
        }),
        fetcher,
      },
    );
    const token = r.data?.[0] || r;
    const short = tokenObject(token);
    actualScopes = Array.isArray(token.permissions)
      ? token.permissions
      : typeof token.permissions === "string"
        ? token.permissions.split(",")
        : [];
    const u = new URL("https://graph.instagram.com/access_token");
    u.search = new URLSearchParams({
      grant_type: "ig_exchange_token",
      client_secret: app.clientSecret,
      access_token: short.accessToken,
    }).toString();
    creds = tokenObject(await providerRequest(u, null, { fetcher }));
    temp.scopes = actualScopes;
    const identity = await adapterFor(provider).identity(
      bareContext(temp, creds, fetcher),
    );
    return storeConnection(
      repo,
      provider,
      {
        ...identity,
        scopes: actualScopes,
        metadata: {
          ...identity.metadata,
          authSubjectId: String(token.user_id || identity.externalId),
        },
      },
      creds,
    );
  }
  if (provider === "pinterest") {
    const r = await providerRequest(
      "https://api.pinterest.com/v5/oauth/token",
      Buffer.from(`${app.clientId}:${app.clientSecret}`).toString("base64"),
      {
        method: "POST",
        basic: true,
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: callbackUrl(provider),
        }),
        fetcher,
      },
    );
    creds = tokenObject(r);
    actualScopes =
      typeof r.scope === "string" ? r.scope.split(/[ ,]+/).filter(Boolean) : [];
    temp.scopes = actualScopes;
    temp.metadata = { accessTier: "unknown" };
    const identity = await adapterFor(provider).identity(
      bareContext(temp, creds, fetcher),
    );
    return storeConnection(
      repo,
      provider,
      {
        ...identity,
        scopes: actualScopes,
        metadata: { accessTier: "unknown" },
      },
      creds,
    );
  }
  if (provider === "facebook") {
    const u = new URL(
      `https://graph.facebook.com/${config.version}/oauth/access_token`,
    );
    u.search = new URLSearchParams({
      client_id: app.clientId,
      client_secret: app.clientSecret,
      redirect_uri: callbackUrl(provider),
      code,
    }).toString();
    creds = tokenObject(await providerRequest(u, null, { fetcher }));
    const permissions = await providerRequest(
      `https://graph.facebook.com/${config.version}/me/permissions`,
      creds.accessToken,
      { fetcher },
    );
    actualScopes = (permissions.data || [])
      .filter((x: { status?: string }) => x.status === "granted")
      .map((x: { permission: string }) => x.permission);
    const subject = await providerRequest(
      `https://graph.facebook.com/${config.version}/me?fields=id`,
      creds.accessToken,
      { fetcher },
    );
    const pages = await providerRequest(
      `https://graph.facebook.com/${config.version}/me/accounts?fields=id,name,access_token,tasks&limit=50`,
      creds.accessToken,
      { fetcher },
    );
    const items = (pages.data || []).slice(0, 50);
    for (const page of items) {
      if (typeof page.id !== "string" || typeof page.access_token !== "string")
        continue;
      const id = randomUUID(),
        value = {
          identity: {
            externalId: page.id,
            displayName: String(page.name || page.id),
            username: "",
            scopes: actualScopes,
            metadata: {
              tasks: Array.isArray(page.tasks) ? page.tasks : [],
              authSubjectId: typeof subject.id === "string" ? subject.id : "",
            },
          },
          credentials: {
            accessToken: page.access_token,
            expiresAt: creds.expiresAt,
          },
        };
      await repo.client.execute({
        sql: "INSERT INTO social_connection_candidates VALUES (?,?,?,?,?,?,NULL)",
        args: [
          id,
          hash(binding),
          provider,
          page.id,
          seal(value, credentialContext(provider, id)),
          Date.now() + 600000,
        ],
      });
    }
    return { provider, candidates: items.length, requiresSelection: true };
  }
  throw new SocialError(
    "policy_restricted",
    "TikTok remains manual-only.",
    403,
  );
}
export async function selectCandidate(
  repo: SocialRepository,
  id: string,
  binding: string,
) {
  return repo
    .tx(async (tx) => {
      const r = await tx.execute({
        sql: "UPDATE social_connection_candidates SET selected_at=? WHERE id=? AND oauth_state_hash=? AND selected_at IS NULL AND expires_at>? RETURNING *",
        args: [Date.now(), id, hash(binding), Date.now()],
      });
      if (!r.rows[0])
        throw new SocialError(
          "unauthorized",
          "Account selection expired or belongs to another browser.",
          403,
        );
      return {
        provider: r.rows[0].provider as Platform,
        value: open<{ identity: Identity; credentials: Credentials }>(
          String(r.rows[0].encrypted_candidate_payload),
          credentialContext(r.rows[0].provider as Platform, id),
        ),
      };
    })
    .then(async ({ provider, value }) =>
      storeConnection(repo, provider, value.identity, value.credentials),
    );
}
export async function selectConnection(
  repo: SocialRepository,
  id: string,
  externalId: string,
  tier?: "trial" | "standard",
) {
  const conn = await repo.getConnection(id);
  if (conn.externalId !== externalId || conn.status !== "connected")
    throw new SocialError(
      "account_unavailable",
      "Confirm the exact connected account identity.",
      422,
    );
  if (
    conn.provider === "instagram" &&
    conn.username.toLowerCase() !== "larkova.art"
  )
    throw new SocialError(
      "account_unavailable",
      "The confirmed primary Instagram account is @larkova.art. Connect that account.",
      422,
    );
  if (conn.provider === "pinterest" && tier) conn.metadata.accessTier = tier;
  conn.metadata.selected = true;
  await repo.client.execute({
    sql: "UPDATE social_connections SET data=?,updated_at=? WHERE id=? AND connection_generation=?",
    args: [JSON.stringify(conn), new Date().toISOString(), id, conn.generation],
  });
  await repo.audit("account_selected", id, { externalId, tier: tier || null });
  return conn;
}
