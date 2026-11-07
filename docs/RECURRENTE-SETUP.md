# Recurrente activation

Delivery configuration remains paused. Do not enable courier booking for payment tests.

## Owner setup — required once

1. Sign in/create Yulia Larkova's account at https://app.recurrente.com using larkova.art@gmail.com. If offered, choose “Solo quiero integrar la API” for testing before live activation.
2. Configuración → Llaves API → Abrir Sandbox. Create/select “Larkova Art”, then create a TEST key.
3. In Vercel larkovart-dev → Environment Variables → Preview, save `RECURRENTE_SECRET_KEY` (sk_test_...) and `RECURRENTE_SANDBOX_ID` (sbx_...). If the Sandbox ID is not shown in the dashboard, the agent can retrieve it from the authenticated `/test` response after the key is saved. Never send secrets through chat.

Authentication is checked during hosted builds. PayPal stays selected until Recurrente is verified. A Sandbox cannot settle to a bank or move real money.

## Implemented

- Sandbox hosted card checkout with server-owned amount/reference and inventory hold.
- Signed Svix webhook parsing, environment checks, durable message deduplication, provider-side payment verification and inventory reconciliation.
- Sandbox refund client verifies original checkout reference, USD amount, paid state and canonical payment intent before sending a full refund with a stable idempotency key. Refund status can be retrieved.
- Authenticated studio-only USD 1 test checkout/verify/refund flow, with durable atomic creation/refund claims. It does not reserve originals, create fulfillment jobs, or book delivery. Ambiguous writes stay in review and are not retried blindly.
- Hosted credential validation; no keys are printed.

## Pending account verification and launch work

- No Recurrente key, Sandbox ID or webhook secret was present at the start of this task; no external Recurrente transaction has been completed.
- After keys exist: verify hosted authentication, complete approved and declined sandbox card tests, verify refund and pending/ambiguous outcomes.
- Register a public, stable webhook endpoint; Vercel preview authentication must not block Recurrente's requests. Keep unrelated preview pages protected. Save the returned Svix signing secret privately as `RECURRENTE_WEBHOOK_SECRET`; verify an actual delivered signed event. Existing webhook registration script targets a public preview URL and must be adapted to a confirmed reachable endpoint before use.
- The studio probe is verified by explicit server reads. It does not yet reconcile its own state automatically from incoming webhooks; store order webhooks use the normal durable handler.
- Production credentials, merchant verification, receiving USD/GTQ, Guatemala bank payout setup/fees, real-money refunds and production launch remain pending. These require the owner's legitimate merchant account and bank information. Do not call the integration live-ready before those checks pass.

Official references:
- https://docs.recurrente.com/guides-english/getting-started/first-test-payment
- https://docs.recurrente.com/guides-english/guides/sandboxes-and-test-clocks
- https://docs.recurrente.com/guides-english/getting-started/webhooks
- https://docs.recurrente.com/referencia-api/api-reference/refunds/create-refund
