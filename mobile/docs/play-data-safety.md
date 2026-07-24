# Native Play Data Safety Notes

This document tracks what the Expo native EventSlot app currently does so Play Console answers can match the shipped Android behavior. Keep this file updated before any native AAB is uploaded.

## Current Native Scope

- The current Play testing bridge is still the TWA/PWA.
- The Expo native app remains an internal rebuild and must not be uploaded until the release gates are approved.
- Production native builds are configured as internal QA builds only.
- Upload writes and push backend registration remain disabled by default.

## Data Categories

| Data area | Native use | Current status | Play Data Safety implication |
| --- | --- | --- | --- |
| Account identifiers | Email, display name, role, plan, token balance are returned by native auth in live mode. | Wired behind bearer-token native auth. | Declare account info if native live auth is enabled in a tester or production build. |
| Authentication tokens | Access and refresh tokens are stored with SecureStore. | Wired; Android device QA still required. | Declare app functionality/security use. Never describe as user-visible profile data. |
| Event workspace data | Dashboard stats, event list, event detail, confirmed/waitlist previews. | Wired through native APIs in live mode. | Declare app functionality and organizer/event management use. |
| Camera | QR ticket scanning through Expo Camera. | Wired; no audio recording. | Declare camera permission for ticket verification only. |
| Files/documents | Document picker and validation for image/document upload questions. | Picker and multipart client wired; bucket writes disabled. | Declare file/document collection only when upload writes are enabled. |
| Push token | Expo push token capture and registration client. | Token capture wired; backend registration disabled. | Declare device identifiers/push token only when backend registration is enabled. |
| Maps links | Opens organizer-provided map links via device browser/maps app. | Wired without GPS permission. | No location permission is requested by native config. |
| Policy/account links | Opens privacy, terms, account deletion policy, support email, and deletion-request email. | Wired. | Store listing must include hosted privacy policy and account deletion URL. |

## Permission Notes

- Android currently declares `POST_NOTIFICATIONS`.
- Camera permission is added through `expo-camera`.
- Audio recording is explicitly disabled with `recordAudioAndroid: false`.
- The native app does not request fine/coarse location.
- The native app does not request microphone.

## Must Stay Blocked Before Public Native Release

- Upload writes until file targets, R2 behavior, retention, and disclosures are approved.
- Push backend registration until token storage, opt-out, logout cleanup, and delivery jobs are approved.
- Direct in-app account deletion until authenticated deletion/request behavior is tested.
- Any production/store upload until physical Android QA has covered launch, auth, event loading, scanner, drafts, links, and logout.

## Evidence Required Before Upload

- `npm run type-check` passes from `mobile/`.
- `npm run audit:readiness` passes from `mobile/`.
- Profile > Device QA connectivity probe passes on a physical Android device.
- Profile > Device QA checklist is manually completed on a physical Android device.
- Play Data Safety answers are reviewed against this file and the final `app.json`.
