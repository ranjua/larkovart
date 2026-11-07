# Admin email login

`/studio` accepts only a one-time code sent to **larkova.art@gmail.com**.
Passwords and old password sessions are no longer accepted. The recipient cannot
be changed by submitting an email address to the login endpoint.

## One-time setup

1. Create a free Resend account using **larkova.art@gmail.com** at https://resend.com/signup.
2. Create an API key and save `RESEND_API_KEY` in Vercel → larkovart-dev →
   Settings → Environment Variables. Use Sensitive for Preview/Production and
   encrypted for Development. Do not paste the key into chat.
3. Redeploy. Visit `/studio`, press **Send sign-in code**, and enter the emailed code.

The default sender is `Larkova Art <onboarding@resend.dev>`. Resend permits this
sender only to the email associated with the Resend account; that is why the
account email must match. It is a testing sender, not a branded production mail
domain. When the art domain is restored, verify it in Resend and configure
`STUDIO_EMAIL_FROM` with that domain for the permanent sender. No paid plan is
required by the implementation.

## Authentication behavior

- Cryptographically random six-digit code; expires after 10 minutes; five attempts.
- Browser-bound challenge in an HttpOnly, Secure-on-hosted-environments,
  SameSite=Strict cookie. The code alone does not authorize another browser.
- One-time consumption is an atomic database write, including concurrent requests.
- Codes stored as HMAC digests bound to a random challenge, host and environment;
  no plaintext code in the application database, responses or logs.
- Mail bodies necessarily contain the code at the email provider. Do not share it.
- Shared database limits: one send per 60 seconds, six/hour, twenty/day, plus
  request/verification IP limits. Limits persist across server instances.
- Sessions use random 256-bit bearer tokens; only digests stored in the database.
  Sessions expire after eight hours and are checked server-side for the exact host
  and environment. Logout revokes the database record.
- There is no password fallback or production email bypass. Missing/failed mail
  configuration cannot create a session. The old STUDIO_PASSWORD environment
  variable may remain configured but is ignored by authentication.

Local browser tests inject a fake email transport using a test-only Node preload
and isolated database. The application never imports that preload. These tests
prove the flow, not external email deliverability.

Sources:
- https://resend.com/docs/api-reference/emails/send-email
- https://resend.com/docs/knowledge-base/403-error-resend-dev-domain
- https://resend.com/pricing
