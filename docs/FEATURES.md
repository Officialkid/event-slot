# EventSlot — Feature Reference

> Canonical source: `docs/EVENTSLOT_SYSTEM_DOCUMENTATION.md`
> 
> Use this file for supporting feature detail only. The canonical document owns the live feature inventory.

_Last updated: May 18, 2026_

---

## Design System

### Brand Colour Enforcement (Part 3)
**Where:** `app/globals.css`, `tailwind.config.ts`, `app/privacy/page.tsx`, `app/terms/page.tsx`  
**What it does:** Aligns the UI to a strict EventSlot color system by centralizing official palette tokens (backgrounds, text, accent, border, status, leaderboard), exposing semantic Tailwind color names, and replacing legal-page color usage with tokenized classes to reduce ad hoc styling drift.

---

## AI Assistant Intelligence (MD 4)

### Assistant Memory Toggle (Opt-In)
**Where:** `app/api/assistant/memory/route.ts`, `components/assistant/AssistantExperience.tsx`, `prisma/schema.prisma`  
**What it does:** Adds a signed-in memory preference (`OFF` by default) so users explicitly control whether assistant memory is stored. UI exposes Memory ON/OFF, and backend persists preference in `UserMemoryPreference`.

### Rolling User Conversation Memory
**Where:** `lib/assistant-md4.ts`, `prisma/schema.prisma`, `app/api/assistant/message/route.ts`  
**What it does:** When memory is enabled, assistant updates a rolling summary and key facts in `UserMemory` after replies. Memory is used as private context in future sessions to improve continuity.

### Live Owned-Event Insights in Assistant
**Where:** `lib/assistant-md4.ts`, `app/api/assistant/message/route.ts`  
**What it does:** Assistant can use organiser-owned event snapshots (confirmed count, waitlist, fill rate, deadline timing pattern, proactive tips) as conversational context. Context is explicitly limited to the current user's own events.

### Documentation Grounding (RAG-Style Snippets)
**Where:** `lib/assistant-md4.ts`, `app/api/assistant/message/route.ts`, `docs/AI_CONTEXT.md`, `docs/FEATURES.md`, `docs/API.md`  
**What it does:** Retrieves top relevant snippets from internal documentation and injects them into assistant context to reduce hallucinations and improve consistency with product docs.

### Swahili-Aware Assistant Responses
**Where:** `lib/assistant-md4.ts`, `app/api/assistant/message/route.ts`  
**What it does:** Detects Swahili in user input and instructs assistant to respond in Swahili unless the user switches language.

---

## Event Day Access

### Attendee Join Event Button (Phase 6.1)
**Where:** `components/JoinEventButton.tsx`  
**What it does:** Provides attendee-side virtual event access UI with time-window awareness, camera-based QR scanning (via `jsqr`), server verification using `POST /api/events/[id]/verify-entry`, fallback name/email lookup path, and success-state meeting link launch for verified attendees.

### Custom Join Window Start Time
**Where:** `prisma/schema.prisma`, `app/api/events/route.ts`, `app/api/events/[slug]/route.ts`, `app/api/events/[slug]/settings/route.ts`, `app/(organizer)/create/page.tsx`, `app/(organizer)/edit/[slug]/page.tsx`, `app/(organizer)/dashboard/events/[slug]/page.tsx`, `components/JoinEventButton.tsx`  
**What it does:** Lets organisers define exactly when attendee join access should open (`joinOpensAt`). If not set, access defaults to 30 minutes before event start. Both server verification and attendee countdown use the same rule.

### ID-Based Attendee Lookup For Event-Day Fallback
**Where:** `app/api/events/id/[id]/lookup/route.ts`, `app/api/events/[id]/verify-entry/route.ts`  
**What it does:** Adds event-id lookup by attendee name/email for fallback access when QR scan is unavailable, then verifies entry via ticket-based fallback payloads.

### Verify-Entry Explicit lookupTicketId Fallback (Phase 8)
**Where:** `app/api/events/[id]/verify-entry/route.ts`, `components/JoinEventButton.tsx`  
**What it does:** Supports direct fallback verification using `lookupTicketId` (without QR payload), including confirmation checks, timing-window enforcement, virtual-link decryption only on success, and event-day entry logging with fallback reason tags.

### Public Event Page Join Flow Mount
**Where:** `app/[username]/page.tsx`, `components/JoinEventButton.tsx`  
**What it does:** Displays attendee join flow directly on public event pages for virtual events and passes custom open-window data (`joinOpensAt`) so the countdown and access gate are consistent between UI and API checks.

### Organiser Live Entry Tracker (Phase 7.1 + 7.2)
**Where:** `app/api/organizer/events/[id]/entry-log/route.ts`, `components/EntryDashboard.tsx`, `app/(organizer)/dashboard/events/[slug]/page.tsx`  
**What it does:** Adds real-time organiser event-day visibility into successful attendee entries, attendance rate, recent scans, and secure host-link quick access for virtual events.

---

## Security

### Admin Conversations API Resilience
**Where:** `app/api/admin/assistant-sessions/route.ts`, `app/admin/conversations/page.tsx`, `app/admin/AdminSidebar.tsx`  
**What it does:** Prevents admin conversations UI failures when API responses are empty/non-JSON or when the database schema is behind. API now returns structured JSON errors (including migration guidance), and the client parses responses safely to avoid `Unexpected end of JSON input` crashes.

### Admin Comms API Resilience
**Where:** `app/api/admin/comms/route.ts`, `app/admin/comms/page.tsx`  
**What it does:** Adds robust super-admin checks and schema-drift-safe error responses for comms publishing. The page now handles error responses gracefully without client-side JSON parse crashes.

### Resend Provider Readiness Requirement
**Where:** `lib/email.ts`, `app/api/admin/broadcast/route.ts`, `app/api/admin/health/route.ts`  
**What it does:** Email features depend on valid Resend configuration. Production email/broadcast flows require both `RESEND_API_KEY` and verified `RESEND_FROM`. Admin health reports provider configuration status, and broadcast route fails fast with a clear error when sender configuration is missing.

## Documentation Platform

### Official EventSlot Documentation Website
**Where:** `docs-site/`  
**What it does:** Provides a standalone official documentation portal for EventSlot using Next.js 14, Nextra 3, TypeScript, and Tailwind CSS. Ships with MDX-based docs content, built-in full-text search, dark-only branded theme styling, and production-ready deployment support for Vercel.

### Documentation Information Architecture
**Where:** `docs-site/pages/`  
**What it does:** Organizes documentation into professional SaaS-style sections including Getting Started, Platform, API Reference, Integrations, Guides, and Security. Includes operational guides (launch checklist, multi-campus rollout) and API usage documentation for implementation teams.

### Documentation Theme and Design System
**Where:** `docs-site/theme.config.tsx`, `docs-site/styles/globals.css`, `docs-site/tailwind.config.ts`  
**What it does:** Implements EventSlot branded visual language (near-black surfaces with lime accent), custom typography stack (Instrument Serif, DM Sans, JetBrains Mono), and tailored UI treatments for sidebars, navigation, code blocks, tables, links, and content reveal animations.

### Documentation Homepage (Phase 3)
**Where:** `docs-site/pages/index.mdx`  
**What it does:** Provides a structured docs landing page with Nextra card navigation and section-level orientation for Product, Technical, Developer, Guides, Business, and Appendix content.

