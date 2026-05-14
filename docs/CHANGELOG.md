# EventSlot — Changelog

## [0.4.54] — May 15, 2026

### Registrations Export Upgrade (CSV + Word) + Lint Stability

- Upgraded registrations export API in `app/api/events/[slug]/export/route.ts` to support `format=csv|word`.
- Added Word (`.docx`) attendee export output with:
  - title + registration count summary
  - structured attendee table matching export data columns
  - registration day formatting
  - privacy notice block for personal data handling
- Updated organizer dashboard event page `app/(organizer)/dashboard/events/[slug]/page.tsx` export panel to let users choose CSV or Word before download.
- Kept existing export authorization/unlock flow intact while extending output format choice.
- Resolved CI lint blockers by fixing hook-order/type issues and unused variables in:
  - `components/DevToolsDetector.tsx`
  - `app/api/assistant/message/route.ts`
  - `app/api/admin/broadcast/route.ts`
  - `app/api/assistant/my-sessions/route.ts`
  - `lib/generateAIReportContent.ts`
  - `lib/generateEventReport.ts`
  - `lib/generateStakeholderReport.ts`
  - `lib/ticket.tsx`
- Hardened lint ignores for generated docs artifacts in `eslint.config.mjs` (`docs-site/.next/**`, `docs-site/out/**`) so CI lint focuses on source files.

## [0.4.53] — May 15, 2026

### EventSlot Assistant Intelligence Upgrade (MD 3) — Phase 6 Continuation (Shared Page + E2E)

- Extracted a shared assistant UI engine into `components/assistant/AssistantExperience.tsx` so widget and full assistant page use the same behavior.
- Refactored `components/AssistantWidget.tsx` into a launcher wrapper that mounts the shared assistant experience in popup mode while preserving EventSlot brand colors.
- Replaced `app/(organizer)/dashboard/assistant/page.tsx` with a dedicated full-page rendering of the same shared assistant experience for consistent UX across entry points.
- Added Playwright coverage in `e2e/assistant-widget.spec.ts` for:
  - image attachment preview flow
  - quota-exceeded response handling
  - feedback prompt rendering and submission path


### EventSlot Assistant Intelligence Upgrade (MD 3) — Phase 6 (Frontend Widget Upgrade)

- Replaced `components/AssistantWidget.tsx` with a full in-page assistant widget experience including:
  - text and voice session channel selection
  - multipart screenshot/image send support with local previews
  - quota-aware messaging with credits remaining indicator and low-credit color states
  - quota-exceeded lock state with reset countdown messaging
  - post-limit rating flow integration with assistant feedback submission
  - voice recording, transcription handoff, and voice message tagging
  - session end and start-new-conversation controls
- Preserved EventSlot brand styling in the launcher and widget UI using the existing lime/black palette.
- Added responsive widget sizing behavior for smaller mobile viewports to prevent overflow clipping.

## [0.4.52] — May 15, 2026

### EventSlot Assistant Intelligence Upgrade (MD 3) — Phase 5 (Feedback API)

- Added assistant feedback submit endpoint `POST /api/assistant/feedback` in `app/api/assistant/feedback/route.ts`.
- Implemented feedback validation rules: rating must be 1-5 and optional comment max length is 200 characters.
- Implemented daily idempotency for feedback submissions using `(identifier, createdAt >= today)` checks to allow one rating per day.
- Added anonymous identifier fallback using hashed request IP when user session is not available.
- Extended existing admin feedback endpoint `GET /api/admin/feedback` in `app/api/admin/feedback/route.ts` to include assistant feedback analytics:
  - total feedback count
  - average rating
  - rating distribution (1-5)
  - latest comment entries (up to 20)
- Preserved existing organizer feedback list/pagination response fields to avoid breaking current admin feedback screens.

## [0.4.51] — May 15, 2026

### EventSlot Assistant Intelligence Upgrade (MD 3) — Phase 4 (Image Upload Support)

- Upgraded `POST /api/assistant/message` in `app/api/assistant/message/route.ts` to support multipart form submissions with up to 3 images per message (max 4MB each).
- Added image validation and in-request base64 conversion for vision analysis payloads.
- Added rolling quota consumption to assistant messages using `consumeCredits(identifier, userEmail, imageCount)` from `lib/chat-quota.ts`.
- Added quota-exceeded response payload with reset timing, wait minutes, remaining credits, and daily feedback trigger flag (`showFeedback`).
- Added daily feedback gate helper (`shouldShowFeedback`) backed by `AssistantFeedback` records.
- Added Groq model routing for image-aware messages (`llama-3.2-11b-vision-preview`) with text-model fallback behavior and graceful user messaging.
- Added standalone assistant image pre-validation endpoint `POST /api/assistant/upload` at `app/api/assistant/upload/route.ts` for allowed type and size checks before send.
- Preserved backward compatibility for existing text-only assistant clients by supporting JSON body payloads when multipart data is not used.

## [0.4.50] — May 15, 2026

### Mobile UX + Deploy Conflict Fixes

- Fixed create/edit flow false `Invalid URL` friction for optional community links by removing browser-level URL input enforcement and allowing server-side normalization.
- Updated event schema validation for `communityLink` to accept plain input text (still normalized server-side via `normalizeCommunityLink`) to prevent user-facing invalid URL interruptions.
- Reworked dashboard mobile bottom navigation in `app/(organizer)/dashboard/_shell.tsx` to a full-width balanced bar matching organizer mobile nav styling patterns.
- Hid floating assistant launcher on dashboard routes in `components/AssistantWidget.tsx` to avoid overlap/conflict with dashboard mobile tab navigation.
- Improved assistant page mobile viewport behavior in `app/(organizer)/dashboard/assistant/page.tsx` to reduce clipped layout and improve responsiveness.
- Hardened deploy workflow docs metadata push logic in `.github/workflows/deploy.yml` to avoid repeated rebase conflict loops by regenerating docs on top of latest `origin/main` before each retry.

## [0.4.49] — May 15, 2026

### EventSlot Assistant Intelligence Upgrade (MD 3) — Phase 1 (Database)

- Added `ChatQuota` model in `prisma/schema.prisma` to support rolling 5-hour assistant credit windows (`identifier`, `creditsUsed`, `windowStart`, `updatedAt`).
- Added `AssistantFeedback` model in `prisma/schema.prisma` for daily assistant limit-hit feedback capture (`identifier`, `rating`, optional `comment`, `createdAt`) with index on `(identifier, createdAt)`.
- Extended `AssistantSession` with `imageCount` in `prisma/schema.prisma` to track per-session image uploads for assistant usage accounting.
- Generated updated Prisma client from the new schema using `npx prisma generate`.
- Migration command `npx prisma migrate dev --name add_chat_quota_and_feedback` was prepared but not applied because Prisma detected schema drift and required a destructive reset confirmation.

### EventSlot Assistant Intelligence Upgrade (MD 3) — Phase 2.1 (Quota Service)

- Added rolling-window quota service in `lib/chat-quota.ts`.
- Implemented `consumeCredits(identifier, userEmail, imageCount)` with the required credit policy:
  - 5-hour rolling window
  - 20 credits maximum per window
  - text cost = 1 credit
  - image cost = 3 credits each
- Implemented super-admin bypass using `isSuperAdmin(...)` with unlimited access behavior.
- Implemented `getQuotaStatus(identifier, userEmail)` to read current credits/reset state without consuming quota.
- Exported quota constants for downstream assistant route/UI wiring (`MAX_CREDITS`, `TEXT_CREDIT_COST`, `IMAGE_CREDIT_COST`, `WINDOW_HOURS`, `WINDOW_MS`).

## [0.4.48] — May 11, 2026

### Fix 4 — Ticket Toggle + Confirmation Lookup

- Added per-event ticket control via `ticketsEnabled` on `Event` in `prisma/schema.prisma` with migration `20260511123000_add_tickets_enabled_to_event`.
- Added organizer API toggle endpoint `PATCH /api/organizer/events/[id]/tickets` to enable/disable ticket downloads per event.
- Added organizer dashboard UI card for ticket settings in `components/tickets/TicketSettingsCard.tsx` and integrated it into `app/(organizer)/dashboard/events/[slug]/page.tsx`.
- Added public confirmation lookup endpoint `GET /api/events/[slug]/lookup?q=` supporting name/email lookup and status responses for confirmed, waitlisted, and not-registered states.
- Reworked public lookup UI in `components/attendance/ConfirmAttendance.tsx` to show:
  - confirmed with ticket download button when tickets are enabled
  - confirmed with confirmation number only when tickets are disabled
  - waitlisted position
  - not-found guidance
