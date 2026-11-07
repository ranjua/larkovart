# Envia setup

Owner reports registration completed. Owner saved ENVIA_SANDBOX_TOKEN in Vercel Preview. Hosted verification is performed during deployment.

1. Open Envia's test environment from its official “Ambiente de pruebas” help page.
2. In the test account, open Desarrolladores → Acceso de API → Agregar.
3. Save that test token as `ENVIA_SANDBOX_TOKEN` in Vercel project `larkovart-dev`, Preview environment only. Do not paste tokens into chat.

Use only the sandbox Shipping API `https://api-test.envia.com/` and Queries API `https://queries.test.envia.com/` for initial verification. Production and test tokens are separate. An account registration is not proof of API authentication or artwork/pickup eligibility.

Guatemala's advertised carrier catalog includes ForzaDelivery, Swift Box, TELOMANDO, Cargo Expreso and international DHL Express. Availability for the specific sender address, artwork and service must be verified through the account.

Sandbox connector implemented for rates, label PDFs, pickup requests and tracking. Requires one complete saved Guatemala sender address (or ENVIA_TEST_ORIGIN_ID to disambiguate), valid destination state codes, confirmed parcel data and a shipping allowance. Planning estimates remain separate from confirmed parcels. Currency conversion is never invented. Authentication and address readiness must be checked in hosted build logs. No Envia orders, paid labels or pickup requests have been created.

Official references:
- https://help.envia.com/token-api
- https://docs.envia.com/docs/getting-started
- https://envia.com/es-GT/paqueterias
