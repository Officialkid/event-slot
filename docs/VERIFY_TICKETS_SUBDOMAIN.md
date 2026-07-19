# Verify Tickets Subdomain

EventSlot now has a standalone verifier surface at `/verify-tickets`.
The intended production URL is `https://verify.eventsslot.com`.

## Current Route Mapping

- `https://www.eventsslot.com/verify-tickets` opens the verifier landing page.
- `https://www.eventsslot.com/verify-tickets/<event-slug>` opens the verifier workspace for one event.
- `https://verify.eventsslot.com/` rewrites to `/verify-tickets`.
- `https://verify.eventsslot.com/<event-slug>` rewrites to `/verify-tickets/<event-slug>`.

## DNS And Hosting Setup

1. Add `verify.eventsslot.com` as a custom domain for the existing EventSlot Cloud Run service or the fronting load balancer.
2. Add the DNS record required by Google Cloud for that custom domain.
3. Wait for Google-managed SSL to become active.
4. Test `https://verify.eventsslot.com` and `https://verify.eventsslot.com/<event-slug>`.

## Access Model

The current implementation reuses the existing event scanner APIs and dashboard token model.
Temporary workers should only receive an event-specific verifier link, not dashboard access.

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
