import { test } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@libsql/client";
import { randomBytes, randomUUID } from "node:crypto";
import { fixture } from "./social-helpers.ts";
import { migrateSocial } from "../src/lib/social/migrations.ts";
import { hash, stable, seal, open, rotate } from "../src/lib/social/crypto.ts";
import { approve, assertApproval } from "../src/lib/social/approval.ts";
import {
  enqueue,
  claimJob,
  finishJob,
  cancelTarget,
} from "../src/lib/social/jobs.ts";
import { runSocialTick, scanInventory } from "../src/lib/social/worker.ts";
import { manualPackage } from "../src/lib/social/export.ts";
import { manualResult, updatePost } from "../src/lib/social/service.ts";
import {
  createPostSchema,
  updateTargetSchema,
  defaultOptions,
} from "../src/lib/social/validation.ts";
import { platforms } from "../src/lib/social/types.ts";
import { socialConfig } from "../src/lib/social/config.ts";
import { localSchedule } from "../src/lib/social/time.ts";
import { campaignUrl } from "../src/lib/social/links.ts";

test("social migrations are repeatable/concurrent and do not seed or change commerce data", async () => {
  const f = await fixture();
  const other = createClient({ url: `file:${f.dir}/social.db` });
  try {
    await f.client.execute(
      "CREATE TABLE artworks(id TEXT PRIMARY KEY,status TEXT)",
    );
    await f.client.execute("INSERT INTO artworks VALUES ('sentinel','sold')");
    await f.client.execute("CREATE TABLE orders(id TEXT PRIMARY KEY)");
    await f.client.execute("INSERT INTO orders VALUES ('customer-order')");
    await Promise.all([
      migrateSocial(f.client),
      migrateSocial(other),
      migrateSocial(f.client),
    ]);
    assert.equal(
      (
        await f.client.execute(
          "SELECT COUNT(*) n FROM social_schema_migrations",
        )
      ).rows[0].n,
      1,
    );
    assert.equal(
      (
        await f.client.execute(
          "SELECT status FROM artworks WHERE id='sentinel'",
        )
      ).rows[0].status,
      "sold",
    );
    assert.equal(
      (await f.client.execute("SELECT COUNT(*) n FROM orders")).rows[0].n,
      1,
    );
  } finally {
    other.close();
    f.close();
  }
});

test("social encryption binds environment/provider/credential, rejects tampering and rotates keys", async () => {
  const f = await fixture();
  try {
    const context = "development:instagram:one",
      a = seal({ accessToken: "fixture-secret" }, context),
      b = seal({ accessToken: "fixture-secret" }, context);
    assert.notEqual(a, b);
    assert.ok(!a.includes("fixture-secret"));
    assert.deepEqual(open(a, context), { accessToken: "fixture-secret" });
    assert.throws(() => open(a, "production:instagram:one"));
    const broken = JSON.parse(a);
    broken.tag = Buffer.alloc(16).toString("base64");
    assert.throws(() => open(JSON.stringify(broken), context));
    process.env.SOCIAL_TOKEN_KEY_V2 = randomBytes(32).toString("base64");
    process.env.SOCIAL_TOKEN_ACTIVE_KEY = "2";
    const rotated = rotate(a, context);
    assert.equal(JSON.parse(rotated).v, "2");
    assert.deepEqual(open(rotated, context), { accessToken: "fixture-secret" });
    delete process.env.SOCIAL_TOKEN_KEY_V1;
    assert.throws(() => open(a, context));
    assert.deepEqual(open(rotated, context), { accessToken: "fixture-secret" });
  } finally {
    f.close();
  }
});