### Documentation Accuracy Guardrail
**Where:** `docs-site/pages/index.mdx`  
**What it does:** Homepage platform summary now reflects only currently documented implementation details (pre-launch status, Neon/PostgreSQL + Prisma data layer, Paystack payments, NextAuth auth, and Cloud Run deployment) and avoids assumption-based roadmap/location claims.

### Phase 4 Fact-Checked Documentation Rewrite
**Where:** `docs-site/pages/product/*.mdx`, `docs-site/pages/technical/*.mdx`, `docs-site/pages/developer/*.mdx`, `docs-site/pages/guides/*.mdx`, `docs-site/pages/business/*.mdx`, `docs-site/pages/appendix/*.mdx`  
**What it does:** Replaces broad placeholder/assumption-oriented docs with implementation-accurate MDX content grounded in current route handlers, schema, auth, billing, deployment, and operations behavior.

### Technical Appendix Diagrams (Mermaid)
**Where:** `docs-site/pages/appendix/diagrams.mdx`  
**What it does:** Adds mermaid-renderable architecture and flow diagrams for system topology, ER relationships, registration flow, waitlist promotion flow, and CI/CD pipeline flow.

### Expanded API Appendix Reference
**Where:** `docs-site/pages/appendix/api-reference.mdx`  
**What it does:** Documents endpoint groups, auth expectations, request/response examples, webhook notes, and rate-limit header conventions aligned with app/api route structure.

### Centralised Event Permission Helper
**Where:** `lib/permissions.ts`  
**What it does:** `resolveEventGrant(slug, session, token?)` resolves whether the caller is the event owner, a super-admin, an accepted team member, or a valid dashboard-token holder — all in one DB round-trip. Returns an `EventGrant` object; callers decide what level of access their route requires.

### Collaborator (Team Member) Access Expansion
**Where:** `app/api/events/[slug]/close`, `archive`, `capacity`, `duplicates`  
**What it does:** Previously these endpoints were owner-only or token-only. They now accept session-based auth from the event owner, any super-admin, or accepted team members. Core-edit endpoints (settings, rename, edit form, PATCH mutations) remain strictly owner-only.

### Backend Input Validation (Zod)
**Where:** `lib/schemas/` (`event.schema.ts`, `team.schema.ts`, `registration.schema.ts`, `profile.schema.ts`)  
**What it does:** Validates and sanitises all incoming request bodies before they reach business logic. Priority routes covered: event create, event settings, team invite, profile update, password change.

### Distributed Rate Limiting (Upstash Redis)
**Where:** `lib/ratelimit.ts`  
**What it does:** Provides Redis-backed sliding-window rate limiters that persist across Cloud Run instances. Falls back to in-memory if Upstash env vars are absent (for local dev). Limiters: general (20/min), signup (5/hr), login (5/10 min), attendance lookup (5/10 min), AI endpoints (10/min), report downloads (5/min), billing (10/min). Env vars required: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.

### Production Build Hardening
**Where:** `next.config.mjs`  
**What it does:** Explicitly disables browser source maps (`productionBrowserSourceMaps: false`). SWC compiler strips `console.log/warn/debug` in production builds while keeping `console.error` for server-side logging.

### DevTools Detection Deterrent
**Where:** `components/DevToolsDetector.tsx`, `app/layout.tsx`  
**What it does:** Client-side only — shows a warning banner when the browser DevTools panel is detected (via viewport-size delta and debugger timing). Fires once per session; does not restrict any functionality. Added to the root layout as a passive deterrent.

### Confirmed Registrations Export Format Selector (CSV + Word)
**Where:** `app/(organizer)/dashboard/events/[slug]/page.tsx`  
**What it does:** Lets organizers choose export format before download (`CSV` or `Word (.docx)`) from the event dashboard export panel, while preserving existing export permission/unlock behavior.

### Confirmed Registrations Export Format Selector (Word + PDF + CSV)
**Where:** `app/(organizer)/dashboard/events/[slug]/page.tsx`  
**What it does:** Organizer export control now defaults to Word and supports three explicit formats (`Word (.docx)`, `PDF`, `CSV`) so users can choose preferred distribution format directly from the dashboard.

### Confirmed Registrations Word Document Export
**Where:** `app/api/events/[slug]/export/route.ts`  
**What it does:** Extends registrations export endpoint with Word output (`format=word`) that generates a document containing a branded attendee table, registration summary line, registration-day formatting, and a data-protection notice.

### Confirmed Registrations PDF Export
**Where:** `app/api/events/[slug]/export/route.ts`  
**What it does:** Adds server-generated PDF attendee export (`format=pdf`) with table-based confirmed attendee rows, export timestamp, and privacy/data-protection notice aligned to the Word export content.

### Word/PDF Export Timestamp Precision
**Where:** `app/api/events/[slug]/export/route.ts`  
**What it does:** Attendee documents now include both date and time of export (`as of <date/time> EAT`) to make report generation time auditable for organizer workflows.

### Super Admin Assistant Feedback Dashboard
**Where:** `app/admin/feedback/page.tsx`  
**What it does:** Provides a dedicated super-admin analytics view for assistant feedback, including average rating, total submissions, per-star distribution bars, and recent user comments submitted from assistant quota-limit prompts.

### Assistant Model Selection Architecture (Review-Only)
**Where:** Planning notes (no runtime implementation yet)  
**What it does:** Documents future model-selection approach for assistant responses, including default Groq model routing, candidate selectable models, and decision gates (user eligibility, credit pricing, and Hugging Face reliability hold).

---

## PWA & Mobile App

### Android TWA / Google Play Store Packaging
**Where:** `public/.well-known/assetlinks.json`, `twa/twa-manifest.json`, `next.config.mjs`  
**What it does:** Enables packaging EventSlot as a native Android APK via a Trusted Web Activity (TWA). The Digital Asset Links file verifies domain ownership to Android — without it, the app shows a browser bar. The `twa-manifest.json` is a pre-filled Bubblewrap config (package: `com.alphatech.eventslot`) that bypasses the interactive wizard.  
**To build APK:** Install JDK 8+, Android SDK → `mkdir eventslot-android && cd eventslot-android` → copy `twa/twa-manifest.json` into it → `bubblewrap build`.  
**Fingerprint:** After generating `eventslot-release.keystore`, run `keytool -list -v -keystore eventslot-release.keystore -alias eventslot`, copy the SHA256 fingerprint, and replace the placeholder in `public/.well-known/assetlinks.json`.

### Progressive Web App (Google Play Store Ready)
**Where:** `public/manifest.json`, `public/offline.html`, `public/icons/`, `app/layout.tsx`, `scripts/generate-icons.js`  
**What it does:** Makes EventSlot a fully compliant PWA — installable on Android/iOS, packagable via PWABuilder/Bubblewrap for Google Play. Includes full Web App Manifest (8-size icon set, `start_url: /dashboard`, `display: standalone`), Apple Web App meta tags, offline fallback page, and service worker via `@ducanh2912/next-pwa`.  
**Icon generation:** Run `node scripts/generate-icons.js` after replacing `public/icons/icon-source.png` with the final 512×512 logo.

---

## Deployment & Infrastructure

### Google Cloud Run Deployment
**Where:** `cloudbuild.yaml`, `scripts/deploy-gcp.ps1`  
**What it does:** Builds and pushes the production container to Artifact Registry, then deploys the app to Cloud Run. Supports parameterized service name, region, and repository.  
**Target:** Cloud Run (`managed`)  
**Image source:** `Dockerfile`

