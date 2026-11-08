import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./social-helpers.ts";
import {
  startOAuth,
  consumeState,
  finishOAuth,
  selectCandidate,
  selectConnection,
  storeConnection,
  credentialContext,
} from "../src/lib/social/oauth.ts";
import { credentialsFor } from "../src/lib/social/credentials.ts";
import { socialConfig } from "../src/lib/social/config.ts";
import { open } from "../src/lib/social/crypto.ts";
const setApp = () => {
  process.env.SOCIAL_INSTAGRAM_CLIENT_ID = "111111";
  process.env.SOCIAL_INSTAGRAM_CLIENT_SECRET = "fixture-instagram-app-secret";
  process.env.SOCIAL_FACEBOOK_CLIENT_ID = "222222";
  process.env.SOCIAL_FACEBOOK_CLIENT_SECRET = "fixture-facebook-app-secret";
  process.env.SOCIAL_PINTEREST_CLIENT_ID = "333333";
  process.env.SOCIAL_PINTEREST_CLIENT_SECRET = "fixture-pinterest-app-secret";
};
const clearApp = () => {
  for (const p of ["INSTAGRAM", "FACEBOOK", "PINTEREST"]) {
    delete process.env[`SOCIAL_${p}_CLIENT_ID`];
    delete process.env[`SOCIAL_${p}_CLIENT_SECRET`];
  }
};

test("OAuth state is one-use, provider/browser/environment-bound and independent of Strict Studio cookies", async () => {
  const f = await fixture();
  setApp();
  try {
    const started = await startOAuth(f.repo, "instagram"),
      u = new URL(started.url),
      state = u.searchParams.get("state")!;
    assert.equal(u.origin, "https://www.instagram.com");
    assert.equal(
      u.searchParams.get("redirect_uri"),
      "https://studio.example.test/api/social/oauth/instagram/callback",
    );
    assert.ok(!started.url.includes("fixture-instagram-app-secret"));
    await assert.rejects(
      consumeState(f.repo, "instagram", state, "x".repeat(43)),
    );
    await assert.rejects(
      consumeState(f.repo, "facebook", state, started.binding),
    );
    process.env.SOCIAL_ENVIRONMENT = "preview";
    await assert.rejects(
      consumeState(f.repo, "instagram", state, started.binding),
    );
    process.env.SOCIAL_ENVIRONMENT = "development";
    await consumeState(f.repo, "instagram", state, started.binding);
    await assert.rejects(
      consumeState(f.repo, "instagram", state, started.binding),
    );
    const expired = await startOAuth(f.repo, "instagram");
    await assert.rejects(
      consumeState(
        f.repo,
        "instagram",
        new URL(expired.url).searchParams.get("state")!,
        expired.binding,
        Date.now() + 600001,
      ),
    );
  } finally {
    clearApp();
    f.close();
  }
});

test("Instagram OAuth records actual granted scopes, encrypts tokens and requires exact account confirmation", async () => {
  const f = await fixture();
  setApp();
  try {
    const s = await startOAuth(f.repo, "instagram"),
      state = new URL(s.url).searchParams.get("state")!;
    const transport: typeof fetch = async (input, init) => {
      const u = new URL(String(input));
      if (u.hostname === "api.instagram.com") {
        assert.equal(init?.method, "POST");
        return Response.json({
          data: [
            {
              access_token: "fixture-short-credential",
              user_id: "1001",
              permissions:
                "instagram_business_basic,instagram_business_content_publish",
            },
          ],
        });
      }
      if (u.pathname === "/access_token")
        return Response.json({
          access_token: "fixture-long-credential",
          expires_in: 5184000,
        });
      if (u.pathname.endsWith("/me"))
        return Response.json({
          data: [{ user_id: "1001", username: "larkova.art" }],
        });
      throw new Error("Unexpected OAuth fixture request");
    };
    const result = await finishOAuth(
      f.repo,
      "instagram",
      state,
      s.binding,
      "fixture-code",
      transport,
    );
    assert.ok("id" in result);
    assert.ok(!JSON.stringify(result).includes("fixture-long-credential"));
    const c = await f.repo.getConnection((result as { id: string }).id);
    assert.equal(c.metadata.selected, false);
    assert.deepEqual(c.scopes, [
      "instagram_business_basic",
      "instagram_business_content_publish",
    ]);
    await assert.rejects(selectConnection(f.repo, c.id, "wrong-id"));
    await selectConnection(f.repo, c.id, "1001");
    const row = await f.client.execute(
      "SELECT encrypted_payload FROM social_credentials",
    );
    assert.ok(
      !String(row.rows[0].encrypted_payload).includes(
        "fixture-long-credential",
      ),
    );
    assert.equal(
      (await credentialsFor(f.repo, await f.repo.getConnection(c.id)))
        .accessToken,
      "fixture-long-credential",
    );
  } finally {
    clearApp();
    f.close();
  }
});

