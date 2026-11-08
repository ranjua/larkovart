# Social Studio implementation evidence — 2026-11-08

Implemented from the owner's saved AGENT-HANDOFF.md, IMPLEMENTATION-PLAN.md and TASKS.md in `/home/randy/larkovart`, branch `dev/nextjs-art-store`. Node **24.22.2**. Baseline **37 tests + typecheck passed** before edits.

## Actual capability matrix

| Capability                                                               | Instagram                              | Facebook Pages                                 | Pinterest                                            | TikTok                                     |
| ------------------------------------------------------------------------ | -------------------------------------- | ---------------------------------------------- | ---------------------------------------------------- | ------------------------------------------ |
| Drafts, per-platform variants, approval, media downloads/manual packages | Implemented; browser/fixture verified  | Same                                           | Same                                                 | Same; default supported path               |
| OAuth, encrypted credentials, explicit account selection                 | Implemented; fixture/browser verified  | Implemented; encrypted Page selection fixtures | Implemented; fixtures                                | Not enabled; no approved product           |
| Authorized identity/recent-content reads                                 | Implemented, bounded                   | Implemented, bounded                           | Implemented, bounded                                 | Native app only                            |
| API publication                                                          | Image, 2–10 image carousel, short Reel | Page text/link, photo, multi-photo, short Reel | Image/video Pin; owned board; explicit tier          | Direct Post policy-restricted; manual only |
| Provider implementation tests                                            | Pass with injected transport           | Pass with injected transport                   | Pass with injected transport, including video upload | Manual path/restriction tests pass         |
| Basic metric reads                                                       | Likes/comments when available          | Shares when available                          | Explicit 7-day summaries                             | Native app                                 |
| Developer app configured on Vercel                                       | **No**                                 | **No**                                         | **No**                                               | **No**                                     |
| Owner authorized account / permissions / app review                      | **No**                                 | **No**                                         | **No**; tier unknown                                 | Not claimed eligible                       |
| Live account read verified                                               | **No**                                 | **No**                                         | **No**                                               | **No**                                     |
| Live test/public write verified                                          | **No**                                 | **No**                                         | **No**; mocked Trial is not live evidence            | **No**                                     |
| Scheduled records/jobs                                                   | Implemented/tested                     | Same                                           | Same                                                 | Manual package reminder/readiness only     |
| Unattended hosted scheduling                                             | **Off / unverified**                   | Same                                           | Same                                                 | Same                                       |

No real social posts, messages, account registrations, ad spend or paid services were performed. No automated test contacts a real social provider. Payments, delivery configuration, existing inventory/customer orders and `_old/` are unchanged.

## Checks and evidence

