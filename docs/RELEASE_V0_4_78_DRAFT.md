# EventSlot v0.4.78 Release Draft

This is the draft for the first official GitHub release once production
migration, deployment, and live end-to-end checks pass.

## Highlights

- Preferred language selection for new email/password signups.
- Preferred language editing in profile settings for existing users.
- Dismissible dashboard notice informing existing users where to set preferred language.
- Central supported-language registry for future i18n translation keys.
- Attendee event descriptions now support compact captions, `Read more`, and preserved line breaks/emojis.
- Public event-description translation route for supported languages.
- Standalone verifier foundation at `/verify-tickets` and `/verify-tickets/[slug]`.
- Future `verify.eventsslot.com` rewrites and setup documentation.
- Goal implementation audit separating completed local work from live blockers.

## Verification Before Publishing

- [x] `npx prisma generate`
- [x] `npx prisma validate`
- [x] `npx tsc --noEmit --incremental false`
- [x] Focused Jest suite for admin delete, drafts, response copy, option limits, tickets, waitlist promotion email, theme coverage, and translation guards
- [ ] Production Prisma migration for `preferredLanguage`
- [ ] Cloud Run deploy from latest `main`
- [ ] Live signup/profile language check
- [ ] Live attendee read-more/translate check
- [ ] Live verifier route check
- [ ] Live export/report check
- [ ] Safe exact test-user deletion check

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

Do not publish this release as final until the production migration, deployment,
and live end-to-end checks are complete.
