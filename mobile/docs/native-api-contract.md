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

Native request/response contracts, client service functions, and backend route scaffolds are now in place for this flow. The expected response includes:

- `accessToken`
- `refreshToken`
- `expiresAt`
- `user` profile with display name, email, role, plan, and token balance.

The app also has a native session-store boundary for:

- Loading the last session on app start.
- Saving the active session after sign-in.
- Clearing the session on sign-out.
- Detecting expired access tokens.
- Calling the native refresh endpoint when a live refresh token is available.

Drafts, preferences, and sessions now go through one shared native storage adapter. The adapter uses SecureStore for sensitive session tokens, AsyncStorage for drafts/preferences, and memory fallback only when a native storage module is unavailable during preview.

Still gated before live use:

- Production hardening for the three native auth endpoints.
- Token revocation on logout and account deletion.
- Refresh retry behavior for expired access tokens.
- Android device QA proving SecureStore session restore, token refresh, logout clearing, and app-restart behavior.

Current backend behavior:

- `POST /api/native/auth/login` validates email/password against the existing user table and respects suspended accounts, login backoff, and OTP-required accounts.
- `POST /api/native/auth/refresh` accepts a native refresh bearer payload and returns a fresh access/refresh pair.
- `POST /api/native/auth/logout` is intentionally stateless for now; persistent revocation is still required before production native auth.
- Tokens are HMAC-signed with the existing `AUTH_SECRET` or `NEXTAUTH_SECRET`, separate from browser cookies.
- The native Sign In screen calls the live login endpoint only when `EXPO_PUBLIC_EVENTSSLOT_AUTH_MODE=live`; demo mode still enters the safe local shell.

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

Live native workspace contracts and backend adapters are now scaffolded for:

- `GET /api/native/dashboard/stats`
- `GET /api/native/events?limit=100`
- `GET /api/native/events/:slug`
- `POST /api/native/events/:slug/verify-ticket`

The native app maps those responses into the existing dashboard, event list, event detail, and registration preview UI. Demo mode still uses local sample data, while live mode requires a bearer access token from the native auth flow.

Current backend behavior:

- Event lists include owned events, events matching the organizer email, and accepted team-assigned events.
- Event detail requires owner/email/team assignment access and returns confirmed plus waitlist previews.
- The native Event Detail screen consumes the live detail endpoint in live mode and falls back to demo registration previews in demo mode.
- Dashboard stats include owned and accepted team-assigned event activity.
- The native Dashboard screen consumes live dashboard stats in live mode and keeps demo-derived metrics in demo mode.
- Event list/detail currently return `accessType: "public"` until native private-link behavior is fully modelled.
- Native ticket verification now uses a bearer-protected endpoint in live mode. It supports ticket code, confirmation code, signed QR payload, and exact name/email lookup, then records admissions and entry logs using the same EventSlot database.

Before enabling live event loading:

- Harden the `/api/native/*` route adapters and confirm their responses match the final mobile UI needs.
- Keep returning owned events and accepted team-invite events in the same list.
- Keep payment state hidden from native creation until the payment rollout is approved.
- Include `mapDirectionsUrl`, `entryFeeLabel`, custom consent settings, verifier codes, and export readiness in event responses.
- Return confirmed and waitlist records in a stable shape that native can summarize without exposing sensitive raw answers unnecessarily.
- Add pagination/refresh handling for organizers with more than 100 events.

## Native Verification

The native Verify screen can now verify real registrations in live mode through:

- `POST /api/native/events/:slug/verify-ticket`

Request body:

- `ticketCode`
- `code`
- `qrPayload`
- `identity`
- `entrantName`

Response body:

- `status`: `verified`, `already-used`, `not-found`, or `error`.
- `message`: user-facing verification result.
- `ticket`: registration/ticket summary when a ticket is found.

Current backend behavior:

- Requires a native bearer access token.
- Allows event owners and accepted team members to verify tickets for the selected event.
- Supports multi-admission tickets by incrementing `admissionsUsed`.
- Marks the registration checked in and writes an `EntryLog`.
- Rejects wrong-event and invalid signed QR payloads.

Still gated before full device QA:

- Add the real Expo Camera dependency and permission flow.
- Parse real QR/barcode scans from the camera stream instead of simulated scan payloads.
- Test duplicate scans, wrong-event tickets, malformed payloads, offline/network failure, and multi-admission tickets on Android hardware.

## Native Exports

The native Event Detail screen now has an Export Centre scaffold for:

- Confirmed registration CSV.
- All response PDF.
- AI event intelligence report.
- Preparing an export action and handing a returned download URL to the native share sheet.

Planned native endpoints:

- `GET /api/native/events/:slug/exports/confirmed.csv`
- `GET /api/native/events/:slug/exports/responses.pdf`
- `POST /api/native/events/:slug/exports/ai-report`

Before enabling real native downloads:

- Require bearer-token organizer/team access.
- Return signed short-lived download URLs or streamed files.
- Preserve the current web export permissions and super-admin access rules.
- Replace demo export URLs with live signed URLs and stronger progress states for large exports and AI report preparation.
- Test downloads on Android file managers, share sheets, and low-storage devices.

