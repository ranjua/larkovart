import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./social-helpers.ts";
import { approve } from "../src/lib/social/approval.ts";
import { enqueue, claimJob } from "../src/lib/social/jobs.ts";
import {
  runSocialTick,
  reconcileTarget,
  providerContext,
} from "../src/lib/social/worker.ts";
import { selectConnection } from "../src/lib/social/oauth.ts";
import { safeRetry } from "../src/lib/social/service.ts";
import { ProviderError, providerRequest } from "../src/lib/social/http.ts";
import { tiktokAdapter } from "../src/lib/social/providers/tiktok.ts";
import { capabilities } from "../src/lib/social/capabilities.ts";
import {
  boundedMedia,
  imageMetadata,
  assetBytes,
} from "../src/lib/social/media.ts";
import type { ProviderContext } from "../src/lib/social/providers/contract.ts";

test("Instagram persists container and published ID, then verifies the native post separately", async () => {
  const f = await fixture(true);
  try {
    const c = await f.connect(),
      t = await f.target("instagram", true, c.id);
    await approve(f.repo, t.id, 1, f.inventory);
    await enqueue(f.repo, t.id, 1, f.inventory);
    let clock = Date.now() + 50,
      created = 0,
      published = 0;
    const transport: typeof fetch = async (input, init) => {
      const u = new URL(String(input));
      if (u.hostname === "res.cloudinary.com")
        return new Response(f.bytes, {
          headers: { "Content-Type": "image/jpeg" },
        });
      assert.equal(u.hostname, "graph.instagram.com");
      if (init?.method === "POST" && u.pathname.endsWith("/media")) {
        created++;
        return Response.json({ id: "2001" });
      }
      if (init?.method === "POST" && u.pathname.endsWith("/media_publish")) {
        published++;
        assert.equal(JSON.parse(String(init.body)).creation_id, "2001");
        return Response.json({ id: "3001" });
      }
      if (u.pathname.endsWith("/2001"))
        return Response.json({ status_code: "FINISHED" });
      if (u.pathname.endsWith("/3001"))
        return Response.json({
          id: "3001",
          permalink: "https://www.instagram.com/p/fixture/",
          media_type: "IMAGE",
        });
      throw new Error("Unexpected fixture request");
    };
    await runSocialTick(f.repo, f.inventory, {
      fetcher: transport,
      now: () => clock,
    });
    assert.equal((await f.repo.getTarget(t.id)).status, "processing");
    clock += 61000;
    await runSocialTick(f.repo, f.inventory, {
      fetcher: transport,
      now: () => clock,
    });
    assert.equal((await f.repo.getTarget(t.id)).status, "processing");
    clock += 1100;
    await runSocialTick(f.repo, f.inventory, {
      fetcher: transport,
      now: () => clock,
    });
    const final = await f.repo.getTarget(t.id);
    assert.equal(final.status, "published");
    assert.equal(final.externalPostId, "3001");
    assert.equal(created, 1);
    assert.equal(published, 1);
    const attempts = await f.client.execute(
      "SELECT outcome,external_operation_id,external_post_id FROM social_attempts",
    );
    assert.equal(attempts.rows.length, 2);
    assert.ok(attempts.rows.every((a) => a.outcome === "accepted"));
  } finally {
    f.close();
  }
});

test("a lost final publish response is uncertain and never blindly retried", async () => {
  const f = await fixture(true);
  try {
    const c = await f.connect(),
      t = await f.target("instagram", true, c.id);
    await approve(f.repo, t.id, 1, f.inventory);
    await enqueue(f.repo, t.id, 1, f.inventory);
    let clock = Date.now() + 10,
      writes = 0;
    const transport: typeof fetch = async (input, init) => {
      const u = new URL(String(input));
      if (u.hostname === "res.cloudinary.com") return new Response(f.bytes);
      if (init?.method === "POST" && u.pathname.endsWith("/media"))
        return Response.json({ id: "2001" });
      if (init?.method === "POST") {
        writes++;
        throw new Error("socket closed after provider accepted");
      }
      return Response.json({ status_code: writes ? "PUBLISHED" : "FINISHED" });
    };
    await runSocialTick(f.repo, f.inventory, {
      fetcher: transport,
      now: () => clock,
    });
    clock += 61000;
    await runSocialTick(f.repo, f.inventory, {
      fetcher: transport,
      now: () => clock,
    });
    assert.equal((await f.repo.getTarget(t.id)).status, "uncertain");
    clock += 600000;
    await runSocialTick(f.repo, f.inventory, {
      fetcher: transport,
      now: () => clock,
    });
    assert.equal(writes, 1);
    await assert.rejects(safeRetry(f.repo, t.id, 1), /definitely safe/);
    await assert.rejects(
      reconcileTarget(f.repo, t.id, f.inventory, transport),
      /No unique read-only/,
    );
    assert.equal(writes, 1);
  } finally {
    f.close();
  }
});