- Added server-side PDF ticket generation path:
  - `lib/ticket.tsx` using `@react-pdf/renderer` and QR generation
  - `GET /api/tickets/[confirmationCode]` with permission checks:
    - `403` when event tickets are disabled
    - `403` when registration is not confirmed
- Updated registration success page `app/register/success/[confirmationCode]/page.tsx` to hide ticket rendering when event ticket downloads are disabled.
- Updated legacy attendance confirmation API `app/api/attendance/confirm/route.ts` to respect `ticketsEnabled`.
- Updated session typing/auth callbacks to expose `tier` (`FREE | PRO | BUSINESS`) in JWT/session for client-side plan-aware UX.

## [0.4.47] — May 11, 2026

### Fix 3 — Cloudflare R2 Image 400 Error

- Added Next.js image remote whitelist in `next.config.mjs` for Cloudflare R2 public event images and Google profile images:
  - `https://<r2-host>/events/**`
  - `https://lh3.googleusercontent.com`
- Made the R2 image hostname config resilient by deriving it from `R2_PUBLIC_URL` when available, with a safe production fallback hostname.
- Hardened image upload response URL generation in `app/api/upload/route.ts` to normalize `R2_PUBLIC_URL` and avoid malformed/double-slash output URLs.
- Hardened image rendering normalization in `components/ui/EventImageWithFallback.tsx` to recover from accidentally percent-encoded full URLs and collapse duplicate path slashes.

## [0.4.46] — May 11, 2026

### Fix 2 — Report UI Text by Role/Plan

- Updated the event dashboard report card copy in `app/(organizer)/dashboard/events/[slug]/page.tsx` to show role/plan-specific messaging instead of a single static line.
- Added conditional report description behavior:
  - super admins: `Generate report for this event. Free for super admins.`
  - pro/business plans: `Generate report for this event. Included in your plan.`
  - free/default plans: `Generate report for this event. Downloading Word uses your report package.`
- Removed exposure of super-admin-free wording for non-admin users.

## [0.4.45] — May 11, 2026

### Fix 1 — Documentation Site SEO Discoverability

- Upgraded global docs SEO metadata in `docs-site/theme.config.tsx` with stronger primary title/description, robots directives, canonical URL, Open Graph image metadata, and Twitter card fields.
- Added sitemap automation for docs build:
  - created `docs-site/next-sitemap.config.js`
  - updated `docs-site/package.json` with `postbuild` sitemap generation
  - installed `next-sitemap` in docs-site dependencies
- Simplified and aligned crawler policy in `docs-site/public/robots.txt` with sitemap reference.
- Added cross-domain discoverability signal by linking `Documentation` (`https://docs.eventsslot.com`) from main-site footer resources in `app/page.tsx`.
- Completed per-page SEO metadata coverage by inserting frontmatter (`title` and `description`) on MDX pages under `docs-site/pages` that were missing it.

## [0.4.44] — May 11, 2026

### Per-Event Report Redesign — Final Contract Alignment

- Refactored event report generation entrypoint in `lib/generateEventReport.ts` to accept a single `EventReportData` object contract.
- Added explicit `EventReportData` interface with event metadata, metrics, attendees, waitlist, pre-computed timeline fields, and optional custom response context.
- Updated both report download routes to construct and pass `EventReportData`:
  - `app/api/admin/generate-report/route.ts`
  - `app/api/events/[slug]/report/route.ts`
- Updated report header/footer contract:
  - running header now renders event title only
  - footer now renders `EventSlot · Confidential · {Event Title} · Page X of Y` with lime top border
- Added confidentiality notice on the cover page.
- Wired summary timeline rendering to consume precomputed `dailyRegistrationCounts` with fallback behavior.
- Preserved completed section redesigns (snapshot, timeline, capacity, attendee roster, waitlist commentary, AI scoring rubric, post-event action items) under the new generation signature.

## [0.4.43] — May 11, 2026

### Per-Event Report Redesign — Section 8 (Post-Event Action Items)

- Added a new forward-looking `Recommended Next Steps` section to `admin-event-report-{event-slug}.docx` in `lib/generateEventReport.ts`.
- Implemented auto-generated post-event action logic derived from event performance signals:
  - mandatory attendee follow-up action
  - low-fill capacity recalibration actions
  - high-fill growth planning actions
  - peak-day concentration campaign-distribution action
  - waitlist/fill-rate-based scarcity and demand-shaping actions
- Added a structured action table with columns:
  - Priority
  - Action
  - Owner
  - Timeframe
- Added priority rendering with visual severity labels and ensured at least one low-priority platform-maintenance action is always present.

## [0.4.42] — May 11, 2026

### Per-Event Report Redesign — Section 7 (AI Strategic Intelligence Reformed)

- Reworked AI generation rules in `lib/generateAIReportContent.ts` to enforce a stricter consultant-style debrief format across all 10 sections.
- Updated AI system prompt and section guidance to require:
  - direct number-linked statements
  - no weak hedging language
  - actionable fixes for every weakness
  - exactly 3 recommendations with timeframe and expected outcome
- Added richer event context payload to AI generation, including event type inference, formatted registration window dates, daily counts, peak-day concentration, and waitlist logic context.
- Added post-processing guard to constrain recommendations output to exactly 3 items.
- Replaced the old unexplained Section 10 score rendering in `lib/generateEventReport.ts` with a visible rubric-based breakdown table:
  - Attendance Rate
  - Registration Distribution
  - Waitlist Generation
  - Setup Quality
  - computed overall score (`X/10`) with accompanying rationale text.
- Preserved the existing 10-section AI structure while upgrading content quality and scoring transparency.

## [0.4.41] — May 11, 2026

### Per-Event Report Redesign — Section 6 (Waitlist Report)

- Reworked empty-waitlist behavior in `lib/generateEventReport.ts` from static `Waitlist is empty.` text to strategic commentary.
- Added fill-rate aware narrative branches for empty waitlist scenarios:
  - low utilisation (<50%) with scarcity/capacity recalibration recommendation
  - healthy but not full utilisation (50-89%) with activation-threshold guidance
  - near-full utilisation (>=90%) with early-open recommendation to capture overflow
- Added no-capacity fallback commentary when the event has no fixed capacity configured.
- Preserved existing non-empty waitlist flow and section placement in the report.

## [0.4.40] — May 11, 2026

### Per-Event Report Redesign — Section 5 (Attendee Roster)

- Updated attendee roster rendering in `lib/generateEventReport.ts` to keep numbered rows and cleaner registration-day formatting (`dd MMM yyyy`).
- Added dynamic phone-column visibility using a 30% completeness threshold:
  - phone column is shown only when at least 30% of attendees have a non-empty phone value
  - when shown, missing values are rendered as `Not provided`
  - when below threshold, the phone column is removed entirely from the roster table
- Added a persistent KDPA-aligned data protection notice below the attendee roster section with visual emphasis styling.

## [0.4.39] — May 11, 2026

### Per-Event Report Redesign — Section 4 (Capacity & Fill Rate)

- Added a dedicated `Capacity & Fill Rate` block to per-event reports in `lib/generateEventReport.ts`.
- Implemented a horizontal stacked capacity utilisation chart (confirmed vs available) with:
  - filled lime segment (`#C8F55A`)
  - remaining light grey segment (`#EEEEEE`)
  - title format: `Capacity Utilisation - {fillRate}% Filled`
- Added summary labels beneath the chart:
  - `{confirmed} of {capacity} slots filled ({fillRate}%)`
  - aligned capacity line (`{confirmed} confirmed` vs `{capacity} capacity`)
- Added fill-rate-aware commentary logic for high, healthy, and low utilisation scenarios with concrete next-edition capacity recommendations.
- Added no-capacity fallback messaging and commentary when event capacity is not configured.

## [0.4.38] — May 11, 2026

### Per-Event Report Redesign — Section 3 (Registration Timeline)

- Added daily registration timeline processing for per-event reports, including zero-activity days across the full registration window.
- Implemented a new `Daily Registration Activity` bar chart in `lib/generateEventReport.ts` using QuickChart with:
  - lime bars (`#C8F55A`) and peak-day highlight treatment
  - peak annotation label (`Peak — {count} registrations`)
  - dotted vertical markers for registration open and registration close dates
- Replaced the plain timeline summary paragraph with AI-generated timeline analysis using the requested 3-sentence rule set and prompt constraints.
- Added deterministic fallback timeline analysis when AI output is unavailable.

## [0.4.37] — May 11, 2026

### Per-Event Report Redesign — Section 2 (Event Snapshot)

- Added a new visual 5-stat Event Snapshot row to the per-event admin report in `lib/generateEventReport.ts`.
- Replaced the former summary metrics grid with stat cards for:
  - Total Registrations
  - Confirmed
  - On Waitlist
  - Capacity
  - Fill Rate status
