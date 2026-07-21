# EventSlot Play Store Readiness

Last checked: 2026-07-21

## Current Status

EventSlot is ready to continue Play Console setup and internal testing preparation. The first Android App Bundle has been generated locally for upload/testing review.

## Confirmed

- Production web app is live at `https://www.eventsslot.com`.
- Verifier domain is live and routable at `https://verify.eventsslot.com`.
- Verifier fallback domain is live and routable at `https://verify.www.eventsslot.com`.
- Early tester signup prompt is live on the homepage.
- Early tester API stores signups through the existing `FeatureInterest` table.
- Early tester confirmation email is attempted automatically after signup.
- Play package ID is `com.alphatech.eventslot`.
- Android asset links include the release certificate fingerprint.
- TWA release config uses `versionName` `1.1.0` and `versionCode` `3`.
- Notification delegation is disabled for the first Play testing build to keep permissions simpler.
- Play Billing is disabled while EventSlot payments remain hidden/coming soon.
- Privacy policy and terms pages are available at `/privacy` and `/terms`.
- Store icon and feature graphic assets exist in `play-store-assets/`.
- Release Android App Bundle generated at `twa/app/build/outputs/bundle/release/app-release.aab`.

## Not Yet Ready

- The final Play Store screenshots in `play-store-assets/screenshot-*.png` are placeholders. Replace them with real screenshots before a public store listing submission.
- Play Console app listing, Data Safety, app access, content rating, and internal testing track still need to be completed in the Play Console UI.

## Android Build Notes

The build machine uses a local Android SDK path in `twa/local.properties`. That file is intentionally ignored because it is machine-specific.

Example local setup:

```properties
sdk.dir=C\:\\Users\\DANIEL\\.android
```

Generate the Play upload bundle with:

```powershell
cd twa
.\gradlew.bat --no-daemon bundleRelease
```

Expected output:

```text
twa/app/build/outputs/bundle/release/app-release.aab
```

Current generated file:

```text
twa/app/build/outputs/bundle/release/app-release.aab
880,718 bytes
```

## Play Console Checklist

- Create app in Play Console using app name `EventSlot`.
- Use default language `English (United States)` unless you prefer `English (Kenya)` if available in Play Console.
- Select app type `App`.
- Select free app.
- Complete app access: explain login is required for organizer dashboard and provide a test account if Google requests it.
- Complete Data Safety based on EventSlot data collection: account info, contact info, user content, files uploaded by attendees, event registration details, diagnostics, and app activity.
- Complete content rating questionnaire.
- Add privacy policy URL: `https://www.eventsslot.com/privacy`.
- Upload app icon and feature graphic from `play-store-assets/`.
- Replace placeholder screenshots with real mobile screenshots before public listing.
- Create internal testing track and add tester emails collected by the homepage prompt.
- Upload the signed release AAB after the Android SDK blocker is fixed.