test("accepted IDs checkpoint before a worker crash and stale fences cannot create another operation", async () => {
  const f = await fixture(true);
  try {
    const c = await f.connect(),
      t = await f.target("instagram", true, c.id);
    await approve(f.repo, t.id, 1, f.inventory);
    await enqueue(f.repo, t.id, 1, f.inventory);
    const now = Date.now() + 50,
      j = (await claimJob(f.repo, "crashed", now))!;
    const target = await f.repo.getTarget(t.id);
    const ctx = providerContext(
      f.repo,
      j,
      target,
      c,
      { accessToken: "fixture-token", expiresAt: null },
      f.inventory,
      async () => {
        throw new Error("not used");
      },
      () => now,
    );
    await ctx.write("ig-container", { image_url: "verified" }, async () => ({
      id: "2001",
    }));
    const recovered = await claimJob(f.repo, "new-worker", now + 91000);
    assert.ok(recovered);
    assert.equal(recovered.progress.containerId, "2001");
    await assert.rejects(
      ctx.write("ig-container", {}, async () => ({ id: "duplicate" })),
      /lease expired/,
    );
  } finally {
    f.close();
  }
});

test("Facebook photo IDs are not confused with Page post IDs and author mismatch remains uncertain", async () => {
  const f = await fixture(true);
  try {
    const c = await f.connect("facebook"),
      t = await f.target("facebook", true, c.id);
    await approve(f.repo, t.id, 1, f.inventory);
    await enqueue(f.repo, t.id, 1, f.inventory);
    let clock = Date.now() + 10,
      writes = 0;
    const transport: typeof fetch = async (input, init) => {
      const u = new URL(String(input));
      if (u.hostname === "res.cloudinary.com") return new Response(f.bytes);
      if (init?.method === "POST") {
        assert.ok(u.pathname.endsWith("/1001/photos"));
        writes++;
        return Response.json({ id: "2002", post_id: "1001_3001" });
      }
      return Response.json({
        id: "1001_3001",
        from: { id: "9999" },
        permalink_url: "https://www.facebook.com/other",
      });
    };
    await runSocialTick(f.repo, f.inventory, {
      fetcher: transport,
      now: () => clock,
    });
    clock += 1100;
    await runSocialTick(f.repo, f.inventory, {
      fetcher: transport,
      now: () => clock,
    });
    assert.equal((await f.repo.getTarget(t.id)).status, "uncertain");
    assert.equal(writes, 1);
    const row = await f.client.execute(
      "SELECT external_post_id,external_operation_id FROM social_attempts",
    );
    assert.equal(row.rows[0].external_post_id, "1001_3001");
    assert.notEqual(row.rows[0].external_post_id, "2002");
  } finally {
    f.close();
  }
});

