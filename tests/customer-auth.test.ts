import { test } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@libsql/client";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCustomerAuth } from "../src/lib/customer/auth-core.ts";
import { customerResponse } from "../src/lib/customer/response.ts";
import { saveItem, savedIds } from "../src/lib/customer/saved.ts";

test("verified accounts, optional email OTP, recovery and isolated collections", async () => {
  const directory = mkdtempSync(join(tmpdir(), "larkova-customers-"));
  const client = createClient({ url: `file:${join(directory, "auth.db")}` });
  let code = "";
  const origin = "http://localhost:3212";
  const service = createCustomerAuth(
    client,
    {
      secret: "isolated-test-secret-12345678901234567890",
      baseURL: origin,
      environment: "development",
      emailReady: true,
    },
    async (v) => {
      code = v.code;
    },
  );
  let jar = "";
  async function call(path: string, body?: unknown, otherOrigin = origin) {
    const response = await service.auth.handler(
      new Request(origin + "/api/auth/" + path, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          origin: otherOrigin,
          "content-type": "application/json",
          cookie: jar,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
    );
    for (const item of response.headers.getSetCookie()) {
      const [pair] = item.split(";"),
        key = pair.split("=")[0];
      const entries = jar
        .split("; ")
        .filter((x) => x && !x.startsWith(key + "="));
      if (!pair.endsWith("=")) entries.push(pair);
      jar = entries.join("; ");
    }
    return { status: response.status, data: await response.json() };
  }
  try {
    await client.execute("CREATE TABLE orders(id TEXT PRIMARY KEY,value TEXT)");
    await client.execute("INSERT INTO orders VALUES('existing','untouched')");
    await Promise.all([service.ready(), service.ready()]);
    await service.ready();
    assert.equal(
      (await client.execute("SELECT value FROM orders")).rows[0].value,
      "untouched",
    );
    const email = "collector@example.test",
      password = "My-customer-test-password-123!";
    assert.equal(
      (await call("sign-up/email", { email, password, name: "Collector" }))
        .status,
      200,
    );
    assert.match(code, /^\d{6}$/);
    assert.equal(
      (await call("sign-in/email", { email, password })).status,
      403,
    );
    assert.equal(
      (
        await call("email-otp/verify-email", {
          email,
          otp: code === "000000" ? "111111" : "000000",
        })
      ).status,
      400,
    );
    assert.equal(
      (await call("email-otp/verify-email", { email, otp: code })).status,
      200,
    );
    assert.notEqual(
      (await call("email-otp/verify-email", { email, otp: code })).status,
      200,
    );
    assert.equal(
      (await call("sign-in/email", { email, password })).status,
      200,
    );
    const session = (await call("get-session")).data;
    assert.equal(session.user.emailVerified, true);
    const userId = session.user.id;
    const stored = (
      await client.execute("SELECT password FROM customer_account")
    ).rows[0].password;
    assert.ok(stored && stored !== password);
    assert.equal(
      (await call("two-factor/enable", { password, method: "otp" })).status,
      200,
    );
    assert.equal((await call("sign-out", {})).status, 200);
    const challenge = await call("sign-in/email", { email, password });
    assert.equal(challenge.data.twoFactorRedirect, true);
    assert.equal((await call("get-session")).data, null);
    assert.equal((await call("two-factor/send-otp", {})).status, 200);
    const challengeCookie = jar;
    jar = "";
    assert.notEqual(
      (await call("two-factor/verify-otp", { code })).status,
      200,
    );
    jar = challengeCookie;
    assert.notEqual(
      (
        await call("two-factor/verify-otp", {
          code: code === "000000" ? "111111" : "000000",
        })
      ).status,
      200,
    );
    assert.equal(
      (await call("two-factor/verify-otp", { code, trustDevice: false }))
        .status,
      200,
    );
    assert.equal((await call("get-session")).data.user.id, userId);
    assert.equal(
      (await call("sign-out", {}, "https://attacker.example")).status,
      403,
    );
    await saveItem(client, userId, "favorite", "mar", true);
    await saveItem(client, userId, "favorite", "mar", true);
    await saveItem(client, userId, "cart", "mar", true);
    assert.deepEqual(await savedIds(client, userId), {
      favorites: ["mar"],
      cart: ["mar"],
    });
    assert.deepEqual(await savedIds(client, "other-user"), {
      favorites: [],
      cart: [],
    });
    await saveItem(client, "other-user", "favorite", "mar", false);
    assert.deepEqual((await savedIds(client, userId)).favorites, ["mar"]);
    for (let i = 0; i < 45; i++)
      await saveItem(client, userId, "cart", "work-" + i, true);
    assert.equal((await savedIds(client, userId)).cart.length, 40);
    const oldSessionCookie = jar;
    assert.equal(
      (await call("email-otp/request-password-reset", { email })).status,
      200,
    );
    const updatedPassword = "Changed-customer-password-321!";
    assert.equal(
      (
        await call("email-otp/reset-password", {
          email,
          otp: code,
          password: updatedPassword,
        })
      ).status,
      200,
    );
    jar = oldSessionCookie;
    assert.equal((await call("get-session")).data, null);
    assert.equal(
      (await call("sign-in/email", { email, password })).status,
      401,
    );
    assert.equal(
      (await client.execute("SELECT value FROM orders")).rows[0].value,
      "untouched",
    );
  } finally {
    client.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("customer email limits persist across transports and never return a code", async () => {
  const { customerMailer, customerEmailLimit } =
    await import("../src/lib/customer/mail.ts");
  const client = createClient({ url: ":memory:" });
  await client.execute(
    "CREATE TABLE customer_email_limits(id TEXT PRIMARY KEY,count INTEGER NOT NULL,started_at INTEGER NOT NULL)",
  );
  const original = globalThis.fetch,
    oldKey = process.env.RESEND_API_KEY;
  let messages = 0;
  process.env.RESEND_API_KEY = "re_test_local_only";
  globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(String(options?.body));
    assert.equal(body.to[0], "fixture@example.test");
    messages++;
    return Response.json({ id: "fixture" });
  };
  try {
    for (let i = 0; i < 3; i++) {
      await customerEmailLimit(
        client,
        "fixture@example.test",
        "email-verification",
      );
      await customerMailer("Test <accounts@example.test>")({
        email: "fixture@example.test",
        code: "123456",
        purpose: "email-verification",
      });
    }
    await assert.rejects(
      customerEmailLimit(client, "FIXTURE@example.test", "email-verification"),
    );
    assert.equal(messages, 3);
    const rows = await client.execute("SELECT id FROM customer_email_limits");
    assert.equal(rows.rows.length, 1);
    assert.match(String(rows.rows[0].id), /^[a-f0-9]{64}$/);
  } finally {
    globalThis.fetch = original;
    if (oldKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = oldKey;
    client.close();
  }
});

test("Google uses fixed callback, one-use state and secure customer cookies", async () => {
  const client = createClient({ url: ":memory:" });
  const service = createCustomerAuth(
    client,
    {
      secret: "isolated-google-test-secret-at-least-32-chars",
      baseURL: "https://accounts.example.test",
      environment: "preview",
      emailReady: false,
      google: {
        clientId: "fixture-client-id",
        clientSecret: "fixture-client-secret",
      },
    },
    async () => {
      throw new Error("No email expected");
    },
  );
  try {
    await service.ready();
    const response = await service.auth.handler(
      new Request("https://accounts.example.test/api/auth/sign-in/social", {
        method: "POST",
        headers: {
          origin: "https://accounts.example.test",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          provider: "google",
          callbackURL: "/en/account",
        }),
      }),
    );
    assert.equal(response.status, 200);
    const { url } = await response.json();
    const consent = new URL(url);
    assert.equal(consent.hostname, "accounts.google.com");
    assert.equal(
      consent.searchParams.get("redirect_uri"),
      "https://accounts.example.test/api/auth/callback/google",
    );
    assert.ok(consent.searchParams.get("state"));
    assert.ok(consent.searchParams.get("code_challenge"));
    assert.ok(
      response.headers
        .getSetCookie()
        .some(
          (x) =>
            x.includes("HttpOnly") &&
            x.includes("Secure") &&
            x.includes("larkova_customer"),
        ),
    );
    assert.equal(
      service.auth.options.account?.accountLinking?.disableImplicitLinking,
      true,
    );
    const callback = await service.auth.handler(
      new Request(
        "https://accounts.example.test/api/auth/callback/google?state=invalid&code=fake",
      ),
    );
    const forwarded = await customerResponse(callback);
    assert.equal(forwarded.status, 302);
    assert.ok(forwarded.headers.get("location"));
    assert.equal(await forwarded.text(), "");
    assert.equal(
      (await client.execute("SELECT count(*) AS n FROM customer_session"))
        .rows[0].n,
      0,
    );
  } finally {
    client.close();
  }
});

test("separate cold starts create only additive customer tables", async () => {
  const directory = mkdtempSync(join(tmpdir(), "larkova-customer-migrations-"));
  const a = createClient({ url: `file:${join(directory, "shared.db")}` }),
    b = createClient({ url: `file:${join(directory, "shared.db")}` });
  const config = {
    secret: "migration-test-secret-at-least-thirty-two-characters",
    baseURL: "http://localhost:3212",
    environment: "development",
    emailReady: false,
  };
  try {
    await a.execute("CREATE TABLE artworks(id TEXT PRIMARY KEY,status TEXT)");
    await a.execute("INSERT INTO artworks VALUES ('original','sold')");
    await Promise.all([
      createCustomerAuth(a, config, async () => {}).ready(),
      createCustomerAuth(b, config, async () => {}).ready(),
    ]);
    assert.deepEqual(
      (await a.execute("SELECT * FROM artworks")).rows.map((r) => [
        r.id,
        r.status,
      ]),
      [["original", "sold"]],
    );
    const names = (
      await a.execute("SELECT name FROM sqlite_master WHERE type='table'")
    ).rows.map((r) => String(r.name));
    assert.ok(
      names.every((n) => n === "artworks" || n.startsWith("customer_")),
    );
  } finally {
    a.close();
    b.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("OAuth response forwarding preserves redirects and cookies without parsing empty JSON", async () => {
  const headers = new Headers({
    "content-type": "application/json",
    location: "https://accounts.example.test/en/account",
  });
  headers.append(
    "set-cookie",
    "larkova_customer.session_token=fixture; Path=/; HttpOnly; Secure; SameSite=Lax",
  );
  headers.append(
    "set-cookie",
    "larkova_customer.oauth_state=; Path=/; Max-Age=0",
  );
  const result = await customerResponse(
    new Response(null, { status: 302, headers }),
  );
  assert.equal(result.status, 302);
  assert.equal(
    result.headers.get("location"),
    "https://accounts.example.test/en/account",
  );
  assert.equal(result.headers.getSetCookie().length, 2);
  assert.equal(result.headers.get("cache-control"), "no-store");
  assert.equal(await result.text(), "");
  const redirect = await customerResponse(
    Response.redirect("https://accounts.example.test/en/account", 302),
  );
  assert.equal(redirect.status, 302);
  const session = await customerResponse(
    Response.json({
      token: "private",
      session: { token: "private", id: "public" },
      user: { name: "Collector" },
      accessToken: "private",
    }),
  );
  assert.deepEqual(await session.json(), {
    session: { id: "public" },
    user: { name: "Collector" },
  });
  const empty = await customerResponse(
    new Response(null, {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );
  assert.equal(await empty.text(), "");
});

test("Google callback completes a verified session through the response wrapper", async () => {
  const { generateKeyPairSync, sign } = await import("node:crypto");
  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  const jwk = {
    ...publicKey.export({ format: "jwk" }),
    kid: "fixture-google-key",
    alg: "RS256",
    use: "sig",
  };
  const client = createClient({ url: ":memory:" });
  const origin = "https://accounts.example.test";
  const service = createCustomerAuth(
    client,
    {
      secret: "google-callback-fixture-secret-at-least-thirty-two-characters",
      baseURL: origin,
      environment: "preview",
      emailReady: false,
      google: {
        clientId: "fixture-client-id",
        clientSecret: "fixture-client-secret",
      },
    },
    async () => {
      throw new Error("Google signup must not send email");
    },
  );
  const originalFetch = globalThis.fetch;
  let tokenRequests = 0;
  let nonce: string | undefined;
  let jar = "";
  async function call(path: string, body?: unknown) {
    const raw = await service.auth.handler(
      new Request(origin + "/api/auth/" + path, {
        method: body ? "POST" : "GET",
        headers: { origin, "content-type": "application/json", cookie: jar },
        ...(body ? { body: JSON.stringify(body) } : {}),
      }),
    );
    const r = await customerResponse(raw);
    for (const cookie of r.headers.getSetCookie()) {
      const [pair] = cookie.split(";"),
        key = pair.split("=")[0];
      const entries = jar
        .split("; ")
        .filter((x) => x && !x.startsWith(key + "="));
      if (!pair.endsWith("=")) entries.push(pair);
      jar = entries.join("; ");
    }
    return r;
  }
  globalThis.fetch = async (input) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    if (url === "https://www.googleapis.com/oauth2/v3/certs")
      return Response.json({ keys: [jwk] });
    if (url === "https://oauth2.googleapis.com/token") {
      tokenRequests++;
      const now = Math.floor(Date.now() / 1000);
      const header = Buffer.from(
        JSON.stringify({ alg: "RS256", kid: jwk.kid, typ: "JWT" }),
      ).toString("base64url");
      const payload = Buffer.from(
        JSON.stringify({
          iss: "https://accounts.google.com",
          aud: "fixture-client-id",
          sub: "fixture-google-subject",
          email: "google-collector@example.test",
          email_verified: true,
          name: "Google Collector",
          iat: now,
          exp: now + 300,
          ...(nonce ? { nonce } : {}),
        }),
      ).toString("base64url");
      const signature = sign(
        "RSA-SHA256",
        Buffer.from(header + "." + payload),
        privateKey,
      ).toString("base64url");
      return Response.json({
        access_token: "fixture-access-token",
        token_type: "Bearer",
        expires_in: 3600,
        id_token: header + "." + payload + "." + signature,
        scope: "openid email profile",
      });
    }
    throw new Error("Unexpected fixture network destination");
  };
  try {
    await service.ready();
    const start = await call("sign-in/social", {
      provider: "google",
      callbackURL: "/en/account",
    });
    assert.equal(start.status, 200);
    const consent = new URL((await start.json()).url);
    nonce = consent.searchParams.get("nonce") || undefined;
    const callbackPath =
      "callback/google?code=fixture-code&state=" +
      encodeURIComponent(consent.searchParams.get("state")!);
    const callback = await call(callbackPath);
    assert.equal(callback.status, 302);
    assert.equal(
      new URL(callback.headers.get("location")!, origin).href,
      origin + "/en/account",
    );
    assert.equal(await callback.text(), "");
    const session = await (await call("get-session")).json();
    assert.equal(session.user.email, "google-collector@example.test");
    assert.equal(session.user.emailVerified, true);
    assert.equal(session.session.token, undefined);
    const tokens = await client.execute(
      "SELECT accessToken FROM customer_account",
    );
    assert.ok(tokens.rows[0].accessToken);
    assert.notEqual(tokens.rows[0].accessToken, "fixture-access-token");
    assert.equal(tokenRequests, 1);
    const replay = await call(callbackPath);
    assert.equal(replay.status, 302);
    assert.equal(tokenRequests, 1);
    assert.equal(
      (await client.execute("SELECT count(*) AS n FROM customer_user")).rows[0]
        .n,
      1,
    );
  } finally {
    globalThis.fetch = originalFetch;
    client.close();
  }
});