### Runtime Upgrade (Next.js 16)
**Where:** `package.json`, app route handlers/pages  
**What it does:** Upgrades the app runtime from Next.js 14 to Next.js 16, including async App Router request API compatibility (`params`/`searchParams`) and compatible lint/build tooling.

### Dependency Security Hardening
**Where:** `package.json` (`overrides`)  
**What it does:** Forces secure transitive versions for vulnerable packages (`cookie`, `got`, `serialize-javascript`) to keep high-severity audit findings at zero.

---

## AI Provider Stack

### Unified AI Router
**Where:** `lib/ai.ts`  
**What it does:** Centralizes all LLM calls behind `askAI(...)` with task-based routing and provider fallback chains. Failures are logged to Prisma `ErrorLog` using route tags like `AI-qa`, `AI-insights`, and `AI-report`.

### Groq Primary + OpenRouter Fallback
**Where:** `lib/groq.ts`, `lib/openrouter.ts`  
**What it does:** Uses Groq as the primary provider for non-report tasks (`insights`, `qa`, `capacity`, `tracker`) and falls back to OpenRouter when needed. Tasks use model mappings optimized for speed/cost profile.

### Report Generation Priority
**Where:** `lib/generateAIReportContent.ts`, `lib/ai.ts`  
**What it does:** Report sections use `taskType: 'report'` with Claude as primary provider, then Groq, then OpenRouter fallback. If all providers fail, section-level fallback text is returned so report generation still completes.

### AI Callsite Migrations
**Where:** `app/api/events/[slug]/ask/route.ts`, `app/api/events/predict-capacity/route.ts`, `lib/generateInsightCards.ts`, `app/api/insights/route.ts`  
**What it does:** Replaced direct Claude calls with task-routed `askAI` calls and added null-response handling for resilient API output.

### Assistant Intelligence Upgrade (MD 3) — Phase 1 Data Foundation
**Where:** `prisma/schema.prisma` (`ChatQuota`, `AssistantFeedback`, `AssistantSession.imageCount`)  
**What it does:** Adds persistent assistant usage and feedback primitives for the upgraded assistant experience. `ChatQuota` enables rolling-window credit accounting by identifier (logged-in user or IP hash), `AssistantFeedback` stores daily anonymous 1-5 star feedback with optional comments after limit-hit flows, and `imageCount` on assistant sessions tracks image uploads for multi-credit usage logic.

### Assistant Intelligence Upgrade (MD 3) — Phase 2.1 Quota Service
**Where:** `lib/chat-quota.ts`  
**What it does:** Adds the server-side rolling 5-hour quota engine for assistant usage. Applies 20-credit window policy, charges 1 credit for text and 3 credits per image, enforces exact reset timing by window start, supports status checks without consumption, and bypasses quota enforcement for super-admin identities.

### Assistant Intelligence Upgrade (MD 3) — Phase 4.1 Message API Image Support
**Where:** `app/api/assistant/message/route.ts`  
**What it does:** Extends assistant messaging to accept multipart submissions with optional screenshots/images, validates image type and max 4MB size, supports up to 3 images per message, routes image requests to a vision-capable Groq model, and applies rolling quota credits (1 text + 3 per image) with reset-time responses and daily feedback-trigger flags on quota exhaustion.

### Assistant Intelligence Upgrade (MD 3) — Phase 4.2 Upload Pre-Validation API
**Where:** `app/api/assistant/upload/route.ts`  
**What it does:** Adds a dedicated assistant upload validation endpoint that checks image MIME type and per-file max size before sending messages, returning deterministic validation errors for unsupported formats and oversized files.

### Assistant Intelligence Upgrade (MD 3) — Phase 5.1 Feedback Submit API
**Where:** `app/api/assistant/feedback/route.ts`  
**What it does:** Adds a dedicated endpoint for assistant rating submission (1-5 stars) with optional comments (max 200 chars), supports anonymous identifiers for logged-out users via hashed IP, and enforces one feedback submission per user/identifier per day.

### Assistant Intelligence Upgrade (MD 3) — Phase 5.2 Admin Feedback Analytics
**Where:** `app/api/admin/feedback/route.ts`  
**What it does:** Extends the admin feedback API with assistant feedback analytics including total responses, average rating, star distribution, and recent comment stream, while preserving existing organizer feedback list and pagination payloads.

### Assistant Intelligence Upgrade (MD 3) — Phase 6 Frontend Widget
**Where:** `components/AssistantWidget.tsx`  
**What it does:** Upgrades the assistant launcher into a full interactive support widget with channel selection (text/voice), screenshot upload previews, multipart image message sending, credit/quota awareness, quota lock messaging, session lifecycle controls, voice transcription flow integration, and in-widget rating prompt submission.

### Assistant Intelligence Upgrade (MD 3) — Shared Assistant Experience
**Where:** `components/assistant/AssistantExperience.tsx`, `components/AssistantWidget.tsx`, `app/(organizer)/dashboard/assistant/page.tsx`  
**What it does:** Unifies assistant behavior across popup widget and dedicated dashboard assistant page by using one shared UI/interaction component for session start, image attachments, quota handling, feedback prompts, and voice flow.

### Assistant E2E UI Regression Coverage
**Where:** `e2e/assistant-widget.spec.ts`  
**What it does:** Adds browser-level UI checks (with mocked assistant API responses) for screenshot attachment previews, quota-exceeded state rendering, and feedback prompt submission.

### Dashboard Mobile Navigation Balance Refresh
**Where:** `app/(organizer)/dashboard/_shell.tsx`  
**What it does:** Updates the dashboard mobile bottom tab bar to a full-width, evenly balanced navigation style aligned with organizer mobile navigation patterns, improving visual symmetry and tap consistency.

### Assistant Launcher Route-Aware Rendering
**Where:** `components/AssistantWidget.tsx`  
**What it does:** Hides the floating assistant launcher on dashboard routes where assistant access is already available through dashboard navigation, preventing overlap with the mobile tab bar.

### Assistant Mobile Viewport Fit
**Where:** `app/(organizer)/dashboard/assistant/page.tsx`  
**What it does:** Adjusts assistant page viewport sizing on mobile to reduce clipping and improve responsive layout behavior when combined with sticky header and bottom navigation.

### CI Deploy Metadata Push Conflict Guard
**Where:** `.github/workflows/deploy.yml`  
**What it does:** Replaces rebase-based docs metadata retries with a regenerate-on-latest strategy, reducing merge conflict failures when concurrent commits update `docs/EVENTSLOT_SYSTEM_DOCUMENTATION.md`.

---

## Access Model

### Simplified Organizer Dashboard Workspace
**Where:** `/dashboard` (`app/(organizer)/dashboard/page.tsx`)  
**What it does:** Keeps the dashboard focused on operational event management (stats, attention items, upcoming events, recent activity, create-event action) and removes sales/upgrade discovery UI from the overview page.

### Open Access Features
**Where:** Core organizer and attendee product surfaces (`/dashboard`, event dashboard tabs, team, insights, analytics, feedback) and related APIs  
**What it does:** All core features are **Free — no restrictions**. Feature access checks that previously returned upgrade-required responses were removed from primary organizer flows.

### Pricing Page Hidden
**Where:** `/pricing` (`app/pricing/page.tsx`)  
**What it does:** Public pricing page is intentionally hidden (returns 404/not-found) to avoid exposing deprecated subscription-tier content.

