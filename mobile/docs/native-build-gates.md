# Native Build Gates

This file protects the full native Expo app as it replaces the temporary TWA/PWA bridge in the existing Play listing.

## Required Separation

- Web/PWA remains hosted at `https://www.eventsslot.com`.
- Expo Android package stays `com.alphatech.eventslot` so Play Console accepts it as the same EventSlot app.
- Expo iOS bundle stays `com.alphatech.eventslot` for the future App Store identity.
- Native URL scheme stays `eventslot`.

## Upload Rules

- Do not add an EAS submit profile until Daniel approves a native upload.
- Do not upload an Expo native AAB/IPA to public production while release gates are blocked.
- Production EAS builds now target `distribution: store` after Daniel's approval for native Play testing.
- Upload writes remain disabled unless `EXPO_PUBLIC_EVENTSSLOT_UPLOADS_ENABLED=true` is intentionally approved.
- Push backend registration remains disabled unless `EXPO_PUBLIC_EVENTSSLOT_PUSH_ENABLED=true` is intentionally approved.

## Required Proof Before Native Upload

- `npm run type-check` passes from `mobile/`.
- `npm run audit:readiness` passes from `mobile/`.
- Android physical device opens the native app from the launcher.
- Live native auth signs in, restores session after restart, and logs out cleanly.
- Dashboard/events load live EventSlot data in live mode.
- QR scanning and manual verification are tested against a real EventSlot ticket.
- File picker behavior is tested while bucket writes remain gated.
- Push token capture is tested on a physical device while backend registration remains gated.
- Privacy, Terms, Account Deletion, Website, and Support links open from native Profile.
- QA evidence report is shared from native Profile.
