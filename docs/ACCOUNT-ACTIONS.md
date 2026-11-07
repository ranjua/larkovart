# Accounts needed to activate sales

Send account names/status only. Store API secrets directly in Vercel environment settings.

| Service | Owner action | What we automate afterward |
|---|---|---|
| PayPal | Create/confirm PayPal Business and developer sandbox app; confirm Guatemala withdrawal partner | Hosted approval, verified capture, inventory and shipping |
| Stripe | Confirm legitimate merchant account and registered supported country; create test keys | Hosted card checkout, signed events and fulfillment |
| NeoNet (formerly VisaNet) | Merchant affiliation; request NeoPay/NeoLink sandbox API docs and settlement terms | Build verified checkout after official contract is available |
| Forza | Request e-commerce sandbox CodApp, secret, merchant and pickup IDs | Guatemala rates, prepaid labels, pickup and tracking |
| Guatex | Request official API docs and test account | Implement against verified contract; currently disabled |
| DHL | MyDHL test username/password/account; approve GT pickup address | International rates, labels, customs paperwork and tracking |
| FedEx | Developer project with Rates, Ship, Pickup and Track access | International rate validation, labels, pickup and tracking |
| Facebook/Instagram | Page and professional Instagram under owner’s Meta Business Portfolio | Catalog sync and approved publishing workflow |
| WhatsApp | Business number/account, authorization and messaging templates | Opted-in order notifications and support |
| TikTok | Profile, developer app, Content Posting permission/approval | Approved content publishing workflow |

Courier request (copy to your representative):

> Hola. Estoy integrando una tienda de obras de arte originales con origen en zona 12, Ciudad de Guatemala. Necesito documentación y credenciales de pruebas para tarifas, guías, recolecciones y rastreo. Paquetes hasta 80 × 80 cm antes de embalaje; indicaré dimensiones y peso embalados por obra. Confirmen restricciones para arte original, seguro, destinos, aduanas y cómo consolidar varias guías en una recolección diaria.

NeoNet request:

> Necesito afiliación para cobrar obras de arte en mi tienda y liquidar a una cuenta bancaria de Guatemala. Solicito documentación y acceso sandbox de NeoPay/NeoLink, creación de cobros por pedido, notificaciones firmadas, consulta de estado, reembolsos y monedas/comisiones de liquidación.

No requests have been sent. No API credentials, social accounts, live payment methods or courier contracts are connected yet. Do not enable live checkout until account tests pass.
