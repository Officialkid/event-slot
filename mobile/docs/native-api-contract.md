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

## Offline Drafts

The native create-event flow now has a draft-store abstraction:

- `loadEventDraft`
- `saveEventDraft`
- `clearEventDraft`

Current implementation is in-memory only, which is safe for the unfinished native preview and does not touch production data.

Before shipping real offline drafts:

- Add Expo SecureStore or AsyncStorage after deciding what data is sensitive.
- Encrypt or avoid storing private attendee/payment-like data locally.
- Add draft versioning so old saved drafts do not break after app updates.
- Add conflict handling when a local draft is later submitted to the live API.
- Add device QA for app restart, low-memory termination, and network loss.

## Maps Handoff

The native app can validate and open organiser-provided Google Maps links using React Native `Linking`.

Current behavior:

- Event details show an Open directions action when `mapDirectionsUrl` is a supported Google Maps URL.
- Create Event draft preview validates the pasted Maps link and lets the organiser test it.
- No GPS/location permission is requested yet.

Before shipping full native maps:

- Decide whether EventSlot needs GPS permission or only Maps URL handoff.
- Add a place-search picker if mobile copying/pasting Maps links remains too hard for organisers.
- Validate shortened `maps.app.goo.gl` links against abuse/spam rules before saving live events.
- Test Android devices with Google Maps installed, browser-only devices, and iOS Apple Maps fallback.

## File And Image Uploads

The native create-event flow can now model an attendee upload question:

- Enable or disable the upload question per event draft.
- Set organiser-facing label and help text.
- Choose accepted file type: `any`, `image`, or `document`.
- Mark the upload as optional or required.

Current implementation is a scaffold only. It does not open a native file picker and does not send files to the production bucket.

Before enabling native uploads:

- Add a reviewed Expo document/image picker dependency.
- Request file/media permissions only when the attendee taps upload.
- Upload files directly to the approved bucket path, not into the database.
- Enforce size limits, MIME validation, malware-safety strategy, and signed download URLs.
- Update Google Play Data Safety for user-uploaded files and images.
- Add retry/cancel UI for poor mobile networks.

## Push Notifications

The native profile page now models notification channels:

- Event reminders.
- Team invites.
- Waitlist promotions.
- Tester updates.

Current implementation is a scaffold only. It does not request notification permission, create an Expo push token, or register a device with the backend.

Before enabling native push:

- Add Expo notifications dependency and platform configuration.
- Ask permission only after explaining why notifications help.
- Register device push tokens against the authenticated user/session.
- Add backend APIs for token registration, token revocation, and per-channel preferences.
- Update privacy policy and Google Play Data Safety for device identifiers and notification use.
- Test token rotation, logout, account deletion, and duplicate devices.

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

## Profile And Settings

The native profile page is currently a readiness hub. It shows:

- Current account identity and app mode.
- Native readiness state for shell, auth, live data, and scanner work.
- Permission placeholders for camera, file uploads, notifications, and maps.

Before these become real settings:

- Store user preferences in secure native storage.
- Connect appearance settings to persisted theme preference.
- Request camera, file, notification, and location/map permissions only at the moment they are needed.
- Add account deletion/privacy links that open the hosted EventSlot policy pages.
- Add tester feedback/support links before closed native builds.
