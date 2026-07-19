# Goal Implementation Audit - 2026-07-19

This audit tracks the active Codex goal: language support, profile identity fix,
standalone ticket verification, docs implementation review, GitHub release
readiness, and full end-to-end testing before Play Store work begins.

## Completed In Code

| Requirement | Current evidence |
| --- | --- |
| Dashboard should greet using the current EventSlot profile identity, not a stale `iSpeak` session name. | `app/(organizer)/dashboard/page.tsx` fetches `/api/profile` and prefers that name for the greeting. |
| New users can choose a preferred language during signup. | `app/(auth)/signup/page.tsx` renders `SUPPORTED_LANGUAGES`; `app/api/auth/signup/route.ts` stores `preferredLanguage`. |
| Existing users can change preferred language later. | `app/(organizer)/dashboard/profile/page.tsx` renders the selector; `app/api/profile/route.ts` reads/writes `preferredLanguage`. |
| Language codes should be centralized for future i18n. | `lib/i18n/languages.ts` defines supported launch languages and helpers. |
| Event content should show a small caption first, then `Read more`. | `components/events/EventDescriptionBlock.tsx` compacts long descriptions and preserves original spacing with `whiteSpace: pre-wrap`. |
| Attendees should see a lightweight `Translate` text action and choose a language. | `components/events/EventDescriptionBlock.tsx` exposes `Translate`, language selector, `Apply`, and `Show original`. |
| Public translation should not expose private dashboard data. | `app/api/events/[slug]/translate-description/route.ts` reads only active, non-archived event title/description. |
| Verify tickets should have its own surface/folder. | `app/verify-tickets/page.tsx` and `app/verify-tickets/[slug]/page.tsx` exist. |
| Future `verify.eventsslot.com` should route to the verifier surface. | `next.config.mjs` rewrites `verify.eventsslot.com` to `/verify-tickets`. |
| Subdomain setup instructions should exist. | `docs/VERIFY_TICKETS_SUBDOMAIN.md` documents DNS/Cloud Run/domain mapping steps. |
| Verify-ticket workflow should reuse scanner tools. | `app/verify-tickets/[slug]/page.tsx` renders `ScannerHome`. |

## Verified Locally

- `npx prisma generate` passed after adding `preferredLanguage`.
- `npx prisma validate` passed.
- `npx tsc --noEmit --incremental false` passed.
- Focused Jest suite passed: admin user deletion, registration draft restore, response copy, option limits, tickets, waitlist promotion email, theme coverage, and attendee description translation guards.

## Still Partial Or Not Proven

| Requirement | Status | What remains |
| --- | --- | --- |
| Full app-wide i18n translation-key system. | Partial. | `preferredLanguage` and public description translation exist, but the whole UI still uses hardcoded English in many places. |
| Google OAuth users choosing language during signup. | Partial. | Google users can change language from profile after account creation; OAuth pre-consent language capture is not wired yet. |
| Dedicated temporary verifier invitations and roles. | Partial. | Standalone verifier route exists, but scoped invite sessions, expiry, roles, and verifier-only audit identity are not complete. |
| Delete exactly the two test users only. | Not completed. | Safe production inspection was blocked locally; no destructive deletion was performed. |
| Production deployment. | Not completed. | The `preferredLanguage` migration must run in production before deploying this code. Local gcloud/Prisma engine permissions blocked migration execution. |
| Full live signed-in end-to-end test. | Not completed. | Needs deployed build, successful migration, and authenticated browser/session access. |
| Official GitHub release. | Not completed. | Source commits are pushed, but a release should be created only after production migration/deploy and live E2E evidence. |
| Docs-wide implementation proof. | In progress. | Main feature/API docs now include current goal work; several historical docs still contain roadmap items and stale pricing/payment references that need separate cleanup. |

## Recommended Next Sequence

1. Run the production Prisma migration for `20260719100000_add_user_preferred_language`.
2. Deploy the latest `main` to Cloud Run.
3. Live-test signup, profile language selection, attendee description read-more/translate, verifier route, exports, waitlist promotion email, and super-admin user actions.
4. Inspect the two exact test-user emails safely, then delete only those accounts if they are not super admin and deletion blockers are understood.
5. Create the first GitHub release after live E2E passes.