test("Pinterest Trial verifies an owned board and records creator-only test completion", async () => {
  const f = await fixture();
  try {
    process.env.SOCIAL_TEST_WRITES_ENABLED = "true";
    process.env.SOCIAL_PUBLIC_STORE_VERIFIED = "true";
    process.env.SOCIAL_STORE_ORIGIN = "https://art.example.test";
    const c = await f.connect("pinterest");
    await selectConnection(f.repo, c.id, c.externalId, "trial");
    let t = await f.target("pinterest", true, c.id);
    t = await f.repo.updateTarget(t.id, 1, {
      deliveryMode: "api_test",
      linkUrl: "https://art.example.test/es/art/atitlan",
      options: {
        provider: "pinterest",
        title: "Atitlan",
        altText: "Original painting",
        boardId: "2001",
        sectionId: null,
      },
    });
    await approve(f.repo, t.id, 2, f.inventory);
    await enqueue(f.repo, t.id, 2, f.inventory);
    let clock = Date.now() + 10,
      posts = 0;
    const transport: typeof fetch = async (input, init) => {
      const u = new URL(String(input));
      if (u.hostname === "res.cloudinary.com") return new Response(f.bytes);
      assert.equal(u.hostname, "api.pinterest.com");
      if (u.pathname === "/v5/boards/2001")
        return Response.json({
          id: "2001",
          owner: { username: "fixtureartist" },
        });
      if (init?.method === "POST") {
        posts++;
        const body = JSON.parse(String(init.body));
        assert.equal(body.board_id, "2001");
        assert.equal(body.media_source.source_type, "image_url");
        return Response.json({ id: "3001" });
      }
      return Response.json({ id: "3001", board_id: "2001" });
    };
    await runSocialTick(f.repo, f.inventory, {
      fetcher: transport,
      now: () => clock,
    });
    clock += 1100;
    await runSocialTick(f.repo, f.inventory, {
      fetcher: transport,
      now: () => clock,
    });
    const final = await f.repo.getTarget(t.id);
    assert.equal(final.status, "test_completed");
    assert.equal(final.externalOperationId, "3001");
    assert.equal(final.externalPostId, null);
    assert.equal(posts, 1);
    assert.equal(
      (await f.repo.state()).targets.filter((t) => t.status === "published")
        .length,
      0,
    );
  } finally {
    f.close();
  }
});

test("TikTok and missing permissions remain honest restrictions, not fake publication", async () => {
  const f = await fixture();
  try {
    assert.equal(
      capabilities("tiktok").publishImage.state,
      "policy_restricted",
    );
    await assert.rejects(
      tiktokAdapter.step({} as never, [], { schema: 1 }, {} as never),
      /private account-management/,
    );
    const t = await f.target("tiktok");
    await approve(f.repo, t.id, 1, f.inventory);
    await enqueue(f.repo, t.id, 1, f.inventory);
    await runSocialTick(f.repo, f.inventory);
    assert.equal((await f.repo.getTarget(t.id)).status, "manual_ready");
    const c = await f.connect("instagram");
    await f.client.execute({
      sql: "UPDATE social_connections SET status='disconnected' WHERE id=?",
      args: [c.id],
    });
    const blocked = await f.target("instagram", true, c.id);
    await assert.rejects(
      approve(f.repo, blocked.id, 1, f.inventory),
      /Connect and explicitly/,
    );
  } finally {
    f.close();
  }
});

test("trusted media rejects arbitrary hosts, altered bytes and forged image formats", async () => {
  const f = await fixture();
  try {
    let fetched = 0;
    const transport: typeof fetch = async () => {
      fetched++;
      return new Response("not an image");
    };
    await assert.rejects(
      boundedMedia("http://169.254.169.254/latest/meta-data", transport),
    );
    await assert.rejects(
      boundedMedia(
        "https://res.cloudinary.com/other-cloud/image/upload/v1/file.jpg",
        transport,
      ),
    );
    assert.equal(fetched, 0);
    assert.throws(() =>
      imageMetadata(Buffer.from("image/jpeg is just a label")),
    );
    const a = await f.asset(true);
    await assert.rejects(assetBytes(a, transport), /changed/);
    await assert.rejects(
      providerRequest("https://attacker.example.test/token", "fixture-token", {
        fetcher: transport,
      }),
    );
    assert.equal(fetched, 1);
  } finally {
    f.close();
  }
});

test("metric snapshots dedupe same-day lifetime counts and distinguish missing from zero", async () => {
  const f = await fixture();
  try {
    const c = await f.connect(),
      m = {
        key: "like_count",
        value: 0,
        unit: "count" as const,
        aggregation: "lifetime" as const,
        definition: "instagram.like_count.v1",
        source: "/fixture?fields=like_count",
        externalPostId: "2001",
        collectedAt: "2026-11-08T10:00:00.000Z",
      };
    await f.repo.recordMetrics(c.id, [m]);
    await f.repo.recordMetrics(c.id, [
      { ...m, value: 7, collectedAt: "2026-11-08T10:05:00.000Z" },
    ]);
    await f.repo.recordMetrics(c.id, [
      { ...m, key: "comments_count", value: null },
    ]);
    const result = await f.client.execute(
      "SELECT metric_key,value FROM social_metrics",
    );
    assert.equal(result.rows.length, 2);
    assert.equal(
      result.rows.find((r) => r.metric_key === "like_count")?.value,
      7,
    );
    assert.equal(
      result.rows.find((r) => r.metric_key === "comments_count")?.value,
      null,
    );
  } finally {
    f.close();
  }
});

