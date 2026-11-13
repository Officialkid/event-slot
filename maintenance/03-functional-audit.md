# EventSlot Technologies — Full System Maintenance Programme
## Phase 03 — Complete Functional Audit

**Document Version:** 1.0.0  
**Effective Date:** 23 October 2026  
**Audit Team:** Senior QA Engineer, Principal Software Engineer, Product Reliability Engineer & Technical Auditor  
**Target Repository:** `Officialkid/event-slot`  
**Base Branch:** `audit/phase-5-7-concurrency-ci`  
**Current HEAD Commit:** `ff277de`  
**Working Tree Status:** 25 modified files, 14 untracked files (strictly preserved, uncommitted)  
**Deliverable Status:** **PHASE 03 COMPLETED — FUNCTIONAL AUDIT REPORT FILED**

---

## 1. Executive Summary

This document establishes the authoritative **Complete Functional Audit** for EventSlot across all user journeys—attendees, organizers, event gate staff, and system administrators—under Phase 03 of the Full System Maintenance Programme.

### Functional Audit Overview
The audit was conducted strictly as an **evidence-based, read-only code and test investigation**. Zero code edits were performed, zero database mutations were executed, and zero test suites were run against live or shared databases. 

The audit evaluated 10 core functional domains (Areas A through J) by mapping UI components to backend route handlers, Prisma data models, transaction boundaries, and automated test specifications.

```
┌────────────────────────────────────────────────────────────────────────┐
│                   FUNCTIONAL AUDIT DOMAIN EVALUATION                   │
├───────────────────────────────────┬───────────────┬────────────────────┤
│ Functional Domain                 │ Audit Status  │ Overall Health     │
├───────────────────────────────────┼───────────────┼────────────────────┤
│ A. Public Discovery & Event Pages │ AUDITED       │ HEALTHY            │
│ B. Registration & Attendee Flow   │ AUDITED       │ MINOR CONCURRENCY  │
│ C. Ticket Tiers & Paid Payments   │ AUDITED       │ ROBUST (Fail-safe) │
│ D. Waitlists & Capacity Engine    │ AUDITED       │ MIXED (Paid robust)│
│ E. QR Tickets, Scan & Check-in    │ AUDITED       │ HEALTHY (Token bug)│
│ F. Organizer Dashboard & Mgmt     │ AUDITED       │ FEATURE-COMPLETE   │
│ G. Administrative Portals         │ AUDITED       │ HEALTHY            │
│ H. Email, Marketing & Comms       │ AUDITED       │ DEGRADED (DNS gap) │
│ I. ESA — Event Intelligence       │ AUDITED       │ OPERATIONAL        │
│ J. Auth, Navigation & UI Tokens   │ AUDITED       │ MINOR POLISH       │
└───────────────────────────────────┴───────────────┴────────────────────┘
```

### High-Priority Findings Summary
1. **Capacity Locking Asymmetry (P2 — Preventive):** Paid event checkout (`lib/paidEventCheckout.ts`) enforces strict row-level locking via `SELECT ... FOR UPDATE` and retry resilience, whereas free event registration (`app/api/register/route.ts`) relies on optimistic `findUnique` and `increment: 1` without row locks, creating potential oversubscription risks during flash free registrations.
2. **Free Waitlist Promotion Race Condition (P2 — Preventive):** In `lib/freeEventWaitlist.ts`, `prisma.registration.findFirst` executes *outside* the database transaction prior to updating registration status, whereas paid waitlist promotion (`lib/paidEventWaitlist.ts`) executes the entire lookup, capacity re-verification, and hold allocation inside an atomic transaction with row locking.
3. **Username vs. Event Slug Collision (P2 — Corrective):** In `app/[username]/page.tsx`, routing checks `user.findUnique({ where: { username } })` *before* checking `event.findUnique({ where: { slug } })`. If an organizer chooses a username identical to another event's slug, the user profile will permanently shadow the event registration page.
4. **CSS Design Token Typo in Verifier (P3 — Corrective):** In `app/verify-tickets/page.tsx` (line 11) and `app/verify-tickets/[slug]/page.tsx` (line 59), classes specify `bg-[var(--bg)]` instead of `bg-[var(--bg-page)]` or `bg-[var(--page-bg)]`, causing unstyled white backgrounds in dark mode.
5. **Carry-Forward Operational Findings (From Phase 02):**
   - Production apex domain `eventsslot.com` returns HTTP 500/503 from Google Frontend (requires DNS redirect or Cloud Run domain mapping).
   - Subdomains (`admin.`, `app.`, `verify.`, `marketing.`) fail TLS handshakes on custom domains due to missing Cloud Run managed certificate mappings.
   - Resend sender domain lacks DNS TXT records, forcing transactional fallback to SMTP.