### Subscription Plans Disabled
**Where:** `POST /api/billing/checkout`, `POST /api/billing/webhook`, admin user plan controls  
**What it does:** Pro/Business subscriptions are disabled. Accounts are normalized to `free`, and paid access is handled only through report-download bundles.

### Report Download Pricing
**Where:** `lib/plans.ts`, `/dashboard/billing`  
**What it does:** Report downloads are the only paid action. Packages are exposed through `REPORT_DOWNLOAD_PRICING` and displayed on the billing/downloads page.

### Free Report Preview + Paid Word Download
**Where:** `GET /api/events/[slug]/report`, `/dashboard/events/[slug]` overview  
**What it does:** Organizers can generate and read AI report content in the browser for free using `mode=preview`. Downloading a DOCX file uses `mode=download` and consumes one paid report download from the organizer balance.

### Report Download Wallet + Transactions
**Where:** `prisma/schema.prisma` (`ReportDownload`, `ReportDownloadTransaction`), `POST /api/billing/report-downloads`, `GET /api/billing/verify`  
**What it does:** Tracks purchased report download bundles and remaining download count per user. Purchases are recorded per unique payment reference and balances are incremented after payment verification.

### Dedicated Report Download Payment Endpoints
**Where:** `POST /api/report-downloads/purchase`, `GET /api/report-downloads/verify`  
**What it does:** Provides a report-specific purchase and verification flow that initializes Paystack transactions for report bundles and credits report download balances after successful verification.

### Report Download Modal
**Where:** `components/ReportDownloadModal.tsx`, `/dashboard/events/[slug]`  
**What it does:** Shows report download bundle choices in a focused payment modal and redirects users to Paystack checkout for the selected package.

### Team Member Safety Limit
**Where:** `lib/plans.ts`, `POST /api/team/invite`  
**What it does:** Team collaboration is open-access with a fixed anti-abuse cap of `10` team members per workspace.

## Feature Availability

### Core Product Features
**Where:** Event creation, registration, waitlist, analytics, insights, tracker, feedback, exports, team, duplicate, predictive capacity  
**What it does:** All core product capabilities are available as **Free — no restrictions**.

### Paid Action Scope
**Where:** Report download purchase/verify flow and report DOCX download action  
**What it does:** Payment applies only when downloading report files. Report generation and in-browser preview remain free.

---

## Registration System

### Event Creation
**Where:** /create  
**Who:** Any signed-in organizer (username required)  
**What it does:** Two-step flow — organizer picks a template first (6 options:
Community Meetup, Corporate Training, Workshop, Conference, Church/Faith,
Blank), which pre-fills the question set. Then fills title, description,
capacity, deadline, event date, location, community link, cover image,
and custom form questions. Capacity suggestion shown on first focus if
organizer has 3+ completed past events.  
**Organizer fields:** Organizer name is required; organizer email is optional.  
**Custom questions:** Option-based questions now support both Multiple Choice and Checkboxes, with explicit option-by-option entry and a setting to allow single-select or multi-select for checkbox questions.  
**API:** POST /api/events

### Event QR Code Export
**Where:** Organizer event dashboard (`/dashboard/events/[slug]`), create success state (`/create`), QR API (`/api/events/[slug]/qr`)  
**Who:** Organizers  
**What it does:** Generates a unique QR code for each event registration URL. Organizers can preview the QR in-app and download a high-resolution PNG (`1024x1024`) for posters, flyers, and social media creatives.  
**API:** GET /api/events/[slug]/qr

### Resilient Event Poster Rendering
**Where:** Public event invitation card (`components/events/EventInvitationCard.tsx`), public organizer event cards (`/app/[username]/page.tsx`), organizer event detail cover (`/dashboard/events/[slug]`)  
**Who:** Attendees and organizers  
**What it does:** Ensures event posters render reliably with graceful fallback UI when image URLs are missing, malformed, expired, or inaccessible. Prevents broken-image icons and keeps page layout intact by using a reusable fallback image component with single-fire error handling (no repeated error loops). Also improves title readability over poster backgrounds with stronger contrast treatment and reduces hydration mismatch risk on event date text.  
**Infra note:** `next.config.mjs` includes Cloudflare R2 support in `images.remotePatterns` via wildcard `*.r2.dev`, explicit production host allowlisting, and dynamic `R2_PUBLIC_URL` hostname; CSP `img-src` and `connect-src` also include matching R2 origins.

### Consultant-Grade AI Event Reports
**Where:** `GET /api/events/[slug]/report?mode=preview|download`, organizer event dashboard report card (`/dashboard/events/[slug]`), report generation logic in `lib/generateAIReportContent.ts` and Word rendering in `lib/generateEventReport.ts`  
**Who:** Organizers and super admins  
**What it does:** Generates structured consultant-style event analysis using Claude with strategic sections including event overview, strengths, weaknesses/risks, audience profile, registration behavior, competitive positioning, waitlist analysis, actionable recommendations, and overall score. The same content is embedded in downloadable Word reports. Includes deterministic data-driven fallback sections when AI providers are unavailable.

### Super Admin Free Report Download
**Where:** `app/api/events/[slug]/report/route.ts`, organizer event dashboard report controls  
**Who:** Super admins  
**What it does:** Bypasses paid report-download gating for super admins server-side. Super admins can preview and download Word reports without consuming download bundles, while non-admin organizers retain standard payment-gated download behavior.

### Super Admin Report by Link
**Where:** Admin overview page (`/admin`), `app/api/admin/generate-report/route.ts`  
**Who:** Super admins  
**What it does:** Enables report generation by pasting a full EventSlot registration URL or raw slug. The system resolves the event, validates it is active/published, generates AI report content, and provides one-click Word download. Designed for sales demos and customer pitching workflows.

### Countdown Timer
**Where:** /[eventSlug] registration page and /dashboard/events/[slug] organizer event header  
**Who:** Attendees and organizers  
**What it does:** Shows a live days/hours/minutes/seconds countdown to registration deadline. On attendee registration, the timer updates every second, changes color as urgency increases, and disables submission when the deadline is reached. On organizer dashboard, it is shown in calm mode for quick deadline visibility.

### Confirm My Attendance (Self-Lookup)
**Where:** /[eventSlug] — "Already Registered?" panel beside the registration form  
**Who:** Anyone (no account needed)  
**What it does:** Attendees enter their email to look up their registration for the event. On confirmed match, shows an inline `ConfirmationTicket` card with a PDF download button. If waitlisted, shows their position. If not found, shows an error message.  
**API:** POST /api/attendance/confirm  
**Rate limit:** 5 lookups per IP per 10 minutes (Upstash Redis)

### Confirmation Ticket Card
**Where:** /register/success/[confirmationCode] (post-registration redirect) and inline in the self-lookup panel  
**Who:** Anyone with the confirmation code link (no account needed)  
**What it does:** Shows a styled ticket card with event details, attendee info, and a QR code. QR encodes `/verify/[confirmationCode]` for door check-in scanning. Supports one-click PDF download via html2canvas + jspdf.  
**Component:** `components/tickets/ConfirmationTicket.tsx`

### Attendee Registration
**Where:** /[eventSlug]  
**Who:** Anyone with the link (no account needed)  
**What it does:** Shows event details and a dynamic form built from the
organizer's custom questions. On submit, assigns confirmed or waitlist
status based on current capacity. Supports bulk registration. Event views
tracked automatically. Duplicate detection flags re-registrations from
the same email.  
**API:** POST /api/register  
**Rate limit:** 10 requests per IP per minute (Upstash Redis)