test("create actions dedupe request/body and rollback invalid target references", async () => {
  const f = await fixture();
  try {
    const a = await f.asset();
    const input = createPostSchema.parse({
      requestId: randomUUID(),
      title: "One campaign",
      artworkId: f.art.id,
      targets: platforms.map((provider) => ({
        provider,
        caption: "Original artwork",
        options: {
          ...defaultOptions(provider),
          ...(provider === "pinterest" ? { title: "Atitlan" } : {}),
        },
        assetIds: [a.id],
      })),
    });
    const ids = await Promise.all([
      f.repo.createPost(input),
      f.repo.createPost(input),
    ]);
    assert.equal(ids[0], ids[1]);
    assert.equal((await f.repo.state()).targets.length, 4);
    await assert.rejects(
      f.repo.createPost({ ...input, title: "Different" }),
      /Request ID/,
    );
    const count = (await f.repo.state()).posts.length;
    await assert.rejects(
      f.repo.createPost({
        ...input,
        requestId: randomUUID(),
        targets: [{ ...input.targets[0], assetIds: [randomUUID()] }],
      }),
    );
    assert.equal((await f.repo.state()).posts.length, count);
  } finally {
    f.close();
  }
});

test("exact-revision approval is canonical and any edit invalidates it", async () => {
  const f = await fixture();
  try {
    assert.equal(stable({ b: 2, a: 1 }), stable({ a: 1, b: 2 }));
    const t = await f.target();
    await approve(f.repo, t.id, 1, f.inventory);
    let current = await f.repo.getTarget(t.id);
    await assertApproval(f.repo, current, f.inventory);
    await f.repo.updateTarget(t.id, 1, { caption: "A different caption" });
    current = await f.repo.getTarget(t.id);
    assert.equal(current.revision, 2);
    assert.equal(current.approvedHash, null);
    assert.equal(current.status, "draft");
    await assert.rejects(approve(f.repo, t.id, 1, f.inventory), /Reload/);
    await assert.rejects(
      f.repo.updateTarget(t.id, 1, { caption: "stale" }),
      /changed/,
    );
  } finally {
    f.close();
  }
});

test("live price/status/unpublished changes block approved availability; sold portfolio is accurately labelled", async () => {
  const f = await fixture();
  try {
    const t = await f.target();
    await approve(f.repo, t.id, 1, f.inventory);
    f.setArt({ price: 12000 });
    await assert.rejects(
      assertApproval(f.repo, await f.repo.getTarget(t.id), f.inventory),
      /changed after approval/,
    );
    f.setArt({ price: 10000, status: "reserved" });
    await assert.rejects(approve(f.repo, t.id, 1, f.inventory), /no longer/);
    f.setArt({ status: "sold" });
    const scan = await scanInventory(f.repo, f.inventory);
    assert.equal(scan.blocked, 1);
    const p = await f.repo.getPost(t.postId);
    await updatePost(
      f.repo,
      p.id,
      p.revision,
      {
        title: p.title,
        campaign: p.campaign,
        intent: "portfolio",
        artworkId: p.artworkId,
      },
      f.inventory,
    );
    const fresh = await f.repo.getTarget(t.id);
    await f.repo.updateTarget(t.id, fresh.revision, {
      caption:
        "Obra vendida · en una colección privada. Sold · private collection.",
    });
    const final = await f.repo.getTarget(t.id);
    await approve(f.repo, final.id, final.revision, f.inventory);
    assert.equal((await f.repo.getTarget(t.id)).status, "approved");
  } finally {
    f.close();
  }
});

test("four manual destinations export real source links and never become verified publications", async () => {
  const f = await fixture();
  try {
    for (const provider of platforms) {
      const t = await f.target(provider);
      await assert.rejects(manualPackage(f.repo, t.id, f.inventory), /Approve/);
      await approve(f.repo, t.id, 1, f.inventory);
      const pack = await manualPackage(f.repo, t.id, f.inventory);
      assert.equal(pack.status, "not_published_by_export");
      assert.ok(pack.files["caption.txt"]);
      assert.equal(pack.files["manifest.json"].media.length, 1);
      assert.ok(!JSON.stringify(pack).includes("fixture-token"));
      await enqueue(f.repo, t.id, 1, f.inventory);
    }
    await runSocialTick(f.repo, f.inventory);
    await runSocialTick(f.repo, f.inventory);
    const state = await f.repo.state();
    assert.equal(
      state.targets.filter((t) => t.status === "manual_ready").length,
      4,
    );
    await manualResult(f.repo, state.targets[0].id, 1, null);
    assert.equal(
      (await f.repo.getTarget(state.targets[0].id)).status,
      "manually_reported",
    );
    assert.equal(
      (await f.repo.state()).targets.filter((t) => t.status === "published")
        .length,
      0,
    );
  } finally {
    f.close();
  }
});

