> Start with [the short setup checklist](QUICK-SETUP.md). Multi-courier test support now includes Forza (GT), DHL and FedEx (international); Guatex awaits its official API contract. Shared sender: `SHIPPING_TEST_SHIPPER_JSON`. Automatic test booking is enabled unless `SHIPPING_AUTO_BOOK_TEST=false`. This supersedes DHL-only configuration below. See `.env.example` for each courier’s test credentials.

# Payment, courier and Vercel development setup

The code now integrates **Recurrente Sandbox** and **DHL Express MyDHL test API**.
It does not connect an account merely because these adapters exist. Account
credentials, a development cloud database and Vercel access are still required.
Live payment keys, live endpoints and production data are outside this task.

## What is implemented

1. The buyer selects a destination and enters fictional contact details.
2. The server checks the artwork's packed dimensions, weight and shipping
   allowance against DHL's test rating service. It does not invent exchange rates
   or store the account's quoted rates. If packaging is missing or delivery is
   outside the allowance, the buyer can save a quote request without paying.
3. An eligible original is atomically reserved. The server verifies the Recurrente
   key belongs to the expected Sandbox, then creates a hosted USD card checkout.
4. A signed webhook or an authenticated buyer status check retrieves the checkout
   from Recurrente. Sandbox, order reference, currency and exact amount must match
   before inventory becomes sold. A success redirect alone does not prove payment.
5. A durable fulfillment job is queued once. Unless `SHIPPING_AUTO_BOOK_TEST=false`, it
   rechecks shipping eligibility and requests a test label and pickup. Otherwise,
   the studio has a **Create test label & pickup** button.
6. The studio can download the test PDF label and request DHL test tracking data.

The country selector includes ISO 3166-1 destinations; inclusion in the selector
does not promise actual service or permission to ship. Product support and rates
are checked with the courier.

## 1. Development account credentials

Keep secrets in ignored `.env.local`, or in **Preview-only** Vercel environment
variables. Never paste them into chat, commits, browser code or command arguments.
Copy the names and non-secret defaults from `.env.example`.

### Recurrente

