# Larkova Art — new development storefront

A **fresh Next.js / TypeScript implementation** for Yulia Larkova's original art,
designed for Vercel. The previous site is preserved byte-for-byte under `_old/`.
No old HTML, JavaScript or CSS is imported. Only artwork photographs and artist
information were carried forward.

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
- Guatemala test orders simulate payment. Other destinations save quote requests,
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

## Not connected yet

This is a reviewable development foundation, **not a live automated business**.
No real payments, bank transfers, PayPal payouts, cryptocurrency transfers,
shipping labels, courier bookings, customer emails, or domain changes occur.

Before accepting real orders:

1. Confirm artwork prices, packed dimensions, weights, depth for sculptures,
   materials, availability and original photographs. Obtain accurate images; AI
   must not change the physical artwork being represented.
2. Verify a Guatemala-compatible payment provider. Recurrente is the first
   candidate, pending account eligibility, international card acceptance, artwork
   sale limits and bank payout verification. Implement and verify its isolated
   sandbox checkout and signed webhooks before adding live execution. Demo
   payment success must never be reused as proof of a real payment.
3. Confirm collection service from Zona 12, Guatemala City, carrier API access,
   packaging rules, damage coverage, destination restrictions and real rates.
   Agree where shipping fits inside the $75–$1,000 sale price. Do not promise
   worldwide shipping at a fixed included price.
4. Implement payment reservations and expiration, idempotent verified payment
   events, refunds, courier jobs and retries, notifications, and order tracking.
   Connect email and add alerts for failed or exceptional orders.
5. Add an image editing provider and a review step for cleaned product photos and
   labeled generated room scenes. The current room view does not use image AI.
6. Confirm store policies, invoicing, customs handling, and buyer-facing contact
   information. Add a mature authentication/rate-limiting setup before public use.

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

Browser tests are in `tests/browser.py`; they start an isolated local Next.js
server and use only temporary test data:

```bash
python3 -m venv .venv
.venv/bin/pip install -r tests/requirements.txt
.venv/bin/python -m playwright install chromium
npm run build
.venv/bin/python tests/browser.py
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
