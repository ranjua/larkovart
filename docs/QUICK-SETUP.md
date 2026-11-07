# One-time setup

1. Enable the **Vercel connection** in ChatGPT. Use a development preview, not production.
2. Request **test API access** from [Forza](https://www.forzadelivery.com/gt/), [DHL](https://developer.dhl.com/api-reference/dhl-express-mydhl-api), and [FedEx](https://developer.fedex.com/). For FedEx enable Rates, Ship, Pickup and Track.
3. Ask [Guatex](https://guatex.com/contacto/) for **API documentation and test access**. Their integration stays disabled until verified.
4. Create a [Recurrente](https://docs.recurrente.com/) sandbox. Save test credentials privately in the preview’s environment settings; never paste secrets into chat.

Copy the courier request from `/studio`. Account registration and courier approval require you; the code, configuration checks and fulfillment flow are prepared here. Vercel preview also needs an isolated development libSQL database and a webhook URL (technical details in [INTEGRATIONS.md](INTEGRATIONS.md)).

## What runs automatically

Checkout compares available test rates within each artwork’s shipping budget. Forza handles Guatemala; DHL and FedEx handle supported international routes. Verified test payment queues a label and pickup request; tracking uses the selected courier. A failed rate provider does not block the others. No carrier switch happens after a shipment write starts.

Forza prices in GTQ need `TEST_GTQ_PER_USD` for synthetic development conversion. This is not a live exchange rate. Missing conversion excludes those rates rather than treating quetzales as dollars.

## Still requires account testing

No payment, courier account or Vercel preview is connected yet. These are implemented sandbox connectors, not verified live services. Guatex requires its technical contract before implementation.

Forza restricts pickup requests to one per day per pickup point. Multiple orders can require a consolidated/regular pickup arrangement with the courier. The current connector requests one pickup per shipment: additional pickup requests may need review. A saved label is retained if pickup fails; the system never recreates it automatically. Durable daily pickup batching and an always-on scheduled worker are still needed before unattended multi-order operation.

The current workspace permits development data only. Live sales and production deployment require a separate authorized production setup.

## API references

- [Forza e-commerce API v2.2](https://documenter.getpostman.com/view/38701531/2sAYdeMrmk)
- [DHL Express API](https://developer.dhl.com/api-reference/dhl-express-mydhl-api)
- [FedEx Guatemala API integration](https://www.fedex.com/es-gt/shipping-tools/direct-integrations/api.html)
- [FedEx rates](https://developer.fedex.com/api/en-us/catalog/rate/v1/docs.html), [shipping](https://developer.fedex.com/api/en-us/catalog/ship/v1/docs.html), [pickup](https://developer.fedex.com/api/en-us/catalog/pickup/v1/docs.html)
