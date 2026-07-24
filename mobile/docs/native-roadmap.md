# EventSlot Native Roadmap

The native app is developed separately from the current web/PWA and TWA bridge. Do not upload native Android or iOS builds until the checklist below is complete and approved.

## Phase 1: Native Shell

- App shell with dark default and light theme.
- Bottom tab navigation.
- Floating create action.
- Sign-in gate with placeholder session.
- Dashboard, events, verifier, and profile screens.
- Profile/settings readiness hub for account mode, permissions, and native launch blockers.

## Phase 2: Real Data

- Add secure session handling for EventSlot API auth.
- Native login, refresh, logout, and session response contracts are scaffolded in the app.
- Native login, refresh, and logout backend route scaffolds exist under `/api/native/auth/*`.
- Native Sign In can call the live native auth endpoint and save the returned app session when live mode is enabled.
- Native session restore and refresh lifecycle is scaffolded behind a session-store service.
- Drafts, preferences, and sessions now use a shared native storage adapter with SecureStore for session tokens and AsyncStorage for preferences/drafts.
- Load organizer dashboard metrics from the live API.
- Load owned and invited events.
- Native dashboard stats, event list, and event workspace contracts are scaffolded behind bearer-token calls.
- Native dashboard stats, event list, and event detail backend adapters exist behind bearer-token access.
- Native Dashboard reads live metrics from `/api/native/dashboard/stats` in live mode and falls back to demo-derived metrics in demo mode.
- Add event detail, confirmed registrations, waitlist, and export status views.
- Event detail now has native confirmed/waitlist preview UI and registration mappers.
- Event detail now loads live confirmed/waitlist previews from `/api/native/events/:slug` when live mode is active.
- Event detail now has a native Export Centre scaffold for CSV, response PDF, and AI report actions.
- Export actions now have native prepare/share interaction scaffolding.
- Keep native event creation in draft mode until bearer-token auth and API validation are ready.
- Native event draft validation is scaffolded for required details, capacity, maps, consent, and upload-question readiness.
- Native event publish preparation is scaffolded and guarded behind live bearer-token mode.
- A first `POST /api/native/events` backend adapter exists for registration-only native events.
- Use Android device QA to prove persistent native storage before relying on real offline drafts or live token restore.
- Keep `EXPO_PUBLIC_EVENTSSLOT_AUTH_MODE=demo` until the native token endpoints are implemented and verified.
- Keep native uploads disabled until bucket upload permissions, file-size limits, and mobile error handling are complete.

## Phase 3: Native Capabilities

- Camera QR scanner for ticket verification.
- Camera scanner UI and simulated QR flow are scaffolded; real camera dependency is still gated.
- Manual verification with clear valid, used, missing, and error states.
- Native live verification now calls `/api/native/events/:slug/verify-ticket` with the signed native access token and records real check-ins for owner/team-accessible events.
- Event detail now models owner/team capabilities and verifier-code sharing readiness.
- Native share-sheet handoff is scaffolded for verifier access codes.
- Offline registration drafts.
- File/image upload questions are scaffolded; device picker and bucket upload still need implementation.
- Push notifications for reminders, invites, and waitlist promotions.
- Notification channels are scaffolded; push token registration and permission prompts are still gated.
- Native maps handoff for event directions.
- Organiser-provided Maps links can be opened from native event details and draft preview.
- Hosted privacy, terms, website, and tester-support links are available from native Profile.
- Preference, draft, and session storage are wired through native storage dependencies; Android app-restart and logout clearing still need device proof.
- Account deletion remains gated until authenticated deletion and data export routes are available to native sessions.

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
- Real camera scanning handles permission denial, duplicate scans, malformed payloads, and network failure.
- File uploads use bucket storage with size/type validation and updated Play Data Safety disclosures.
- Push notifications have token registration, logout cleanup, and updated privacy/Data Safety disclosures.
- Export downloads use native authenticated endpoints with signed URLs, progress states, and device download/share testing.
- Preferences persist across app restart and clear correctly on logout/account deletion.
- Sessions persist securely across app restart, refresh correctly, and clear on logout/account deletion.
- Maps links are tested on Android with Google Maps installed and browser fallback.
- Duplicate ticket scans, wrong-event tickets, used tickets, and multi-admission tickets are tested.
- Dark and light themes are visually checked on at least one Android phone.
- The current TWA closed test remains available while native development continues.
