# Current status — 2026-11-07

## Admin authentication

Admin authentication uses email OTP only for
`larkova.art@gmail.com`. Password login and old password cookies are rejected;
short-lived browser-bound codes, persistent throttling and revocable sessions
are implemented. All 35 automated tests, the build and browser OTP/publishing checks pass. The OTP
login page is deployed and verified on Vercel Preview. `RESEND_API_KEY` is now
configured for Preview, Production and Development. Preview was redeployed as
`dpl_7bp4B26DGrri5mmnjSLzGx2TYSWb`; a real OTP request returned HTTP 200, Resend
accepted the admin-email message and the browser-bound challenge cookie was set.
Inbox receipt and the owner's real login remain owner-confirmed steps, not inferred
from API acceptance. The test code was not used to create an admin session.
Instructions: `docs/ADMIN-LOGIN.md`.
Cloudinary variables were confirmed present in all three Vercel environments;
Cloudinary account authentication, original storage and an AI-enhanced test image
were verified in deployment `dpl_5ZNCf3xY7EMpirhb5VVL1vkuygRQ`. The reusable test
asset was not published to the catalog; no inventory or customer data changed.

## Photo enhancement and publishing

Private `/studio` now includes simplified photo upload, USD 100 default price,
automatic factual descriptions in six languages and publishing checked by default.
Cloudinary signed direct uploads, AI exposure/color enhancement, original-photo
preservation and provider receipt verification are implemented. Cloudinary
variables are configured in Preview, Production and Development. Account authentication and real AI enhancement were verified in the deployment
check. Original uploads remain available
when enhancement is disconnected. Setup/cost details: `docs/PHOTO-ENHANCEMENT.md`.

## Delivery: paused at owner's request

Do not continue delivery configuration or request further delivery setup until the owner resumes it. Preserve all existing credentials and configuration.

Completed:
- Envia sandbox token saved privately in Vercel Preview; authentication verified against the test API.
- Sandbox multi-carrier connector implemented for quotes, labels, pickup and tracking; transport-injected tests pass.
- Owner-provided Guatemala sender details configured privately in the store, not saved as an Envia address-book entry. Envia address-book count was zero at last verification.
- Atitlan, Gato and Mar2 are USD 100 each including shipping. Their planning estimates are 62 × 62 × 14 cm, 4 kg each, assuming unframed canvas without glass. These remain separate from confirmed parcel data.
- No shipping quote confirmed, no label purchased, no pickup requested.

Outstanding when delivery resumes:
- Exact collection location: building/house number or map pin; only the street/zone was supplied.
- Validate sender state/address codes and actual eligible carrier services for Zona 12 and original artwork.
- Obtain successful destination-specific quotes and establish a shipping allowance consistent with the USD 100 total price. Do not invent rates or FX conversion.
- Final packed dimensions/weight must be confirmed before real labels; customs data, tax IDs where required, insurance/artwork restrictions and international duties policy need validation.
- Consolidated/daily pickup handling, pickup exception reconciliation and an always-on worker remain outstanding before unattended multi-order fulfillment.
- Guatex requires official API contract/access; direct Forza/DHL/FedEx accounts are not connected. Their code connectors are sandbox-only.

## Payments

Recurrente is now the selected Preview provider. Sandbox authentication, a hosted USD 1 successful payment, a simulated decline and a full refund have been verified against Recurrente. Signed natural `intent.succeeded`, `intent.failed` and `refund.create` callbacks were received and recorded. Webhook registration and encrypted signing-secret storage are automated; the preview remains protected. The studio has an independent test panel that never reserves originals or creates shipments.

Live payments are NOT enabled. Merchant verification, bank payout setup, live keys, separate live webhook settings and live-mode payment/refund handling remain pending. Current code deliberately accepts Sandbox only. Store checkout still requires shipping readiness; delivery stays paused and automatic shipping test booking is disabled. See RECURRENTE-SETUP.md for verified evidence and remaining work.

PayPal sandbox authentication remains verified and its credentials are retained, but it is no longer the selected Preview provider. A complete external PayPal purchase/capture test, dedicated PayPal webhooks, refunds and live payout eligibility remain pending.

Stripe sandbox code exists with no connected credentials or eligible live merchant account. NeoNet/VisaNet is researched only, with no merchant/API connection. No real payment, refund or payout has occurred.

## Hosting and verification

- Vercel project: larkovart-dev. GitHub repository ranjua/larkovart is connected; branch pushes produce previews.
- Last verified ready payment implementation commit: 7a6b44d. Branch preview: https://larkovart-dev-git-dev-nextjs-art-store-juarerandy-7417.vercel.app . Preview protection remains enabled.
- Production currently contains the minimal setup placeholder, not a launched store.
- Latest verification: 30 tests pass; type checking and build pass; preview homepage HTTP 200; hosted PayPal/Envia sandbox authentication passes.
- Separate development Turso database is used by previews. Production payment/database environment configuration has not been provisioned for live commerce.

## Social

Owner-confirmed primary Instagram: @larkova.art (2026-11-07; previously recorded @yuliaartgt). Meta catalog feed and social strategy document exist; see MARKETING-PLAN.md for the 90-day marketing and sales plan. No social OAuth connection, publishing, messaging or paid campaign is active. Account approvals and public-domain/catalog eligibility remain outstanding. No content or messages have been sent on the owner's behalf.

## Recurrente update

Sandbox configuration and external payment/decline/refund/webhook tests completed. No further Sandbox key entry is required. Production activation and payouts remain pending. See RECURRENTE-SETUP.md.
