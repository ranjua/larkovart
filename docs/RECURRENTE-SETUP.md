# Recurrente integration — verified sandbox status

## Connected

- Yulia's Sandbox TEST key is protected in Vercel Preview. The Sandbox ID was retrieved from authenticated `/api/test` and saved automatically.
- Recurrente is the selected Preview payment provider. PayPal credentials are retained. Live processing is disabled by code and environment settings.
- Sandbox webhook endpoint registered automatically, confirmed enabled, and its URL verified against the intended destination. The preview stays protected; a private Vercel automation token allows the callback to reach the handler. That token is never placed in public/client code or documentation.
- The Svix signing secret is encrypted with AES-256-GCM in the development database. Registration is durably claimed and will not create duplicate endpoints after an ambiguous outcome.
- Raw-body signature verification, exact Sandbox ID checks and explicit live-event rejection are enforced. `live_mode` is optional when the native serializer omits it, but any explicit live flag is rejected. Accepted message IDs are persisted and deduplicated.

## External tests completed — no real money

Executed through the hosted Recurrente checkout, not only mocked transports:

| Test | Observed result |
|---|---|
| USD 1 checkout, documented success card | Provider paid state verified server-side |
| Documented decline card | Provider displayed simulated decline; checkout stayed unpaid |
| Full USD 1 refund | Provider returned succeeded; subsequent GET confirmed it |
| Natural payment webhook | Signed `intent.succeeded` received and recorded |
| Natural decline webhook | Signed `intent.failed` received and recorded |
| Natural refund webhook | Signed `refund.create` received and recorded |
| Connectivity fixtures | Two signed `intent.pending` messages accepted; no payment graph created |
| Unsigned request | Callback returned HTTP 400 |

The private studio includes a test checkout/verify/refund panel. It creates separate durable test records, not store orders. It never reserves originals, changes inventory or creates fulfillment jobs. Atitlan, Gato and Mar2 remained available after testing. No real card, money, bank payout, label or collection was used.

## Automated checks

30 tests pass, including environment rejection, amounts/references, refund idempotency, signature freshness, Sandbox isolation, encrypted secret integrity and duplicate fulfillment protection. Type checking, build and studio browser checks pass. Deployed Preview is READY.

## Live activation remains pending

- Owner completes Recurrente merchant verification and bank payout setup in Recurrente; confirm receiving/settlement currencies, fees and payout eligibility.
- Live keys, a separate live webhook secret and live-mode payment/refund handling must be implemented/configured and validated before accepting real sales. Current factory deliberately accepts Sandbox only.
- Store checkout still requires eligible shipping and confirmed parcel data. Delivery configuration remains paused at the owner's request; automatic shipping test booking is disabled. The independent payment test does not bypass those safeguards for actual originals.
- This is not a live sales launch and is not proof of real bank settlement or 3DS behavior.

## Maintenance

- Recurrente API-key rotation requires re-encrypting the stored webhook secret with the new key or securely restoring it from Recurrente's webhook dashboard. Never blindly create another endpoint to recover from uncertainty.
- A changed callback URL or Vercel automation token requires an intentional endpoint update. The setup script detects mismatches and stops instead of duplicating registrations.
- Keep sandbox IDs, webhook records and test payment receipts for audit. Do not turn connectivity fixtures into claims of completed payments; actual payment/refund states were separately verified above.

Official references:
- https://docs.recurrente.com/guides-english/getting-started/first-test-payment
- https://docs.recurrente.com/guides-english/getting-started/webhooks
- https://docs.recurrente.com/referencia-api/api-reference/refunds/create-refund
