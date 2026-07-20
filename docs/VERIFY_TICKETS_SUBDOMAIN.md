# Verify Tickets Subdomain

EventSlot now has a standalone verifier surface at `/verify-tickets`.
The intended production URL is `https://verify.eventsslot.com`.
The temporary/alternate host requested for Cloudflare is
`https://verify.www.eventsslot.com`.

## Current Route Mapping

- `https://www.eventsslot.com/verify-tickets` opens the verifier landing page.
- `https://www.eventsslot.com/verify-tickets/<event-slug>` opens the verifier workspace for one event.
- `https://verify.eventsslot.com/` rewrites to `/verify-tickets`.
- `https://verify.eventsslot.com/<event-slug>` rewrites to `/verify-tickets/<event-slug>`.
- `https://verify.www.eventsslot.com/` rewrites to `/verify-tickets`.
- `https://verify.www.eventsslot.com/<event-slug>` rewrites to `/verify-tickets/<event-slug>`.

## DNS And Hosting Setup

1. Add `verify.eventsslot.com` and/or `verify.www.eventsslot.com` as custom domains for the existing EventSlot Cloud Run service or the fronting load balancer.
2. Add the DNS records required by Google Cloud for those custom domains. In Cloudflare this is normally a `CNAME` for `verify` or `verify.www` pointing to the Google-provided target, with proxying disabled until Google-managed SSL is active.
3. Wait for Google-managed SSL to become active.
4. Test `https://verify.eventsslot.com` and `https://verify.eventsslot.com/<event-slug>`.

## Access Model

Each event now has a separate `verifierCode`. Organisers can share this code
with as many temporary gate workers as needed. The public verifier landing page
accepts the code and opens only the focused ticket-verification workspace.

The verifier code is not the organiser dashboard token. It is accepted only by
ticket-verification APIs and should not grant billing, settings, team,
analytics, or unrelated-event access.

Human verification is enforced through the backend when either
`RECAPTCHA_SECRET_KEY` or `TURNSTILE_SECRET_KEY` is configured. Until a provider
secret is configured, the UI shows a human-confirmation checkbox and the backend
marks provider verification as skipped.

Future hardening should add dedicated verifier invites with:

- Event-scoped access only.
- Expiring invite links.
- Roles such as scanner-only, scanner plus search, scanner plus walk-in, and lead verifier.
- Audit logs for every scan, search, approve, decline, reverse, and walk-in action.
- No access to billing, reports, settings, team management, or unrelated events.

## Verifier Actions

The verifier workspace supports the existing scanner modes:

- Scan QR code.
- Upload a ticket softcopy.
- Search or enter details manually.

The verifier result should show attendee name, ticket code, event, tier when available, admissions used, and whether the ticket is valid, already used, waitlisted, or missing.