- Implemented explicit fill-rate status mapping for the final card:
  - `>=90%` green (`Near Capacity`)
  - `>=60%` lime (`Healthy`)
  - `>=30%` amber (`Moderate`)
  - `<30%` red (`Low - Review Strategy`)
- Added resilient handling for unlimited/no-capacity events by showing `N/A` fill rate with a neutral fallback card.

## [0.4.36] — May 11, 2026

### Per-Event Report Redesign — Section 1 (Cover / Event Header)

- Reworked `admin-event-report-{event-slug}.docx` cover/header layout to remove duplicated branding and produce a clean Event Intelligence cover structure.
- Added new cover header flow in `lib/generateEventReport.ts`:
  - `Event` + `Slot` brand text lockup
  - lime divider rule
  - event title (single clean header)
  - `EVENT INTELLIGENCE REPORT` label
  - metadata table (Organiser, Event Date, Location, Registration Deadline, Report Generated)
- Updated first-page behavior to suppress default running header on the cover page (`titlePage` + empty first header), preventing the historical `EventSlot EventSlot ...` duplication.
- Standardized deadline display in metadata table with explicit `EAT` suffix formatting.

## [0.4.35] — May 11, 2026

### Stakeholder Report Redesign — Sections 7 and 8 Completion

- Completed stakeholder report implementation for **Section 8** with:
  - monthly **Next Period Targets** rendered as a table (Metric, Current, Target, How)
  - yearly **Year-Ahead Outlook** rendered as a 2-paragraph investor narrative generated with strict prompt rules
- Upgraded footer styling in stakeholder DOCX to include a lime `#C8F55A` top border rule and consistent `Page X of Y` formatting.
- Finalized AI strategic recommendations output format for **Section 7**:
  - exactly 4 recommendations
  - numbered format with bold titles and specific, time-bound actions
  - EventSlot-stage-specific constraints enforced in prompt design
- Added a snapshot-style section-order regression test for stakeholder report structure:
  - `__tests__/lib/generateStakeholderReport.sectionOrder.test.ts`
- Added explicit User Growth chart launch annotation and retained Cloud Run-safe remote chart rendering.
- Tuned Pro eligibility logic for conversion pipeline to configurable threshold via env var:
  - `REPORT_PRO_ELIGIBILITY_MIN_REGISTRATIONS` (default `30`)
- Standardized report date references to **15 April 2026** as EventSlot live date across narrative prompts and report context.

## [0.4.34] — May 10, 2026

### Feature 5 — Two-Way Communications

- Converted the dashboard feedback surface into a comms hub with public announcements, feedback submission, and user submission history.
- Added public comms endpoints for user feedback and a super-admin announcement composer at `/api/comms` and `/api/admin/comms`.
- Added a public `/comms` feed plus admin comms page so announcements can be published and reviewed in-app.
- Migrated the legacy `Message` model to a comms-oriented schema with typed message categories and public announcement support.
- Updated the admin messages inbox to use the new schema and focus on announcements and feedback instead of read/archive flags.
- Enhanced the weekly digest to include recent public announcements so the email highlights what shipped during the week.
- Updated feature documentation to reflect the comms flow and weekly digest changes.

## [0.4.33] — May 10, 2026

### Feature 4 — Platform Notification Broadcasts (In-App)

- Added platform-wide in-app notification broadcast endpoint: `POST /api/admin/notify-all` for super admins.
- Updated notification schema to support typed categories via `NotificationType` enum (`EVENT`, `PLATFORM`) and richer payload fields (`title`, `message`, optional `link`).
- Refactored notification producers to use the new schema across registration, capacity updates, payment-failure events, expiry warnings, and feedback prompts.
- Updated notifications API payload and organizer notifications UI to render both EVENT and PLATFORM notifications, including a distinct platform-update badge style.
- Added audit logging for platform broadcasts with actor ID and recipient counts.
- Added migration artifact `prisma/migrations/20260510170000_add_notification_model/migration.sql` for environments where direct migration execution is temporarily unavailable.

## [0.4.32] — May 8, 2026

### Documentation Website — Phase 4 Full Content Rewrite (Fact-Checked)

- Rewrote core docs-site content pages across Product, Technical, Developer, Guides, Business, and Appendix sections to remove assumption-based claims and align with live implementation.
- Updated product docs to reflect real waitlist/capacity behavior from route handlers and current free-core monetization model with paid report-download bundles.
- Updated technical docs with current architecture and integrations (Cloud Run, Neon PostgreSQL, Prisma, NextAuth, Paystack, Upstash, Cloudflare R2), plus route-protection and rate-limit implementation details.
- Updated developer docs for actual install/setup/env workflows and replaced Stripe-oriented assumptions with current Paystack-backed billing reality.
- Added/updated Mermaid diagrams, API appendix references, expanded glossary, and historical changelog summary in docs-site appendix pages.
- Corrected docs compatibility constraints for Nextra 3-era content structure and preserved build-safe MDX patterns.

## [0.4.31] — May 8, 2026

### Documentation Website — Phase 3 Homepage + Navigation Accuracy

- Replaced `docs-site/pages/index.mdx` with a new docs landing page structure using Nextra `Cards` and direct links into Product, Developer, Appendix, and Guides sections.
- Updated homepage section taxonomy and summary table to match the new docs information architecture (Product, Technical, Developer, Guides, Business, Appendix).
- Removed assumption-based claims and aligned homepage platform facts to currently documented system state (pre-launch status, Paystack, Neon/PostgreSQL, Prisma, NextAuth, Cloud Run).
- Preserved docs-site compatibility with Nextra 3 by keeping implementation within MDX and existing theme structure.

## [0.4.30] — May 8, 2026

### Official Documentation Portal (Next.js + Nextra)

- Added a full standalone documentation website scaffold under `docs-site/`.
- Implemented a production-ready Next.js 14 + Nextra 3 + TypeScript + Tailwind stack for docs deployment on Vercel.
- Added branded dark-only docs theme aligned to EventSlot identity:
  - near-black surfaces and accent lime visual system
  - typography stack using Instrument Serif, DM Sans, and JetBrains Mono
  - custom global styling for navigation, sidebar, code blocks, tables, and motion
- Authored complete MDX documentation structure with sections for:
  - Getting Started
  - Platform
  - API Reference
  - Integrations
  - Guides
  - Security
- Added API and operations content including quickstart, waitlist behavior, integration setup, launch checklist, and compliance guidance.
- Added docs-site README and build scripts for local dev and production build.
- Validated docs-site with successful production build output.

## [0.4.29] — May 6, 2026

### Canonical System Documentation + Deploy Metadata Automation

- Added `docs/EVENTSLOT_SYSTEM_DOCUMENTATION.md` as the canonical live system document for product, schema, API, pricing, auth, compliance, and infrastructure state.
- Added `scripts/update-system-docs.mjs` to stamp deploy metadata into the canonical doc and prepend deploy-history rows to its auto-managed changelog block.
- Updated `.github/workflows/deploy.yml` to run the documentation updater after successful Cloud Run deploy verification and commit the metadata change back to `main` with CI-skip protection.
- Added canonical-source notices to `docs/SYSTEM.md`, `docs/FEATURES.md`, and `docs/API.md` so supporting docs no longer compete as parallel sources of truth.

## [0.4.28] — May 5, 2026

### Security Hardening — Backend Protection, Input Validation, Distributed Rate Limiting

#### Phase 1: Centralised Permissions + Collaborator Access Expansion
- Added `lib/permissions.ts` with `resolveEventGrant()` helper — resolves owner/admin/team-member access for any event in a single call.
- **Expanded collaborator (team member) access** to endpoints previously owner-only:
  - `close/route.ts` — toggle open/closed (now allows admin + team member)
  - `archive/route.ts` — archive event (now allows admin + team member)
  - `capacity/route.ts` — update capacity (was token-only; now also accepts session auth for owner/admin/team member)
  - `duplicates/route.ts` — view duplicate registrations (was token-only; now also accepts session auth)
- Core-edit endpoints remain strictly owner-only: `settings`, `rename`, `edit`, PATCH mutations, `duplicate`.

#### Phase 2: Input Validation with Zod
- Installed `zod` (v4).
- Created `lib/schemas/` with four schema files: `event.schema.ts`, `team.schema.ts`, `registration.schema.ts`, `profile.schema.ts`.
- Applied `safeParse` validation to priority routes:
  - `POST /api/events` — full event creation schema (title, questions, capacity, dates, etc.)
  - `PATCH /api/events/[slug]/settings` — settings update schema
  - `POST /api/team/invite` — email validation + normalisation
  - `PATCH /api/profile` — name validation
  - `PATCH /api/profile/password` — currentPassword + newPassword (min 8 chars)
