# Gmail customer email

Sender: `Larkova Art <larkova.art@gmail.com>` via Gmail SMTPS (TLS, port 465).
No purchased domain or Gmail API/OAuth client is required for this route.
Cloud CLI sign-in does not authorize Gmail sending.

## Owner steps

1. Sign in as `larkova.art@gmail.com` and enable [2-Step Verification](https://myaccount.google.com/signinoptions/two-step-verification).
2. Create an [app password](https://myaccount.google.com/apppasswords) named `Larkova website`.
3. Save it as `GMAIL_APP_PASSWORD` in [Vercel project environment settings](https://vercel.com/juarerandy-7417/larkovart-dev/settings/environment-variables), for Preview and Development. Use a Secret for hosted Preview. Never paste it into chat or use the normal Google password.
4. Redeploy the development branch Preview. In Studio, open **Customer emails** and select **Send test to my Gmail**. Check the inbox; SMTP acceptance is not proof of delivery.

Assistant config: `CUSTOMER_EMAIL_PROVIDER=gmail` is set for branch `dev/nextjs-art-store` Preview. Local development needs the same provider setting in an ignored environment file. A correctly formed app password activates existing email/password registration, verification, password recovery and optional email OTP; Google login remains separate. Studio administrator OTP continues through Resend, preserving working admin access.

The daily customer mail request cap is 200 per rolling application window, stored in the existing email-limit table and shared across instances. Individual address and account request throttles also apply. Gmail's actual limits include normal mailbox use and can block sending sooner. No automatic provider fallback/retry follows an uncertain SMTP result. This task does not add order-confirmation workflows or marketing email.

Status: code tests pass; real Gmail authentication/delivery is pending the owner credential and hosted verification. No customer messages have been sent during automated tests.

If App Passwords is unavailable, do not weaken Google security: use a separate Gmail OAuth integration instead. Changing the Google account password can revoke app passwords. The integration sanitizes mail errors and never logs credentials or codes.

References:
- https://support.google.com/accounts/answer/185833
- https://support.google.com/mail/answer/22839
- https://nodemailer.com/guides/using-gmail