Create an account or use an existing account's **named Sandbox**. Recurrente's
[first test payment guide](https://docs.recurrente.com/guides-english/getting-started/first-test-payment)
explains API-only signup and Sandbox access before live activation.

Set:

```text
PAYMENT_PROVIDER=recurrente
PAYMENT_ENVIRONMENT=sandbox
RECURRENTE_SECRET_KEY=<the Sandbox's sk_test_ key>
RECURRENTE_SANDBOX_ID=<the Sandbox's sbx_ identifier>
```

Every provider operation verifies `GET /api/test` returns `environment=sandbox`
and the expected Sandbox ID. The adapter rejects `sk_live_` before making requests.
No bank withdrawal or payout API is invoked. Sandbox cannot prove real settlement
or bank payout eligibility; that requires separate merchant onboarding.

### DHL Express

Obtain **MyDHL Express test credentials and a test account number** through the
[official API access process](https://developer.dhl.com/api-reference/dhl-express-mydhl-api).
This code is fixed to `https://express.api.dhl.com/mydhlapi/test`; it exposes no
production URL override.

Set `DHL_ENVIRONMENT=sandbox`, `DHL_TEST_USERNAME`, `DHL_TEST_PASSWORD`, and
`DHL_TEST_ACCOUNT`. Configure `DHL_TEST_SHIPPER_JSON` using fictional developer
data in Guatemala, in this shape:

```json
{
  "name": "Development Studio",
  "email": "studio@example.com",
  "phone": "+50255550123",
  "address": "Fictional studio address",
  "city": "Guatemala City",
  "postal": "01012",
  "country": "GT"
}
```

The real collection address and courier agreement are not inferred from “Zona
12”. Account service availability, artwork acceptance, packaging, coverage and
local delivery options must still be confirmed before live use. DHL test tracking
uses provider fixtures and may not reflect a test label's lifecycle.

## 2. Artwork shipping setup

In `/studio`, expand **Packed dimensions & shipping allowance** for each work.
Enter measured outer length/width/depth, packed weight, artwork net weight,
confirmed origin country, approved customs HS code, and the amount of the total
sale price that may cover shipping. None are guessed from canvas dimensions.

For development, use fictional test measurements and classification data. A
shipping allowance is not added to the buyer's price; it limits which delivery
costs can be absorbed within that price. USD quotes are required; other currencies
lead to a quote request. The shipment payload uses DAP, so the integration does not
represent destination duties or taxes as prepaid.

## 3. Vercel Preview and development database

Connect Vercel to this session so the project can be created and linked to
`ranjua/larkovart`, using `dev/nextjs-art-store` as a **Preview** deployment.
Do not deploy or promote production or attach `larkovart.com` under this task.
`vercel.json` disables automatic deployments from `main` and `master`; this is not
a substitute for confirming the deployment target is Preview.

Use an isolated development **libSQL/Turso** cloud database with
`DATABASE_ENVIRONMENT=development`. Set `DATABASE_URL` and
`DATABASE_AUTH_TOKEN` in the Vercel Preview environment. The local SQLite file is
not durable Vercel storage, and the application intentionally refuses to use it
when running on Vercel. Also configure a random `STUDIO_PASSWORD` of at least 24
characters and `APP_URL` as the canonical HTTPS Preview URL.

Configure provider credentials only in that Preview environment. The main account,
production databases, live credentials and existing production hosting are not
inspected or modified.

## 4. Register the Sandbox webhook after a Preview exists

Once `APP_URL` names the actual development Preview, run:

```bash
npm run integrations:check
npm run integrations:register-webhook
```

The registration helper checks the TEST key and Sandbox ID before creating an
endpoint at `/api/webhooks/recurrente`. It saves the returned signing secret to
ignored `.env.local` with mode 0600 without printing it. Add that same
`RECURRENTE_WEBHOOK_SECRET` to the Vercel **Preview** environment and redeploy the
Preview. The helper will not create another endpoint if a secret is already
configured. If endpoint creation times out, inspect the Sandbox dashboard before
retrying; the provider might already have created it.

The webhook must be reachable by Recurrente. If Vercel Deployment Protection
blocks it, configure the appropriate development webhook access before claiming
webhook delivery works. No protection settings are changed by this repository.

Webhook processing verifies the raw body with Svix, enforces a fresh timestamp,
rejects `live_mode=true` and the wrong `sandbox_id`, and uses a durable event inbox
for retries. See [Recurrente's webhook contract](https://docs.recurrente.com/guides-english/getting-started/webhooks).

## 5. Test the actual accounts

Use Recurrente's `4242 4242 4242 4242` success card and
`4000 0000 0000 0002` decline card, fictional buyer details and a future expiry.
Never enter a real card. Verify:

- The provider's sandbox checkout opens at the correct server-calculated price.
- Only one buyer can hold the original; no charge is inferred from redirects.
- Successful payment reaches the webhook and changes the original to sold.
- Declines do not mark it sold; expiry releases it only after provider confirmation.
- Replaying a webhook does not duplicate a fulfillment job or courier request.
- Test labels, pickup confirmation and tracking responses are returned by DHL.
- The studio and provider Sandbox show the same order and amount.

Current automated tests use injected provider transports, **not actual account
credentials**. Passing those tests does not establish provider account eligibility
or prove a live courier or bank payout works.

## Reconciliation and uncertain outcomes

`POST /api/studio/integrations/reconcile` is available to the signed-in studio.
`GET /api/cron/reconcile` requires `Authorization: Bearer <CRON_SECRET>` (at least
24 random characters). It processes a bounded batch of pending payments and
queued fulfillment jobs.

No scheduler is activated automatically. Vercel Cron runs against production,
so a development Preview needs a separate development scheduler or manual studio
reconciliation. Confirm access and scheduling before calling the service fully
automated. Signed webhooks and the buyer return page still verify payments.

Unknown checkout creation outcomes keep the original reserved and flag
`payment_setup_review`; never create a replacement checkout blindly. Courier
timeouts or errors become `review_required`, without automatic retries that could
duplicate shipments. A process interrupted after claiming a job may leave it
`creating`; inspect the test courier account before resetting it. A fulfillment
job cannot be created before a verified sandbox payment.

Refunds, disputes, real payouts, insurance purchases and real courier operations
are not implemented or executed in this sandbox scope.
