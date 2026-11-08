import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { fixture } from "./social-helpers.ts";
import {
  verifyMetaBody,
  verifySignedRequest,
  receiveMetaEvent,
  deleteProviderData,
} from "../src/lib/social/webhooks.ts";
import { disconnect } from "../src/lib/social/service.ts";
import { approve } from "../src/lib/social/approval.ts";
import { enqueue } from "../src/lib/social/jobs.ts";

test("Meta raw signatures reject tampering and webhook replays do not create publish jobs", async () => {
  const f = await fixture();
  process.env.SOCIAL_META_WEBHOOK_APP_SECRET = "fixture-meta-webhook-secret";
  try {
    const c = await f.connect(),
      raw = JSON.stringify({
        object: "instagram",
        entry: [
          {
            id: c.externalId,
            changes: [
              { field: "comments", value: { text: "must not be persisted" } },
            ],
          },
        ],
      });
    const signature =
      "sha256=" +
      createHmac("sha256", process.env.SOCIAL_META_WEBHOOK_APP_SECRET)
        .update(raw)
        .digest("hex");
    verifyMetaBody(raw, signature, process.env.SOCIAL_META_WEBHOOK_APP_SECRET);
    assert.throws(() =>
      verifyMetaBody(
        raw + " ",
        signature,
        process.env.SOCIAL_META_WEBHOOK_APP_SECRET!,
      ),
    );
    const first = await receiveMetaEvent(f.repo, "instagram", raw, signature),
      second = await receiveMetaEvent(f.repo, "instagram", raw, signature);
    assert.equal(first.accepted, 1);
    assert.equal(second.accepted, 0);
    assert.equal((await f.repo.state()).jobs.length, 0);
    const rows = await f.client.execute(
      "SELECT payload_json FROM social_webhook_events",
    );
    assert.ok(
      !String(rows.rows[0].payload_json).includes("must not be persisted"),
    );
    const unknown = JSON.stringify({ entry: [{ id: "9999", changes: [] }] });
    const unknownSignature =
      "sha256=" +
      createHmac("sha256", process.env.SOCIAL_META_WEBHOOK_APP_SECRET)
        .update(unknown)
        .digest("hex");
    assert.equal(
      (await receiveMetaEvent(f.repo, "instagram", unknown, unknownSignature))
        .accepted,
      0,
    );
    await assert.rejects(
      receiveMetaEvent(f.repo, "tiktok", raw, signature),
      /not configured/,
    );
  } finally {
    delete process.env.SOCIAL_META_WEBHOOK_APP_SECRET;
    f.close();
  }
});

test("signed provider deletion removes credentials/profile/metrics without touching customer tables", async () => {
  const f = await fixture();
  process.env.SOCIAL_INSTAGRAM_CLIENT_SECRET = "fixture-app-secret";
  try {
    const c = await f.connect();
    await f.client.execute("CREATE TABLE orders(id TEXT PRIMARY KEY)");
    await f.client.execute("INSERT INTO orders VALUES ('keep-customer')");
    const payload = Buffer.from(
      JSON.stringify({
        algorithm: "HMAC-SHA256",
        user_id: c.externalId,
        issued_at: Math.floor(Date.now() / 1000),
      }),
    ).toString("base64url");
    const signature = createHmac(
      "sha256",
      process.env.SOCIAL_INSTAGRAM_CLIENT_SECRET,
    )
      .update(payload)
      .digest("base64url");
    const signed = `${signature}.${payload}`;
    assert.equal(
      verifySignedRequest(signed, process.env.SOCIAL_INSTAGRAM_CLIENT_SECRET)
        .userId,
      c.externalId,
    );
    assert.throws(() =>
      verifySignedRequest(
        signed + "x",
        process.env.SOCIAL_INSTAGRAM_CLIENT_SECRET!,
      ),
    );
    const first = await deleteProviderData(f.repo, "instagram", signed),
      second = await deleteProviderData(f.repo, "instagram", signed);
    assert.equal(first.confirmationCode, second.confirmationCode);
    assert.equal(
      (await f.client.execute("SELECT COUNT(*) n FROM social_credentials"))
        .rows[0].n,
      0,
    );
    assert.equal(
      (await f.client.execute("SELECT COUNT(*) n FROM social_connections"))
        .rows[0].n,
      0,
    );
    assert.equal(
      (await f.client.execute("SELECT COUNT(*) n FROM orders")).rows[0].n,
      1,
    );
    assert.equal(
      (
        await f.client.execute(
          "SELECT COUNT(*) n FROM social_deletion_requests",
        )
      ).rows[0].n,
      1,
    );
  } finally {
    delete process.env.SOCIAL_INSTAGRAM_CLIENT_SECRET;
    f.close();
  }
});

test("disconnect blocks pending jobs and destroys local tokens but does not delete remote posts", async () => {
  const f = await fixture(true);
  try {
    const c = await f.connect(),
      t = await f.target("instagram", true, c.id);
    await approve(f.repo, t.id, 1, f.inventory);
    await enqueue(f.repo, t.id, 1, f.inventory);
    await disconnect(f.repo, c.id);
    assert.equal((await f.repo.getConnection(c.id)).status, "disconnected");
    assert.equal((await f.repo.getTarget(t.id)).status, "blocked");
    assert.equal((await f.repo.state()).jobs[0].state, "blocked");
    assert.equal(
      (await f.client.execute("SELECT COUNT(*) n FROM social_credentials"))
        .rows[0].n,
      0,
    );
  } finally {
    f.close();
  }
});
