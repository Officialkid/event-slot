# Native API Contract

The native app is ready to call EventSlot APIs, but live organizer sessions are not enabled yet.

## Current Safe Mode

- The app boots in demo mode.
- Demo mode uses typed local event data.
- The UI still exercises real navigation, loading, error, event detail, and theme states.

## Public Auth Endpoints

These existing web endpoints can be called from native:

- `POST /api/auth/signup`
- `POST /api/auth/send-otp`

The sign-in screen can already call the OTP request endpoint for safe connectivity testing. It does not create a native session yet.

## Protected Endpoint Gap

Most organizer routes currently use NextAuth browser cookies. A native app should not depend on hidden web cookies because Android and iOS need explicit, secure token storage and refresh behavior.

Before switching native mode from `demo` to `live`, add a mobile-safe session flow:

- `POST /api/native/auth/login`
- `POST /api/native/auth/refresh`
- `POST /api/native/auth/logout`
- Bearer-token support for organizer event list and event workspace routes.

## Runtime Flags

Use `.env` values from `.env.example`:

- `EXPO_PUBLIC_EVENTSSLOT_API_BASE_URL`: EventSlot API origin.
- `EXPO_PUBLIC_EVENTSSLOT_AUTH_MODE`: `demo` until live native sessions are ready.
- `EXPO_PUBLIC_EVENTSSLOT_UPLOADS_ENABLED`: keep `false` until device file uploads are wired and reviewed.

## Event Loading

`AppShell` owns event loading and passes the same state to dashboard, events, and event detail screens:

- `events`
- `eventsLoading`
- `eventsError`
- `refreshEvents`

That keeps the native UI ready for the real backend without duplicating fetch logic in each screen.

## Event Creation

The native create-event screen is still draft-only. It mirrors the web API shape without posting live data yet:

- `title`, `description`, `capacity`, `eventDate`, and `deadline`.
- `eventType`: `physical` or `virtual`.
- `accessType`: `public` or `private`.
- `mapDirectionsUrl`: organiser-provided Google Maps link.
- `entryFeeLabel`: external fee/contribution wording while EventSlot payments remain hidden.
- `whatsappNumber` and `contactMode` for organiser contact.
- `attendeeConsentEnabled` and `attendeeConsentText` for optional custom consent clauses.

Before enabling live creation:

- Add native-safe bearer session support for `POST /api/events`.
- Convert native date/time fields into ISO strings expected by the backend.
- Keep `isPaid=false` until the payment rollout is officially enabled.
- Preserve multiline descriptions exactly as the organiser typed them.
- Add validation for map URLs, capacity, deadline, and WhatsApp number before submit.

## Ticket Verification

The native verifier is structured around the existing web API paths:

- `POST /api/verify-tickets/access`
- `POST /api/events/:slug/verify-ticket`
- `POST /api/events/:slug/verify-ticket/lookup`

Current native behavior:

- Demo mode verifies sample ticket codes locally.
- Codes containing `USED` simulate an already-used ticket.
- Codes containing `404` simulate a missing ticket.
- Other non-empty codes simulate a successful check-in.

Before enabling live mode:

- Confirm whether native should send verifier `code`, verifier `token`, or a mobile bearer token.
- Add camera QR scanning and pass the parsed QR payload to the same verification service.
- Add explicit unverify/reverse-check-in handling for super admins or permitted event teams.
- Test duplicate scans, wrong-event scans, expired/closed events, and multi-admission tickets.
