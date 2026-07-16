# Verify Ticket Workflow

This document captures how EventSlot ticket verification works today and how the future standalone verifier experience should work.

## Current State

EventSlot already supports ticket verification inside the organiser event dashboard.

Current scanner entry points:

- `Scan QR Code`: uses the device camera to scan a ticket QR code.
- `Upload Softcopy`: reads a ticket image or PDF and extracts the ticket reference.
- `Enter Details`: searches manually by attendee name, email, ticket number, or confirmation code.

Current API flow:

- Quick scan posts ticket data to `/api/events/[slug]/verify-ticket`.
- Manual lookup reads from `/api/events/[slug]/verify-ticket/lookup`.
- Manual reversal posts to `/api/events/[slug]/verify-ticket/unverify`.
- Attendee profile lookup can resolve QR payloads, ticket codes, confirmation codes, and related registration records.

Current permissions:

- Event owner can verify tickets.
- Super admin can verify tickets through authorised event access.
- Accepted team members can verify only events explicitly assigned to them.
- Event dashboard token access can support dashboard-scoped verification flows.

## Current User Experience

When a verifier scans or searches a ticket:

1. The system finds the ticket or matching registration.
2. It shows attendee details such as name, email, ticket code, confirmation status, and remaining admissions.
3. The verifier can approve/check in the attendee.
4. The system records the verification state so the same ticket cannot be reused beyond its allowed admissions.
5. If a mistake is made, an authorised verifier can unverify/reverse the scan.

## Desired Future: Standalone Verify Domain

The preferred future experience is a separate verifier surface, for example:

```text
verify.eventsslot.com
```

This should be designed for volunteers and temporary event workers who are not full members of the organiser account.

## Future Access Model

Verifier access should be invitation-based and event-specific.

Flow:

1. Organiser opens an event.
2. Organiser invites a verifier for that event only.
3. Invite email says they have been invited to verify tickets for that event.
4. Invite link opens the verifier domain.
5. Verifier accepts and can only see the assigned event.
6. Verifier cannot see unrelated organiser events, billing, settings, reports, or team pages.

## Future Verifier Actions

The verifier should have three primary options:

- `Scan`: scan ticket QR code using camera.
- `Search`: enter attendee name, email, phone, ticket code, or confirmation number.
- `Upload`: upload ticket image or PDF.

After a match is found, the verifier should see:

- Attendee name.
- Confirmation status.
- Ticket code or confirmation code.
- Event title.
- Admission usage count.
- Any ticket tier or admission bundle details.
- Clear result status: valid, already used, waitlisted, cancelled, not found, or wrong event.

The verifier should then be able to:

- Approve entry.
- Decline entry.
- Reverse an accidental approval if permitted.
- Register a walk-in or missing person only if the organiser enabled that permission.

## Search Behavior

Search should support:

- Exact ticket code.
- Confirmation code.
- Email address.
- Phone number.
- Attendee name.

Recommended matching:

- Exact code matches should rank first.
- Email and phone should rank before fuzzy name matches.
- Name search should return a short list with enough details to avoid admitting the wrong person.
- If multiple matches exist, require the verifier to choose one explicitly.

## Security Rules

- Verifier invites must expire.
- Verifier access must be scoped to one event unless explicitly assigned to multiple events.
- Every verification action must write an audit record.
- Every audit record should include verifier identity, event id, ticket id, action, timestamp, and result.
- Verifier should never see payment settings, organiser billing, user management, or private admin pages.
- Camera use should only happen while the scanner screen is open.

## Implementation Notes

Current dashboard scanner components can be reused:

- `components/scanner/ScannerHome.tsx`
- `components/scanner/QuickScan.tsx`
- `components/scanner/ManualTicketVerifier.tsx`
- `components/scanner/DeepScan.tsx`
- `components/scanner/qr-utils.ts`

The future standalone verifier should share verification APIs where possible, but use a narrower auth/session model and a simplified layout.

## Open Decisions

- Whether verifier accounts require passwords, magic links, or one-time invite sessions.
- Whether verifiers can register missing attendees.
- Whether verifiers can reverse scans after a time limit.
- Whether organiser can define roles: scanner only, scanner plus search, scanner plus walk-in registration.
- Whether `verify.eventsslot.com` should be a separate app or a route group in the same app.