- **71/71 Node tests pass**: 37 existing and 34 social tests. Commands: `npm test`, `npm run typecheck`; Node 24.
- **Webpack production build passes** (`npm run build -- --webpack`). This workspace has read-only external dependency symlinks; no unrelated package upgrades or new dependencies were introduced.
- `tests/social-core.test.ts`: repeated/concurrent additive migrations preserve sentinel customer/artwork data; transactional rollback/request dedupe; AES-GCM AAD/tampering/version rotation; exact revision hashes; edit/price/reserved/sold/unpublished changes block stale availability; all four manual packages contain actual sources; job claims/leases/fences/crash recovery; timezone ambiguity; UTM preservation; configuration gates; metadata/add-destination optimistic revisions.
- `tests/social-oauth.test.ts`: expiring one-use browser/provider/environment-bound state; Instagram actual scopes/data-wrapper/token encryption; encrypted Facebook Page candidates; refresh lease/interruption requires reconnect. No production fake-provider selector exists.
- `tests/social-providers.test.ts`: distinct container/media/final post IDs; lost final response remains uncertain without a second publish; accepted-ID checkpoint before crash; wrong Facebook author remains uncertain; owned-board creator-only Trial state; SSRF/magic/checksum protection; null-vs-zero metrics and snapshot dedupe; child processing/failure/order; Reel processing limits; bounded response bodies; Facebook Reel start/upload/finish/read; Pinterest encrypted signed upload/video/cover/Trial distinction; forged social upload receipts rejected before fetching storage.
- `tests/social-webhooks.test.ts`: raw HMAC tampering/replay, unrelated account receipt behavior, signed deletion and local disconnect preserve customer tables and never create publishing jobs.
- **Browser journey passes** (`tests/social_browser.py`): existing OTP, private API/CSRF/body limit, four persisted independent variants, edit/validate/approve, stale-approval invalidation, actual JSON package plus source byte download, manual job/report as unverified, schedule/calendar/timezone, reload persistence, all seven mobile tabs without page overflow, missing-state rejection, successful fixture OAuth callback **without the Strict Studio cookie**, replay rejection and no token returned to browser. Uses isolated SQLite, test-only fake Resend/OAuth transport; no real email/social provider requests.
- Screenshots inspected: `/tmp/larkova-social-desktop.png`, `/tmp/larkova-social-mobile.png` (local fixture data only).
- React best-practices checklist applied: server-side authorization, bounded public props, credentials/server crypto kept out of the browser module graph, component-level state, accessible labels/native controls, busy-state duplicate submission protection, focusable feedback, mobile layout. No unsolicited new component framework/dependency.
- `git diff --check` passes. Client-secret scan: 54 built browser JavaScript bundles checked against locally configured private secrets, no matches; no secret values printed. Final deployed checks are recorded below.

## Storage and retry findings

The local libSQL driver cannot safely interleave yielded per-statement DDL transactions from two clients; the initial concurrency test exposed SQLITE_BUSY at commit. Migrations now use one atomic additive batch, with serialized local writes and bounded busy retry. The repeated/concurrent sentinel test passes.

Every provider write records an attempt before sending. Accepted operation IDs and private upload authorization are checkpointed transactionally **before** returning to the adapter. Lease expiry with an unresolved attempt, lost final response or a known final ID whose verification fails remains uncertain. Reconciliation performs reads only; no automatic repost. Signed Pinterest upload parameters are separately encrypted, not included in browser-visible job progress.

Local social storage is a separate file. Preview can use the existing guarded development libSQL DB, only with additive social-prefixed tables and no commerce initialization/seed call. Production requires explicit separate social DB settings; the existing commerce guard is unchanged, so production inventory access remains a separately reviewed setup prerequisite rather than a bypass.

## Hosting and external prerequisites

Connected Vercel metadata confirms team `team_Q9eV1iiGwCtird9GCFOlALeK`, project `prj_ASePEocpNrBuQP3vPOhBg4lVC58K` / `larkovart-dev`, Node 24, deployment protection enabled. Existing Turso variables target Preview/Development. No SOCIAL_ variables or social project connectors were configured at inspection. Secret values were not printed.

The connected team metadata did not expose a hosting plan. Manual mode is default; local worker works only while the owner's process is running. A bearer-protected hosted tick boundary exists, but there is no social cron schedule, no paid scheduler purchased and no claim of unlimited free commercial hosting.

Remaining owner-only actions are in PLATFORM-SETUP.md: first create/select the Instagram Login app, register the exact callback, save its app credentials privately, authorize @larkova.art and confirm its immutable account ID. Other account/Page/board selections and provider reviews remain separate. Protected preview URLs do not satisfy a public buyer destination or app-review privacy-domain requirement. Production writing remains off until isolated storage/inventory/public-origin/account/test authorization are verified.

## Deployment packaging

A final packaging review found module-relative filesystem URLs could refer to the
build workspace after serverless deployment. Local artwork reads now resolve
from the runtime project root, and Next output tracing explicitly includes
`public/artworks` for the social Studio and worker routes. Bundle trace contents
are checked after rebuilding. Reference:
https://nextjs.org/docs/app/api-reference/config/next-config-js/output

## Release evidence

Pending final protected preview deployment and read-only hosted route checks. Local/full-flow evidence above must not be confused with live provider or hosted authenticated-account evidence.