- All validation failures return `400 { error, details }`.

#### Phase 3: Distributed Rate Limiting (Upstash Redis)
- Rewrote `lib/ratelimit.ts` — now uses `@upstash/ratelimit` sliding-window limiters when `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` env vars are set; falls back to in-memory if not (safe for local dev).
- **New limiters added**: `loginRatelimit`, `aiRatelimit` (10/min), `reportDownloadRatelimit` (5/min), `billingRatelimit` (10/min).
- Migrated `auth/[...nextauth]` credentials route from `rate-limiter-flexible` to new unified `loginRatelimit`.
- Migrated `attendance/confirm` route to new `attendanceLookupRatelimit`.
- Applied `aiRatelimit` to: `events/[slug]/ask`, `events/[slug]/insights`, `events/predict-capacity`.
- Applied `reportDownloadRatelimit` to: `events/[slug]/report`.
- Applied `billingRatelimit` to: `billing/credits`, `report-downloads/purchase`.

#### Phase 4: Production Build Hardening
- `next.config.mjs`: explicitly set `productionBrowserSourceMaps: false`.
- `next.config.mjs`: added `compiler.removeConsole` — strips `console.log/warn/debug` from production builds; `console.error` retained for server-side error logging.

#### Phase 5: DevTools Detection Deterrent
- Created `components/DevToolsDetector.tsx` — client-side component that detects DevTools via viewport-size delta and debugger timing. Shows a non-blocking warning banner once per session.
- Added `<DevToolsDetector />` to `app/layout.tsx`.



### Consultant-Grade AI Reports + Super Admin Report Ops

- Reworked AI event report generation in `lib/generateAIReportContent.ts` to produce consultant-style structured analysis (target 600–1000 words) with sections for:
  - event overview
  - strengths
  - weaknesses & risks
  - audience profile
  - registration behavior
  - competitive positioning
  - recommendations
  - waitlist analysis
  - overall score
- Added robust deterministic fallback report generation (data-driven narrative) so report previews no longer show repeated "temporarily unavailable" section placeholders when an AI provider is unavailable.
- Expanded Word report AI analysis page in `lib/generateEventReport.ts` to include all new strategic sections and overall score.
- Restored reliable Word response streaming in event report route (`app/api/events/[slug]/report/route.ts`) using `Uint8Array` response bodies.

### Super Admin Report Privileges

- Added server-side super-admin bypass for event report payment gates in `app/api/events/[slug]/report/route.ts`:
  - super admins can preview and download Word reports without consuming paid download balance
  - super admins can access report generation without owner token constraints
- Updated organizer event dashboard report UI to reflect super-admin free download state and display all expanded AI sections.

### Super Admin “Generate Report by Link”

- Added new endpoint `app/api/admin/generate-report/route.ts`:
  - `POST` accepts `{ eventUrl }`, resolves slug from full URL or raw slug, validates active/published event access, and returns AI preview + download URL
  - `GET` accepts `slug` and returns downloadable Word report for super admins
- Added admin UI flow on `app/admin/page.tsx`:
  - paste registration URL/slug
  - generate report preview
  - one-click Word download for sales demos and customer pitching

### Onboarding Tour (Non-Blocking)

- Removed forced action-route behavior from tutorial progression in `hooks/useTutorial.ts`.
- Simplified tutorial control buttons in `components/tutorial/TutorialOverlay.tsx` to informational navigation (`Next`, `Back`, `Skip`, `Finish`) with no required in-app actions.
- Updated tour copy in `lib/tutorialSteps.ts` to guidance-oriented wording instead of action-forcing prompts.

## [0.4.26] — May 4, 2026

### Event Poster 400 + Hydration Stability Hotfix

- Fixed production `/_next/image` 400 failures for event posters by hardening `images.remotePatterns` in `next.config.mjs` with:
  - wildcard `*.r2.dev`
  - explicit host `pub-08713a93a7a2437c89ead762d4588859.r2.dev`
- Stabilized reusable poster rendering in `components/ui/EventImageWithFallback.tsx`:
  - URL normalization/validation before rendering `next/image`
  - single-fire `onError` handling to avoid repeated state flips
- Reduced hydration mismatch risk in `components/events/EventInvitationCard.tsx` by making event date text hydration-safe (`suppressHydrationWarning` + mounted guard).
- Removed eager poster preload behavior from the invitation hero image to reduce repeated preload warnings and wasted network work when a poster fails to load.

## [0.4.25] — May 4, 2026

### Event Image Reliability + Header Readability Fixes

- Fixed broken/missing tab icon behavior by adding explicit favicon metadata entries in `app/layout.tsx`.
- Improved event invitation title readability on poster backgrounds in `components/events/EventInvitationCard.tsx` by adding a dark contrast backing and stronger shadow treatment.
- Fixed missing poster rendering on key event views by introducing resilient image fallback behavior:
  - new reusable component `components/ui/EventImageWithFallback.tsx`
  - applied to public event cards in `app/[username]/page.tsx`
  - applied to organizer event cover in `app/(organizer)/dashboard/events/[slug]/page.tsx`
- Hardened poster loading in `EventInvitationCard` by detecting load failures and automatically switching to gradient fallback instead of leaving a broken/blank image state.
- Updated `next.config.mjs` to support Cloudflare R2 public image hosts more reliably:
  - added `images.remotePatterns` including `*.r2.dev` and dynamic `R2_PUBLIC_URL` hostname
  - expanded CSP `img-src` and `connect-src` with dynamic R2 public origin support

## [0.4.24] — May 4, 2026

### Onboarding Tour Fix (One-Time + Section Selector)

- Added persistent onboarding flags on `User`:
  - `onboardingCompleted`
  - `onboardingSkipped`
- Added migration `add_onboarding_state` and regenerated Prisma client.
- Added new onboarding state endpoint `GET/PATCH /api/user/onboarding`:
  - `PATCH` supports actions `complete` and `skip` for tutorial persistence.
  - `GET` returns effective onboarding flags (with legacy `UserOnboarding` compatibility fallback).
- Refactored tutorial trigger logic in `hooks/useTutorial.ts` to auto-start only when:
  - `onboardingCompleted === false`
  - `onboardingSkipped === false`
- Updated tutorial complete/skip flow to persist through `/api/user/onboarding`.
- Added section-aware tutorial filtering with manual start support.
- Added new selector modal component `components/OnboardingTourSelector.tsx` with:
  - multi-section selection
  - select all / clear
  - zero-selection validation
- Updated dashboard shell sidebar to include `◎ Take a tour` above Terms/Privacy links and wired it to the selector modal.
- Added tutorial targets for insights/team links to support section-specific tour routing.

## [0.4.23] — May 4, 2026

### Super Admin Stakeholder Report (DOCX)

- Added stakeholder report document generator in `lib/generateStakeholderReport.ts` using `docx` with:
  - executive summary and period-over-period comparison tables
  - platform overview and top events by registrations
  - system health summary (API errors, failed email signal)
  - challenges/issues summary and AI-generated recommendations
  - Word `.docx` output styled for stakeholder distribution
- Added new protected admin API route `GET /api/admin/stakeholder-report?period=weekly|monthly|yearly`:
  - super-admin-only access via `isAdminEmail`
  - aggregates platform metrics, top events, plan mix, report-download revenue, and error logs
  - returns downloadable Word report attachment
- Updated `/admin` overview UI with a new `Stakeholder Reports` card to trigger one-click report downloads for:
  - This Week
  - This Month
  - This Year

## [0.4.22] — May 4, 2026

### Event QR Code Generation

- Added shared QR utilities in `lib/qrcode.ts` for:
  - preview-friendly base64 QR generation (`generateEventQRCode`)
  - print-ready PNG buffer generation (`generateEventQRCodeBuffer`)
- Added new API route `GET /api/events/[slug]/qr` that returns a downloadable high-resolution PNG QR code (`1024x1024`) for event registration links.
- Updated organizer event dashboard (`/dashboard/events/[slug]`) with:
  - `QR Code` action beside registration link controls
  - modal preview of QR code
  - one-click high-res PNG download for poster/flyer usage
- Updated event creation success experience (`/create`) with:
  - registration link display and copy action
  - `Get QR Code` action using the same preview + download flow
  - direct `Continue to Dashboard` action

## [0.4.21] — May 4, 2026

### Plan Removal + Pricing Hidden

- Hid public pricing by changing `/app/pricing/page.tsx` to return `notFound()`.
- Removed `/pricing` from sitemap generation.
- Fully disabled subscription-plan checkout by deprecating `POST /api/billing/checkout` with `410 ENDPOINT_DEPRECATED`.
- Forced subscription webhook writes to keep users on `free` plan.
- Removed remaining Pro/Business selectors from admin user management and broadcast targeting UI.
- Removed Pro/Business gates from organizer event analytics and feedback tabs.
- Reset all existing users with `plan IN ('pro','business')` to `free` and cleared billing-cycle/subscription fields.

