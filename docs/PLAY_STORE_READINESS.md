# EventSlot Play Store Readiness

Last checked: 2026-07-21

## Current Status

EventSlot is ready to begin Play Console setup and internal testing preparation, but the Android App Bundle still needs to be generated after Android SDK setup is fixed on the build machine.

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

## Not Yet Ready

- The final Play Store screenshots in `play-store-assets/screenshot-*.png` are placeholders. Replace them with real screenshots before a public store listing submission.
- A release `.aab` has not been generated in this environment because Gradle cannot find a valid Android SDK.
- Play Console app listing, Data Safety, app access, content rating, and internal testing track still need to be completed in the Play Console UI.

## Android SDK Blocker

Gradle failed with:

```text
SDK location not found. Define a valid SDK location with an ANDROID_HOME environment variable or by setting the sdk.dir path in twa/local.properties.
```

Current environment:

```text
ANDROID_HOME=C:\Users\DANIEL\AppData\Local\Android\Sdk
```

That path does not currently exist. Install Android SDK through Android Studio, then create `twa/local.properties` with:

```properties
sdk.dir=C\:\\Users\\DANIEL\\AppData\\Local\\Android\\Sdk
```

After that, run:

```powershell
cd twa
.\gradlew.bat bundleRelease
```

Expected output:

```text
twa/app/build/outputs/bundle/release/app-release.aab
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