## Event Creation

The native create-event screen is still draft-only. It mirrors the web API shape without posting live data yet:

- `title`, `description`, `capacity`, `eventDate`, and `deadline`.
- `eventType`: `physical` or `virtual`.
- `accessType`: `public` or `private`.
- `mapDirectionsUrl`: organiser-provided Google Maps link.
- `entryFeeLabel`: external fee/contribution wording while EventSlot payments remain hidden.
- `whatsappNumber` and `contactMode` for organiser contact.
- `attendeeConsentEnabled` and `attendeeConsentText` for optional custom consent clauses.
- Native draft validation for required basics, capacity, Maps URL support, consent wording, and upload-question setup.

Before enabling live creation:

- Add native-safe bearer session support for `POST /api/events`.
- Add the planned `POST /api/native/events` route or route adapter used by the native publish service.
- Convert native date/time fields into ISO strings expected by the backend.
- Keep `isPaid=false` until the payment rollout is officially enabled.
- Preserve multiline descriptions exactly as the organiser typed them.
- Convert the draft readiness checks into submit blockers for the live create-event request.
- Add deadline/time validation and WhatsApp number normalization before submit.

The mobile app now has a guarded native publish service:

- `prepareNativeCreateEventRequest` maps a validated draft into `CreateEventRequest`.
- `submitNativeEventDraft` posts to `POST /api/native/events` only when a live bearer session exists.
- Demo mode keeps the action disabled from production writes while still showing readiness and validation states.

Current backend behavior for `POST /api/native/events`:

- Requires a native bearer access token.
- Creates registration-only events with default full-name, email, and phone questions.
- Forces `isPaid=false` and `paymentsLive=false` while payments remain hidden.
- Maps native `physical/virtual` to the existing Prisma `EventType`.
- Blocks native virtual-event publishing until the mobile draft collects and validates a Google Meet link.
- Keeps native `public/private` as a client contract for now; the current database still stores registration events as `REGISTRATION`, so true private-link behavior remains a backend follow-up.

## Offline Drafts

The native create-event flow now has a draft-store abstraction:

- `loadEventDraft`
- `saveEventDraft`
- `clearEventDraft`

Current implementation is in-memory only, which is safe for the unfinished native preview and does not touch production data.

The native session-store abstraction now routes sensitive tokens through SecureStore via the shared storage adapter. That lets the app screens wire sign-in, restore, refresh, and sign-out behavior without putting production tokens into general AsyncStorage.

Before shipping real offline drafts:

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
- Camera mode is scaffolded with a simulated QR payload that feeds the same verification service.
- Event Detail now shows owner/team access capabilities and the event-specific verifier code share prompt.
- Verifier access codes can be handed to the native share sheet from Event Detail.

Before enabling live mode:

- Confirm whether native should send verifier `code`, verifier `token`, or a mobile bearer token.
- Add camera QR scanning and pass the parsed QR payload to the same verification service.
- Add backend tracking for verifier invite issuance, expiry, and revocation if codes should rotate.
- Add explicit unverify/reverse-check-in handling for super admins or permitted event teams.
- Test duplicate scans, wrong-event scans, expired/closed events, and multi-admission tickets.

## Camera Scanner

The native app now has scanner types and a scanner service for:

- Camera permission status.
- Manual vs camera mode.
- QR payload shape and scan timestamps.
- Demo scan payload generation.

Current implementation does not use the device camera. It lets the verifier screen exercise camera-mode UI and QR verification flow safely.

Before enabling real scanning:

- Add and configure Expo Camera or the chosen scanner dependency.
- Request camera permission only when the verifier opens scanner mode.
- Parse EventSlot QR payloads and reject malformed or wrong-event payloads.
- Keep manual lookup available as a fallback.
- Test low light, duplicate scans, fast repeated scans, offline/network failure, and Android permission denial.

## Profile And Settings

The native profile page is currently a readiness hub. It shows:

- Current account identity and app mode.
- Native readiness state for shell, auth, live data, and scanner work.
- Permission placeholders for camera, file uploads, notifications, and maps.
- Memory-backed theme and notification-channel preferences.
- Hosted privacy policy, terms, website, and tester-support link actions.
- Account deletion readiness messaging while the authenticated deletion API remains gated.

Before these become real settings:

- Store user preferences in secure native storage.
- Connect appearance settings to persisted theme preference.
- Request camera, file, notification, and location/map permissions only at the moment they are needed.
- Add authenticated account deletion and data export routes for native users.
- Confirm hosted policy URLs, support inbox handling, and app-store account deletion wording before closed native builds.

## Native Preferences

The native app now has a preferences service for:

- Theme preference, defaulting to dark.
- Notification-channel preferences.

Current implementation is memory-backed only. It gives the app a stable API while avoiding a premature storage dependency.

Before release:

- Choose AsyncStorage for ordinary preferences or SecureStore for sensitive preferences.
- Persist theme before first paint to avoid a flash of the wrong theme.
- Sync notification preferences with the backend after native auth exists.
- Clear local preferences on logout if they become user-specific.