test("Facebook Page discovery exposes safe candidates only and cannot be selected by another browser", async () => {
  const f = await fixture();
  setApp();
  try {
    const s = await startOAuth(f.repo, "facebook"),
      state = new URL(s.url).searchParams.get("state")!;
    const transport: typeof fetch = async (input) => {
      const u = new URL(String(input));
      if (u.pathname.endsWith("oauth/access_token"))
        return Response.json({
          access_token: "fixture-user-token",
          expires_in: 3600,
        });
      if (u.pathname.endsWith("permissions"))
        return Response.json({
          data: [
            { permission: "pages_show_list", status: "granted" },
            { permission: "pages_manage_posts", status: "granted" },
            { permission: "pages_read_engagement", status: "granted" },
          ],
        });
      if (u.pathname.endsWith("/me")) return Response.json({ id: "9090" });
      if (u.pathname.endsWith("accounts"))
        return Response.json({
          data: [
            {
              id: "1001",
              name: "First managed Page",
              access_token: "fixture-page-one-token",
              tasks: ["CREATE_CONTENT", "MANAGE", "MODERATE"],
            },
            {
              id: "1002",
              name: "Second managed Page",
              access_token: "fixture-page-two-token",
              tasks: ["ANALYZE"],
            },
          ],
        });
      throw new Error("Unexpected Page fixture request");
    };
    await finishOAuth(
      f.repo,
      "facebook",
      state,
      s.binding,
      "fixture-code",
      transport,
    );
    const stateData = await f.repo.state();
    assert.equal(stateData.candidates.length, 2);
    assert.equal(stateData.connections.length, 0);
    assert.ok(!JSON.stringify(stateData).includes("fixture-page-one-token"));
    const candidate = stateData.candidates.find(
      (c) => c.external_resource_id === "1001",
    )!;
    assert.equal(candidate.displayName, "First managed Page");
    await assert.rejects(
      selectCandidate(f.repo, String(candidate.id), "other-browser"),
    );
    const chosen = await selectCandidate(
      f.repo,
      String(candidate.id),
      s.binding,
    );
    assert.equal(chosen.externalId, "1001");
    await assert.rejects(
      selectCandidate(f.repo, String(candidate.id), s.binding),
    );
    const c = await f.repo.getConnection(chosen.id);
    assert.equal(c.metadata.selected, false);
    assert.ok(c.metadata.tasks?.includes("CREATE_CONTENT"));
  } finally {
    clearApp();
    f.close();
  }
});

test("refresh leases serialize renewal and interrupted refresh requires reconnection", async () => {
  const f = await fixture();
  setApp();
  try {
    const now = Date.now(),
      c = await f.connect("instagram", {
        accessToken: "fixture-old-token",
        expiresAt: now + 120000,
      });
    let count = 0;
    const transport: typeof fetch = async () => {
      count++;
      await new Promise((r) => setTimeout(r, 15));
      return Response.json({
        access_token: "fixture-renewed-token",
        expires_in: 5184000,
      });
    };
    const results = await Promise.allSettled([
      credentialsFor(f.repo, c, transport, now),
      credentialsFor(f.repo, c, transport, now),
    ]);
    assert.equal(count, 1);
    assert.ok(results.some((r) => r.status === "fulfilled"));
    assert.equal(
      (await credentialsFor(f.repo, c, transport, now)).accessToken,
      "fixture-renewed-token",
    );
    const row = await f.client.execute("SELECT id FROM social_credentials");
    await f.client.execute({
      sql: "UPDATE social_credentials SET refresh_lease_owner='interrupted',refresh_lease_until=? WHERE id=?",
      args: [now - 1, row.rows[0].id],
    });
    await assert.rejects(
      credentialsFor(f.repo, c, transport, now),
      /interrupted/,
    );
    assert.equal(count, 1);
    assert.equal(
      (await f.repo.getConnection(c.id)).status,
      "reconnect_required",
    );
  } finally {
    clearApp();
    f.close();
  }
});