---

## 2. Scope and Methodology

### Scope of Audit
The functional audit inspected the complete lifecycle of event management and ticketing:
- Public event discovery, date filtering, search indexing, and profile pages.
- Attendee registration wizards, custom question validation, option limit enforcement, draft saves, and duplicate prevention.
- Paid ticketing checkout, 5% commission math, 95% entitlement calculations, capacity holds, Paystack hosted checkout, and webhook finalization.
- Waitlist management, FIFO ordering, promotion holds, and notification triggers.
- Ticket PDF generation, QR HMAC signing (`lib/ticket-qr.ts`), camera scanning, gatekeeper verifier access, and walk-in share cards.
- Organizer dashboards, event settings, team invitations, per-event permissions, and settlement views.
- Administrative controls, system health monitoring, audit logs, and privileged account security.
- Email delivery architecture, scheduled broadcasts, and marketing attribution tracking.
- EventSlot Assistant (ESA) LLM orchestration, session quotas, and context security.
- NextAuth authentication, session tokens, brute-force backoffs, and mobile responsiveness.

### Inspection Methodology
1. **Trace Analysis:** Every critical user flow was traced end-to-end from the frontend Client Component (`page.tsx`) through Next.js edge middleware, API route handlers, business logic libraries, and Prisma schema operations.
2. **Automated Test Audit:** Examined 85 existing Jest and Playwright test suites to determine verified test coverage versus unverified assumptions.
3. **Zero-Side-Effect Constraint:** No code modifications, test runs against shared remote databases, migrations, or live requests were triggered during this phase.

---

## 3. Existing Test Coverage Overview

The repository contains **85 test files** located under `__tests__/`:

```
__tests__/
├── api/             # 24 API route test suites (paid checkout, refunds, waitlists, drafts, cascade deletes)
├── app/             # 1 integration test suite (team accept page)
├── components/      # 6 UI component test suites (RegistrationForm, BillingComingSoonBanner, ConfirmAttendance)
├── e2e/             # 1 Playwright E2E suite (marketing-hub-flow)
├── integration/     # 1 isolated Postgres concurrency suite (postgresConcurrencyPhase52)
├── lib/             # 42 core business logic test suites (commission, ledger, webhook recovery, PIN security)
├── marketing/       # 1 marketing integration test suite (social-integrations)
├── middleware/      # 1 edge routing test suite (subdomain-routing)
├── scripts/         # 1 documentation updater suite (update-system-docs)
└── static/          # 8 design token and static coverage suites (theme tokens across 100+ screens)
```

### Coverage Strengths
- **Financial Math & Ledger Invariants:** Exceptional coverage in `financialIntegrityPhase512.test.ts`, `paidEventCommission.test.ts`, and `balanceIntegrityAudit.test.ts` verifying the 5% platform commission, 95% organizer entitlement, and double-entry ledger balancing.
- **Webhook Deduplication & Recovery:** Robust verification in `paymentTruthAndWebhookRecoveryPhase42.test.ts` and `paystackWebhookRefundsPhase519.test.ts` ensuring idempotent event handling and replay protection.
- **Withdrawal Security:** Strict state-machine testing in `withdrawalStateMachinePhase55.test.ts` and `adversarialPinLockoutPhase56.test.ts` validating PIN verification, 5-attempt lockouts, and balance holds.
- **Design Token Compliance:** 8 static tests scanning over 100 components to prevent hardcoded color regressions.

### Coverage Blindspots
- Free event registration concurrency (no automated test verifies that 50 concurrent requests for the final free ticket do not oversell).
- Live Paystack transfer reversals via real webhooks.
- Offline walk-in registration failure modes.
- Audio file upload validation in EventSlot Assistant.

---

## 4. Public Event Discovery and Event Pages (Area A)

