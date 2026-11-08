# Connect social accounts

Manual drafting/export is available at `/studio/social` using the existing email OTP. No social account is connected yet. Start with Instagram; the other accounts can be connected later.

## Owner's next action — Instagram

1. Open [Meta developer apps](https://developers.facebook.com/apps/). Create/select the app and add **Instagram API with Instagram Login**. Use the professional account **@larkova.art**.
2. Register the exact redirect shown under **Studio → Social → Connections**: `{SOCIAL_ORIGIN}/api/social/oauth/instagram/callback`. Add the tester/account role and accept its invitation in Instagram if the app is in development mode.
3. Save `SOCIAL_INSTAGRAM_CLIENT_ID` and `SOCIAL_INSTAGRAM_CLIENT_SECRET` in Vercel environment settings. Do not send passwords/tokens in chat. After deployment, choose **Connect Instagram**, authorize, then **Use this exact account** after checking its username and account ID.

The developer-app creation, consent and review steps require the account owner. They cannot be completed by inventing credentials or reusing the Studio OTP.

## Prepared automatically for the preview

The existing `dev/nextjs-art-store` preview branch now has its canonical callback
origin, a dedicated encrypted social key, active key version, manual worker mode,
and explicit false public/test-write, public-store and hosted-scheduler gates.
No provider app secret, access token or production/development key was added.
You only need the provider's developer-app settings and consent steps above.
Do not replace the encryption key after accounts connect; use the rotation
procedure when changing keys.

## Shared server configuration

- `SOCIAL_ORIGIN`: canonical HTTPS Studio origin; exact allowlisted callback origin, no trailing path. The current protected branch preview is `https://larkovart-dev-git-dev-nextjs-art-store-juarerandy-7417.vercel.app`.
- `SOCIAL_TOKEN_KEY_V1`: a **separate random 32-byte base64 key**, server only. Use a password manager or local cryptographic generator and save directly to environment settings. `SOCIAL_TOKEN_ACTIVE_KEY=1`.
- `SOCIAL_META_GRAPH_VERSION=v25.0` (supported version recorded in PROVIDER-CONTRACTS.md).
- Keep `SOCIAL_PUBLISH_ENABLED=false`, `SOCIAL_TEST_WRITES_ENABLED=false`, `SOCIAL_WORKER_MODE=manual` during connection/read verification.
- Set provider secrets only for their intended environment. Never copy production tokens/keys into Preview or Development. Encryption binds credentials to their environment/provider/row; production writing is refused in previews even if the public-write flag is accidentally true.
- Preview uses the existing **development** libSQL service and separate `social_` tables. Production requires an explicit separately configured social DB: `SOCIAL_DATABASE_URL`, `SOCIAL_DATABASE_AUTH_TOKEN`, `SOCIAL_DATABASE_ENVIRONMENT=production`. Do not weaken commerce's development guard or point social tests at customer inventory.

Protected previews are suitable for owner testing, but app reviewers need public privacy/callback URLs on a suitable domain. Public social privacy content is implemented at `/social/privacy`; do not represent a protected preview as a public buyer destination. `SOCIAL_STORE_ORIGIN` and `SOCIAL_PUBLIC_STORE_VERIFIED=true` may only be set after the matching artwork pages are actually public and verified. Pinterest API drafts require that destination. No domain purchase/renewal is performed by this change.

## Facebook Pages

Use Facebook Login, separately from Instagram Login. Save `SOCIAL_FACEBOOK_CLIENT_ID` / `SOCIAL_FACEBOOK_CLIENT_SECRET`; register `{SOCIAL_ORIGIN}/api/social/oauth/facebook/callback`. Request `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`; app review/advanced access/business verification may be required for the intended users. Read the actual granted permissions. Select a returned managed Page, inspect its name/ID/tasks, then confirm that exact Page. Personal profiles cannot be publishing destinations. Verify account reads before authorizing any exact public post.

Supported code: Page text/link, photo, multi-photo, and bounded short Reels. Reels require a verified 9:16 H.264/AAC source, 540×960 minimum, 3–90 seconds, 24–60 fps. Ordinary long-form video, native music and Stories are not advertised as supported.

## Pinterest

Create/select the business app at [Pinterest developer apps](https://developers.pinterest.com/apps/). Save `SOCIAL_PINTEREST_CLIENT_ID` / `SOCIAL_PINTEREST_CLIENT_SECRET`; register `{SOCIAL_ORIGIN}/api/social/oauth/pinterest/callback`. Requested scopes: `user_accounts:read`, `boards:read`, `boards:write`, `pins:read`, `pins:write`.

Connect, confirm the account ID, load an **owned** board, choose its ID, and confirm the app's actual dashboard tier. Unknown tier blocks API publication. **Trial is creator-only** and requires explicit nonproduction `SOCIAL_TEST_WRITES_ENABLED=true`; a successful Trial Pin is recorded as `test_completed`. Standard access/review is required for public Pins. Review submission must honestly demonstrate this private original-art workflow, the public privacy/deletion page and exact account access. Do not claim public posting from a Trial result.

Image Pins and video registration/upload/poll/Pin creation are implemented. A video target selects the original video first and one cover image second. The integration accepts a conservative 4–90-second verified MP4/MOV subset, within the 25 MB storage limit. Uploaded signed S3 parameters remain encrypted on the server.

## TikTok

Use **Download package**, download its source media and copy its caption into TikTok. Record the native result when finished. Private developer/team account-management tools are excluded by the current Direct Post guidelines. No active Direct Post or unapproved inbox-upload flow is exposed. An optional legitimate Upload-to-inbox product would require a separate eligibility/approval decision and creator-completion workflow; it is not necessary for manual use.

## Meta lifecycle callbacks

For each configured Meta app, register its corresponding:

- Deauthorization: `{SOCIAL_ORIGIN}/api/social/{instagram|facebook}/deauthorize`
- Data deletion: `{SOCIAL_ORIGIN}/api/social/{instagram|facebook}/data-deletion`
- Privacy: `{SOCIAL_ORIGIN}/social/privacy`

These verify Meta `signed_request` using the corresponding provider app secret. Local account credentials/profile/metrics are removed; artist sources and orders are preserved. Confirmation URLs are opaque and validated against stored hashed codes.

Optional receipt-only webhook: `/api/webhooks/social/{instagram|facebook}` with `SOCIAL_META_WEBHOOK_VERIFY_TOKEN` and `SOCIAL_META_WEBHOOK_APP_SECRET` for the **actual subscribing Meta app**. Do not use one root secret for a different app's events. No comments/DM subscription or webhook-triggered publication is implemented. Polling works without webhooks.

## Before any public provider test

Verify the production account, separately configured DB, public artwork page, actual permissions and worker health. The owner must approve the exact destination/content/visibility in Studio and explicitly authorize the test. Only then enable the production public-write gate. This implementation did not perform that test or publish anything.