### Waitlist Promotion
**Where:** Organizer dashboard → Overview tab → Increase capacity  
**Who:** Organizer or team member  
**What it does:** When capacity is increased, the system automatically
promotes waitlisted registrations in FIFO order. Promoted attendees
receive an email notification if they consented to transactional emails.  
**API:** PATCH /api/events/[slug]/capacity

### Organizer Ticket Verification (Check-in)
**Where:** /dashboard/events/[slug] → Check-in tab  
**Who:** Organizer or authorized team member  
**What it does:** Verifies attendee tickets at entry by accepting a ticket code, QR-scan payload, attendee email, or attendee name. The flow blocks duplicate verification by enforcing one-time check-in and returning the existing check-in timestamp if already used. Ambiguous identity searches return a conflict response so staff can refine the lookup before check-in.  
**API:** POST /api/events/[slug]/verify-ticket

### Registration Status Page
**Where:** /registration/[registrationId]  
**Who:** Attendee (link provided after registration)  
**What it does:** Shows confirmed status or waitlist position. Editable
draft mode supported.  
**API:** GET /api/registrations/[registrationId], PATCH /api/registrations/[registrationId]

### Bulk Registration
**Where:** /[eventSlug]  
**What it does:** Attendee can add multiple people in one form submission.
Each gets their own registration record.  
**Limits:** Free: 3, Pro: 20, Business: unlimited

---

## Organizer Dashboard

### Admin Overview (Signup Priority)
**Where:** /admin  
**Who:** Super admin (`SUPER_ADMIN_EMAIL`)  
**What it does:** Surfaces signup momentum first with prominent `Total Signups` and `New Signups This Week` cards, followed by supporting platform stats. Weekly signups are computed from Monday 00:00 server time. Plan breakdown is de-emphasized and only displayed when Pro/Business plans are present.
**API:** GET /api/admin/stats

### Stakeholder Report Generator (Word Export)
**Where:** /admin (overview), `lib/generateStakeholderReport.ts`  
**Who:** Super admins (`SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_EMAIL_2`)  
**What it does:** Generates a downloadable Word report for stakeholder meetings with platform overview, period comparison, top events, system health summary, challenge highlights from error logs, plan mix, and AI-generated recommendations. Supports weekly, monthly, and yearly report windows.
**API:** GET /api/admin/stakeholder-report?period=weekly|monthly|yearly

### Admin Broadcast Delivery Reporting
**Where:** /admin/broadcast  
**Who:** Super admin (`SUPER_ADMIN_EMAIL`)  
**What it does:** Sends platform-wide broadcasts by plan segment and reports provider-accepted vs failed recipients (instead of showing all attempts as sent). Requires verified sender configuration via `RESEND_FROM`.
**API:** POST /api/admin/broadcast, GET /api/admin/broadcast/count

### Platform Health Email Signal
**Where:** /admin/health  
**Who:** Super admin (`SUPER_ADMIN_EMAIL`)  
**What it does:** Displays database health, recent API errors, and provider-derived monthly accepted email count where available. Includes provider readiness state via `emailProviderConfigured`.
**API:** GET /api/admin/health

### Interactive Onboarding Tutorial
**Where:** Organizer dashboard shell (`/dashboard` and nested routes), profile settings restart control  
**Who:** Newly created users who have not skipped or completed onboarding  
**What it does:** Automatically launches a guided, multi-step dashboard tutorial with spotlighted UI targets, progress tracking, skip/complete controls, and contextual action routing. Tutorial progress is persisted per user and can be restarted from profile or from the dashboard help (`?`) button.  
**Data model:** `UserOnboarding`  
**API:** `GET /api/onboarding`, `PATCH /api/onboarding`

### Onboarding Tour Selector + One-Time Trigger Control
**Where:** Dashboard sidebar (`◎ Take a tour`), `components/OnboardingTourSelector.tsx`, `hooks/useTutorial.ts`  
**Who:** Organizers  
**What it does:** Prevents automatic tour replay after completion/skip and adds a section selector so users can run tours for specific areas only (dashboard, create flow, registration, event management, analytics, reports, team). Includes select-all/clear controls and validation when no section is selected.  
**Data model:** `User.onboardingCompleted`, `User.onboardingSkipped` (with backward compatibility to `UserOnboarding`)  
**API:** `GET /api/user/onboarding`, `PATCH /api/user/onboarding`

### Dashboard Home
**Where:** /dashboard  
**What it does:** Stat cards (total events, registrations, active events,
waitlist count) with monthly delta indicators. Needs Attention section
(events near capacity or approaching deadline — filtered to active events
only). Recent activity feed. Upcoming events list. Plan badge with
upgrade CTA. Quick actions grid.

### My Events
**Where:** /dashboard/events  
**Tabs:** Active | Past | Archived  
**Three-dot menu per event:** Rename, Duplicate (Pro+), Archive, Delete

### Individual Event Dashboard
**Where:** /dashboard/events/[slug]  
**Tabs:**
- **Overview** — Stats, capacity management, Export CSV panel
- **Confirmed** — Table of confirmed registrations with answers
- **Waitlist** — Table with position numbers
- **Analytics** — Charts, insight cards, Q&A (plan/credits gated)
- **Settings** — Edit event description, date, location, deadline
- **Feedback** — Attendee feedback inbox (Business plan only)

**Header tools:** Includes registration link copy/share actions plus a QR Code action that opens a modal preview and supports high-res PNG download.

### Notifications
**Where:** /dashboard/notifications  
**Triggers:**
- Event reaches 80% capacity → notification created
- Event reaches 100% capacity → notification created
- Waitlist attendees promoted → notification created
- Payment failure → notification created
- Data expiry warning (10 days before Free plan deletion)
- Organizer feedback request appears after event ends

### Platform Notification Broadcasts (In-App)
**Where:** `POST /api/admin/notify-all`, /dashboard/notifications  
**Who:** Super admin sends; all signed-up users receive  
**What it does:** Creates mandatory in-app announcements for every user, independent of marketing email consent. Platform broadcasts are stored as `NotificationType.PLATFORM` and displayed with a dedicated “Platform Update” badge in the notifications center.

### Two-Way Communications Hub
**Where:** `app/(organizer)/dashboard/feedback`, `app/comms`, `app/admin/comms`, `app/api/comms`, `app/api/admin/comms`  
**Who:** Signed-in users submit feedback; super admins publish public announcements  
**What it does:** Turns the legacy feedback page into a comms board with public announcements, private feedback submission, and user submission history. Admin announcements are shown publicly on the comms board and also pushed as platform notifications.

### Weekly Digest Highlights
**Where:** `app/api/cron/weekly-digest/route.ts`  
**Who:** Weekly cron email to super admin  
**What it does:** Adds a "what shipped this week" section to the digest by including recent public announcements alongside the weekly metrics summary.

### Build-safe Privileged Account Seeding
**Where:** app/layout.tsx, lib/seedAdmins.ts  
**What it does:** Privileged-account seeding is now skipped during CI and production build phase to prevent build-time database connection failures while preserving runtime seeding behavior in non-build execution paths.

### Profile
**Where:** /dashboard/profile  
**Features:** Edit name, profile photo (uploaded to Cloudflare R2),
change password (email/password users only), delete account