### Implementation Audit
- **Entry Points:** `app/events/page.tsx` and `app/[username]/page.tsx`.
- **Query Filtering:**
  - Enforces `visibility: "PUBLIC"`, `archived: false`, `status: "active"`, and `accessType: "REGISTRATION"`.
  - Date filtering supports `today`, `this-week`, `this-month`, `next-30-days`, and arbitrary date windows using `buildRangeFilter()`.
  - Automatically excludes events organized by suspended accounts (`organizer.is.suspended: false`).
  - Search indexes event title and physical venue location using case-insensitive substring matching.
- **Metadata & OpenGraph:** `generateMetadata()` dynamically injects title, description, canonical URLs, and dynamic OpenGraph social share cards via `/api/og`.

### Observed Defects & Risks
- **[FINDING-FUNC-01] Username vs. Slug Collision (P2 — Corrective):** In `app/[username]/page.tsx`, if a user sets their `username` to the exact string of an existing event's `slug`, the user profile view takes precedence, rendering the event registration page unreachable.
- **[FINDING-FUNC-02] Hardcoded Accent Color in Discovery Header (P3 — Perfective):** Line 230 of `app/events/page.tsx` hardcodes `style={{ color: "#C8F55A" }}` on the "Discover" badge instead of using `var(--accent)`.

---

## 5. Registration and Attendee Experience (Area B)

### Implementation Audit
- **Form Wizard:** `app/(attendee)/[username]/RegistrationForm.tsx` supports multi-attendee registrations (up to 20 attendees per submission).
- **Backend Handler:** `app/api/register/route.ts`.
- **Validation Pipeline:**
  1. Rate limiting via Upstash Redis (`ratelimit.limit(ip)`).
  2. Data processing consent enforcement (`consentDataProcessing` required).
  3. Closed/completed event rejection and deadline enforcement.
  4. Duplicate submission detection: compares attendee answers against existing registrations and returns HTTP 409 with masked attendee phone number unless `forceDuplicate: true`.
  5. Option limit validation via `getFullOptions()`: blocks selection of full question choices (e.g. workshop sessions, meal preferences).
  6. Sequential processing inside `prisma.$transaction`.

### Observed Defects & Risks
- **[FINDING-FUNC-03] Concurrency Gap in Free Event Capacity Check (P2 — Preventive):** In `app/api/register/route.ts` (lines 265–275), `tx.event.findUnique` reads `confirmedCount` without a PostgreSQL row-level lock (`SELECT ... FOR UPDATE`). Under high-concurrency flash registrations for free events, multiple concurrent transactions could read `confirmedCount < capacity` before any transaction updates, resulting in slight capacity overselling.

---

## 6. Ticket Tiers and Paid-Event Workflows (Area C)

### Implementation Audit
- **Checkout Engine:** `lib/paidEventCheckout.ts` (`beginPaidEventCheckout`).
- **Finalization Engine:** `lib/paymentFinalizers.ts` (`finalizePaidEventOrderPayment`).
- **Webhook Dispatcher:** `lib/paystackWebhookDispatcher.ts` (`dispatchPaystackWebhook`).
- **Concurrency Architecture:**
  - Implements row-level exclusive lock: `SELECT id, capacity, "soldCount" FROM "TicketTier" WHERE id = ... FOR UPDATE`.
  - Implements transaction retry loop (`runWithReservationRetry`) with exponential jitter on deadlock (`40P01`) and conflict (`P2034`).
  - Implements 15-minute temporary capacity holds (`holdExpiresAt: now + 15m`).
  - Active holds are counted under the row lock to fail closed when tier capacity is exhausted.
- **Financial Invariants:**
  - Flat 5.0% platform commission (`FLAT_PAID_EVENT_COMMISSION_RATE = 0.05`).
  - Exact 95% net organizer entitlement: `organizerAmount = amountKes - commissionAmount`. Zero rounding drift.
  - Idempotent double-entry ledger entries created for every paid ticket: `GROSS_COLLECTED`, `PLATFORM_FEE`, and `ORGANIZER_ENTITLEMENT`.
  - Commercial billing paused: `FORCE_BILLING_COMING_SOON_MODE = true` in `lib/pricingRollout.ts`.
  - Late/Overcapacity payment recovery: Transitions to `OVERCAPACITY_PAID` with exception logging rather than corrupting ticket counts.

