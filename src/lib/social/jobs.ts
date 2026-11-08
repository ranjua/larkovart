import { randomUUID } from "node:crypto";
import { SocialRepository, writeTarget, jobRow } from "./repository.ts";
import { SocialError, type Job, type Target } from "./types.ts";
import { assertApproval } from "./approval.ts";
import type { InventoryReader } from "./inventory.ts";
export async function enqueue(
  repo: SocialRepository,
  id: string,
  revision: number,
  inventory: InventoryReader,
  now = Date.now(),
) {
  const target = await repo.getTarget(id);
  if (target.revision !== revision)
    throw new SocialError(
      "revision_conflict",
      "Reload this revision before scheduling.",
      409,
    );
  if (!["approved", "scheduled", "queued"].includes(target.status))
    throw new SocialError(
      "approval_stale",
      "Approve this revision first.",
      409,
    );
  await assertApproval(repo, target, inventory);
  if (target.scheduledAt && Date.parse(target.scheduledAt) < now - 60000)
    throw new SocialError(
      "schedule_missed",
      "Choose a future time and approve the new revision.",
      422,
    );
  const key = `publish:${id}:${revision}`;
  return repo.tx(async (tx) => {
    const t = await repo.getTarget(id, tx);
    if (
      t.revision !== revision ||
      t.approvedHash !== target.approvedHash ||
      !["approved", "scheduled", "queued"].includes(t.status)
    )
      throw new SocialError(
        "revision_conflict",
        "Destination changed before enqueue.",
        409,
      );
    const existing = await tx.execute({
      sql: "SELECT id FROM social_jobs WHERE operation_key=?",
      args: [key],
    });
    if (existing.rows[0]) return String(existing.rows[0].id);
    const jobId = randomUUID(),
      time = new Date(now).toISOString();
    await tx.execute({
      sql: "INSERT INTO social_jobs(id,target_id,connection_id,kind,operation_key,state,run_at,payload_json,created_at,updated_at) VALUES (?,?,?,'publish',?,'ready',?,?,?,?)",
      args: [
        jobId,
        id,
        t.connectionId,
        key,
        t.scheduledAt || time,
        JSON.stringify({ schema: 1 }),
        time,
        time,
      ],
    });
    await writeTarget(
      tx,
      { ...t, status: t.scheduledAt ? "scheduled" : "queued" },
      revision,
    );
    return jobId;
  });
}
export async function claimJob(
  repo: SocialRepository,
  owner: string,
  now = Date.now(),
): Promise<Job | null> {
  return repo.tx(async (tx) => {
    const expired = await tx.execute({
      sql: "SELECT * FROM social_jobs WHERE state='running' AND lease_until<? LIMIT 20",
      args: [now],
    });
    for (const row of expired.rows) {
      const unresolved = await tx.execute({
        sql: "SELECT id FROM social_attempts WHERE job_id=? AND outcome IS NULL LIMIT 1",
        args: [row.id],
      });
      const uncertain = unresolved.rows.length > 0;
      await tx.execute({
        sql: "UPDATE social_jobs SET state=?,lease_owner=NULL,lease_until=NULL,last_error_code=?,updated_at=? WHERE id=? AND fence=?",
        args: [
          uncertain ? "uncertain" : "ready",
          uncertain ? "provider_uncertain" : null,
          new Date(now).toISOString(),
          row.id,
          row.fence,
        ],
      });
      if (uncertain && row.target_id) {
        const t = await repo.getTarget(String(row.target_id), tx);
        await writeTarget(
          tx,
          { ...t, status: "uncertain", lastErrorCode: "provider_uncertain" },
          t.revision,
        );
      }
    }
    const exhausted = await tx.execute(
      "SELECT * FROM social_jobs WHERE state IN ('ready','retry_wait') AND attempts>=max_attempts LIMIT 20",
    );
    for (const row of exhausted.rows) {
      await tx.execute({
        sql: "UPDATE social_jobs SET state='blocked',last_error_code='step_budget_exhausted' WHERE id=?",
        args: [row.id],
      });
      if (row.target_id) {
        const t = await repo.getTarget(String(row.target_id), tx);
        const progress = jobRow(row).progress;
        await writeTarget(
          tx,
          {
            ...t,
            status: progress.postId ? "uncertain" : "blocked",
            lastErrorCode: "step_budget_exhausted",
          },
          t.revision,
        );
        if (progress.postId)
          await tx.execute({
            sql: "UPDATE social_jobs SET state='uncertain' WHERE id=?",
            args: [row.id],
          });
      }
    }
    const due = await tx.execute({
      sql: "SELECT * FROM social_jobs WHERE state IN ('ready','retry_wait') AND run_at<=? AND attempts<max_attempts ORDER BY run_at,id LIMIT 1",
      args: [new Date(now).toISOString()],
    });
    if (!due.rows[0]) return null;
    const row = due.rows[0];
    const r = await tx.execute({
      sql: "UPDATE social_jobs SET state='running',lease_owner=?,lease_until=?,fence=fence+1,attempts=attempts+1,updated_at=? WHERE id=? AND state IN ('ready','retry_wait') RETURNING *",
      args: [owner, now + 90000, new Date(now).toISOString(), row.id],
    });
    if (!r.rows[0]) return null;
    const job = jobRow(r.rows[0]);
    if (job.targetId) {
      const t = await repo.getTarget(job.targetId, tx);
      if (
        !["queued", "scheduled", "retry_wait", "processing"].includes(t.status)
      ) {
        await tx.execute({
          sql: "UPDATE social_jobs SET state='blocked',last_error_code='approval_stale' WHERE id=?",
          args: [job.id],
        });
        return null;
      }
      await writeTarget(tx, { ...t, status: "processing" }, t.revision);
    }
    return job;
  });
}
export async function ownsLease(
  repo: SocialRepository,
  j: Job,
  now = Date.now(),
) {
  const r = await repo.client.execute({
    sql: "SELECT id FROM social_jobs WHERE id=? AND state='running' AND lease_owner=? AND fence=? AND lease_until>?",
    args: [j.id, j.leaseOwner, j.fence, now],
  });
  return r.rows.length === 1;
}
export async function finishJob(
  repo: SocialRepository,
  j: Job,
  state: Job["state"],
  status: Target["status"],
  patch: Partial<Target> = {},
  progress = j.progress,
  runAt = j.runAt,
) {
  return repo.tx(async (tx) => {
    const r = await tx.execute({
      sql: "UPDATE social_jobs SET state=?,payload_json=?,run_at=?,lease_owner=NULL,lease_until=NULL,last_error_code=?,updated_at=? WHERE id=? AND state='running' AND lease_owner=? AND fence=?",
      args: [
        state,
        JSON.stringify(progress),
        runAt,
        patch.lastErrorCode || null,
        new Date().toISOString(),
        j.id,
        j.leaseOwner,
        j.fence,
      ],
    });
    if (r.rowsAffected !== 1)
      throw new SocialError("lease_lost", "Another worker owns this job.", 409);
    if (j.targetId) {
      const t = await repo.getTarget(j.targetId, tx);
      await writeTarget(tx, { ...t, ...patch, status }, t.revision);
    }
  });
}
export async function cancelTarget(
  repo: SocialRepository,
  id: string,
  revision: number,
) {
  await repo.tx(async (tx) => {
    const t = await repo.getTarget(id, tx);
    if (t.revision !== revision)
      throw new SocialError("revision_conflict", "Destination changed.", 409);
    if (
      [
        "processing",
        "uncertain",
        "published",
        "test_completed",
        "awaiting_creator",
        "manually_reported",
      ].includes(t.status)
    )
      throw new SocialError(
        "provider_uncertain",
        "This operation may already be on the platform. Reconcile or check it natively; it cannot be canceled safely.",
        409,
      );
    await writeTarget(tx, { ...t, status: "canceled" }, revision);
    await tx.execute({
      sql: "UPDATE social_jobs SET state='canceled' WHERE target_id=? AND state IN ('ready','retry_wait','blocked')",
      args: [id],
    });
  });
}