## [0.4.20] — May 4, 2026

### Landing Page: Free Model Messaging

- Updated landing hero subheading to explicitly communicate the free model and paid report-download-only flow.
- Updated primary landing CTA text to: `Start for free — no credit card` and linked it to `/signup`.
- Removed landing pricing preview cards and remaining plan-tier references from `/app/page.tsx`.
- Removed remaining pricing/upgrade language from feature marketing copy on the landing page.
- Kept footer links free of pricing references.
- Updated docs to reflect the free-access model and report-download pricing:
  - `docs/FEATURES.md`
  - `docs/SYSTEM.md`
  - `docs/AI_CONTEXT.md`

## [0.4.19] — May 4, 2026

### Organizer Dashboard Simplification

- Simplified `/dashboard` to a clean workspace-first layout.
- Removed sales-oriented UI blocks from organizer dashboard overview:
  - feature discovery grid
  - quick actions promo block
  - feature upgrade/credits modal logic
  - plan and credits dependency state in dashboard overview
- Preserved core operational sections:
  - greeting + create event CTA
  - stat cards (events, registrations, active, waitlist)
  - needs attention
  - upcoming events
  - recent activity
  - admin snapshot (for admin users)

## [0.4.18] — May 4, 2026

### Report Download Payment Flow (Dedicated Routes)

- Added dedicated report-download purchase route: `POST /api/report-downloads/purchase`.
- Added dedicated report-download verification route: `GET /api/report-downloads/verify`.
- Added reusable payment UI component `components/ReportDownloadModal.tsx` with bundle options and Paystack redirect handling.
- Updated event dashboard report flow to use the reusable `ReportDownloadModal` for paid Word download unlocks.
- Preserved free report preview flow while separating report download payment concerns into report-specific API endpoints.

## [0.4.17] — May 4, 2026

### Report Flow: Free Preview, Paid Download

- Added Prisma models for paid report download tracking:
  - `ReportDownload` (per-user download balance)
  - `ReportDownloadTransaction` (purchase ledger by payment reference)
- Added relation on `User` to `ReportDownload` and applied migration `add-report-downloads`.
- Refactored `GET /api/events/[slug]/report` into two modes:
  - `mode=preview` returns AI report JSON for browser rendering (free)
  - `mode=download` requires available report downloads and returns DOCX when balance exists
- Added dedicated checkout endpoint `POST /api/billing/report-downloads` for report download bundles.
- Extended `GET /api/billing/verify` to credit report download balances on successful `report_download` payments with idempotency via unique reference checks.
- Reworked organizer event dashboard report UX (`/dashboard/events/[slug]`) to a two-stage flow:
  - Generate AI report (free)
  - Download Word (paid, with payment modal when balance is empty)

## [0.4.16] — May 4, 2026

### AI Provider Routing (Groq Primary)

- Added new AI provider utilities:
  - `lib/groq.ts` (task-based Groq models)
  - `lib/openrouter.ts` (REST fallback)
  - `lib/ai.ts` (unified task router + `errorLog` failure logging)
- Installed `groq-sdk` and wired environment keys for local setup (`GROQ_API_KEY`, `OPENROUTER_API_KEY`).
- Migrated AI call sites from direct Claude calls to `askAI` routing:
  - `POST /api/events/[slug]/ask` (`qa` task)
  - `POST /api/events/predict-capacity` (`capacity` task)
  - `lib/generateAIReportContent.ts` (`report` task with Claude-first fallback chain)
  - `lib/generateInsightCards.ts` (`insights` task)
  - `GET /api/insights` (`tracker` task summary)
- Added resilient null/failed-AI fallbacks in route responses and insight-card generation.

## [0.4.15] — May 4, 2026

### Open Access Rollout (No Plan Gates)

- Replaced `/app/pricing/page.tsx` with a redirect to `/dashboard` and removed pricing links from landing/nav surfaces.
- Rebuilt `/dashboard/billing` into a simple downloads-focused page that shows report download package pricing.
- Removed plan and credit feature gates from key API routes (export, insights, ask, analytics, feedback, team invite, predict-capacity, and insight tracker).
- Removed `UpgradePrompt` usage across dashboard flows and deleted `app/components/UpgradePrompt.tsx`.
- Removed dashboard sidebar plan badge, sidebar upgrade CTAs, and sidebar credits balance display.
- Removed dashboard home plan/credits banner and made quick actions available directly.
- Updated `lib/plans.ts` to an open-access model with:
  - `FEATURES_FREE = true`
  - `REPORT_DOWNLOAD_PRICING` bundles
  - `TEAM_MEMBER_LIMIT = 10`
- Removed remaining plan enforcement in event creation limits, registration overage billing, and feedback cron gating.

## [0.4.14] — April 29, 2026

- [April 2026] | Bug Fix | Event cover image now displays at full height (contain, not cover)
- [April 2026] | Bug Fix | Countdown timer now correctly receives serialized deadline prop
- [April 2026] | Bug Fix | Registration page — event title no longer duplicated
- [April 2026] | UX Fix  | Description field now guides organizers away from repeating structured data

## [0.4.13] — April 27, 2026

### Pricing Page Simplification + Free Plan Limit Increase

- Replaced `/pricing` content with a dedicated "Coming soon" experience so unfinished pricing/subscription details are not shown publicly.
- Added a future-capabilities grid on `/pricing` describing what Free, Credits, Pro, and Business will do, giving customers a clear picture of expected roadmap functionality.
- Increased Free plan active event limit from `1` to `5` by updating `PLAN_LIMITS.free.maxActiveEvents` in `lib/plans.ts`.
- Updated user-facing free-plan copy to reflect the new limit:
  - Home page plan card now says "Up to 5 active events".
  - Universities page free-plan summary now states up to 5 active events.
  - API and system docs updated for the 5-event Free limit.

## [0.4.12] — April 27, 2026

- [April 27, 2026] | Countdown Timer | Live deadline countdown on registration page and organizer dashboard header.

## [0.4.11] — April 27, 2026

### Admin Dashboard: Signup-First Overview + Reliable Broadcast Health

- Updated admin overview (`/admin`) to prioritize signup KPIs at the top:
  - Added a prominent `Total Signups` hero card.
  - Added `New Signups This Week` hero card.
  - Added weekly signup metric support in `GET /api/admin/stats` (`newUsersThisWeek`, Monday-based week start).
- Rebalanced overview layout so plan breakdown is no longer shown in the primary metric rows; it now renders only when Pro/Business users exist.
- Fixed admin broadcast send reporting (`POST /api/admin/broadcast`):
  - Replaced attempted-recipient counting with provider-accepted counting.
  - API now returns `attempted`, `accepted`, and `failed`.
  - Broadcast sender now requires `RESEND_FROM` to avoid silent misconfiguration.
- Updated admin broadcast UI (`/admin/broadcast`) to display accepted/failed results instead of always reporting a generic "Sent" state.
- Fixed platform health email metric (`GET /api/admin/health`):
  - Removed misleading registration-based proxy count.
  - Switched to provider-based monthly accepted-email count where available.
  - Added `emailProviderConfigured` readiness signal.

## [0.4.10] — April 21, 2026

### Feature: Interactive Dashboard Onboarding Tour

- Added `UserOnboarding` model and migration to persist tutorial progress per user (completed steps, skipped/completed flags, completion timestamp).
- Added onboarding state API at `GET/PATCH /api/onboarding` with authenticated user guard.
- Added onboarding bootstrapping for new users:
  - Credentials signups now create a `UserOnboarding` row.
  - OAuth-created users now get onboarding row creation via NextAuth `createUser` event.
- Added reusable tutorial step config in `lib/tutorialSteps.ts`.
- Added interactive tutorial system:
  - `hooks/useTutorial.ts` for tour state, auto-start checks, progression, skip/complete actions, and restart.
  - `components/tutorial/TutorialOverlay.tsx` with backdrop, spotlight mask, progress UI, and contextual actions.
- Integrated tutorial overlay into organizer dashboard shell with a top-bar help trigger (`?`) to restart tour.
- Added non-breaking `data-tutorial` markers to dashboard and event screens for guided targeting (stats, create event CTA, nav entries, registration link, waitlist, check-in section).
- Added “Restart Dashboard Tour” control in profile settings that resets onboarding state and redirects to dashboard.

## [0.4.9] — April 21, 2026

### Registration Reliability + Ticket Verification + CI Stability

