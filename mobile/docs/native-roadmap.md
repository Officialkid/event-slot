# EventSlot Native Roadmap

The native app is developed separately from the current web/PWA and TWA bridge. Do not upload native Android or iOS builds until the checklist below is complete and approved.

## Phase 1: Native Shell

- App shell with dark default and light theme.
- Bottom tab navigation.
- Floating create action.
- Sign-in gate with placeholder session.
- Dashboard, events, verifier, and profile screens.

## Phase 2: Real Data

- Add secure session handling for EventSlot API auth.
- Load organizer dashboard metrics from the live API.
- Load owned and invited events.
- Add event detail, confirmed registrations, waitlist, and export status views.
- Keep native event creation in draft mode until bearer-token auth and API validation are ready.
- Keep `EXPO_PUBLIC_EVENTSSLOT_AUTH_MODE=demo` until the native token endpoints are implemented and verified.
- Keep native uploads disabled until bucket upload permissions, file-size limits, and mobile error handling are complete.

## Phase 3: Native Capabilities

- Camera QR scanner for ticket verification.
- Manual verification with clear valid, used, missing, and error states.
- Offline registration drafts.
- File/image upload from device storage.
- Push notifications for reminders, invites, and waitlist promotions.
- Native maps handoff for event directions.

## Phase 4: Store Readiness

- Android package and iOS bundle IDs confirmed.
- App icon, splash screen, screenshots, and feature graphics created from final native UI.
- Privacy/data safety review updated for native permissions.
- QA on Android devices before iOS work begins.

## Native Release Gate

Do not submit the Expo native app to Play Store or App Store until all of these are proven:

- Real native sign-in creates a secure session without relying on web cookies.
- Dashboard and events load from EventSlot APIs for owned and invited team events.
- Create event, verifier code, ticket verification, and profile settings work on-device.
- Camera scanner, file uploads, maps handoff, and push-notification permissions are reviewed.
- Duplicate ticket scans, wrong-event tickets, used tickets, and multi-admission tickets are tested.
- Dark and light themes are visually checked on at least one Android phone.
- The current TWA closed test remains available while native development continues.