test("Instagram carousel waits for each child, preserves order and does not create a parent after child failure", async () => {
  const { instagramAdapter } =
    await import("../src/lib/social/providers/instagram.ts");
  const f = await fixture(true);
  try {
    const c = await f.connect(),
      t = await f.target("instagram", true, c.id),
      asset = await f.asset(true);
    const writes: { step: string; body: unknown }[] = [];
    let processing = true;
    const ctx: ProviderContext = {
      connection: c,
      credentials: { accessToken: "fixture-token", expiresAt: null },
      now: Date.now,
      fetcher: async (input) => {
        const u = new URL(String(input));
        return Response.json({
          status_code: processing
            ? "IN_PROGRESS"
            : u.pathname.endsWith("/2222")
              ? "ERROR"
              : "FINISHED",
        });
      },
      write: async <T>(
        step: string,
        body: unknown,
        send: () => Promise<T>,
      ): Promise<T> => {
        writes.push({ step, body });
        return { id: "3333" } as T;
      },
    };
    const carousel = { ...t, format: "carousel" as const };
    const p = { schema: 1 as const, children: ["1111", "2222"] };
    const result = await instagramAdapter.step(
      carousel,
      [asset, asset],
      p,
      ctx,
    );
    assert.equal(result.kind, "next");
    assert.equal(writes.length, 0);
    if (result.kind === "next") assert.equal(result.delayMs, 60000);
    processing = false;
    await assert.rejects(
      instagramAdapter.step(carousel, [asset, asset], p, ctx),
      /carousel child/,
    );
    assert.equal(writes.length, 0);
    ctx.fetcher = async () => Response.json({ status_code: "FINISHED" });
    await instagramAdapter.step(carousel, [asset, asset], p, ctx);
    assert.equal(writes[0].step, "ig-container");
    assert.equal(
      (writes[0].body as { children: string }).children,
      "1111,2222",
    );
  } finally {
    f.close();
  }
});

test("Instagram Reel processing is resumable and bounded before final publication", async () => {
  const { instagramAdapter } =
    await import("../src/lib/social/providers/instagram.ts");
  const f = await fixture(true);
  try {
    const c = await f.connect(),
      t = await f.target("instagram", true, c.id);
    const ctx: ProviderContext = {
      connection: c,
      credentials: { accessToken: "fixture-token", expiresAt: null },
      now: Date.now,
      fetcher: async () => Response.json({ status_code: "IN_PROGRESS" }),
      write: async () => {
        throw new Error("Must not publish while processing");
      },
    };
    const progress = { schema: 1 as const, containerId: "2222", pollCount: 4 };
    const r = await instagramAdapter.step(
      { ...t, format: "video" },
      [],
      progress,
      ctx,
    );
    assert.equal(r.kind, "next");
    await assert.rejects(
      instagramAdapter.step(
        { ...t, format: "video" },
        [],
        { ...progress, pollCount: 5 },
        ctx,
      ),
      /Processing took too long/,
    );
    ctx.fetcher = async () => Response.json({ status_code: "EXPIRED" });
    await assert.rejects(
      instagramAdapter.step(t, [], progress, ctx),
      /could not process/,
    );
  } finally {
    f.close();
  }
});

test("provider response limits and ambiguous writes fail closed without exposing response data", async () => {
  const response = () =>
    new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(2_000_001));
          controller.close();
        },
      }),
    );
  await assert.rejects(
    providerRequest("https://graph.instagram.com/v25.0/me", "fixture-token", {
      fetcher: async () => response(),
    }),
    /could not be reached/,
  );
  await assert.rejects(
    providerRequest(
      "https://graph.instagram.com/v25.0/1001/media",
      "fixture-token",
      { method: "POST", body: {}, fetcher: async () => response() },
    ),
    (e: unknown) => e instanceof ProviderError && e.uncertain,
  );
});

