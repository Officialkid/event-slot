# EventSlot Native App

This folder is the isolated native rebuild for EventSlot. It does not replace or alter the existing Next.js web/PWA app or the current TWA wrapper.

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

