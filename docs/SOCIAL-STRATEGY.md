# Social commerce launch

Goal: every channel sends collectors to one artwork page and one inventory system. Originals have inventory 1; sold or reserved art must never be advertised as available. Payment confirmation, not a social message or screenshot, sells the original.

## Stage 1 — store and account setup

- Owner supplies Facebook Page, Instagram professional account, TikTok profile and WhatsApp Business number; no passwords in chat.
- Use one Meta Business Portfolio to own the Page, Instagram account and WhatsApp Business account. Owner completes business verification and approves requested permissions.
- Publish a stable HTTPS storefront domain with real contact, shipping, returns and privacy information. Existing preview authentication prevents external catalog crawlers from reaching the store; keep previews protected and enable feeds on the public store only.
- Confirm merchant settlement to Guatemala before live checkout. Do not spend on advertising until payment, refunds, label creation and pickup are account-tested.

## Stage 2 — organic conversion

- Facebook/Instagram: ingest `/api/catalog/meta` into Commerce Manager after APP_URL is the public store origin. Validate catalog diagnostics, item policy and country eligibility. Feed exports only published art and marks reserved/sold pieces out of stock. Country support may limit Shops; website product links work independently of Shops approval.
- WhatsApp: connect Business profile to Instagram. Add owner-approved click-to-chat links with artwork URL. Cloud API order updates require authorized account access and approved templates where applicable; store customer opt-in. Do not send unsolicited campaigns.
- TikTok: use profile/product-page links first. Content Posting API requires an approved app, creator authorization and appropriate scopes. Audit and visibility restrictions apply; do not assume fully unattended public posting is permitted.

## Stage 3 — measured automation

- Prepare three weekly content themes: process/painting, finished artwork in context, and artist/story. Derive sizes, prices and availability from the store.
- Generate Spanish and English drafts first, then translate to Russian, Simplified Chinese, Japanese and Portuguese when audiences justify it.
- Use authentic photographs; AI may improve lighting/background presentation but must not change the artwork or invent its physical details. Label room mockups clearly.
- Queue owner-approved posts with durable IDs and platform status reconciliation. Never blindly retry an ambiguous publish request. Store OAuth tokens privately and track expiry/revocation.
- Add consent-controlled analytics and UTM tags (`utm_source`, `utm_medium`, `utm_campaign`, artwork ID). Start with weekly views → artwork views → checkout starts → verified purchases → delivered orders.
- Paid promotion needs explicit budget approval. Begin with organic results; do not buy ads automatically.

## Current implementation

Catalog feed route implemented; requires canonical APP_URL. No social account is connected and no posts, messages or ads have been sent. OAuth onboarding, publishing workers, messaging templates and conversion APIs remain to be implemented after account selection/access is confirmed.

## Official references

- https://developers.facebook.com/docs/instagram-platform/content-publishing/
- https://developers.facebook.com/docs/whatsapp/cloud-api/get-started
- https://faq.whatsapp.com/647574060315065
- https://developers.tiktok.com/docs/en/content-posting-api-get-started
- https://developers.tiktok.com/docs/en/tiktok-api-scopes
