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
| Existing users should be informed that the language option exists. | `app/(organizer)/dashboard/_shell.tsx` shows a dismissible dashboard notice linking to Profile until the user dismisses it in local storage. |
| Language codes should be centralized for future i18n. | `lib/i18n/languages.ts` defines supported launch languages and helpers. |
| Event content should show a small caption first, then `Read more`. | `components/events/EventDescriptionBlock.tsx` compacts long descriptions and preserves original spacing with `whiteSpace: pre-wrap`. |
| Attendees should see a lightweight `Translate` text action and choose a language. | `components/events/EventDescriptionBlock.tsx` exposes `Translate`, language selector, `Apply`, and `Show original`. |
| Public translation should not expose private dashboard data. | `app/api/events/[slug]/translate-description/route.ts` reads only active, non-archived event title/description. |
| Verify tickets should have its own surface/folder. | `app/verify-tickets/page.tsx` and `app/verify-tickets/[slug]/page.tsx` exist. |
| Future `verify.eventsslot.com` should route to the verifier surface. | `next.config.mjs` rewrites `verify.eventsslot.com` to `/verify-tickets`. |
| Subdomain setup instructions should exist. | `docs/VERIFY_TICKETS_SUBDOMAIN.md` documents DNS/Cloud Run/domain mapping steps. |
| Verify-ticket workflow should reuse scanner tools. | `app/verify-tickets/[slug]/page.tsx` renders `ScannerHome`. |
| Delete exactly the two test users only. | Production guard inspected `danmwalilitest@gmail.com` and `danmwalili@gmail.com`, confirmed both were non-admin and owned zero events, deleted exactly 2 accounts, then read-back returned `remaining: 0`. |
| Production migration for preferred language. | Production `npx prisma migrate deploy` applied `20260719100000_add_user_preferred_language` successfully. |
| Deploy latest source after migration. | Cloud Build `925877d5-f2b2-444a-b18b-c875802ad7df` deployed image tag `20260720-001227`; Cloud Run smoke tests passed 7/7. |
| Super admins should be able to execute organiser-level event commands. | `lib/adminMode.ts` now grants `hasOrganiserAccess` for `hasAdminAccess` sessions without requiring an event-specific Admin Mode cookie; covered by `__tests__/lib/adminMode.test.ts`. |

## Verified Locally

- `npx prisma generate` passed after adding `preferredLanguage`.
- `npx prisma validate` passed.
- `npx tsc --noEmit --incremental false` passed.
- `cmd /c npx tsc --noEmit --incremental false` passed after the super-admin command fix.
- `cmd /c npx jest __tests__/lib/adminMode.test.ts --runInBand --silent=false` passed 2/2.
- Focused Jest suite passed: admin user deletion, registration draft restore, response copy, option limits, tickets, waitlist promotion email, theme coverage, and attendee description translation guards.
- Dashboard language notice coverage passed in `__tests__/static/dashboardThemeCoverage.test.ts`.
- Post-deploy Cloud Run smoke tests passed for homepage, sign-in, sign-up, billing pause endpoints, robots.txt, and sitemap.xml.
- Super-admin command fix deployed in commit `df33204` via Cloud Build `784bade7-b506-4df8-b704-5745b8e128b0`, image tag `20260720-111248`; Cloud Run smoke tests passed 7/7.
- Direct `www.eventsslot.com` checks now pass for `/`, `/signup`, and `/verify-tickets` with HTTP 200.
- Live JavaScript-rendered signup page shows preferred language options, Google consent, Terms of Service, Privacy Policy, and unsubscribe wording.
- Live attendee event page for `christhood-potluck-edition-1-2026-897l` shows `Read more`, `Translate`, progress-save wording, preserved event spacing, and directions.
- Live exports for the same event returned downloadable files: confirmed CSV, all responses PDF, confirmed responses PDF, and Word export all returned HTTP 200.
- Signed-in in-app browser profile check passed: `/dashboard/profile` shows `EventSlot`, preferred language selector, `Custom dark`, and `Light mode`; it does not show the stale `iSpeak` profile name.
- Signed-in dashboard check passed: `/dashboard` greets `Good morning, EventSlot`, shows the language notice, and does not show the payment launch banner.
- Signed-in active event check passed for `christhood-potluck-edition-1-2026-897l`: Export Centre, CSV/PDF/AI documentation labels, Verify Ticket tab, and no internal server error.
- Signed-in admin checks passed for `/admin`, `/admin/events`, and `/admin/health`; no forbidden/unauthorized redirects, and health shows Resend reachable with verified sender `hello@eventsslot.com`.
- Signed-in route sweep passed for `/dashboard`, `/dashboard/events`, `/dashboard/profile`, `/dashboard/notifications`, `/dashboard/community`, `/dashboard/insights`, `/dashboard/team`, `/dashboard/billing`, `/admin`, `/admin/events`, `/admin/users`, `/admin/feedback`, `/admin/broadcast`, `/admin/health`, and `/verify-tickets`.
- Billing route check passed: `/dashboard/billing` is informational only, states payments are coming soon/hidden, and does not show the previous super-admin privilege banner.

## Still Partial Or Not Proven

| Requirement | Status | What remains |
| --- | --- | --- |
| Full app-wide i18n translation-key system. | Partial. | `preferredLanguage` and public description translation exist, but the whole UI still uses hardcoded English in many places. |
| Google OAuth users choosing language during signup. | Partial. | Google users can change language from profile after account creation; OAuth pre-consent language capture is not wired yet. |
| Dedicated temporary verifier invitations and roles. | Partial. | Standalone verifier route exists, but scoped invite sessions, expiry, roles, and verifier-only audit identity are not complete. |
| Full live signed-in end-to-end test. | Mostly completed. | Signed-in read-only page sweep now passes. Remaining unproven live items are side-effect flows that were intentionally not triggered in this pass: saving profile preference, team invite email, waitlist promotion email, reminder/digest email, broadcast send, destructive admin delete, and payment transactions. |
| Official GitHub release. | Not completed. | Source commits are pushed and release draft exists, but a release should be created only after live E2E evidence. |
| Docs-wide implementation proof. | In progress. | Main feature/API docs now include current goal work; several historical docs still contain roadmap items and stale pricing/payment references that need separate cleanup. |

## Recommended Next Sequence

1. Live-test signup, profile language selection, attendee description read-more/translate, verifier route, exports, waitlist promotion email, and super-admin user actions.
2. Create the first GitHub release after live E2E passes.
