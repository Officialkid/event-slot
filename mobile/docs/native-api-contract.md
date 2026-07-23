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
