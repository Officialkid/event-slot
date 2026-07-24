# EventSlot Native App

This folder contains the Expo native EventSlot app. It does not replace or alter the existing Next.js web/PWA app, but its Android package is aligned to the existing Play listing so the native build can replace the temporary TWA app in closed testing.

## Direction

- Framework: Expo + React Native + TypeScript.
- Default theme: dark, matching the EventSlot dashboard.
- Alternate theme: light, available from the app shell.
- Navigation model: mobile-first bottom tab bar, floating create action, rectangular cards, and simple page-level actions.
- Backend: the native app will call the existing EventSlot API at `EXPO_PUBLIC_EVENTSSLOT_API_BASE_URL`.

## First Milestone

The first native milestone is a faithful mobile shell with these flows:

- Sign in / session handoff.
- Dashboard overview.
- My Events.
- Ticket verification.
- Profile and settings.

## Commands

Install dependencies from this folder:

```powershell
npm install
```

Run locally:

```powershell
npm run start
```

Run the native preflight audit:

```powershell
npm run audit:readiness
```

Android development build:

```powershell
npm run android
```

iOS development build, on macOS:

```powershell
npm run ios
```

## Release Rule

Do not upload this native app to Play Store or App Store until it is fully developed, tested, and approved. The current Play testing bridge remains the TWA.

Before any native Play Console upload, review `docs/play-data-safety.md` against the final `app.json`, enabled runtime flags, and Android device QA results.

## Internal Native Build Profiles

`eas.json` is configured for internal QA builds only:

```powershell
npx eas build --platform android --profile production
npx eas build --platform ios --profile preview
```

Current native permissions declared in `app.json`:

- Camera for QR ticket scanning.
- Notifications for reminders, invites, waitlist promotions, and tester updates.
- File/media access for document and image picker flows.
- SecureStore for native session token storage.

Do not run `eas submit` or upload a native AAB/IPA until Android device QA, backend upload/push token routes, account/privacy flows, and final store review are complete.

Before push-notification device QA, create/link the Expo EAS project so `Constants.easConfig.projectId` is available in builds.
