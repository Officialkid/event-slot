# EventSlot SMTP Setup

EventSlot already supports SMTP through `lib/email.ts`. Use these steps when moving production email away from Resend.

## 1. Choose An SMTP Sender

Use a real mail provider that supports authenticated SMTP, for example Google Workspace SMTP relay, Zoho Mail, Mailgun SMTP, Amazon SES SMTP, Postmark SMTP, or another domain-authenticated provider.

Required values:

- `SMTP_HOST`: provider SMTP host, for example `smtp.zoho.com`.
- `SMTP_PORT`: usually `587` for STARTTLS or `465` for implicit TLS.
- `SMTP_SECURE`: `true` only for port `465`; otherwise use `false`.
- `SMTP_USER`: SMTP username.
- `SMTP_PASSWORD`: SMTP password or app password.
- `SMTP_FROM`: verified sender, for example `EventSlot <hello@eventsslot.com>`.
- `EMAIL_PROVIDER`: set to `smtp`.

## 2. Verify The Domain

Before using `hello@eventsslot.com`, configure the provider's DNS records:

- SPF record.
- DKIM record.
- DMARC record.
- Any provider-specific verification CNAME/TXT records.

Do not use a sender address until the provider marks the domain as verified.

## 3. Local Test

Add the values to `.env.local`:

```env
EMAIL_PROVIDER=smtp
SMTP_HOST=your.smtp.host
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-user
SMTP_PASSWORD=your-smtp-password
SMTP_FROM=EventSlot <hello@eventsslot.com>
```

Then open the admin health page and confirm the email provider reports SMTP as reachable.

## 4. Production Secrets

Create Google Secret Manager entries:

```powershell
gcloud secrets create SMTP_HOST --data-file=-
gcloud secrets create SMTP_PORT --data-file=-
gcloud secrets create SMTP_SECURE --data-file=-
gcloud secrets create SMTP_USER --data-file=-
gcloud secrets create SMTP_PASSWORD --data-file=-
gcloud secrets create SMTP_FROM --data-file=-
```

For existing secrets, use:

```powershell
gcloud secrets versions add SMTP_HOST --data-file=-
```

Repeat for each value.

## 5. Cloud Run Deployment

After the secrets exist, update `cloudbuild.yaml` to set:

```text
EMAIL_PROVIDER=smtp
```

And add these secret mappings:

```text
SMTP_HOST=SMTP_HOST:latest
SMTP_PORT=SMTP_PORT:latest
SMTP_SECURE=SMTP_SECURE:latest
SMTP_USER=SMTP_USER:latest
SMTP_PASSWORD=SMTP_PASSWORD:latest
SMTP_FROM=SMTP_FROM:latest
```

Do not add those mappings before the secrets exist, because Cloud Run deployment will fail if a referenced secret is missing.

## 6. Features That Depend On SMTP

- OTP and authentication emails.
- Team invite emails.
- Event attendee campaign emails.
- Waitlist promotion emails.
- Admin broadcast emails.
- Registration response copy emails.

After deployment, test one email from each flow before announcing that production email is fully ready.