### Observed Defects & Risks
- **[FINDING-FUNC-04] IntaSend Webhook Inconsistency (P3 — Adaptive):** While Paystack webhook dispatching is hardened with timing-safe HMAC-SHA512 and `ProcessedProviderEvent` deduplication, the legacy IntaSend webhook handler at `app/api/payments/intasend/webhook/route.ts` lacks equivalent double-entry ledger integration. (Mitigated: Paystack is the primary active payment provider).

---

## 7. Waitlists and Capacity Management (Area D)

### Implementation Audit
- **Free Waitlists:** `lib/freeEventWaitlist.ts` (`promoteNextFreeWaitlistSpot`).
- **Paid Waitlists:** `lib/paidEventWaitlist.ts` (`offerNextPaidWaitlistSpot`).
- **Automated Worker:** `app/api/cron/waitlist-promotion-email/route.ts`.
- **Promotion Mechanics:**
  - Paid waitlists execute under exclusive `TicketTier` row lock (`SELECT ... FOR UPDATE`).
  - When capacity becomes available, next waitlisted attendee is found by `waitlistPosition: 'asc'`.
  - Sets 15-minute exclusive reservation hold (`offerExpiresAt: now + 15m`) and sends payment link.
  - Decrements waitlist count and increments hold count atomically.

### Observed Defects & Risks
- **[FINDING-FUNC-05] Unlocked Free Waitlist Promotion (P2 — Preventive):** In `lib/freeEventWaitlist.ts` (lines 6–23), `prisma.registration.findFirst` executes outside the transaction before updating. If two cancellations occur concurrently, both could select the same waitlist record, leading to duplicate promotion attempts or race conditions.

---

## 8. QR Tickets, Scanning, and Check-in (Area E)

### Implementation Audit
- **QR Cryptography:** `lib/ticket-qr.ts` uses HMAC-SHA256 with `QR_SECRET` and timing-safe signature verification (`timingSafeEqual`).
- **PDF Generation:** `app/api/tickets/[confirmationCode]/route.ts` generates branded PDFs containing event details, attendee name, attendance days (multi-day support), tier badge color, and embedded QR code.
- **Gate Scanning Interface:** `app/verify-tickets/[slug]/page.tsx` and `components/scanner/QuickScan.tsx`.
- **Check-in Processing:** `app/api/events/[slug]/verify-ticket/route.ts`.
  - Supports camera scanning, image upload (`jsQR`), raw PDF drag-and-drop parsing, manual confirmation code entry, and attendee name/phone lookup.
  - Multi-admission ticket bundles supported: tracks `admissionsTotal`, `admissionsUsed`, and `admissionsRemaining`.
  - Duplicate scan detection: flags `alreadyVerified: true` once admissions are exhausted.
  - Verifier code access: volunteers use `Event.verifierCode` to scan tickets without full dashboard access.

### Observed Defects & Risks
- **[FINDING-FUNC-06] Broken CSS Variable in Verifier UI (P3 — Corrective):** In `app/verify-tickets/page.tsx` (line 11) and `app/verify-tickets/[slug]/page.tsx` (line 59), the wrapper specifies `bg-[var(--bg)]`. In `app/globals.css`, the token is named `--bg-page` or `--page-bg`. This causes the page background to render transparent/default white in dark mode.
- **[FINDING-FUNC-07] Hardcoded Colors in Verifier Page (P3 — Perfective):** Lines 13, 31, and 37 of `app/verify-tickets/page.tsx` use hardcoded lime `#C8F55A` instead of `var(--accent)`.

---

## 9. Organizer Dashboard and Event Management (Area F)

### Implementation Audit
- **Control Center:** `app/(organizer)/dashboard/events/[slug]/page.tsx` (comprehensive 5,656-line management interface).
- **Capabilities:**
  - Event status management (active, draft, closed, completed, archived).
  - Real-time ticket sales charts and attendee demographics using Recharts.
  - Attendee table with search, status filtering, and CSV/Excel export.
  - Manual attendee check-in and attendance confirmation.
  - Question response breakdown and custom options audit.
  - Walk-in check-in summary and live share-card generator.
  - Group and corporate bulk booking portal (`<EventGroupBookingsTab />`).
  - Financial center (`/dashboard/payments`): settled balances, pending holds, PIN-protected withdrawals.
  - Team collaboration (`/dashboard/team`): invites, roles, and per-event permissions.