### Billing
**Where:** /dashboard/billing  
**Features:**
- Current plan card (badge, billing cycle, renewal date, cancel subscription button)
- Live credits balance from /api/billing/status
- Buy credits: 3 bundles (100 credits / 500 credits / 1,000 credits)
- Collapsible PAYG pricing reference table
- Upgrade section with monthly/annual toggle (hidden for Business users)
- Credit transaction history (last 20 with running balance)
**Provider:** Paystack

### Team Members
**Where:** /dashboard/team  
**Features:** Invite by email (token link sent via Resend), accept at
/team/accept, resend invite, remove members  
**Limits:** Free: 1, Pro: 10, Business: 20

### Insights Tracker
**Where:** /dashboard/insights  
**Tier:** Business only  
**What it does:** Cross-event audience analytics. Aggregates form answers
across all events to surface demographic patterns, peak registration days,
repeat attendees, and location trends.  
**API:** GET /api/insights

---

## AI Features

### AI Event Report
**Tier:** Pro/Business (included), Free (standard Word report free, 50 credits AI version)  
**Where:** /dashboard/events/[slug] → Download Report  
**What it does:** Generates a Word document (.docx). Standard report
contains attendee data tables. AI version adds Claude-written narrative:
executive summary, audience profile, registration behaviour, waitlist
analysis, recommendations.  
**API:** GET /api/events/[slug]/report

### AI Insight Cards
**Tier:** Pro/Business (included), or 20 credits  
**Where:** /dashboard/events/[slug] → Analytics tab  
**What it does:** Generates 3 personalised insight cards using Claude and
actual event data. Cached per event. Can be regenerated.  
**API:** GET /api/events/[slug]/insights

### Natural Language Q&A
**Tier:** Business (included), or 60 credits per query  
**Where:** /dashboard/events/[slug] → Analytics tab  
**What it does:** Chat interface for asking questions about event data.
Claude answers using real registration and analytics data.  
**API:** POST /api/events/[slug]/ask

### Intelligent Capacity Suggestions
**Tier:** All plans (requires 3+ completed past events)  
**Where:** /create → capacity field (on first focus)  
**What it does:** Analyses last 5 completed events, calculates average
confirmed count × 1.2 buffer, returns suggested capacity with message
adapted to fill rate (≥85%, 50–84%, <50%).  
**API:** GET /api/events/suggest-capacity

---

## Post-Event Features

### Feedback Form
**Tier:** Business plan events only  
**Where:** /feedback/[registrationId]  
**Trigger:** Auto-sent via cron to consenting confirmed attendees  
**What it does:** Star rating plus three open text fields (enjoyed, improve,
complaint). Responses visible in Organizer Dashboard Feedback tab.  
**API:** POST /api/feedback, GET /api/events/[slug]/feedback

### Event Report Download
**Tier:** All plans (Standard Word doc free on all plans),
Pro/Business included for AI report  
**Format:** Word document (.docx). Cover page, summary stats, confirmed
table, waitlist table, AI narrative (if AI version unlocked).  
**API:** GET /api/events/[slug]/report

### CSV Export
**Tier:** Pro/Business (included), Free (15 credits base + per 100
registrations)  
**Where:** /dashboard/events/[slug] → Overview tab  
**Format:** UTF-8 BOM CSV with dynamic question headers, Status,
Registered At columns  
**API:** GET /api/events/[slug]/export

---

## Payments

### Subscriptions
**Provider:** Paystack (recurring subscription)  
**Plans:** Pro monthly (KSH 2,600), Pro annual (KSH 25,000),
Business monthly (KSH 13,000), Business annual (KSH 125,000)  
**Webhook events handled:** subscription.create, charge.success,
invoice.payment_failed, subscription.disable, subscription.not_renew  
**API:** POST /api/billing/checkout, POST /api/billing/webhook,
POST /api/billing/cancel

### Credits (Pay As You Go)
**Provider:** Paystack (one-time payment)  
**Bundles:** 100 credits = KSH 1,000 | 500 credits = KSH 4,500 |
1,000 credits = KSH 8,000  
**Credit Costs:**
- Standard report: Free
- AI-enhanced report: 50 credits
- Event analytics: 10 credits
- AI insight cards: 20 credits
- Analytics Q&A: 60 credits per query
- CSV export: 15 credits base + (confirmedCount / 100) × cost
- Remove watermark: 10 credits
- Custom thank you: 10 credits
- Duplicate event: 5 credits
- Team members: 10 credits per member/month
- Insight Tracker: 50 credits
- Feedback forms: 30 credits
- Predictive capacity: 25 credits  
**API:** POST /api/billing/credits, POST /api/billing/verify

### Feature Unlock (EventUnlock)
**What it does:** Spending credits creates an EventUnlock record for a
specific feature + event combination. Valid 30 days.  
**Features:** analytics, watermark, csv, report, ai_report, thankYou  
**API:** POST /api/billing/unlock

---

## Auth & Accounts

### Google OAuth
**Provider:** NextAuth.js + Google OAuth  
**Flow:** Sign in → account linked or created → username setup (if new)
→ redirect to /dashboard

### Email/Password
**Flow:** /signup → bcrypt 12 rounds → /signin  
**Forgot password:** /forgot-password → SHA-256 hashed UUID token (1h
expiry) → email link → /reset-password → new bcrypt hash stored

### Username Setup
**Where:** /setup-username (required before accessing dashboard)  
**Rules:** 3–20 chars, alphanumeric + hyphens, reserved words blocked  
**API:** PATCH /api/users/username, GET /api/users/check-username

---

## Public Pages

### Organizer Public Profile
**Where:** /[username]  
**What it does:** Server-rendered profile showing organizer's upcoming
active events with slot-fill progress bars and Register CTAs. SEO
metadata generated. Follow button present (disabled, coming soon).

### Landing Page
**Where:** /  
**Contents:** Hero section, features grid, testimonials, pricing CTA, footer.
PWA splash header shown on /signin in standalone mode.

### Pricing Page
**Where:** /pricing  
**Contents:** Plan cards, monthly/annual toggle, feature comparison table,
credit bundle cards, FAQ accordion.

---

## PWA