- Improved team invite reliability by routing invites through the shared email sender configuration so organizer invites consistently send with the configured verified sender.
- Improved waitlist flow UX so attendees can provide a notification email after seeing the waitlist result, with inline validation and request-state feedback.
- Improved organizer alerting for event demand milestones:
  - Near-full alerts now trigger at 80% fill.
  - Full-capacity alerts continue at 100%.
  - Waitlist-join and waitlist-promotion organizer notifications were reinforced through the email path.
- Added organizer ticket verification API: `POST /api/events/[slug]/verify-ticket`.
  - Supports lookups by ticket code, QR-scanned code string, attendee email, or attendee name.
  - Returns an explicit ambiguous-match response when a non-unique identity query matches multiple records.
  - Enforces one-time check-in so an already checked-in ticket cannot be verified again.
- Replaced organizer event dashboard check-in tab with functional verification workflow wired to the new verification API.
- Build/CI stability hardening:
  - Root layout privileged-account seeding is now skipped during CI and production build phase to avoid build-time Prisma connection failures.
  - Removed conflicting `public/_next` artifact that breaks Next.js production build routing.

## [0.4.8] — April 21, 2026

### Event Creation + Registration Builder Improvements

- Updated event creation flow so Organizer Name is now required and Organizer Email is optional.
- Added a safer create-event API path that avoids a 500 when a session contains a stale user id by validating organizer linkage before create.
- Improved custom question builder UX for option-based questions:
  - Added separate option entry with Add button (Google Forms style) instead of comma-only input.
  - Added new Checkboxes question type.
  - Added per-checkbox question setting to allow either single selection or multiple selections.
- Added client and API validation to ensure option-based questions always include at least one option.
- Added attendee and edit-registration support for checkbox answers with single/multi-select behavior.
- Added a compatibility fallback at `public/_next/app-build-manifest.json` to prevent older service worker precache installs from failing on 404.

## [0.4.7] — April 21, 2026

### Feature: Android TWA (Trusted Web Activity) — Play Store Packaging

- **`public/.well-known/assetlinks.json` created** — Digital Asset Links file for TWA verification. Replace `REPLACE_WITH_SHA256_FINGERPRINT` with the output of `keytool -list -v -keystore eventslot-release.keystore -alias eventslot` after the keystore is generated.
- **`next.config.mjs` updated** — Added dedicated headers rule for `/.well-known/assetlinks.json`: forces `Content-Type: application/json`, `no-cache` and `Access-Control-Allow-Origin: *` so Android's asset link verification service can always read it without caching stale fingerprints.
- **`twa/twa-manifest.json` created** — Pre-filled Bubblewrap config for `com.alphatech.eventslot`. Run `cd twa && bubblewrap build` (after placing this file in the Android project directory) to build the APK without going through the interactive wizard.
- **`@bubblewrap/cli` installed globally** via `npm install -g @bubblewrap/cli`.

## [0.4.6] — April 21, 2026

### Feature: Full PWA Compliance (Google Play Store Ready)

- **`public/manifest.json` updated** — Full PWA manifest with `start_url: /dashboard`, `scope: /`, `orientation: portrait`, `theme_color: #a3e635`, `background_color: #0a0a0a`, `categories`, `lang`, `screenshots`, and a complete 8-size icon set (`72×72` → `512×512`).
- **`app/layout.tsx` metadata updated** — `themeColor` changed to `#a3e635`; `viewport` set with `userScalable: false` and `maximumScale: 1`; `apple-touch-icon` updated to `/icons/icon-192x192.png`.
- **`public/offline.html` created** — Branded offline fallback page served when the user has no connection (dark background, lime `#a3e635` heading).
- **`public/icons/` generated** — All 8 required PWA icon sizes created from `public/assets/logo-unfiltered.png` using `sharp`.
- **`scripts/generate-icons.js` added** — Regenerates all icon sizes from `public/icons/icon-source.png` (or falls back to existing logo asset). Run with `node scripts/generate-icons.js`.
- **`sharp` installed as devDependency** for icon generation.
- **Service worker** already handled by `@ducanh2912/next-pwa` (no changes needed).

## [0.4.5] — April 20, 2026

### Platform: Security + Runtime Upgrade + Google Cloud Migration

- **Dependencies upgraded for security and compatibility**:
  - `next` upgraded to `^16.2.4`
  - `eslint-config-next` upgraded to `^16.2.4`
  - `eslint` upgraded to `^9.25.0`
  - migrated from `next-pwa` to `@ducanh2912/next-pwa@^10.2.9`
- **Security hardening in package resolution**:
  - Added `overrides` for `cookie`, `got`, and `serialize-javascript`
  - `npm audit --audit-level=high` now reports **0 vulnerabilities**
- **Next.js async request API migration completed**:
  - Updated affected App Router pages and API route handlers to async `params`/`searchParams` signatures required by Next.js 15+
- **Build pipeline updated for Next.js 16 compatibility**:
  - Build script changed to `next build --webpack`
- **Google Cloud deployment path added (Cloud Run)**:
  - Added `cloudbuild.yaml` for Cloud Build + Artifact Registry + Cloud Run deploy
  - Added `scripts/deploy-gcp.ps1` for local one-command GCP deploy flow
  - Replaced README boilerplate with project-specific setup and Cloud Run deployment instructions


## [0.4.4] — April 18, 2026

### Feature: Gate Premium Features with ComingSoon Component (Phase 4)

- **Updated: `app/(organizer)/dashboard/insights/page.tsx`** — Replaced custom upgrade wall with `<ComingSoon featureName="Insight Tracker" />` (Business plan gate).
- **Updated: `app/(organizer)/dashboard/events/[slug]/page.tsx`** — Replaced blurred Pro plan overlay in the Analytics tab and blurred Business plan overlay in the Feedback tab with `<ComingSoon>` component.
- **Updated: `app/(organizer)/dashboard/billing/page.tsx`** — Replaced plan upgrade cards section and credit bundle purchase cards section with `<ComingSoon>` gates, preserving the credits balance display and feature cost reference table.
- **Import added** to all three pages: `import ComingSoon from "@/components/ui/ComingSoon"`


## [0.4.3] — April 18, 2026

### Feature: Confirm My Attendance (Public Self-Lookup)

- **New component: `components/attendance/ConfirmAttendance.tsx`** — Client-side "Already Registered?" panel embedded on the public event page. Accepts an email address, queries the attendance lookup API, and displays one of: confirmed ticket (inline `ConfirmationTicket` card with PDF download), waitlist status message, or not-found message. No login required.
- **New API: `POST /api/attendance/confirm`** — Looks up a registration by email + eventId. Returns ticket data for confirmed registrations, waitlist position message, or not-found. Rate-limited to 5 lookups per IP per 10 minutes via Upstash Redis.
- **Updated: `app/[username]/page.tsx`** — Public event page now renders a two-column grid on large screens (registration form + "Already Registered?" panel side-by-side). Single-column on mobile.
- **Updated: `lib/ratelimit.ts`** — Added `attendanceLookupRatelimit` (5 per 10 min sliding window).


## [0.4.2] — April 18, 2026

### Feature: Confirmation Ticket Card with QR Code & PDF Download

- **Schema:** Added `confirmationCode String? @unique` to Registration model
- **New: `lib/confirmationCode.ts`** — Generates unique `EVT-XXXXXXXX` confirmation codes
- **New: `components/tickets/ConfirmationTicket.tsx`** — Client component displaying attendee ticket with QR code (via `qrcode`) and PDF download (via `html2canvas` + `jspdf`)
- **New: `app/register/success/[confirmationCode]/page.tsx`** — Post-registration success page showing the ticket; no login required
- **New: `app/verify/[confirmationCode]/page.tsx`** — QR scan check-in verification page showing green ✓ (valid) or red ✗ (invalid)
- **Updated: `app/api/register/route.ts`** — Generates and stores confirmation code on confirmed registration
- **Updated: `app/api/events/[slug]/capacity/route.ts`** — Generates confirmation codes when waitlisted attendees are promoted
- **Updated: `app/api/events/[slug]/manual-register/route.ts`** — Generates confirmation code for manually added confirmed registrants
- **Updated: `lib/email.ts`** — `sendSlotConfirmedEmail` now includes optional ticket URL button
- **Updated: `app/(attendee)/[username]/RegistrationForm.tsx`** — Shows "View & Download Ticket →" link on successful confirmed registration


## [0.4.1] — April 15, 2026

### UI/UX Fixes & Accuracy Pass

