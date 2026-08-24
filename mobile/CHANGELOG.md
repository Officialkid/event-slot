# EventSlot Mobile Changelog

## 1.0.0 - 2026-07-27

- Established the web-parity baseline for the Expo mobile app.
- Mapped mobile version `1.0.0` to EventSlot web app version `7` as the source-of-truth release line.
- Added initial project documentation for the web-parity rebuild plan inside `mobile/docs/web-parity-plan.md`.
- Started aligning shared mobile design tokens with the pasted EventSlot dark-theme specification.
- Locked Expo config and startup UI back to dark-only behavior to match the parity brief.
- Wired native push-permission and Expo token capture to run after authenticated session restore/sign-in, while keeping backend registration behind the existing release gate.
- Reset the native app version line to `1.0.0` so it matches the July 27, 2026 brief and the documented web-version-7 baseline.
- Disabled iPad/tablet support in Expo config and set `runtimeVersion.policy = appVersion` to keep OTA compatibility tied to the mobile release line.