test("leases, fence and operation keys prevent duplicate jobs and stale worker completion", async () => {
  const f = await fixture();
  try {
    const t = await f.target();
    await approve(f.repo, t.id, 1, f.inventory);
    const ids = await Promise.all([
      enqueue(f.repo, t.id, 1, f.inventory),
      enqueue(f.repo, t.id, 1, f.inventory),
    ]);
    assert.equal(ids[0], ids[1]);
    const now = Date.now() + 1000;
    const claims = await Promise.all([
      claimJob(f.repo, "first", now),
      claimJob(f.repo, "second", now),
    ]);
    assert.equal(claims.filter(Boolean).length, 1);
    const job = claims.find(Boolean)!;
    const next = await claimJob(f.repo, "replacement", now + 91000);
    assert.ok(next);
    assert.ok(next.fence > job.fence);
    await assert.rejects(
      finishJob(f.repo, job, "done", "manual_ready"),
      /Another worker/,
    );
    await finishJob(f.repo, next, "done", "manual_ready");
    assert.equal((await f.repo.getTarget(t.id)).status, "manual_ready");
  } finally {
    f.close();
  }
});

test("expired unresolved provider attempts become uncertain and cannot be reset or canceled into a repost", async () => {
  const f = await fixture();
  try {
    const t = await f.target();
    await approve(f.repo, t.id, 1, f.inventory);
    await enqueue(f.repo, t.id, 1, f.inventory);
    const now = Date.now() + 1000,
      job = (await claimJob(f.repo, "crashed", now))!;
    await f.client.execute({
      sql: "INSERT INTO social_attempts(id,job_id,target_id,step_key,attempt_no,request_fingerprint,started_at) VALUES (?,?,?,'publish',1,'fingerprint',?)",
      args: [randomUUID(), job.id, t.id, new Date(now).toISOString()],
    });
    assert.equal(await claimJob(f.repo, "recovery", now + 91000), null);
    assert.equal((await f.repo.getTarget(t.id)).status, "uncertain");
    await assert.rejects(
      f.repo.updateTarget(t.id, 1, { caption: "blind retry" }),
      /started or completed/,
    );
    await assert.rejects(
      cancelTarget(f.repo, t.id, 1),
      /cannot be canceled safely/,
    );
    await assert.rejects(enqueue(f.repo, t.id, 1, f.inventory), /Approve/);
  } finally {
    f.close();
  }
});

test("pause and missed schedules prevent sends; UTC conversion rejects DST ambiguity", async () => {
  const f = await fixture();
  try {
    const t = await f.target();
    await approve(f.repo, t.id, 1, f.inventory);
    await enqueue(f.repo, t.id, 1, f.inventory);
    await f.client.execute({
      sql: "INSERT INTO social_settings VALUES ('paused','true',?)",
      args: [new Date().toISOString()],
    });
    assert.equal((await runSocialTick(f.repo, f.inventory)).processed, 0);
    await f.client.execute("DELETE FROM social_settings WHERE key='paused'");
    assert.equal((await runSocialTick(f.repo, f.inventory)).processed, 1);
    assert.equal(
      localSchedule("2026-11-08T10:00", "America/Guatemala"),
      "2026-11-08T16:00:00.000Z",
    );
    assert.throws(
      () => localSchedule("2026-03-08T02:30", "America/New_York"),
      /does not exist/,
    );
    assert.throws(
      () => localSchedule("2026-11-01T01:30", "America/New_York"),
      /ambiguous/,
    );
    process.env.SOCIAL_PUBLISH_ENABLED = "not-a-boolean";
    assert.throws(() => socialConfig(), /true or false/);
  } finally {
    f.close();
  }
});