- **Navbar active state** — Added `id="how-it-works"` to the Feature Highlights section and `id="get-started"` to the CTA band section so the IntersectionObserver in Nav correctly highlights Features and Get Started links when those sections are in view
- **Pricing page — Business plan price corrected** — Monthly: $100 (was incorrectly showing $19); Annual: $80/month billed $960/year, saving $240/year (not $48)
- **Pricing page — Pro team members corrected** — Updated from "2 team members" to "10 team members" in feature list
- **Pricing page — Business team members corrected** — Updated from "5 team members" to "20 team members" in feature list
- **Pricing page — Business feature list updated** — Added AI event reports, AI insight cards, Natural language Q&A, Event Insights Tracker; removed inaccurate "Custom domain" entry
- **Pricing page — Pro feature list updated** — Added "AI insight cards" (included in Pro); corrected registrations label to "500 included (pay-as-you-go beyond)"
- **Pricing page — Comparison table corrected** — Team members (Free: 1, Pro: 10, Business: 20); Registrations (Free: 100 included, Pro: 500 included, Business: Unlimited); Analytics & AI section expanded with AI insight cards, AI reports, Q&A, Insights Tracker, demographics, feedback; Bulk registration (Free: Up to 3)
- **Pricing page — `id="ai-features"` anchor added** — "See all AI features →" link on homepage now scrolls to the credits/AI section on /pricing
- **Home page — "See all AI features" link** — Changed from `/pricing` to `/pricing#ai-features`
- **Home page — Trust stat updated** — "Loved by organizers in 5+ countries" changed to "Used across Kenya, Nigeria, Uganda & beyond"
- **Home page — Smart CTAs** — Hero "Start for free", Feature 1 CTA, and CTA band buttons now use `SmartCTA` component: signed-in users are sent to `/dashboard`, others to `/signup`
- **Home page — Pro plan preview updated** — Added "AI insight cards" to Pro plan feature list; "Up to 500 registrations" → "500 registrations included"
- **Signup page** — Already-signed-in users are immediately redirected to `/dashboard` instead of being shown the signup form
- **Signin page** — Already-signed-in users are immediately redirected to `/dashboard`
- **New component: `components/SmartCTA.tsx`** — Session-aware CTA link component



### Documentation & System Updates
- **Documentation System** — Updated all docs files post-build completion
- **`docs/FEATURES.md`** — Updated credit costs and plan access logic to reflect v0.3.7 changes
- **`docs/AI_CONTEXT.md`** — Verified feature matrix table with current credit pricing
- **`docs/SYSTEM.md`** — Updated version to 0.4.0; refreshed plan tiers section
- **`docs/KNOWN_ISSUES.md`** — Marked KI-001, KI-002, KI-003, KI-005 as ✅ Resolved
- **Landing Page** — Integrated hero background and dashboard mockup images from `/public/assets/`
- **Visual Assets** — Added dashboard-laptop.jpg, hero-bg.png, event-checkin.jpg, organizer-mobile.jpg to enhance landing page UX

## [Unreleased]

## [0.3.7] — April 14, 2026

### Credit Cost Restructure
- **`lib/credits.ts`** — Replaced `CREDIT_COSTS` object entirely with new keys and values:
  - `ai_report`: 150 → 50 credits
  - `ai_insights`: 2 → 20 credits
  - `ai_query` (renamed `ask_your_data`): 1 → 60 credits per query
  - `word_report` (renamed `standard_report`): 100 → 0 (now free)
  - `analytics_unlock` (renamed `event_analytics`): 150 → 10 credits
  - `export_csv`: 15 (unchanged)
  - `remove_watermark`: 10 (unchanged)
  - `custom_thank_you`: 20 → 10 credits
  - New: `duplicate_event` (5), `team_members` (10), `insight_tracker` (50), `feedback_forms` (30), `predictive_capacity` (25)
  - Updated `hasFeatureAccess` plan check: `ai_query` → `ask_your_data`
- **`lib/plans.ts`** — Updated `PAYG_PRICING` to match: `wordReportBase` 100 → 0, `analyticsUnlock` 150 → 10, `customThankYou` 20 → 10
- **`app/api/events/[slug]/ask/route.ts`** — Updated `CREDIT_COSTS.ai_query` → `CREDIT_COSTS.ask_your_data` (2 references)
- **`app/(organizer)/dashboard/page.tsx`** — FEATURES array: AI event report cost 150 → 50, AI insight cards cost 2 → 20; hardcoded `creditBalance >= 150` → `>= 50`; featureModal `credits: 150` → 50; badge `>150 cr` → `>50 cr`
- **`app/pricing/page.tsx`** — Credits table fully rewritten: 5 old rows → 13 rows with new costs including all new features; "points" → "credits" terminology; standard report shown as Free
- **`docs/FEATURES.md`** — Updated AI feature tier descriptions with new credit costs; feature access matrix already reflected new values
- **`docs/AI_CONTEXT.md`** — Credits section rewritten with itemised costs for all 13 credit-purchasable features



### Security Fixes — KI-001 / KI-002 / KI-003 / KI-005
- **KI-001** — Added `signupRatelimit` (5 req / 1 h per IP, sliding window) via Upstash Redis to `POST /api/auth/signup`; prevents email bombing and Resend quota exhaustion
- **KI-002** — Rewrote `/api/billing/unlock` to execute the idempotency check, balance check, credit deduction, `EventUnlock` create, and `CreditTransaction` create inside a single `prisma.$transaction`; eliminates double-spend race condition; added per-user rate limit (10 req / 1 min)
- **KI-003** — Created `lib/validateEnv.ts` with `validateR2Env()` helper; `POST /api/upload` now calls it before authentication and returns a clean `503 Service Unavailable` when R2 environment variables are missing instead of an unhandled 500
- **KI-005** — Added `const BASE_URL = process.env.NEXTAUTH_URL ?? 'https://www.eventsslot.com'` in `lib/email.ts`; all 4 email template URL references now use `BASE_URL` so password-reset and team-invite links never contain `undefined/...`

## [0.3.5] — April 13, 2026

### Documentation System — Full E2E Audit & Live Docs
- Created `/docs/API.md` — complete API reference for all 60+ endpoints (auth, events, registration, billing, team, admin, cron)
- Created `/docs/KNOWN_ISSUES.md` — honest codebase audit of 18 tracked issues (3 critical, 7 important, 8 minor); verified working list of 46 confirmed features
- Created `/docs/AI_CONTEXT.md` — AI chatbot training knowledge base covering all features, plans, FAQs, feature matrix
- Created `/docs/TEST_RESULTS.md` — E2E test results from static codebase audit; 38 code-verified PASS, 4 FAIL flagged, 24 requiring live browser test
- Updated `/docs/SYSTEM.md` — full rewrite with live URLs, complete tech stack table, all user roles, accurate plan pricing (KSH), complete DB model table (17 models), all env vars including R2
- Updated `/docs/FEATURES.md` — full rewrite replacing old table-based format with structured feature entries; accurate credit costs from lib/credits.ts; complete feature access matrix
- Issues found during audit: KI-001 (signup rate limiting missing), KI-002 (unlock race condition), KI-003 (R2 env validation), KI-005 (NEXTAUTH_URL null check in emails)

## [0.3.4] — April 9, 2026

### CSV Export with Pay-as-you-go Unlock
- `GET /api/events/[slug]/export` — new route; validates session owner or dashboard token; returns UTF-8 BOM CSV of all confirmed registrations with dynamic question headers + Status + Registered At columns; values containing commas/quotes/newlines are properly escaped; if organizer is on Free plan without a `csv` EventUnlock, returns 402 with `{ cost, eventId, upgradeRequired: true }` so the client can present the purchase flow
- `calculateCSVCost` from `lib/plans.ts` used to compute cost: `csvExportBase ($2) + ceil(confirmedCount / 100) × $1`
- `app/(organizer)/dashboard/events/[slug]/page.tsx` — Overview tab now includes an **Export Registrations** panel:
  - On Pro/Business (or after unlock): "Export CSV" button downloads the file directly via `<a>` blob trick
  - On Free without unlock: shows cost preview "Export this data for $X.XX credits" with **Buy & Export** and Cancel buttons
  - **Buy & Export** POSTs to `POST /api/billing/unlock` with `{ eventId, feature: "csv" }`; on `insufficientCredits` (402) redirects to `/dashboard/billing`; on success re-triggers export
  - Button disabled when there are 0 confirmed registrations
  - State variables added: `csvExporting`, `csvCost`, `csvEventId`, `csvUnlockLoading`, `csvError`

## [0.3.3] — April 9, 2026