test("Facebook Reel checkpoints start, upload and finish, then verifies Page and public status", async () => {
  const f = await fixture(true);
  try {
    const c = await f.connect("facebook"),
      source = await f.asset(true);
    const b = Buffer.from([
      0, 0, 0, 24, 102, 116, 121, 112, 105, 115, 111, 109, 0, 0, 0, 0,
    ]);
    const { hash } = await import("../src/lib/social/crypto.ts");
    const video = await f.repo.addAsset({
      ...source,
      id: crypto.randomUUID(),
      storageKey: "fixture-reel",
      url: `https://res.cloudinary.com/social-test/video/upload/v1/social-assets/${crypto.randomUUID()}.mp4`,
      kind: "video",
      mime: "video/mp4",
      width: 540,
      height: 960,
      durationMs: 10000,
      framesPerSecond: 30,
      sha256: hash(b),
      bytes: b.length,
    });
    let t = await f.target("facebook", true, c.id);
    t = await f.repo.updateTarget(t.id, 1, {
      format: "video",
      assetIds: [video.id],
    });
    await approve(f.repo, t.id, 2, f.inventory);
    await enqueue(f.repo, t.id, 2, f.inventory);
    let clock = Date.now() + 10;
    const writes: string[] = [];
    const transport: typeof fetch = async (input, init) => {
      const u = new URL(String(input));
      if (u.hostname === "res.cloudinary.com") return new Response(b);
      if (init?.method === "POST") {
        if (u.hostname === "rupload.facebook.com") {
          writes.push("upload");
          assert.equal(
            (init.headers as Record<string, string>).Authorization,
            "OAuth fixture-token-never-real",
          );
          return Response.json({ success: true });
        }
        const body = JSON.parse(String(init.body));
        writes.push(body.upload_phase);
        if (body.upload_phase === "start")
          return Response.json({
            video_id: "2001",
            upload_url: "https://rupload.facebook.com/video-upload/2001",
          });
        return Response.json({ success: true });
      }
      if (u.searchParams.get("fields") === "status")
        return Response.json({
          status: {
            uploading_phase: { status: "completed" },
            processing_phase: { status: "completed" },
          },
        });
      return Response.json({
        id: "2001",
        from: { id: c.externalId },
        status: { publishing_phase: { publish_status: "published" } },
        permalink_url: "https://www.facebook.com/reel/2001",
      });
    };
    for (let i = 0; i < 5; i++) {
      await runSocialTick(f.repo, f.inventory, {
        fetcher: transport,
        now: () => clock,
      });
      clock += 61000;
    }
    assert.equal(
      (await f.repo.getTarget(t.id)).status,
      "published",
      JSON.stringify({ target: await f.repo.getTarget(t.id), writes }),
    );
    assert.deepEqual(writes, ["start", "upload", "finish"]);
    assert.equal((await f.repo.getTarget(t.id)).externalPostId, "2001");
  } finally {
    f.close();
  }
});