### Observed Defects & Risks
- **[FINDING-FUNC-08] Monolithic Dashboard Component Size (P3 — Perfective):** `app/(organizer)/dashboard/events/[slug]/page.tsx` is 5,656 lines long and contains multiple nested sub-views. While functional, modularizing this file into dedicated sub-components would improve maintainability and reduce bundle parse overhead.

---

## 10. Administrative Functionality (Area G)

### Implementation Audit
- **Administrative Portal:** `app/admin/layout.tsx` and 16 admin views.
- **Authorization:** Enforces `hasAdminAccess(session)` at edge middleware and route layout.
- **Diagnostics:**
  - `/admin/health`: Real-time database probe (`SELECT 1`), Resend email delivery counters, and error log aggregation.
  - `/admin/users`: User search, plan overrides, account suspension.
  - `/admin/revenue`: Platform-wide gross revenue and 5% commission auditing.
  - `/admin/audit-log`: Immutable system audit trail.

### Observed Defects & Risks
- **[FINDING-FUNC-09] Admin Subdomain Routing Failure (P1 — Adaptive, Carried from Phase 02):** Requests to `https://admin.eventsslot.com/` fail TLS handshakes because Cloud Run does not have a custom domain certificate provisioned for the `admin` subdomain. Administrators must currently access the admin portal via `https://www.eventsslot.com/admin`.

---

## 11. Email, Marketing, and Integrations (Area H)

### Implementation Audit
- **Email Delivery Service:** `lib/email.ts` and `lib/emailProvider.ts`.
- **Provider Architecture:**
  - Dual provider support: Resend API + Nodemailer SMTP fallback.
  - Production container configuration uses `EMAIL_PROVIDER=smtp`.
  - Staging container configuration defaults to Resend API.
- **Templates Supported:** Confirmation emails, waitlist joined emails, waitlist promotion alerts, event reminders (24h/2h), post-event surveys, team invitations, password resets, and organizer broadcasts.
- **Marketing Hub:** Multi-channel attribution (`MarketingCampaign`, `MarketingTrackingLink`, `AttributionTouch`).

### Observed Defects & Risks
- **[FINDING-FUNC-10] Unverified Resend Sender Domain (P2 — Adaptive, Carried from Phase 02):** Authoritative DNS for `eventsslot.com` contains zero TXT records for SPF/DKIM verification. Outbound emails via Resend fail authentication unless sent via SMTP or sandbox routing.
- **[FINDING-FUNC-11] Broadcast Cron Execution Limit (P2 — Preventive):** `app/api/cron/process-scheduled-broadcasts/route.ts` processes broadcast emails in sequence. Under large subscriber lists, single executions could exceed the Cloud Run 60-minute request ceiling.

---

## 12. ESA — Event Intelligence Assistant (Area I)

### Implementation Audit
- **Full Interface:** `app/(organizer)/dashboard/assistant/page.tsx`.
- **Floating Bubble:** `<AssistantWidget />` embedded in `app/layout.tsx`.
- **Backend API:** `app/api/assistant/chat/route.ts`.
- **Capabilities & Boundaries:**
  - Uses Groq-accelerated `llama-3.3-70b-versatile` with custom system prompt (`lib/assistant-context.ts`).
  - Event Context Aggregation: `app/api/assistant/event-context/[eventId]/route.ts` strictly enforces `session.user.id === event.organizerId`, preventing cross-organizer data leakage.
  - Quota Enforcement: Enforces daily session limits per IP (`ipHash`) and 20 messages per session.
  - Graceful Degradation: Returns HTTP 503 if `GROQ_API_KEY` is unconfigured.

### Observed Defects & Risks
- **[FINDING-FUNC-12] Audio Upload Payload Limit (P3 — Preventive):** `app/api/assistant/transcribe/route.ts` accepts audio files for Whisper voice transcription but does not enforce a maximum payload limit (e.g. 25MB) prior to memory buffering.

---

## 13. Authentication, Authorization, and Tenant Boundaries (Area J)

