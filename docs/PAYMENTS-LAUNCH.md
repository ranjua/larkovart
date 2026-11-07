# Payment activation — owner steps

1. Tell us which accounts you have: Recurrente, PayPal Business, Stripe (registered country), NeoNet merchant account. Never send passwords or secrets in chat.
2. Save provider test credentials in Vercel Preview environment settings. Choose `PAYMENT_PROVIDER=recurrente`, `stripe` or `paypal`; keep `PAYMENT_ENVIRONMENT=sandbox`.
3. We complete a test purchase, duplicate notification, cancellation, refund/reconciliation check and courier booking before live activation.

## Available code

- Recurrente: sandbox checkout, signed webhooks, server verification and inventory protection.
- Stripe: sandbox hosted Checkout, stable idempotency keys, server amount/reference verification, signed webhook endpoint `/api/webhooks/stripe`. Keys: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.
- PayPal: fixed sandbox Orders API, approval link and server capture with stable retry key; verifies order reference/amount before capture and completed capture after. Keys: `PAYPAL_SANDBOX_CLIENT_ID`, `PAYPAL_SANDBOX_SECRET`. Browser verification and reconciliation supported; dedicated PayPal webhooks and refund management remain pending.
- Each order retains its payment provider so changing store configuration cannot reconcile old orders against the wrong provider. Credentials are not connected and no live charge has been made.

## Guatemala decision

Stripe's country list does not include Guatemala. A Stripe live merchant account needs a legitimate eligible business setup in a supported jurisdiction. Do not invent an address or assume a Guatemala bank can receive Stripe payouts.

PayPal Guatemala says receiving funds requires association with a licensed local partner. Confirm receiving, withdrawal partner, conversion costs and account eligibility with PayPal before promising payouts.

VisaNet Guatemala is now NeoNet. NeoLink provides payment links; NeoPay/Cybersource serve e-commerce. Request merchant affiliation, sandbox documentation, signed notifications, refunds, settlement currency/bank and shipment/reference metadata. A generic reusable payment link cannot safely reserve or sell a unique artwork automatically. Never mark an order paid from a return URL or payment screenshot.

Keep cards on hosted provider pages. Never collect card numbers in this app. Full live functionality still needs merchant approval, real shipping/customs prices, refunds, legal policies and production account testing; demo checkout is not a live sale.

## Official sources

- https://stripe.com/global
- https://docs.stripe.com/api/checkout/sessions/create
- https://developer.paypal.com/api/orders/v2
- https://www.paypal.com/gt/cshelp/article/¿cómo-hago-para-retirar-dinero-y-transferirlo-a-mi-cuenta-bancaria-help394
- https://www.visanet.com.gt/
