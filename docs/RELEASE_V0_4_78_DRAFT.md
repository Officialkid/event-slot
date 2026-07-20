# EventSlot v0.4.78 Release Draft

This release note supports the pushed `v0.4.78` version tag. A GitHub
Release-page object can be created from the same tag once release-capable
GitHub tooling is available in the environment.

## Highlights

- Preferred language selection for new email/password signups.
- Preferred language editing in profile settings for existing users.
- Dismissible dashboard notice informing existing users where to set preferred language.
- Central supported-language registry for future i18n translation keys.
- Attendee event descriptions now support compact captions, `Read more`, and preserved line breaks/emojis.
- Public event-description translation route for supported languages.
- Standalone verifier foundation at `/verify-tickets` and `/verify-tickets/[slug]`.
- Future `verify.eventsslot.com` rewrites and setup documentation.
- Super-admin event command access no longer depends on first entering event-specific Admin Mode.
- Goal implementation audit separating completed local work from live blockers.

## Verification Before Publishing

- [x] `npx prisma generate`
- [x] `npx prisma validate`
- [x] `npx tsc --noEmit --incremental false`
- [x] Focused Jest suite for admin delete, drafts, response copy, option limits, tickets, waitlist promotion email, theme coverage, and translation guards
- [x] Production Prisma migration for `preferredLanguage`
- [x] Cloud Run deploy from latest `main`
- [x] Live signup language/consent render check
- [x] Live profile language check
- [x] Live attendee read-more/translate check
- [x] Live verifier route check
- [x] Live export/report check
- [x] Safe exact test-user deletion check
- [x] Super-admin command permission unit coverage
- [x] Focused email-flow unit coverage for team invite, forgot password, waitlist promotion, attendee response copy, provider selection, and Resend integration

## Suggested GitHub Release Title

`EventSlot v0.4.78 - Language, Translation, and Verify Tickets Foundation`

## Suggested Release Notes

EventSlot v0.4.78 prepares the platform for broader language coverage and
event-day operations. Organizers can now collect preferred language during
signup and users can update it later from profile settings. Attendee event
pages now keep long descriptions simple with a compact caption, preserve
spacing and emojis, and offer a lightweight translation option.

This release also introduces the first standalone ticket-verification surface,
ready for the future `verify.eventsslot.com` subdomain. It reuses the existing
scan, upload, and manual search tools while keeping verifier work separate from
the main dashboard experience.

Publish only if the remaining live side-effect checks are explicitly deferred
from v0.4.78 scope: real inbox delivery, broadcast send, destructive admin
delete, payment transactions, and cron reminder/digest runs.