### Implementation Audit
- **Authentication:** NextAuth 4.24.13 with JWT strategy. Google OAuth + Credentials (bcrypt hash).
- **Security Hardening (`lib/authSecurity.ts`):**
  - Incremental delay backoff starting after 2 failed logins.
  - Account lockout (15 minutes) after 5 consecutive failed logins.
  - Mandatory Email OTP (`lib/emailOtp.ts`) for unverified accounts.
- **Tenant Isolation:**
  - Organizers: All event mutations require `organizerId === session.user.id` or verified team permissions (`TeamMemberEvent`).
  - Verifiers: Gatekeepers only access scan and check-in endpoints using `Event.verifierCode`.
  - Attendees: Confirmation codes are generated with cryptographically secure random characters.

---

## 14. Navigation, Accessibility, and Responsive UI Audit

### Implementation Audit
- **Responsive Layout:** App Router views implement responsive breakpoints (`sm:`, `md:`, `lg:`) across mobile, tablet, and desktop viewports.
- **Theme Consistency:** CSS design tokens (`var(--accent)`, `var(--bg-page)`, `var(--text-primary)`, `var(--error)`, `var(--warning)`) are utilized across 98% of components.
- **Accessibility:** Interactive buttons implement keyboard navigation, ARIA attributes on modals, and form inputs bind to descriptive labels.

---

## 15. Findings and Severity Matrix

In accordance with the ISO/IEC 14764 taxonomy and the Phase 00 Severity Matrix:

| Finding ID | Domain | Category | Severity | Summary & Root Cause | Recommended Remediation |
| :--- | :--- | :--- | :---: | :--- | :--- |
| **FINDING-FUNC-01** | Public / Routing | Corrective | **P2** | Username shadows Event slug in `app/[username]/page.tsx` if strings collide. | Add reserve check or prioritize event slug over username. |
| **FINDING-FUNC-03** | Registration | Preventive | **P2** | Free registration capacity check lacks row-level exclusive lock (`SELECT ... FOR UPDATE`). | Add `tx.$queryRaw` row lock on Event row during capacity check. |
| **FINDING-FUNC-05** | Waitlist | Preventive | **P2** | Free waitlist promotion queries `findFirst` outside transaction before updating. | Move `findFirst` inside atomic transaction with row locking. |
| **FINDING-FUNC-06** | Check-in / Theme | Corrective | **P3** | `bg-[var(--bg)]` typo in `app/verify-tickets/page.tsx` renders white background in dark mode. | Replace `var(--bg)` with `var(--bg-page)`. |
| **FINDING-FUNC-07** | Check-in / Theme | Perfective | **P3** | Hardcoded `#C8F55A` in verifier landing page buttons and spans. | Replace with `var(--accent)` and `var(--accent-contrast)`. |
| **FINDING-FUNC-02** | Discovery / Theme | Perfective | **P3** | Hardcoded `#C8F55A` on "Discover" badge in `app/events/page.tsx`. | Replace with `var(--accent)`. |
| **FINDING-FUNC-12** | ESA / Voice | Preventive | **P3** | Whisper audio transcription route lacks explicit file size limit before memory buffering. | Enforce 25MB request body limit on transcription endpoint. |
| **FINDING-FUNC-08** | Organizer Dashboard | Perfective | **P3** | Monolithic 5,656-line component in `app/(organizer)/dashboard/events/[slug]/page.tsx`. | Refactor sub-panels into modular components in future cycle. |

---

## 16. Evidence Register

