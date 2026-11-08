# Operate the Social Studio

## Normal owner workflow

Open `/studio/social` with the existing email OTP. **New campaign → choose artwork → save drafts → edit each version → Validate → Approve exact version.** Availability captions use the current price/status; a change invalidates approval rather than silently rewriting the caption. Sold work is permitted as accurately labelled portfolio content.

Manual targets work without OAuth: **Prepare manual package → Run due jobs → Download package**. The versioned JSON contains the actual caption, native instructions and authenticated source-download links/checksums. It is not a ZIP. Download the original media while signed in; copy the caption into the native app. **Record native post** is explicitly unverified owner reporting, not API publication.

API targets additionally need configured/authorized accounts, supported public source media, the proper environment/write gate and exact-revision approval. Each destination proceeds independently; failure on one does not falsely mark the others successful. Reusing the create action or parallel workers does not blindly re-create a provider operation.

## Runtime and storage

Use Node 24. No dependency/service subscription was added. Existing database/media/hosting usage still has its own quotas/costs; unlimited free commercial hosting is not promised. The connected team metadata did not expose the hosting plan. No unattended hosted scheduler has been enabled, and Vercel Hobby is not presented as the commercial hosting solution.

Local social storage is separate from local commerce (`.data/social.db`, or the local commerce file plus `.social`). The preview uses the existing guarded development libSQL DB with additive `social_` tables and **does not seed commerce**. Production requires explicit isolated social storage and a separately reviewed authoritative inventory reader; the commerce safety guard remains unchanged.

```sh
npm run social:check
npm run social:migrate
```

`social:check` prints booleans/configuration names, never keys/tokens. Migration is additive and versioned; no customer/inventory/order writes.

## Worker modes

Default **manual**: saved schedules do not run by themselves. Click **Run due jobs**; only due bounded steps run. An API container may need another tick after the displayed processing delay. Manual packages never publish remotely.

To run the owner-operated local worker against the intended database/environment, put `SOCIAL_WORKER_MODE=local` in its private ignored `.env.local`, then:

```sh
npm run social:worker
```

Keep the machine/process online; stop with Ctrl+C or SIGTERM. It polls every 20 seconds, takes at most three bounded steps per tick, records heartbeats and cleans retention daily. No deployment build hook starts it. The private Studio's Activity view shows the latest heartbeat; a completed old manual tick is not evidence of an unattended worker.

A local process using preview credentials must explicitly use `SOCIAL_ENVIRONMENT=preview` and the matching preview keys/DB. Never share production social credentials into preview. Public provider writes remain production-only. Do not bypass the inventory DB environment guard to run production writes.

Hosted boundary `/api/cron/social` is bearer-protected (`SOCIAL_WORKER_SECRET`, >=32 characters), and additionally requires `SOCIAL_WORKER_MODE=hosted` and `SOCIAL_HOSTED_SCHEDULER_VERIFIED=true`. There is **no social cron entry** and no paid service provisioned. Verify the actual commercial hosting plan, schedule frequency, function limits and DB isolation before configuring an unattended schedule.

## Recovery

- **Pause all** is the kill switch; check it between steps. A request already accepted by a provider may still complete. Clear environment write flags too if stopping a deployment.
- Edit/reset only definitely blocked or failed content. Every edit clears approval and cancels queued work for that revision. Historical posts are not remotely edited/deleted by these controls.
- **Outcome uncertain** means the provider may have accepted a write. Do not reset/requeue/copy it into a new campaign as a retry. Use **Reconcile read-only**, inspect the native account and retain operation IDs. If no unique publication evidence exists, automatic reposting stays blocked.
- Lost refresh leases/ambiguous credential rotations require reconnect, not blind reuse of a possibly rotated refresh token. Reconnect invalidates previous queued approval.
- **Disconnect locally** removes saved credentials/upload authorizations and blocks pending jobs. Revoke the app in the native platform settings too. Disconnect does not delete remote posts.
- Jobs more than one hour late are blocked for fresh review. Provider processing has bounded polls, leases are fenced, HTTP calls time out and unacknowledged expired writes become uncertain.
- The inventory scan blocks pending unavailable originals and flags historical availability posts for review; it never reopens stock or changes orders.

## Keys and retention

Back up social storage and encryption keys securely. To rotate: pause publishing; add a new independent `SOCIAL_TOKEN_KEY_V2`, retain V1, set `SOCIAL_TOKEN_ACTIVE_KEY=2` in the intended environment, then run `npm run social:rotate-keys`. The script re-encrypts credentials, pending candidates and private upload artifacts with compare-and-swap. Verify connections before removing the old key. Losing the key requires reconnecting accounts; never dump decrypted payloads to debug.

Expired OAuth/candidates are cleaned after their expiry plus one day; private upload artifacts expire after one hour; completed/canceled-job attempts, audit events and account webhook receipts after 90 days (unresolved attempts and deletion receipts are retained); metric snapshots after 365 days; heartbeats/request dedupe after seven days. Cleanup happens with the local worker, so a manual-only deployment needs an owner Run due jobs maintenance tick (cleanup also runs there); it is not promised to run by itself. Source art/campaigns are retained until intentionally managed. Platform deletion callbacks remove the relevant credentials/profile/metrics/upload authorizations without changing art or commerce data.

## Verification and forward rollback

```sh
npm test
npm run typecheck
npm run build -- --webpack
# Browser tests use the existing project Python/Playwright environment:
# tests/social_browser.py — isolated SQLite, test-only fake email/OAuth transport
```

Tests never contact real social providers. Read VERIFICATION.md for the distinction between fixtures and live evidence. Webpack is used locally because this workspace's dependency folder is an external read-only symlink.

To roll back behavior: pause all, set both write gates false, stop the local worker/hosted schedule, and deploy the previous application version. Keep additive tables, encrypted keys and attempts intact. Do not restore an old database over newer uncertain operations or re-enable revoked credentials from a backup. Inspect/reconcile in-flight IDs before re-enabling work. No migration drops social or customer data.
