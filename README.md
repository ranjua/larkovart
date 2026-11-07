# Larkova Art — new development storefront

A **fresh Next.js / TypeScript implementation** for Yulia Larkova's original art,
designed for Vercel. The previous site is preserved byte-for-byte under `_old/`.
No old HTML, JavaScript or CSS is imported. Only artwork photographs and artist
information were carried forward.

For the short account setup checklist, see [QUICK-SETUP.md](docs/QUICK-SETUP.md).

## Start locally

Use Node.js 24:

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Open `http://127.0.0.1:3000`. Spanish is the default; the language selector remembers
your choice. Routes also support `/en`, `/ru`, `/zh`, `/ja`, and `/pt`.
Chinese uses Simplified Chinese; Portuguese copy uses Brazilian Portuguese.

To enable `/studio`, set `STUDIO_PASSWORD` to a random password of at least 24
characters in `.env.local`. Do not commit it. The workspace uses signed,
HTTP-only, eight-hour sessions. The current development workspace already has an
ignored `.env.local` containing a generated password.

## Working in this development version

- Responsive storefront, artwork details, category filters and sold states.
- Actual existing artwork photos, with uncropped detail images.
- A **CSS room visualization**, clearly labeled approximate and illustrative. It
  is not an AI-generated photo, an exact scale reference, or a promised frame.
- Six-language storefront, descriptions, delivery information and test checkout.
- Persistent local SQLite/libSQL catalog and orders in ignored `.data/`.
- Transactional one-of-a-kind purchasing with contention retries; one successful
  test purchase makes the original unavailable to all other buyers.
- In default demo mode, Guatemala orders simulate payment. Other destinations save quote requests,
  without consuming inventory or collecting payment. Guatemala delivery is a
  demonstration rule, not a verified carrier quote.
- Private studio for photo uploads, six-language descriptions, unpublished
  drafts, catalog visibility, sample prices, and test orders.
- Optional AI listing descriptions using the OpenAI Responses API. Configure
  `OPENAI_API_KEY` and `OPENAI_TEXT_MODEL` explicitly to enable it. Generated text
  is returned for review and never automatically published. No external AI calls
  were made during development. See [official structured-output documentation](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses).

All prices are **sample development prices** ($75–$1,000), not artist-approved
offers. Existing sold states are retained. Dates, dimensions, media and biography
were carried over from the earlier catalog and should be confirmed by the artist.
Original artwork titles are retained in every language.

Uploaded draft photographs are stored as data URLs in the development database
(4 MB maximum). This keeps development self-contained. Move uploads to private
object storage, with published derivatives, before a real store launch.

## Payment and courier integration status

Recurrente Sandbox checkout and Forza, DHL Express and FedEx test connectors
for ratings, labels, pickup and tracking are implemented. Guatex awaits verified
API documentation and access. The order flow includes checkout inventory holds,
server-side amount verification, signed webhooks, durable replay protection,
expiry reconciliation and idempotent fulfillment jobs. The studio supports
packing data and test label downloads. A 249-country selector is checked against
actual courier availability and an artist-configured shipping allowance.

**The provider accounts and Vercel are not connected yet.** No provider credentials
were available during implementation. Integration tests use injected transports,
not real provider accounts. No real payment, bank payout, courier collection,
customer email, image enhancement or domain change has occurred.

Follow [the integration setup guide](docs/INTEGRATIONS.md) to configure isolated
Sandbox/test accounts, a development cloud database and a Vercel Preview. Run
`npm run integrations:check` to see missing configuration names without exposing
secrets. AI image editing, refund/dispute handling, real payouts and live courier
operations remain outside this development version.

## Vercel development preview

Do not deploy production from this development task. The Next.js project can be
imported into Vercel for an isolated **Preview** environment after access is
configured. Supply a separate development libSQL database and set:

```text
DATABASE_URL=libsql://YOUR-DEVELOPMENT-DATABASE
DATABASE_AUTH_TOKEN=YOUR-DEVELOPMENT-TOKEN
DATABASE_ENVIRONMENT=development
STUDIO_PASSWORD=YOUR-RANDOM-DEVELOPMENT-PASSWORD
```

Without a database URL on Vercel, the application deliberately fails instead of
pretending local filesystem storage is durable. It refuses a configured database
unless `DATABASE_ENVIRONMENT=development`. All pages are marked `noindex`.
Do not enable production payment credentials or attach `larkovart.com` yet.
No domain lookup, renewal, DNS change, or hosting deployment was performed.

## Validation

```bash
npm test
npm run typecheck
npm run build
```

Store tests create and remove a dedicated temporary development database. They
cover concurrent buyers, international quotes, sold inventory, draft visibility,
and server-controlled pricing.

Integration tests also cover sandbox-only credentials, checkout holds, signed
webhooks and replay handling, verified amounts, expiry, and duplicate-shipment
prevention. Provider transports are fixtures; actual account verification remains
pending sandbox credentials.

Browser tests are in `tests/browser.py`; they start an isolated local Next.js
server and use only temporary test data:

```bash
python3 -m venv .venv
.venv/bin/pip install -r tests/requirements.txt
.venv/bin/python -m playwright install chromium
npm run build
.venv/bin/python tests/browser.py
.venv/bin/python tests/sandbox_browser.py
```

## Repository layout

```text
_old/             Unmodified original site and its original tests
public/           Existing artist and artwork photos
src/app/          Next.js routes and development API endpoints
src/components/   New gallery, checkout and studio interfaces
src/lib/          Six-language copy, catalog, auth and transactional store
tests/            Isolated store and browser checks
```
