# Provider contracts — checked 2026-11-08

Only official documentation, provider-owned Postman collections and official
Pinterest OpenAPI are used. Some browser fetches returned 429/JavaScript shells;
the same official Meta URLs with `?locale=en_US` were retrieved successfully with
curl. Documentation examples may show v27 while the version lifecycle table
lists v26; this implementation pins **v25.0**, released February 18, 2026 and
supported until July 29, 2028 per Meta's official versions table. There is no
claim of live account or write verification.

## Shared decisions

Native fetch/crypto and existing libSQL/Zod only. No paid scheduler/SaaS/AI
subscription. Manual/local worker baseline. Team hosting plan was not exposed
by the connected metadata API; hosted commercial scheduling remains unverified
and disabled. No social credentials or Vercel social connectors existed at the
initial inspection. Preview writes default off. Pinterest Trial is the only
creator-only api_test mode; Meta API posts are not mislabeled private tests.

## Instagram — Instagram Login

- Professional account; target owner-confirmed username `larkova.art`, with
  immutable account ID explicitly selected after read verification.
- Requested minimum scopes: `instagram_business_basic`,
  `instagram_business_content_publish`. Comments/messages/insight product scopes
  are not requested; basic likes/comments fields may be unavailable and remain
  null or a permission failure rather than fabricated metrics.
- Authorization: `https://www.instagram.com/oauth/authorize`, code and state.
- Exchange: POST `https://api.instagram.com/oauth/access_token`, form app ID,
  secret, code, exact redirect, grant_type=authorization_code. Current response
  can wrap token/user_id/permissions in data[0]; direct shape is also accepted.
- Long token: GET graph.instagram.com/access_token, ig_exchange_token and secret;
  refresh: GET /refresh_access_token, ig_refresh_token. Actual expires_in is
  stored. Documented refresh requires a valid token at least 24 hours old.
- Profile: GET /v25.0/me?fields=user_id,username; unwrap data[0] where present.
- Media: POST /v25.0/{account}/media; persist child/container IDs; query
  /{container}?fields=status_code; POST /{account}/media_publish creation_id;
  verify final media ID/permalink with a separate read.
- Current guide supports up to 20 carousel items; this release deliberately
  supports the conservative subset 2–10 images. Children are comma-separated.
  The API crops carousel images to the first; mismatched aspect ratios are
  rejected to preserve original art.
- Conservative image subset: standard JPEG, <=8 MB, width >=320, ratio 4:5 to
  1.91:1. Original source only; no automatic crop/repainting. Reels subset:
  verified MP4/MOV, 3–90 seconds, existing media storage <=25 MB.
- Image alt_text is documented from March 24, 2025. No Stories, music, product
  tags, collaborators, ads or claims of full native-app parity.
- Containers polled in durable jobs, not blocking sleeps. Timeout after create
  or final publication is uncertain; read-only reconciliation never reposts.
- Live evidence: none; no owner OAuth grant or public test post.

Sources:

- https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login/?locale=en_US
- https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/get-started/?locale=en_US
- https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/content-publishing/?locale=en_US
- https://developers.facebook.com/docs/graph-api/changelog/versions/?locale=en_US
- https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api

## Facebook Pages — separate Facebook Login

- GET versioned facebook.com/dialog/oauth, then server code exchange on
  graph.facebook.com/v25.0/oauth/access_token. Actual granted permissions are
  read from /me/permissions. Page discovery /me/accounts with id/name/token/tasks
  is bounded to 50. Page candidates stay encrypted until explicit selection.
- Base scopes: pages_show_list, pages_read_engagement, pages_manage_posts.
  Current general Page post guidance lists additional engagement permissions
  for some operations; no ungranted capability is inferred. Actual account tests
  must verify the precise permissions/tasks for its selected format.
- Publishing destination is a managed Page with CREATE_CONTENT/MANAGE task
  evidence, never a personal profile.
- Text/link: POST /{page}/feed. Single photo: POST /{page}/photos url/caption.
  Official Page photos reference returns separate id (photo) and post_id.
  Multi-photo: persist unpublished photo IDs then create final attached_media feed
  post. Final selected-Page author and post ID/permalink are read independently.