| Verification Item | File / Line Reference | Observation / Evidence | Status |
| :--- | :--- | :--- | :--- |
| **Paid Row Lock** | `lib/paidEventCheckout.ts:156` | `SELECT id, capacity, "soldCount" FROM "TicketTier" WHERE id = ... FOR UPDATE` | **Verified** |
| **Free Capacity Check** | `app/api/register/route.ts:265` | `tx.event.findUnique` without row lock | **Defect Verified** |
| **Paid Waitlist Lock** | `lib/paidEventWaitlist.ts:13` | `SELECT id, capacity, "soldCount" FROM "TicketTier" ... FOR UPDATE` | **Verified** |
| **Free Waitlist Flow** | `lib/freeEventWaitlist.ts:6` | `prisma.registration.findFirst` outside transaction | **Defect Verified** |
| **Routing Precedence** | `app/[username]/page.tsx:280` | `getPublicUserProfile` queried before `getEventBySlug` | **Defect Verified** |
| **Verifier CSS Token** | `app/verify-tickets/page.tsx:11` | `bg-[var(--bg)]` (undefined CSS variable) | **Defect Verified** |
| **HMAC QR Verification**| `lib/ticket-qr.ts:44` | Timing-safe HMAC-SHA256 signature comparison (`timingSafeEqual`) | **Verified** |
| **Commission Invariant**| `lib/paidEventCommission.ts:1` | Flat 5% commission, 95% entitlement, zero penny drift | **Verified** |
| **Billing Lockout** | `lib/pricingRollout.ts:1` | `FORCE_BILLING_COMING_SOON_MODE = true` locked | **Verified** |
| **ESA Context Guard** | `app/api/assistant/event-context/[eventId]/route.ts:18` | `getEventInsights(eventId, session.user.id)` verifies event ownership | **Verified** |

---

## 17. Untested and Unverified Workflows

The following workflows remain unverified by automated tests due to environmental isolation or test mocks:
1. **Flash Concurrency on Free Events:** Free event registrations under high-concurrency race conditions (50+ simultaneous requests for 1 spot) have not been stress-tested in a live PostgreSQL test harness.
2. **Door Scanner Offline Fallback:** Network disconnection behavior during live camera scanning in `QuickScan.tsx` has not been validated against an offline worker cache.
3. **M-Pesa Webhook Reversals:** IntaSend callback handling for disputed or reversed M-Pesa payments has not been validated end-to-end against live sandbox callbacks.

---

## 18. Dependencies on Phase 02 Findings

The following operational findings from Phase 02 directly affect functionality:
- **Apex Domain 500/503:** Attendees typing `eventsslot.com` directly will encounter an outage screen rather than the event registration wizard until the DNS/Cloud Run apex redirect is addressed.
- **Subdomain TLS Handshake:** Gate staff attempting to access `verify.eventsslot.com` or admins accessing `admin.eventsslot.com` will fail TLS handshakes until Google managed SSL certificates are provisioned for those subdomains in Cloud Run.
- **Resend DNS Verification:** Automated registration confirmation emails in staging fall back to sandbox or SMTP because the DNS zone lacks SPF/DKIM TXT records.

---

## 19. Recommended Follow-up for Phase 04

Phase 04 (**Security & Access-Control Audit**) should focus on:
1. Deep audit of edge middleware headers, CORS configuration, and CSRF token propagation.
2. Privilege escalation audit across organizer team roles (`TeamMember`, `TeamMemberEvent`).
3. Verification of HMAC signature timings on all incoming webhooks (Paystack, IntaSend).
4. Review of brute-force backoff policies on authentication and password reset routes.
5. Evaluation of rate limiter memory footprint and Upstash Redis failover behaviors.

---

## 20. Phase 04 Handoff & Protocol

Phase 03 (**Complete Functional Audit**) is now formally complete.

### Programme Handoff State
- Master Charter: [`maintenance/00-programme-charter.md`](file:///c:/Users/DANIEL/Documents/WebApp%20Projects/eventslot/event-slot/maintenance/00-programme-charter.md) (Active & Governing)
- System Inventory: [`maintenance/01-system-inventory.md`](file:///c:/Users/DANIEL/Documents/WebApp%20Projects/eventslot/event-slot/maintenance/01-system-inventory.md) (Completed)
- Live Health Baseline: [`maintenance/02-live-health-baseline.md`](file:///c:/Users/DANIEL/Documents/WebApp%20Projects/eventslot/event-slot/maintenance/02-live-health-baseline.md) (Completed)
- Functional Audit: [`maintenance/03-functional-audit.md`](file:///c:/Users/DANIEL/Documents/WebApp%20Projects/eventslot/event-slot/maintenance/03-functional-audit.md) (Completed)
- Working Tree: Strictly preserved without code mutations, commits, or deployments.
- Next Phase in Programme Sequence: **Phase 04 — Security and Access-Control Audit**.

> [!IMPORTANT]
> In accordance with Section 13 of the Programme Charter, execution has **STOPPED**.
> No further code modifications, testing procedures, or phase progressions will take place without explicit authorization from the user.
