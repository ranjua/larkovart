# Current status — 2026-11-07

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

PayPal:
- Owner reports Yulia Larkova's PayPal Business signup completed. Business email: larkova.art@gmail.com. Account verification, live receiving eligibility and Guatemala payout route have not been independently verified.
- Preview selects PayPal sandbox. Protected sandbox client ID/secret are present; hosted OAuth authentication succeeds.
- Code implements hosted approval, server-side capture, stable capture retry IDs, order/amount checks and inventory holds.
- Current tests use injected provider responses; no complete external buyer approval/capture test has been completed. No real payment or payout has occurred.
- Checkout currently requires a confirmed parcel and eligible shipping quote BEFORE creating a payment order. Pausing delivery leaves end-to-end checkout blocked. Packing estimates alone do not satisfy that gate.
- Payment factory rejects non-sandbox environments. No live PayPal client exists in the current deployment. Dedicated PayPal webhooks, refund management, live launch settings and durable payment reconciliation need completion/verification before launch.
- Next payment work can be developed independently of delivery: sandbox-specific payment testing decoupled from label/pickup creation, PayPal webhook verification/reconciliation and refunds. Do not weaken live shipping safeguards or charge anyone without specific authorization.

Other providers:
- Stripe sandbox Checkout and signed webhook code implemented. No Stripe credentials or eligible live merchant account connected. Guatemala is not on Stripe's direct merchant-country list; do not fabricate eligibility.
- Recurrente sandbox connector implemented; no account credentials connected.
- NeoNet/VisaNet payment links/NeoPay: researched only. No merchant affiliation, verified API integration or live settlement connected. Visa is a card network; accepting Visa depends on the chosen payment processor and merchant eligibility.

## Hosting and verification

- Vercel project: larkovart-dev. GitHub repository ranjua/larkovart is connected; branch pushes produce previews.
- Last verified ready preview commit: ffb404b. Latest immutable preview: https://larkovart-ifmv2y5pe-juarerandy-7417.vercel.app . Branch preview: https://larkovart-dev-git-dev-nextjs-art-store-juarerandy-7417.vercel.app . Preview protection remains enabled.
- Production currently contains the minimal setup placeholder, not a launched store.
- Latest verification: 27 tests pass; type checking and build pass; preview homepage HTTP 200; hosted PayPal/Envia sandbox authentication passes.
- Separate development Turso database is used by previews. Production payment/database environment configuration has not been provisioned for live commerce.

## Social

Existing Instagram: @yuliaartgt. Meta catalog feed and social strategy document exist. No social OAuth connection, publishing, messaging or paid campaign is active. Account approvals and public-domain/catalog eligibility remain outstanding. No content or messages have been sent on the owner's behalf.
