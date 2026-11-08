# Current status — 2026-11-08

## Admin authentication

Admin authentication uses email OTP only for
`larkova.art@gmail.com`. Password login and old password cookies are rejected;
short-lived browser-bound codes, persistent throttling and revocable sessions
are implemented. All 37 automated tests, the build and browser OTP/publishing checks pass. The OTP
login page is deployed and verified on Vercel Preview. `RESEND_API_KEY` is now
configured for Preview, Production and Development. Preview was redeployed as
`dpl_7bp4B26DGrri5mmnjSLzGx2TYSWb`; a real OTP request returned HTTP 200, Resend
accepted the admin-email message and the browser-bound challenge cookie was set.
The owner confirmed that email OTP login works on November 8. The test code was not used to create an admin session.
Instructions: `docs/ADMIN-LOGIN.md`.
Cloudinary variables were confirmed present in all three Vercel environments;
Cloudinary account authentication, original storage and an AI-enhanced test image
were verified in deployment `dpl_5ZNCf3xY7EMpirhb5VVL1vkuygRQ`. The reusable test
asset was not published to the catalog; no inventory or customer data changed.

## Original photos, realistic rooms and visual redesign

The original photo is now the default in gallery cards, artwork detail, checkout,
admin thumbnails and Meta feed. Existing listings use their preserved original;
no catalog migration, inventory reset or image deletion is required.
New signed Cloudinary uploads no longer request color enhancement or eager AI
processing. The original upload is verified before publication.

Three built-in-imagegen photographic interiors are saved in `public/rooms/`.
The browser composites the actual artwork photo over them, preserving its aspect
ratio and using entered dimensions for approximate scale. There is no recurring
per-artwork room generation charge. The product viewer defaults to original and
provides three room choices with a clear illustrative-room/scale disclosure.
Sculptures retain their original photograph; they are not misrepresented as wall
paintings. Asset provenance and full prompts: `docs/ROOM-ASSETS.md`.

Storefront, responsive layout, gallery, artwork viewer, checkout styles, OTP
login and admin have a new sans-serif visual design. Admin separates Collection,
Orders and Add Artwork; payment/courier diagnostics are collapsed into settings.
OTP emails now include a branded HTML design alongside the plain-text version.
37 automated tests pass, plus browser checks for all three interiors, original
preference, artwork proportions, admin login and all six locales on mobile.
Deployed and verified as `dpl_77E3fb2rxKXg9aZJDiYCVSKQzbKW` (commit `a0e5d73`).
Hosted homepage, redesigned OTP login and the owner-uploaded Atitlan detail
returned HTTP 200. The owner listing renders the original photo by default and
all three room choices; rendered image tags do not use color-enhancement URLs.

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