- Caption subset <=5,000 chars; original verified image sources only. Page
  short Reels use start → hosted upload → processing → finish → independent
  Page/public-status verification. Each accepted stage is checkpointed. The
  returned rupload.facebook.com path is strictly constrained to its video ID;
  hosted upload uses OAuth headers and file_url, not a provider token in a URL.
  Supported subset: verified H.264/AAC, 9:16, >=540×960, 24–60fps, 3–90s, <=25MB.
  Long-form video/Stories/music remain unsupported API formats.
- Page tokens are not assumed immortal. Expiry/revocation requests reconnect;
  the user token is not retained merely to invent a refresh flow.
- Live evidence: none; no Page selected or public test post.

Sources:

- https://developers.facebook.com/docs/pages-api/posts/?locale=en_US
- https://developers.facebook.com/docs/graph-api/reference/page/photos/?locale=en_US
- https://developers.facebook.com/docs/video-api/guides/reels-publishing/?locale=en_US
- https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api (managed Page token example)

## Pinterest — API v5, official OpenAPI 5.28.0

- Source: pinterest/api-description/main/v5/openapi.json, retrieved directly.
- OAuth authorization URL https://www.pinterest.com/oauth/; POST
  https://api.pinterest.com/v5/oauth/token with Basic app authentication and
  form grant_type=authorization_code/code/redirect_uri. Refresh uses documented
  refresh_token grant and atomic lease/generation storage.
- Current OpenAPI lists user_accounts:read, boards:read, boards:write,
  pins:read, pins:write for this full read/create workflow. boards:write appears
  in the create-Pin security requirements even though this release does not
  create boards. No ads/billing permissions requested.
- Profile GET /user_account; owned board discovery GET /boards and board
  verification GET /boards/{id}. Image Pin POST /pins with title, description,
  alt_text, board_id, optional section/link and media_source:image_url.
- Limits from schema: title 100, description 800, alt_text 500, link 2048.
  Source subset JPEG/PNG <=20 MB. Exact public artwork destination required by
  this product; a protected preview is not a public product link.
- Pin GET /pins/{id} verifies ID and selected board. Trial is creator-only:
  api_test -> test_completed. Standard is required for public mode. Tier is
  owner-confirmed from app-dashboard evidence, not inferred from an API token.
- Analytics use explicit supported 7-day summary fields; snapshots are not
  summed across networks or confused with sales. Video Pins register POST /media
  media_type:video, store media_id plus encrypted signed upload authorization,
  POST multipart bytes/parameters to the exact documented Pinterest S3 host
  (204 success, no bearer token), poll GET /media/{id} until succeeded, then
  create video_id Pin with the separately selected original cover image.
  The returned Pin ID/board is read independently.
- Conservative video subset: verified H.264/AAC MP4/MOV, 4–90s, <=25MB; these
  are product limits rather than claims of the provider's full maxima. Image
  cover is checked with the same immutable media path. AWS signing parameters
  are AES-GCM encrypted server artifacts, expire in one hour and never appear
  in job state, API responses or logs.
- Live evidence: none; app tier, account and board unverified.

Sources:

- https://developers.pinterest.com/docs/work-with-organic-content-and-users/create-boards-and-pins/
- https://github.com/pinterest/api-description/blob/main/v5/openapi.json
- https://developers.pinterest.com/docs/key-concepts/access-tiers/
- https://developers.pinterest.com/docs/getting-started/connect-app/
- https://github.com/pinterest/pinterest-python-generated-api-client

## TikTok — manual/native completion

Direct Post guidelines explicitly exclude a utility for accounts the developer
or team manages. The suite is private and therefore keeps that path disabled.
Manual image/video packages and captions work without API credentials. The
optional Upload-to-inbox product is separate; an accepted upload would only mean
awaiting_creator, never verified public publication. No approval is claimed,
no TikTok tokens are requested and no competitor scraping/music transfer occurs.

Sources:

- https://developers.tiktok.com/docs/en/content-sharing-guidelines
- https://developers.tiktok.com/docs/en/content-posting-api-reference-upload-video

## Webhooks/lifecycle

Only verified Meta challenge/raw-body HMAC and signed deauthorization/deletion
contracts may be enabled. Pinterest/TikTok webhook boundaries remain disabled
without an actual supported product contract. Polling/read-only reconciliation
is sufficient for implemented publishing. No webhook may approve new content,
charge customers or modify inventory.
