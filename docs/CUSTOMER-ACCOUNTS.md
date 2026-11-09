# Customer accounts and collections

Customer accounts are separate from the fixed-email Studio administrator OTP.
Google OAuth and verified email/password are supported; passwords require 12–128
characters. Password accounts can enable an extra email code at every login in
Account → Account security. Codes expire in five minutes. No passwordless email
login or remember-device bypass is exposed. Password recovery requires an email
code and revokes existing sessions. Google-only accounts authenticate with Google.
Existing password accounts must sign in before explicitly connecting Google.

Favorites and carts work for guests using artwork IDs in local browser storage.
Verified sign-in merges guest items with the account; account collections sync
across devices. Each original has quantity one. Saved items do not reserve stock.
Only published works can be added, and only available originals enter the cart.
A cart can hold multiple works, but each original uses the existing separate
checkout and destination confirmation. A combined multi-artwork payment is not
implemented. Current price and availability are checked again by checkout.

## Current Preview connection status

Google client credentials are configured in Preview. Deployment
`dpl_Df8rhEdBesrYJZF51rh8BvRpRwq3` is READY on functional commit `f07efb7`.
A protected browser check confirmed Google is enabled, the sign-in endpoint
returns HTTP 200, the callback matches the canonical branch origin, state/PKCE
are present, and Google displays its sign-in prompt without a configuration
error. No Google password or consent was submitted and no customer account was
created. The owner must complete the first Google login to verify the return
and customer session. Email/password and customer OTP remain disabled pending
`CUSTOMER_EMAIL_FROM` on a verified Resend domain.

## Setup reference — email sender remains pending

1. **Email:** in Resend, verify a sending domain you control. Set Vercel Preview
   `CUSTOMER_EMAIL_FROM` to a sender on that domain. The existing server-side
   `RESEND_API_KEY` is reused. Resend's onboarding sender cannot serve arbitrary
   customers. Do not copy credentials into chat or source files.
2. **Google:** create a Google Cloud OAuth **Web application**. Add the account
   origin below as an authorized JavaScript origin and its exact callback URI as
   an authorized redirect. Set Vercel Preview `CUSTOMER_GOOGLE_CLIENT_ID` and
   `CUSTOMER_GOOGLE_CLIENT_SECRET`. While the consent app is in testing, add your
   tester emails; complete Google's publication requirements before public use.
3. Redeploy Preview; test real signup/verification/recovery and Google consent with
   your own account before public launch. No real customer email or Google consent
   has been exercised by the development fixtures.

Account origin:
`https://larkovart-dev-git-dev-nextjs-art-store-juarerandy-7417.vercel.app`

Google callback:
`https://larkovart-dev-git-dev-nextjs-art-store-juarerandy-7417.vercel.app/api/auth/callback/google`

A dedicated customer secret and canonical origin have been provisioned only for
this branch's Preview. Unconfigured methods are visibly unavailable. Preview
protection remains enabled; Google callback tests must use a browser authorized
for that Preview. Before launch, use the confirmed public domain consistently for
origin/callbacks, separate production customer storage and secret, a verified
sender, and a deliberate release. Production has not been promoted.

## Storage and security

Better Auth provides password hashing, verified email, Google state/PKCE,
revocable HttpOnly SameSite cookies, hashed short-lived OTPs, and persistent
rate limits. Customer sessions are distinct from Studio sessions. Public JSON
strips bearer/provider secrets; provider tokens are encrypted at rest.
Customer APIs derive the user ID from the session, validate same-origin writes,
limit collection sizes, and read live published catalog data. OAuth automatic
same-email linking is disabled. Account data is not added to marketing lists.

Customer schema creation is additive and restricted to `customer_*` tables.
Preview may use the existing guarded development database; production requires
explicit `CUSTOMER_DATABASE_URL`, token and matching database environment. The
commerce database guard is unchanged. Existing orders and inventory are never
migrated into auth or altered by saved collections. Back up customer data with
its database; do not treat a Vercel filesystem as persistent storage.

## Authentic photo sets and policies

Studio → Collection → artwork → **Artwork photo set** accepts up to six extra
real detail/back/edge/signature views. Select the view, arrange and save. The
primary original remains first and room previews use that original. Signed
Cloudinary receipts are verified before accepting new hosted photos. Revision
checks prevent one tab overwriting another photo edit; metadata edits preserve
photo changes. Removing a photo detaches it without deleting the stored source.
No invented signature, back, detail, or altered artwork is generated.

`/{locale}/policies` explains originals, destination-dependent shipping/customs,
damage evidence, returns/cancellations and account privacy in all six languages.
The interim return wording requires specific written terms before real payment;
no fixed return window has been authorized. Mandatory consumer rights remain.
Delivery configuration stays paused and existing payment modes are unchanged.