test("Pinterest video registration keeps upload signatures encrypted and Trial completion private", async () => {
  const f = await fixture();
  try {
    process.env.SOCIAL_TEST_WRITES_ENABLED = "true";
    process.env.SOCIAL_PUBLIC_STORE_VERIFIED = "true";
    process.env.SOCIAL_STORE_ORIGIN = "https://art.example.test";
    const c = await f.connect("pinterest");
    await selectConnection(f.repo, c.id, c.externalId, "trial");
    const cover = await f.asset(true),
      b = Buffer.from([
        0, 0, 0, 24, 102, 116, 121, 112, 105, 115, 111, 109, 0, 0, 0, 0,
      ]);
    const { hash } = await import("../src/lib/social/crypto.ts");
    const video = await f.repo.addAsset({
      ...cover,
      id: crypto.randomUUID(),
      storageKey: "fixture-pin-video",
      url: `https://res.cloudinary.com/social-test/video/upload/v1/social-assets/${crypto.randomUUID()}.mp4`,
      kind: "video",
      mime: "video/mp4",
      width: 540,
      height: 960,
      durationMs: 10000,
      sha256: hash(b),
      bytes: b.length,
    });
    let t = await f.target("pinterest", true, c.id);
    t = await f.repo.updateTarget(t.id, 1, {
      format: "video",
      deliveryMode: "api_test",
      assetIds: [video.id, cover.id],
      linkUrl: "https://art.example.test/es/art/atitlan",
      options: {
        provider: "pinterest",
        title: "Original",
        altText: "Original artwork video",
        boardId: "2001",
        sectionId: null,
      },
    });
    await approve(f.repo, t.id, 2, f.inventory);
    await enqueue(f.repo, t.id, 2, f.inventory);
    let clock = Date.now() + 10;
    const writes: string[] = [];
    const secret = "fixture-upload-signature-never-real";
    const transport: typeof fetch = async (input, init) => {
      const u = new URL(String(input));
      if (u.hostname === "res.cloudinary.com")
        return new Response(u.pathname.includes("/video/") ? b : f.bytes);
      if (u.hostname === "pinterest-media-upload.s3-accelerate.amazonaws.com") {
        writes.push("upload");
        assert.ok(init?.body instanceof FormData);
        assert.equal(init.body.get("x-amz-signature"), secret);
        assert.equal(
          (init.headers as Record<string, string> | undefined)?.Authorization,
          undefined,
        );
        return new Response(null, { status: 204 });
      }
      if (init?.method === "POST") {
        if (u.pathname === "/v5/media") {
          writes.push("register");
          return Response.json({
            media_id: "2222",
            upload_url:
              "https://pinterest-media-upload.s3-accelerate.amazonaws.com/",
            upload_parameters: {
              policy: "fixture-policy",
              "x-amz-signature": secret,
            },
          });
        }
        writes.push("pin");
        const body = JSON.parse(String(init.body));
        assert.deepEqual(body.media_source, {
          source_type: "video_id",
          media_id: "2222",
          cover_image_url: cover.url,
        });
        return Response.json({ id: "3333" });
      }
      if (u.pathname === "/v5/media/2222")
        return Response.json({ media_id: "2222", status: "succeeded" });
      if (u.pathname === "/v5/boards/2001")
        return Response.json({ id: "2001", owner: { username: c.username } });
      return Response.json({ id: "3333", board_id: "2001" });
    };
    for (let i = 0; i < 5; i++) {
      await runSocialTick(f.repo, f.inventory, {
        fetcher: transport,
        now: () => clock,
      });
      clock += 61000;
    }
    assert.equal((await f.repo.getTarget(t.id)).status, "test_completed");
    assert.deepEqual(writes, ["register", "upload", "pin"]);
    assert.ok(!JSON.stringify(await f.repo.state()).includes(secret));
    const encrypted = await f.client.execute(
      "SELECT encrypted_payload FROM social_provider_artifacts",
    );
    assert.equal(encrypted.rows.length, 1);
    assert.ok(!String(encrypted.rows[0].encrypted_payload).includes(secret));
  } finally {
    f.close();
  }
});

test("social upload verifies signed receipt before storage fetch and preserves original bytes", async () => {
  const f = await fixture();
  const keys = ["CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"];
  const before = keys.map((k) => process.env[k]);
  try {
    process.env.CLOUDINARY_API_KEY = "fixture-storage-key";
    process.env.CLOUDINARY_API_SECRET = "fixture-storage-secret";
    const { signSocialUpload, completeSocialUpload } =
      await import("../src/lib/social/media.ts");
    const { photoSignature } = await import("../src/lib/photo.ts");
    const signed = await signSocialUpload(f.repo, "image");
    const receipt = {
      assetId: signed.assetId,
      public_id: signed.params.public_id,
      version: 123,
      signature: "0".repeat(40),
    };
    let calls = 0;
    const transport: typeof fetch = async (input) => {
      calls++;
      if (new URL(String(input)).hostname === "api.cloudinary.com")
        return Response.json({
          public_id: receipt.public_id,
          version: 123,
          format: "jpg",
          width: 800,
          height: 800,
          bytes: f.bytes.length,
        });
      return new Response(f.bytes);
    };
    await assert.rejects(
      completeSocialUpload(f.repo, receipt, transport),
      /signature/,
    );
    assert.equal(calls, 0);
    const dims = imageMetadata(f.bytes);
    const valid: typeof fetch = async (input) => {
      calls++;
      if (new URL(String(input)).hostname === "api.cloudinary.com")
        return Response.json({
          public_id: receipt.public_id,
          version: 123,
          format: "jpg",
          ...dims,
          bytes: f.bytes.length,
        });
      return new Response(f.bytes);
    };
    receipt.signature = photoSignature({
      public_id: receipt.public_id,
      version: "123",
    });
    const a = await completeSocialUpload(f.repo, receipt, valid);
    assert.equal(a.bytes, f.bytes.length);
    assert.equal(a.width, dims.width);
    assert.ok(a.apiReady);
    assert.equal(calls, 2);
    receipt.signature = "0".repeat(40);
    await assert.rejects(
      completeSocialUpload(f.repo, receipt, valid),
      /signature/,
    );
    assert.equal(calls, 2);
  } finally {
    keys.forEach((k, i) => {
      if (before[i] === undefined) delete process.env[k];
      else process.env[k] = before[i];
    });
    f.close();
  }
});