### Auth — Welcome Email, Forgot Password, Reset Password
- `lib/email.ts` — added `sendWelcomeEmail` and `sendPasswordResetEmail` functions (dark-themed HTML, lime CTA, EventSlot brand)
- `POST /api/auth/signup` — now fires `sendWelcomeEmail` after account creation (fire-and-forget, does not block response)
- `prisma/schema.prisma` — added `resetToken String?` and `resetTokenExpiry DateTime?` to User model; pushed via `prisma db push`
- `POST /api/auth/forgot-password` — finds user by email, generates a UUID raw token, hashes it (SHA-256) and stores the hash + 1-hour expiry; sends reset email with raw token; always returns 200 even if email is not registered (enum security)
- `POST /api/auth/reset-password` — hashes incoming token, finds user where hash matches and expiry is in the future; updates password (bcrypt 12 rounds), clears token fields; returns 400 with message if link invalid or expired
- `app/(auth)/forgot-password/page.tsx` — new page: card, back link, Instrument Serif heading, email input, "Send reset link" button; always shows same success message after submit regardless of outcome
- `app/(auth)/reset-password/page.tsx` — new page: reads `?token` from search params; new password + confirm fields; client-side match/length validation; on success redirects to `/signin?reset=success`
- `app/(auth)/signin/page.tsx` — added "Forgot password?" ghost link below password input; added lime banner shown when `?reset=success` is in the URL; page now wrapped in `Suspense` for `useSearchParams`

## [0.3.2] — April 9, 2026

### Intelligent Capacity Suggestions
- Added `GET /api/events/suggest-capacity` — analyses the organizer’s last 5 completed events (deadline passed, capacity set) and returns a suggested capacity with an average fill rate, event count, and human-readable message
- Suggestion logic: average confirmed count × 1.2 buffer; message adapts based on fill rate (≥85%, 50–84%, <50%); includes fastest fill time if any event fully filled
- Returns `{ suggestion: null }` if organizer has fewer than 3 qualifying events
- `app/(organizer)/create/page.tsx` — capacity input now fetches the suggestion on first focus; if a suggestion exists and the field is empty, a lime card appears below with a lightbulb icon, the API message, and a “Use this suggestion” ghost button that fills the field

## [0.3.1] — April 9, 2026

### Event Creation Templates
- Added `lib/eventTemplates.ts` — 6 templates: Community Meetup, Corporate Training, Workshop, Conference, Church/Faith Event, Start from scratch, each with pre-built question sets
- `app/(organizer)/create/page.tsx` — two-step flow: template picker shown first (before form); selecting a template pre-fills questions and smooth-scrolls to the form
- Template picker: Instrument Serif heading "Start with a template", auto-fill grid (minmax 172px), cards with icon / name / description, lime border + bg on selected, lime hover on unselected
- Template banner inside Registration Questions card shows icon + "Using [Template Name] template. You can edit the questions below." (hidden for blank/scratch)
- Templates remain visible after selection so organizer can switch templates mid-form

## [0.3.0] — April 9, 2026

### Organizer Public Profiles
- Added `username String? @unique` to User model in Prisma schema; applied via `prisma db push`
- Added `username` to the NextAuth `session` callback (fetched from DB on every session) and to `types/next-auth.d.ts`
- New route `GET /api/users/check-username` — availability check with validation (3–20 chars, alphanumeric + hyphens, reserved words list)
- New route `PATCH /api/users/username` — authenticated endpoint to set/update username
- New page `/setup-username` (`app/(auth)/setup-username/page.tsx`) — centered card with inline "eventslot.co/" prefix input, debounced availability check (400ms), lime green/red availability feedback, "Set username" button → redirects to `/dashboard`
- `app/(organizer)/dashboard/layout.tsx` now redirects to `/setup-username` if `!session.user.username`
- New page `/[username]` (`app/[username]/page.tsx`) — server component public profile with: initials circle, upcoming active events grid (2-col `auto-fill`), slot-fill bar, "Register →" CTA, disabled "Follow" button (Coming soon), `generateMetadata` for SEO; reserved usernames return `notFound()`
- `components/Nav.tsx` — added "My public profile" link above "Sign out" in dropdown (only shown when `session.user.username` exists)

## [0.2.4] — April 9, 2026

### Build Fix
- Rewrote `types/paystack-node.d.ts` to declare `PaystackResource` interface with `[method: string]: (...args: any[]) => Promise<any>` and typed `transaction`, `subscription`, `customer`, `plan` etc. as `PaystackResource` — resolves `'paystack.transaction' is of type 'unknown'` build error
- Ran `prisma generate` locally to clear stale Prisma client (VS Code TypeScript errors for `paystackSubscriptionCode`, `creditBalance`, `creditTransaction`, `eventUnlock` were all stale — fields/models already existed in schema)

## [0.2.3] — April 9, 2026

### Build Fix
- Added `types/paystack-node.d.ts` — local type declaration shim for `paystack-node` which ships no TypeScript types, resolving `Could not find a declaration file for module 'paystack-node'` build error

## [0.2.2] — April 9, 2026

### Build Fix
- Replaced `require('paystack-node')` with `import Paystack from 'paystack-node'` in `lib/paystack.ts` — ESLint rule `@typescript-eslint/no-require-imports` was blocking the Vercel build

## [0.2.1] — April 9, 2026

### Build Fix
- Deleted stale `lib/stripe.ts` from git tracking — it was causing a Vercel build failure (`Type '"2024-06-20"' is not assignable to type '"2026-03-25.dahlia"'`) after the Stripe → Paystack migration
- Committed and pushed all prior session work that had not been pushed to GitHub (27 files, 2210 insertions): Paystack billing routes, credits system, billing page rewrite, `lib/credits.ts`, `lib/paystack.ts`, updated plan limits, Prisma schema, and `/docs`

## [0.2.0] — April 9, 2026

### Paystack Billing & Credits System
- Migrated payment provider from Stripe to Paystack
- Replaced `lib/stripe.ts` with Paystack integration via `paystack-node`
- Rewrote `lib/plans.ts` with `PLAN_LIMITS` and `PAYG_PRICING` constants
- Created `lib/credits.ts` for credit deduction, balance checking, and unlock queries
- Added `CreditTransaction` model to Prisma schema (tracks all credit activity with balance)
- Added `EventUnlock` model to Prisma schema (tracks per-event PAYG feature unlocks)
- Updated `User` model with `creditBalance`, `paystackCustomerCode`, `paystackSubscriptionCode`

### New API Routes
- `POST /api/billing/checkout` — Initiate Paystack subscription checkout (accepts plan name + billing cycle)
- `POST /api/billing/credits` — Initiate credit top-up via Paystack one-time payment
- `POST /api/billing/unlock` — Unlock a per-event PAYG feature using credits
- `POST /api/billing/cancel` — Cancel active Paystack subscription
- `GET /api/billing/status` — Return billing status (plan, cycle, end date, credit balance)
- `GET /api/billing/invoices` — Fetch invoices from Paystack
- `GET /api/billing/transactions` — Return last 20 credit transactions with running balance
- `POST /api/billing/portal` — Get Paystack billing portal URL
- `POST /api/billing/webhook` — Handle Paystack subscription and payment webhook events

### Billing Page Rewrite
- Rewrote `/app/(organizer)/dashboard/billing/page.tsx` (replaced Stripe-based UI)
- Current plan card with badge, billing cycle, renewal date, cancel subscription button
- Success banner (from `?success=true&plan=`) and credits-added banner (`?credits=added`) with 5s auto-dismiss
- Credits section: live balance, three buy-credit buttons ($10/$45/$80), collapsible PAYG pricing table
- Upgrade section: monthly/annual toggle, Pro and Business plan cards (hidden for Business users)
- Credit history table: last 20 transactions with date, description, amount (color-coded), running balance

### Dashboard UI
- Added `PlanBadge` component to dashboard sidebar
- Added colored plan indicator dot to mobile bottom navigation bar
- Updated `GET /api/me` to return `creditBalance` in user profile response

### Revised Plan Limits
- Free: 1 active event, 100 free registrations, 30-day data retention, 1 team member
- Pro: $19/mo or $15/mo annual, unlimited events, 500 free registrations, 10 team members
- Business: $49/mo or $39/mo annual, unlimited everything, 20 team members, no PAYG costs

---

## [0.1.0] — March 2026

### Initial V1 Build
- Event creation with title, description, capacity, deadline, and custom questions
- Shareable attendee registration form (`/[eventSlug]`)
- Automatic waitlist when event reaches capacity
- Waitlist promotion and notification when capacity increases
- Organizer dashboard with event management
- Registration number generation per event
- Event archiving and status management
- Auth: Google OAuth and email/password via NextAuth.js
- Email: Resend integration for slot confirmation and team invites
- Team members: invite co-organizers by email
- Attendee feedback forms (Business plan)
- Event analytics and insights tracker
- Admin panel (super admin only)
- Data expiry cron for Free-plan events (30-day retention)
- Feedback request cron for Business-plan events
- Rate limiting via Upstash Redis
- OG image generation for event pages
- Duplicate registration detection
- R2 image upload for event covers and profile photos
- Vercel deployment with `vercel.json` configuration