**Manifest:** /public/manifest.json  
**Start URL:** /signin  
**Theme:** Dark (#0A0A0A)  
**Purpose:** Quick dashboard access on mobile  
**Supported:** Android Chrome (Add to Home Screen), iOS Safari

---

## Super Admin Panel

**Access:** /admin (returns 404 to all non-admin users)  
**Auth:** SUPER_ADMIN_EMAIL env var match required  
**Pages:**
- /admin → Platform overview stats
- /admin/users → All users, plan management, suspend/delete
- /admin/events → All platform events with action controls
- /admin/messages → Organizer feedback inbox
- /admin/health → System health (DB, Redis, Auth status)
- /admin/broadcast → Email broadcast to all platform users
- /admin/launch → Launch checklist (env vars, DB, Redis, admin)

---

## Cron Jobs

| Endpoint                 | Schedule  | Auth        | Action                                    |
|--------------------------|-----------|-------------|-------------------------------------------|
| /api/cron/send-feedback  | 9AM daily | CRON_SECRET | Send feedback emails for ended events     |
| /api/cron/expire-data    | 2AM daily | CRON_SECRET | Delete Free plan registrations after 30d  |

---

## Email Templates (Resend)

All emails use dark-themed HTML with lime CTA buttons:
- **Welcome email** — sent after new account signup
- **Password reset** — token link, 1-hour expiry, SHA-256 secured
- **Slot confirmed** — sent when attendee is registered as confirmed
- **Waitlist notification** — sent when attendee is promoted from waitlist
- **Team invite** — invite link with acceptance token
- **Feedback request** — post-event link to /feedback/[registrationId]
- **Data expiry warning** — Free plan deletion notice (10-day heads up)
- **Payment failure** — subscription charge failed notification

---

## Feature Access Matrix

| Feature | Availability |
|---------|--------------|
| Event creation and management | Free — no restrictions |
| Registrations and waitlist automation | Free — no restrictions |
| Analytics and insight tracker | Free — no restrictions |
| AI insight cards and Q&A | Free — no restrictions |
| CSV export and duplicate event | Free — no restrictions |
| Team collaboration | Free — up to `TEAM_MEMBER_LIMIT` per workspace |
| Report generation and browser preview | Free — no restrictions |
| Report file download (DOCX) | Paid bundles only |

---

## Deprecated / Removed

### Legacy Plan-Gated Pricing Surfaces
**Where:** `/pricing`, legacy plan-tier and credit-unlock references in old docs and routes  
**Current status:** Replaced by open-access core product model. Only report-file download remains paid via bundle purchase.

---

## API Endpoints

| Method | Path | Auth | Plan | Description |
|--------|------|------|------|-------------|
| POST | `/api/auth/signup` | No | Any | Email/password user signup |
| GET, POST | `/api/auth/[...nextauth]` | No | Any | NextAuth authentication (Google OAuth, credentials) |
| GET | `/api/me` | Yes | Any | Get current user profile + credit balance |
| GET, PATCH | `/api/profile` | Yes | Any | Get/update user profile |
| POST | `/api/profile/photo` | Yes | Any | Upload profile photo |
| PATCH | `/api/profile/password` | Yes | Any | Update password |
| POST | `/api/events` | Yes | Any | Create a new event |
| GET | `/api/events` | Yes | Any | List organizer's events |
| GET | `/api/events/[slug]` | Yes | Any | Get event details |
| PATCH | `/api/events/[slug]` | Yes | Any | Update event details |
| PATCH | `/api/events/[slug]/settings` | Yes | Any | Update event settings |
| PATCH | `/api/events/[slug]/archive` | Yes | Any | Archive an event |
| PATCH | `/api/events/[slug]/close` | Yes | Any | Close/cancel an event |
| PATCH | `/api/events/[slug]/capacity` | Yes | Any | Update capacity (triggers waitlist promotion) |
| PATCH | `/api/events/[slug]/rename` | Yes | Any | Rename event |
| GET | `/api/events/[slug]/report` | Yes | Pro+ / PAYG | Download CSV or Word report |
| GET | `/api/events/[slug]/analytics` | Yes | Pro+ / PAYG | Get event analytics |
| GET | `/api/events/[slug]/feedback` | Yes | Business | Get attendee feedback for event |
| GET | `/api/events/[slug]/edit` | Yes | Any | Get event data for editing |
| GET | `/api/events/[slug]/duplicates` | Yes | Any | List duplicate registrations |
| POST | `/api/events/[slug]/duplicate` | Yes | Pro+ | Duplicate an event |
| POST | `/api/events/[slug]/claim` | No | Any | Claim event ownership with dashboard token |
| POST | `/api/register` | No | Any | Register attendee for an event |
| GET | `/api/registrations/[registrationId]` | No | Any | Get registration details |
| GET | `/api/my-events` | Yes | Any | Get organizer's events (with status filters) |
| GET | `/api/dashboard/stats` | Yes | Any | Get dashboard statistics |
| GET | `/api/insights` | Yes | Business | Get cross-event insights |
| GET | `/api/notifications` | Yes | Any | List user notifications |
| PATCH | `/api/notifications/[id]/read` | Yes | Any | Mark single notification as read |
| PATCH | `/api/notifications/read` | Yes | Any | Mark all notifications as read |
| POST | `/api/admin/notify-all` | Yes | Super Admin | Broadcast an in-app platform notification to all users |
| POST | `/api/upload` | Yes | Any | Upload image to R2 object storage |
| POST | `/api/team/invite` | Yes | Pro+ | Send team member invitation email |
| GET | `/api/team/members` | Yes | Pro+ | List team members |
| POST | `/api/team/resend` | Yes | Pro+ | Resend team invitation |
| DELETE | `/api/team/[memberId]` | Yes | Pro+ | Remove team member |
| POST | `/api/billing/checkout` | Yes | Any | Initiate Paystack subscription checkout |
| POST | `/api/billing/credits` | Yes | Any | Initiate credit top-up via Paystack |
| POST | `/api/billing/unlock` | Yes | Any | Unlock a feature for an event using credits |
| POST | `/api/billing/cancel` | Yes | Pro+ | Cancel active subscription |
| GET | `/api/billing/status` | Yes | Any | Get billing status (plan, balance, subscription) |
| GET | `/api/billing/invoices` | Yes | Pro+ | Fetch payment invoices from Paystack |
| GET | `/api/billing/transactions` | Yes | Any | Get credit transaction history (last 20) |
| POST | `/api/billing/portal` | Yes | Pro+ | Get Paystack customer portal URL |
| POST | `/api/billing/webhook` | No (sig) | Any | Paystack webhook (subscription events, payments) |
| POST | `/api/feedback` | No | Any | Submit attendee event feedback |
| POST | `/api/feedback/organizer` | No | Any | Submit organizer platform feedback |
| GET | `/api/cron/send-feedback` | CRON | Business | Send feedback request emails to attendees |
| GET | `/api/cron/expire-data` | CRON | Any | Delete expired registrations; send expiry warnings |
| GET | `/api/og` | No | Any | Generate dynamic OG image for events |
| GET | `/api/admin/health` | Admin | Admin | System health check |
| GET | `/api/admin/events` | Admin | Admin | List all events on the platform |
| GET | `/api/admin/users` | Admin | Admin | List all users |
| PATCH | `/api/admin/users/[id]` | Admin | Admin | Update user (suspend, change plan, etc.) |
| GET | `/api/admin/messages` | Admin | Admin | List all organizer feedback messages |
| GET | `/api/admin/stats` | Admin | Admin | Platform-wide statistics |
| GET | `/api/admin/launch-checklist` | Admin | Admin | Environment/config completeness check |

---

## Database Models

### Event
| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | Primary key |
| title | String | |
| description | String? | |
| slug | String (unique) | URL identifier |
| capacity | Int? | null = unlimited |
| deadline | DateTime? | |
| confirmedCount | Int | default 0 |
| waitlistCount | Int | default 0 |
| organizerEmail | String | |
| dashboardToken | String (unique) | Token for tokenized dashboard access |
| questions | Json | Custom registration questions |
| createdAt | DateTime | |
| organizerId | String? | FK → User |
| eventDate | DateTime? | |
| location | String? | |
| communityLink | String? | |
| imageUrl | String? | |
| archived | Boolean | default false |
| status | String | default "active" |
| feedbackSent | Boolean | default false |
| dataExpired | Boolean | default false |

### User
| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | Primary key |
| name | String? | |
| email | String? (unique) | |
| emailVerified | DateTime? | |
| image | String? | |
| password | String? | Hashed |
| createdAt | DateTime | |
| plan | String | default "free" |
| planStartDate | DateTime? | |
| planEndDate | DateTime? | |
| isAdmin | Boolean | default false |
| billingCycle | String? | "monthly" or "annual" |
| suspended | Boolean | default false |
| paystackCustomerCode | String? (unique) | |
| paystackSubscriptionCode | String? (unique) | |
| creditBalance | Float | default 0 |

### Registration
| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | Primary key |
| eventId | String | FK → Event (cascade delete) |
| answers | Json | Custom question answers |
| status | String | "confirmed" or "waitlist" |
| waitlistPosition | Int? | |
| registrationNumber | Int? | Sequential per event |
| submittedAt | DateTime | |
| notified | Boolean | default false |
| attendeeEmail | String? | |
| consentTransactional | Boolean | default false |
| consentMarketing | Boolean | default false |
| isDuplicate | Boolean | default false |

### CreditTransaction
| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | Primary key |
| userId | String | FK → User (cascade delete) |
| amount | Float | Positive = credit, negative = debit |
| type | String | e.g. "topup", "debit" |
| description | String | Human-readable description |
| eventId | String? | Associated event (optional) |
| createdAt | DateTime | |

### EventUnlock
| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | Primary key |
| eventId | String | FK → Event (cascade delete) |
| userId | String | |
| feature | String | Feature unlocked (e.g. "analytics", "watermark") |
| unlockedAt | DateTime | |

### Notification
| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | Primary key |
| userId | String | FK → User (cascade delete) |
| type | NotificationType | `EVENT` or `PLATFORM` |
| title | String | Notification heading |
| message | String | |
| read | Boolean | default false |
| link | String? | Optional deep link |
| createdAt | DateTime | |

### TeamMember
| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | Primary key |
| ownerId | String | FK → User (organizer, cascade delete) |
| memberId | String? | FK → User (member, set null on delete) |
| email | String | Invited email |
| status | String | default "pending" |
| inviteToken | String (unique) | |
| createdAt | DateTime | |

### Message
| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | Primary key |
| senderName | String? | |
| senderEmail | String? | |
| eventId | String? | |
| eventTitle | String? | |
| type | String | "organizer" or "attendee" |
| rating | Int? | |
| body | String | |
| read | Boolean | default false |
| archived | Boolean | default false |
| createdAt | DateTime | |

### ErrorLog
| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | Primary key |
| route | String | |
| message | String | |
| createdAt | DateTime | |

### EventView
| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | Primary key |
| eventId | String | FK → Event (cascade delete) |
| viewedAt | DateTime | |
| source | String? | Referral source |

### AttendeeFeedback
| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | Primary key |
| eventId | String | FK → Event (cascade delete) |
| registrationId | String (unique) | |
| rating | Int | |
| enjoyed | String? | |
| improve | String? | |
| complaint | String? | |
| submittedAt | DateTime | |

### OrganizerFeedback
| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | Primary key |
| userId | String | |
| eventId | String? | |
| rating | Int | |
| message | String | |
| createdAt | DateTime | |

### Account / Session / VerificationToken
Standard NextAuth.js models for OAuth provider linking, session management, and email verification.

---

## Email Templates

| Trigger | Recipient | Subject | Function | Location |
|---------|-----------|---------|----------|----------|
| Registration confirmed (from waitlist) | Attendee | "Your slot for {eventTitle} is confirmed" | `sendSlotConfirmedEmail()` | `lib/email.ts` |
| Event passed, feedback not yet sent | Confirmed attendees (Business plan) | "How was {eventTitle}? Share your feedback" | `sendFeedbackRequestEmail()` | `lib/email.ts` |
| Team member invited | Invited email address | "{inviterName} invited you to join their EventSlot team" | `sendTeamInviteEmail()` | `lib/email.ts` |

---

## Cron Jobs

| Schedule | Endpoint | Auth | Description |
|----------|----------|------|-------------|
| Daily (via Vercel Cron) | `GET /api/cron/send-feedback` | `Bearer CRON_SECRET` | Finds passed events with `feedbackSent: false`; sends feedback request emails to consenting confirmed attendees on Business-plan events; sets `feedbackSent: true` |
| Daily (via Vercel Cron) | `GET /api/cron/expire-data` | `Bearer CRON_SECRET` | Step 1: deletes registrations + views for Free-plan events 30+ days past deadline, sets `dataExpired: true`. Step 2: sends `data_expiry_warning` notifications for Free-plan events 20-29 days past deadline. |

---

## Pay-As-You-Go Pricing

| Feature | Credit Cost |
|---------|-------------|
| Registration overage (per 100 above free limit) | $1 |
| Remove EventSlot watermark (one event) | $5 |
| CSV export | $2 + $1/100 registrations |
| Word report | $3 + $1/100 registrations |
| Analytics unlock (one event) | $4 |
| Custom thank you page (one event) | $2 |
| Extra active event slot (per month) | $3 |

---

## Pages

| URL | File | Auth | Description |
|-----|------|------|-------------|
| `/` | `app/page.tsx` | No | Landing page |
| `/signin` | `app/(auth)/signin/page.tsx` | No | Sign in |
| `/signup` | `app/(auth)/signup/page.tsx` | No | Sign up |
| `/pricing` | `app/pricing/page.tsx` | No | Public pricing page |
| `/privacy` | `app/privacy/page.tsx` | No | Privacy policy |
| `/terms` | `app/terms/page.tsx` | No | Terms of service |
| `/[eventSlug]` | `app/(attendee)/[eventSlug]/page.tsx` | No | Attendee event registration form |
| `/registration/[registrationId]` | `app/registration/[registrationId]/page.tsx` | No | Registration confirmation |
| `/feedback/[registrationId]` | `app/feedback/[registrationId]/page.tsx` | No | Attendee feedback form |
| `/team/accept` | `app/team/accept/page.tsx` | No | Accept team invitation |
| `/dashboard` | `app/(organizer)/dashboard/page.tsx` | Yes | Organizer dashboard home |
| `/dashboard/[slug]` | `app/(organizer)/dashboard/[slug]/page.tsx` | Yes | Event overview |
| `/dashboard/events` | `app/(organizer)/dashboard/events/page.tsx` | Yes | Events list |
| `/dashboard/events/[slug]` | `app/(organizer)/dashboard/events/[slug]/page.tsx` | Yes | Event registrations detail |
| `/dashboard/billing` | `app/(organizer)/dashboard/billing/page.tsx` | Yes | Billing, credits, plan management |
| `/dashboard/team` | `app/(organizer)/dashboard/team/page.tsx` | Yes | Team member management |
| `/dashboard/insights` | `app/(organizer)/dashboard/insights/page.tsx` | Yes (Business) | Cross-event analytics |
| `/dashboard/notifications` | `app/(organizer)/dashboard/notifications/page.tsx` | Yes | Notification center |
| `/create` | `app/(organizer)/create/page.tsx` | Yes | Create event form |
| `/edit/[slug]` | `app/(organizer)/edit/[slug]/page.tsx` | Yes | Edit event form |
| `/my-events` | `app/(organizer)/my-events/page.tsx` | Yes | Organizer's events overview |
| `/admin` | `app/admin/page.tsx` | Admin | Admin dashboard |
| `/admin/events` | `app/admin/events/page.tsx` | Admin | All platform events |
| `/admin/users` | `app/admin/users/page.tsx` | Admin | User management |
| `/admin/messages` | `app/admin/messages/page.tsx` | Admin | Platform feedback messages |
| `/admin/health` | `app/admin/health/page.tsx` | Admin | System health check |
| `/admin/launch` | `app/admin/launch/page.tsx` | Admin | Launch checklist |