test("UTM links preserve meaningful query parameters and do not contain campaign PII", () => {
  const u = new URL(
    campaignUrl(
      "https://art.example.test/es/art/one?ref=designer&utm_source=owner",
      "instagram",
      "opaque-id",
      "artist@example.test",
    ),
  );
  assert.equal(u.searchParams.get("ref"), "designer");
  assert.equal(u.searchParams.get("utm_source"), "owner");
  assert.ok(!u.href.includes("artist"));
  assert.equal(u.searchParams.get("utm_content"), "opaque-id");
});

test("social configuration rejects malformed flags and prevents preview public writes", async () => {
  const f = await fixture();
  try {
    const { socialConfig } = await import("../src/lib/social/config.ts");
    process.env.SOCIAL_PUBLISH_ENABLED = "true";
    assert.equal(socialConfig().publishEnabled, false);
    process.env.SOCIAL_PUBLISH_ENABLED = "yes";
    assert.throws(() => socialConfig(), /true or false/);
    process.env.SOCIAL_PUBLISH_ENABLED = "false";
    process.env.SOCIAL_WORKER_MODE = "fake";
    assert.throws(() => socialConfig(), /Unknown social worker/);
  } finally {
    f.close();
  }
});

test("campaign metadata and added destinations use optimistic revisions without copying approval", async () => {
  const { addTarget, updatePost } =
    await import("../src/lib/social/service.ts");
  const f = await fixture();
  try {
    const first = await f.target();
    await approve(f.repo, first.id, 1, f.inventory);
    const p = await f.repo.getPost(first.postId);
    const { targetInput, defaultOptions } =
      await import("../src/lib/social/validation.ts");
    const input = targetInput.parse({
      provider: "facebook",
      caption: "Original art",
      assetIds: first.assetIds,
      options: defaultOptions("facebook"),
    });
    const r = await addTarget(f.repo, p.id, p.revision, input);
    assert.equal((await f.repo.getTarget(r.id)).approvedHash, null);
    await assert.rejects(addTarget(f.repo, p.id, p.revision, input), /Reload/);
    const changed = await f.repo.getPost(p.id);
    await updatePost(
      f.repo,
      p.id,
      changed.revision,
      {
        title: "Revised campaign",
        campaign: "originals",
        intent: "process",
        artworkId: p.artworkId,
      },
      f.inventory,
    );
    assert.equal((await f.repo.getTarget(first.id)).approvedHash, null);
    assert.equal((await f.repo.getTarget(first.id)).status, "draft");
  } finally {
    f.close();
  }
});

test("a late destination is blocked independently while the other campaign packages complete", async () => {
  const f = await fixture();
  try {
    const a = await f.asset();
    const { createPostSchema, defaultOptions } =
      await import("../src/lib/social/validation.ts");
    const now = Date.now();
    const post = await f.repo.createPost(
      createPostSchema.parse({
        requestId: crypto.randomUUID(),
        title: "Partial campaign",
        artworkId: f.art.id,
        targets: platforms.map((provider, i) => ({
          provider,
          caption: "Original artwork. Consultas por mensaje.",
          assetIds: [a.id],
          options: {
            ...defaultOptions(provider),
            ...(provider === "pinterest" ? { title: "Original" } : {}),
          },
          scheduledAt: i === 3 ? new Date(now + 60000).toISOString() : null,
        })),
      }),
    );
    const targets = (await f.repo.state()).targets.filter(
      (t) => t.postId === post,
    );
    for (const t of targets) {
      await approve(f.repo, t.id, 1, f.inventory);
      await enqueue(f.repo, t.id, 1, f.inventory, now);
    }
    await runSocialTick(f.repo, f.inventory, { now: () => now + 7200000 });
    await runSocialTick(f.repo, f.inventory, { now: () => now + 7200000 });
    const results = (await f.repo.state()).targets;
    assert.equal(results.filter((t) => t.status === "manual_ready").length, 3);
    assert.equal(
      results.filter(
        (t) => t.status === "blocked" && t.lastErrorCode === "schedule_missed",
      ).length,
      1,
    );
    assert.equal(
      (await f.repo.state()).jobs.filter((j) => j.state === "uncertain").length,
      0,
    );
  } finally {
    f.close();
  }
});
