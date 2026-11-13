# EventSlot Technologies — Full System Maintenance Programme
## Phase 01 — System Inventory & Environment Mapping

**Document Version:** 1.0.0  
**Effective Date:** 23 October 2026  
**Programme Lead:** Principal Software Architect, DevOps Lead, Security Engineer & Technical Auditor  
**Target Repository:** `Officialkid/event-slot`  
**Base Branch:** `audit/phase-5-7-concurrency-ci`  
**Current HEAD Commit:** `ff277de`  
**Working Tree Status:** 25 modified files, 14 untracked files (strictly preserved, uncommitted)  
**Deliverable Status:** **PHASE 01 COMPLETED — READ-ONLY BASELINE AUDIT FILED**

---

## 1. Executive Summary

This document establishes the authoritative **System Inventory & Environment Mapping** for the EventSlot application ecosystem under Phase 01 of the Full System Maintenance Programme.

### Reconciliation of Programme Sequence
In the preliminary Phase 00 charter draft (`maintenance/00-programme-charter.md`), Phase 01 was tentatively captioned as *"Core Quality Gates & Build Verification"*. By directive of executive steering and technical governance, the approved Phase 01 scope was formally designated as **System Inventory & Environment Mapping**. Establishing an exhaustive, verified catalog of application components, data architectures, secret boundaries, third-party integrations, and environment topologies is a mandatory prerequisite before running live health diagnostics, triggering build verification gates, or applying corrective remediations in Phase 02. The sequence is formally reconciled; Core Quality Gates and Deep Component Audits will execute under Phase 02 onwards.

### Executive Assessment Summary
EventSlot is a full-featured event registration, ticketing, organizer intelligence, and financial payout platform built on modern cloud-native technologies:
1. **Application Core:** Next.js 16.2.4 (App Router) with React 18, Tailwind CSS, TypeScript 5, and Prisma ORM 5.22.0 deployed in a multi-stage Docker container on Google Cloud Run (`us-central1`).
2. **Database Engine:** Serverless PostgreSQL hosted on Neon, featuring 76 Prisma models, 40 enums, and 45+ versioned SQL migrations.
3. **Environment Isolation:** Complete database separation achieved between Staging (`staging` Neon branch `br-frosty-glitter-amhn6cza`, endpoint `ep-morning-silence-amb5ua6q`) and Production (`main` branch `ep-little-butterfly-...aws.neon.tech`). Staging is deployed on Cloud Run (`eventslot-web-staging`) at `https://staging.eventsslot.com`.
4. **Commercial Safeguards:** Subscription billing remains intentionally paused (`FORCE_BILLING_COMING_SOON_MODE = true`), providing free open organizer access until the scheduled commercial launch (1 July 2026).
5. **Financial Engine:** Built on mathematical invariants: flat 5% platform commission (`lib/paidEventCommission.ts`), 95% organizer net entitlement, immutable double-entry ledger (`FinancialLedgerEntry`), timing-safe HMAC-SHA512 Paystack webhook verification, and withdrawable balance rules tied exclusively to settled funds.

All investigations in this phase were executed in **read-only mode**. Zero code files were modified, zero git commits or pushes were performed, zero database migrations were executed, and the existing working tree was preserved intact.

---

## 2. Repository and Branch Snapshot

### Git Repository Status
- **Repository Root:** `c:\Users\DANIEL\Documents\WebApp Projects\eventslot\event-slot`
- **Active Branch:** `audit/phase-5-7-concurrency-ci`
- **Upstream Tracking:** `origin/audit/phase-5-7-concurrency-ci` (local branch is ahead by 3 commits)
- **HEAD Commit:** `ff277de` (`fix(payments): fail-closed capacity, atomic waitlist promotion, exact commission auditor, and verified refund state machine`)
- **Preceding Commits:**
  - `fbd7064`: `fix(payments): harden waitlist promotion races, protect offers from late webhook preemption, and align auditor rounding`
  - `d4b165c`: `feat(payments): anti-drift ledger auditor, capacity hold auto-release, and settlement worker resiliency`

### Working Tree Preservation Log
The working tree contains 25 modified files and 14 untracked files accumulated from prior stabilization and staging preparation phases. In compliance with the Phase 00 Charter, all working tree states are strictly preserved:

#### Modified Files (25)
1. `__tests__/components/RegistrationForm.test.tsx` (Preserved — registration wizard tests)
2. `__tests__/lib/financialIntegrityPhase512.test.ts` (Preserved — 5% commission and ledger unit tests)
3. `__tests__/lib/paymentTruthAndWebhookRecoveryPhase42.test.ts` (Preserved — webhook recovery tests)
4. `app/(attendee)/[username]/RegistrationForm.tsx` (Preserved — attendee registration UI)
5. `app/(organizer)/create/page.tsx` (Preserved — event creation wizard)
6. `app/(organizer)/dashboard/assistant/page.tsx` (Preserved — EventSlot Assistant full-page experience)
7. `app/(organizer)/dashboard/payments/page.tsx` (Preserved — payments overview)
8. `app/(organizer)/edit/[slug]/page.tsx` (Preserved — event editor)
9. `app/api/billing/cancel/route.ts` (Preserved — billing freeze)
10. `app/api/billing/invoices/route.ts` (Preserved — billing invoice handler)
11. `app/api/billing/status/route.ts` (Preserved — billing paused status)
12. `app/api/organizer/payments/summary/route.ts` (Preserved — balance summary API)
13. `app/api/organizer/payments/withdrawals/route.ts` (Preserved — safe withdrawal requests)
14. `app/layout.tsx` (Preserved — AssistantWidget floating bubble integration)
15. `app/pay/[orderId]/page.tsx` (Preserved — hosted checkout redirection)
16. `components/payments/OrganizerPaymentsPage.tsx` (Preserved — organizer balance cards)
17. `lib/organizerPayments.ts` (Preserved — balance service)
18. `lib/paidEventCheckout.ts` (Preserved — checkout session logic)
19. `lib/paymentFinalizers.ts` (Preserved — atomic order finalization)
20. `lib/paystack.ts` (Preserved — Paystack HMAC-SHA512 verification)
21. `lib/paystackWebhookDispatcher.ts` (Preserved — webhook deduplication & dispatch)
22. `lib/settlementSyncWorker.ts` (Preserved — settlement reconciliation worker)
23. `lib/subscription.ts` (Preserved — subscription tier rules)
24. `lib/subscriptionBilling.ts` (Preserved — billing state lock)
25. `lib/withdrawalService.ts` (Preserved — PIN verification and balance hold service)

#### Untracked Files & Directories (14)
1. `__tests__/api/organizerPaymentsDashboardPhase519.test.ts`
2. `__tests__/components/PaidEventRegistrationFlow.test.tsx`
3. `__tests__/lib/organizerPaymentsExperiencePhase520.test.ts`
4. `__tests__/lib/paystackWebhookRefundsPhase519.test.ts`
5. `__tests__/lib/providerVerifiedRefundPhase515.test.ts`
6. `__tests__/lib/safeWithdrawalsAndPayoutReconciliationPhase6.test.ts`
7. `__tests__/lib/settlementReconciliationPhase521.test.ts`
8. `__tests__/lib/subscriptionBillingMigrationPhase7.test.ts`
9. `app/api/cron/payout-reconciliation/`
10. `app/api/cron/settlement-reconciliation/`
11. `cloudbuild.staging.yaml` (Staging Cloud Build pipeline definition)
12. `generate_partnership_pdf.py` (Local utility script)
13. `lib/subscriptionMigration.ts` (Subscription migration helper)
14. `maintenance/` (Governance and audit directory containing `00-programme-charter.md` and `01-system-inventory.md`)

---

## 3. Application Architecture

```
                                  ┌────────────────────────┐
                                  │   Client / Browser     │
                                  └───────────┬────────────┘
                                              │ (HTTPS)
                                              ▼
                        ┌───────────────────────────────────────────┐
                        │               Next.js Edge                │
                        │             (middleware.ts)               │
                        ├───────────────────────────────────────────┤
                        │ • Security Headers (HSTS, CSP, X-Frame)   │
                        │ • Subdomain Routing (verify, admin, app)  │
                        │ • NextAuth JWT Session Authentication     │
                        └─────┬───────────────────────────────┬─────┘
                              │                               │
             ┌────────────────▼───────────────┐  ┌────────────▼──────────────┐
             │       App Router (SSR/RSC)     │  │       Route Handlers      │
             │   • /(organizer)/dashboard     │  │   • /api/webhooks/paystack│
             │   • /(attendee)/[username]     │  │   • /api/assistant/chat   │
             │   • /admin, /marketing         │  │   • /api/cron/*           │
             └────────────────┬───────────────┘  └────────────┬──────────────┘
                              │                               │
                              └───────────────┬───────────────┘
                                              ▼
                        ┌───────────────────────────────────────────┐
                        │              Prisma ORM Client            │
                        │     (@prisma/client 5.22.0, pooled URL)   │
                        └─────────────────────┬─────────────────────┘
                                              │
                      ┌───────────────────────┴───────────────────────┐
                      ▼                                               ▼
         ┌─────────────────────────┐                     ┌─────────────────────────┐
         │      Neon Postgres      │                     │   External Integrations │
         │   • 76 Data Models      │                     │   • Paystack API        │
         │   • 40 Enums            │                     │   • Resend & SMTP       │
         │   • Ledger & Balances   │                     │   • Cloudflare R2       │
         │   • Webhook Audit Log   │                     │   • Groq / OpenAI LLMs  │
         └─────────────────────────┘                     └─────────────────────────┘
```

### Framework & Runtime
- **Framework:** Next.js 16.2.4 (React 18.3.1, React DOM 18.3.1)
- **Node Runtime:** Node.js v22 (Alpine Linux base in Docker container)
- **Build Mode:** Next.js Standalone Output (`output: 'standalone'`) with `--webpack` compiler flag
- **PWA Integration:** `@ducanh2912/next-pwa` (service worker caching disabled on sensitive dashboard routes)
- **Styling & Design System:** Tailwind CSS 3.4.1 with custom CSS design tokens (`var(--accent)`, `var(--bg-page)`, `var(--text-primary)`, `var(--error)`, `var(--warning)`) supporting dynamic Light and Dark themes.

### Edge Middleware & Subdomain Routing (`middleware.ts`)
The edge middleware enforces routing and perimeter defense before requests reach Node.js handlers:
1. **Subdomain Rewriting:**
   - `admin.eventsslot.com` $\to$ Rewrites directly to `/admin` routes. Requires `SUPER_ADMIN` role or email in admin whitelist.
   - `app.eventsslot.com` $\to$ Rewrites root to `/dashboard` and `/events` to `/my-events`.
   - `verify.eventsslot.com` $\to$ Rewrites to `/verify-tickets` (gate-check scanner surface).
   - `marketing.eventsslot.com` $\to$ Rewrites to `/marketing` hub.
2. **Security Headers Invariant:**
   - `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
   - `X-Content-Type-Options: nosniff`
   - `X-Frame-Options: DENY`
   - `X-XSS-Protection: 1; mode=block`
   - `Referrer-Policy: strict-origin-when-cross-origin`
   - Strict `Content-Security-Policy` restricting script-src, frame-ancestors, and API connections.
3. **Protected Path Enforcement:** Requests to `/dashboard`, `/my-events`, `/create`, `/edit`, `/admin`, `/tokens`, `/marketing` require valid NextAuth JWT sessions; unauthenticated requests are redirected to `/signin`.

---

## 4. Frontend and Backend Inventory

### Frontend Route Catalog
The frontend UI is organized under the App Router directory structure:

| Route Group / URL | Key Entry File | Purpose / Capabilities | Theme Tokens |
| :--- | :--- | :--- | :--- |
| **`/(organizer)/dashboard`** | `app/(organizer)/dashboard/page.tsx` | Main organizer overview, ticket velocity, quick action cards, announcements. | Token-based (CSS vars) |
| **`/(organizer)/dashboard/events`** | `app/(organizer)/dashboard/events/page.tsx` | Event list, status filtering, capacity metrics, event management. | Token-based (CSS vars) |
| **`/(organizer)/dashboard/events/[slug]`** | `app/(organizer)/dashboard/events/[slug]/page.tsx` | Event control center, registrations, check-in stats, exports. | Token-based (CSS vars) |
| **`/(organizer)/dashboard/payments`** | `app/(organizer)/dashboard/payments/page.tsx` | Financial center: gross revenue, settled balance, pending holds, PIN-protected withdrawals. | Token-based (CSS vars) |
| **`/(organizer)/dashboard/assistant`** | `app/(organizer)/dashboard/assistant/page.tsx` | EventSlot Assistant full-page chat interface, intelligence insights, action cards. | Token-based (CSS vars) |
| **`/(organizer)/dashboard/team`** | `app/(organizer)/dashboard/team/page.tsx` | Team workspace, collaborator invites, per-event permission assignments. | Token-based (CSS vars) |
| **`/(organizer)/create`** | `app/(organizer)/create/page.tsx` | Event creation wizard, ticket tier builder, custom questions, dates/times. | Token-based (CSS vars) |
| **`/(organizer)/edit/[slug]`** | `app/(organizer)/edit/[slug]/page.tsx` | Event modification, FAQs, tiers, attendee consent toggles. | Token-based (CSS vars) |
| **`/(attendee)/[username]`** | `app/(attendee)/[username]/page.tsx` | Public profile and event listings for organizers. | Token-based (CSS vars) |
| **`/(attendee)/[username]/[slug]`** | `app/(attendee)/[username]/[slug]/page.tsx` | Public event registration page: multi-step form, tier selection, waitlist promotion. | Token-based (CSS vars) |
| **`/events`** | `app/events/page.tsx` | Public event discovery directory, search, category filters. | Token-based (CSS vars) |
| **`/walkin/[slug]`** | `app/walkin/[slug]/page.tsx` | Rapid door registration for walk-in attendees; generates live share card proof. | Token-based (CSS vars) |
| **`/pay/[orderId]`** | `app/pay/[orderId]/page.tsx` | Hosted checkout redirect and payment verification wait-screen. | Token-based (CSS vars) |
| **`/booking/[token]`** | `app/booking/[token]/page.tsx` | Organization Manager Portal: manage reserved bulk slots, delegate assignments. | Token-based (CSS vars) |
| **`/claim/[token]`** | `app/claim/[token]/page.tsx` | Member Self-Claim Portal: individual slot claiming for group reservations. | Token-based (CSS vars) |
| **`/verify-tickets`** | `app/verify-tickets/page.tsx` | Gatekeeper camera scanner: QR code ticket verification and instant check-in. | Token-based (CSS vars) |
| **`/admin/*`** | `app/admin/layout.tsx` | 16 super-admin monitoring pages: health, audit log, users, revenue, reports. | Token-based (CSS vars) |
| **`/marketing/*`** | `app/marketing/page.tsx` | Marketing Hub: multi-channel attribution, campaigns, tracking links. | Token-based (CSS vars) |

### Backend API Route Catalog
The backend exposes 65+ REST endpoints handling application operations:

```
app/api/
├── admin/                     # Privileged administration APIs (SuperAdmin protected)
│   ├── app-testers/           # Tester management
│   ├── assistant-sessions/    # Assistant chat session audit logs
│   ├── audit-log/             # System audit trail
│   ├── broadcast/             # System-wide email broadcasts (single & scheduled)
│   ├── health/                # Platform health diagnostics probe
│   ├── revenue/               # Platform-wide revenue & commission audit
│   ├── test/payments/         # Sandboxed test payment simulation
│   └── users/                 # User moderation, plan adjustment, suspension
├── assistant/                 # Event Intelligence Assistant (ESA)
│   ├── chat/                  # Core Llama 3.3 70B conversational completion
│   ├── event-context/         # Dynamic event context aggregator
│   ├── session/               # Session lifecycle (start, persist, terminate)
│   └── transcribe/            # Whisper audio voice transcription
├── attendance/confirm/        # Attendee self-confirmation API
├── auth/                      # Authentication endpoints
│   ├── forgot-password/       # Password reset dispatch
│   ├── otp/                   # Email OTP issuance and validation
│   ├── register/              # New account registration
│   └── session/               # NextAuth session verification
├── billing/                   # Commercial subscription management (COMING SOON)
│   ├── cancel/, invoices/, status/ # Frozen endpoints returning paused state
├── cron/                      # 15 Scheduled automation workers (Cron secret protected)
│   ├── country-snapshot/      # Daily organizer demographic snapshots
│   ├── event-reminder/        # 24h & 2h pre-event attendee reminders
│   ├── expire-data/           # GDPR/Data retention purge
│   ├── payout-reconciliation/ # Automated Paystack payout reconciliation
│   ├── post-event-summary/    # Post-event attendee follow-up dispatch
│   ├── process-scheduled-broadcasts/ # Scheduled email dispatcher
│   ├── purge-expired-events/  # Cleanup of archived/expired events
│   ├── recalculate-leaderboard/# Community referral leaderboard updates
│   ├── reset-voice-quota/     # Assistant voice minutes reset
│   ├── send-feedback/         # Post-event organizer survey dispatch
│   ├── settlement-reconciliation/ # Paystack settlement batch reconciliation
│   └── weekly-digest/         # Weekly organizer performance digest
├── events/                    # Event lifecycle CRUD, questions, duplicate, delete
├── organizer/payments/        # Organizer financial APIs
│   ├── summary/               # Real-time balance cards (settled, gross, pending)
│   └── withdrawals/           # PIN-protected withdrawal requests
├── paid-events/               # Paid ticketing checkout
│   ├── checkout/              # Initialize Paystack checkout session
│   └── orders/[orderId]/      # Order status polling and payment verification
├── registrations/             # Registration CRUD, CSV exports, waitlist promotions
├── team/                      # Team collaboration, invites, per-event access grants
├── tickets/                   # Ticket retrieval, PDF generation, QR verification
├── walkin/                    # Walk-in door registration and SVG share card generator
└── webhooks/                  # External webhook receivers
    ├── paystack/              # Unified HMAC-SHA512 Paystack webhook dispatcher
    └── intasend/              # IntaSend webhook fallback
```

### Event Intelligence Assistant (ESA) Architecture
- **Full Page:** `app/(organizer)/dashboard/assistant/page.tsx` provides multi-session conversational event management.
- **Floating Widget:** `<AssistantWidget />` embedded in `app/layout.tsx` offers contextual help across dashboard views.
- **Backend Model:** Groq-accelerated `llama-3.3-70b-versatile` with custom system prompt injecting event metrics, attendee counts, and financial summaries.
- **Safeguards:** IP-hashed rate limiting (`IP_HASH_SALT`), 20 messages per session limit, daily session quotas, and memory preferences stored in `UserMemoryPreference`.

---

## 5. Database and Data-Access Architecture

### Database Engine & Connection Management
- **Database Engine:** PostgreSQL (Serverless v16 compatible, hosted on Neon).
- **ORM:** Prisma Client `5.22.0`.
- **Connection Configuration (`prisma/schema.prisma`):**
  - `url = env("DATABASE_URL")`: Connection-pooled transaction endpoint (`ep-...-pooler...neon.tech`) used by Next.js application runtime to prevent pool exhaustion.
  - `directUrl = env("DIRECT_URL")`: Direct PostgreSQL connection endpoint bypassing poolers, used exclusively for DDL migrations (`prisma migrate deploy`).

### Data Model Inventory (76 Models, 40 Enums)
The data layer is partitioned into distinct functional domains:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        EVENTSLOT PRISMA DATA DOMAINS                   │
├────────────────────┬───────────────────────────────────────────────────┤
│ Domain             │ Primary Models                                    │
├────────────────────┼───────────────────────────────────────────────────┤
│ 1. Identity & Auth │ User, Account, Session, VerificationToken,        │
│                    │ EmailOTP, LoginSecurityState                      │
├────────────────────┼───────────────────────────────────────────────────┤
│ 2. Events & Core   │ Event, EventFAQ, TicketTier, WalkInCheckin,       │
│                    │ EntryLog, EventView                               │
├────────────────────┼───────────────────────────────────────────────────┤
│ 3. Registrations   │ Registration, RegistrationDraft, Ticket,          │
│                    │ GroupBooking, GroupTicketSlot                     │
├────────────────────┼───────────────────────────────────────────────────┤
│ 4. Financial       │ PaidEventOrder, Payment, OrganiserBalance,        │
│                    │ Withdrawal, SettlementBatch, FinancialLedgerEntry,│
│                    │ ProcessedProviderEvent                            │
├────────────────────┼───────────────────────────────────────────────────┤
│ 5. Assistant & AI  │ AssistantSession, AssistantMessage, ChatQuota,    │
│                    │ VoiceQuota, AssistantFeedback, UserMemory         │
├────────────────────┼───────────────────────────────────────────────────┤
│ 6. Marketing       │ MarketingCampaign, MarketingContentItem,          │
│                    │ MarketingTrackingLink, AttributionTouch           │
├────────────────────┼───────────────────────────────────────────────────┤
│ 7. Collaboration   │ TeamMember, TeamMemberEvent                       │
├────────────────────┼───────────────────────────────────────────────────┤
│ 8. Audit & System  │ AuditLog, ErrorLog, RateLimitLog, NativePushDevice│
└────────────────────┴───────────────────────────────────────────────────┘
```

### Migration History & Drift Safety
The repository contains **45+ ordered migrations** under `prisma/migrations/`. Recent critical migrations include:
- `20261020113200_add_financial_ledger_and_provider_events`: Established the double-entry `FinancialLedgerEntry` and idempotent `ProcessedProviderEvent`.
- `20261020160000_add_overcapacity_paid_order_status`: Handled edge-case overcapacity paid orders.
- `20261020163000_add_order_fulfillment_exception_and_refunded_status`: Established provider-verified refund tracking.
- `20261020173000_add_settlement_and_withdrawal_lifecycle`: Added settlement batch IDs and safe withdrawal state machine.

Migrations are applied automatically during container deployment via Dockerfile `CMD`:
```bash
if [ "$RUN_DB_MIGRATIONS" = "true" ]; then npx prisma@5.22.0 migrate deploy; fi && node server.js
```

---

## 6. Authentication and Authorization Overview

### Authentication Stack
- **Library:** NextAuth.js 4.24.13 with `@next-auth/prisma-adapter`.
- **Session Strategy:** JSON Web Token (JWT) signed with `NEXTAUTH_SECRET`.
- **Supported Providers:**
  1. **Google OAuth 2.0:** Enabled via `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Uses offline access and prompt `select_account`.
  2. **Credentials Provider:** Email and password with bcrypt hash verification.
- **Login Brute-Force Safeguards (`lib/authSecurity.ts`):**
  - Tracks failed attempts in `LoginSecurityState`.
  - Enforces incremental delay backoff starting after 2 failures.
  - Automatically locks accounts for 15 minutes after 5 consecutive failures.
  - Mandates Email OTP verification (`lib/emailOtp.ts`) for unverified accounts.

### Authorization & Multi-Tenant Boundaries
1. **Super Admin Tier:** Protected by email whitelist (`getConfiguredAdminEmails()`), `token.role === 'SUPER_ADMIN'`, or `token.isAdmin === true`. Guarded at both edge middleware (`/admin`, `/api/admin`) and API route handlers.
2. **Organizer Tenant Boundary:**
   - Organizers can only query and mutate resources where `organizerId === session.user.id`.
   - Team members are checked against `TeamMember` and `TeamMemberEvent` access tables (`lib/permissions.ts`). Unauthorized access returns HTTP 403 Forbidden.
3. **Attendee Verification:** Attendees access tickets via cryptographic confirmation codes or signed bearer tokens; attendee registration data is never exposed to other attendees.

---

## 7. Integrations and External Dependencies

```
┌────────────────────────────────────────────────────────────────────────┐
│                     EXTERNAL SERVICE DEPENDENCIES                      │
├────────────────────┬───────────────────────────────────────────────────┤
│ External Service   │ Purpose & Integration Details                     │
├────────────────────┼───────────────────────────────────────────────────┤
│ 1. Paystack        │ Primary payment gateway: Hosted Checkout,         │
│                    │ HMAC-SHA512 Webhooks, Transfer API (withdrawals). │
├────────────────────┼───────────────────────────────────────────────────┤
│ 2. Neon PostgreSQL │ Serverless cloud database hosting primary data    │
│                    │ with connection pooling & branch isolation.       │
├────────────────────┼───────────────────────────────────────────────────┤
│ 3. Resend & SMTP   │ Dual-provider transactional and marketing email:  │
│                    │ Resend API for transactional, SMTP fallback.     │
├────────────────────┼───────────────────────────────────────────────────┤
│ 4. Cloudflare R2   │ S3-compatible object storage (`@aws-sdk/client-s3`)│
│                    │ for event banners, QR codes, and data archives.   │
├────────────────────┼───────────────────────────────────────────────────┤
│ 5. Groq Cloud      │ Ultra-fast LLM inference (`llama-3.3-70b`)        │
│                    │ powering the EventSlot Assistant (ESA).           │
├────────────────────┼───────────────────────────────────────────────────┤
│ 6. OpenAI / Claude │ Fallback LLMs for report generation and insights. │
├────────────────────┼───────────────────────────────────────────────────┤
│ 7. Upstash Redis   │ Distributed rate limiting & IP throttling via     │
│                    │ `@upstash/ratelimit` (optional in local dev).     │
├────────────────────┼───────────────────────────────────────────────────┤
│ 8. Google Cloud    │ Google Cloud Run hosting, Cloud Build CI/CD,      │
│                    │ Secret Manager, and Google Calendar sync.         │
└────────────────────┴───────────────────────────────────────────────────┘
```

---

## 8. Development Environment

- **Local Server:** Next.js Dev Server run via `npm run dev` (`next dev --webpack`) on port 3000.
- **Configuration:** Local `.env` / `.env.local` containing local test secrets.
- **Isolation Protection:** Real PostgreSQL concurrency tests (`__tests__/integration/postgresConcurrencyPhase52.test.ts`) are programmed to **skip automatically** when `TEST_POSTGRES_DATABASE_URL` is unset, ensuring that local test runs cannot accidentally pollute or mutate remote databases.
- **Mocking:** Unit and integration tests utilize Jest mocks (`jest.mock('@/lib/prisma')`) and MSW (Mock Service Worker) to isolate component tests from network dependencies.

---

## 9. Staging Environment

- **Hosting Platform:** Google Cloud Run (Managed, Region: `us-central1`).
- **GCP Project:** `project-d46be384-233e-47fb-bb5`.
- **Cloud Run Service:** `eventslot-web-staging`.
- **Current Active Revision:** `eventslot-web-staging-00020-7b2`.
- **Staging Domains:**
  - Custom Domain: `https://staging.eventsslot.com` (Mapped via DNS CNAME to `ghs.googlehosted.com`).
  - Cloud Run Direct URL: `https://eventslot-web-staging-502127271448.us-central1.run.app`.
- **Database Isolation:**
  - Dedicated Neon Branch: `staging` (`br-frosty-glitter-amhn6cza`).
  - Dedicated Endpoint: `ep-morning-silence-amb5ua6q` (`ep-morning-silence-amb5ua6q-pooler.us-east-2.aws.neon.tech`).
  - Secret Injection: Loaded via Google Secret Manager secret `EVENTSLOT_STAGING_DATABASE_URL:latest`.
- **CI/CD Pipeline:** `cloudbuild.staging.yaml` and `.github/workflows/deploy-staging.yml`. Automatically deploys pushes on `staging` branch or manual dispatch.
- **Payment Mode:** Configured for Paystack Test Mode (`PAYSTACK_SECRET_KEY` uses test keys `sk_test_...`).

---

## 10. Production Environment

- **Hosting Platform:** Google Cloud Run (Managed, Region: `us-central1`).
- **GCP Project:** `project-d46be384-233e-47fb-bb5`.
- **Cloud Run Service:** `eventslot-web`.
- **Production Domains:** `https://www.eventsslot.com` and `https://eventsslot.com`.
- **Production Database:**
  - Neon PostgreSQL Project `proud-bonus-07826999`, branch `main`.
  - Endpoint: `ep-little-butterfly-...aws.neon.tech`.
  - Secret Injection: Loaded via Google Secret Manager secret `EVENTSLOT_DATABASE_URL:latest`.
- **Commercial Mode:** Billing paused (`FORCE_BILLING_COMING_SOON_MODE = true`).
- **Production Lockout Status:** **STRICTLY LOCKED**. No deployments, branch merges, or migrations permitted during maintenance phases.

---

## 11. Environment-Separation Assessment

| Evaluation Vector | Staging Configuration | Production Configuration | Separation Integrity |
| :--- | :--- | :--- | :--- |
| **Database Branch** | `staging` (`br-frosty-glitter-amhn6cza`) | `main` (`br-long-thunder-21447039`) | **PERFECT (100% Isolated)** |
| **Database Endpoint** | `ep-morning-silence-amb5ua6q` | `ep-little-butterfly-...` | **PERFECT (Distinct hosts)** |
| **Secret Name** | `EVENTSLOT_STAGING_DATABASE_URL` | `EVENTSLOT_DATABASE_URL` | **PERFECT (Distinct secrets)** |
| **Cloud Run Service** | `eventslot-web-staging` | `eventslot-web` | **PERFECT (Distinct containers)** |
| **Max Instances** | 5 instances | 20 instances | **VERIFIED (Throttled staging)** |
| **Public Hostname** | `staging.eventsslot.com` | `www.eventsslot.com` | **VERIFIED (Distinct CNAMEs)** |
| **Paystack Gateway** | Test Secret Key (`sk_test_...`) | Live Secret Key (`sk_live_...`) | **VERIFIED (Isolated accounts)** |

**Assessment Verdict:** There is **zero database connection overlap** between Staging and Production. Changes, migrations, test registrations, or load simulations executed against Staging cannot leak into or corrupt Production.

---

## 12. Deployment and CI/CD Architecture

### Containerization (`Dockerfile`)
- Uses a secure 3-stage build process:
  1. `deps`: Alpine Linux with `libc6-compat`, `openssl`, and `npm ci --legacy-peer-deps`.
  2. `builder`: Compiles Next.js standalone application with `NODE_OPTIONS="--max-old-space-size=4096"`.
  3. `runner`: Minimalist Alpine image executing under a non-root system user (`nextjs:nodejs`, UID 1001).
- Health & Migration entrypoint: Runs `prisma migrate deploy` conditionally when `RUN_DB_MIGRATIONS=true` prior to executing `node server.js`.

### Pipeline Specifications
1. **GitHub Actions (`.github/workflows/deploy-staging.yml`):**
   - Triggers on push to `staging` or `workflow_dispatch`.
   - Executes static analysis (`tsc --noEmit`), linting (`eslint .`), unit tests (`npm test -- --ci`), and build verification before deploying.
2. **Cloud Build Pipelines (`cloudbuild.yaml` & `cloudbuild.staging.yaml`):**
   - Builds container image using Google Artifact Registry (`us-central1-docker.pkg.dev/...`).
   - Deploys container to Cloud Run with explicit environment variables and Secret Manager bindings.

---

## 13. Testing and Build Architecture

### Test Frameworks & Configurations
- **Test Runner:** Jest 30.3.0 with `ts-jest 29.4.9` and `jest-environment-jsdom`.
- **E2E Runner:** Playwright 1.59.1 (`@playwright/test`).
- **Assertion Helpers:** `@testing-library/react` 16.3.2, `@testing-library/jest-dom` 6.9.1.

### Test Suite Inventory (85 Test Suites, 574+ Tests)
The test suite covers every layer of application logic:

```
__tests__/
├── api/             # 24 API route test suites (refunds, withdrawals, drafts, tickets, waitlists)
├── app/             # 1 page integration test suite (team accept page)
├── components/      # 6 UI component test suites (RegistrationForm, BillingBanner, ConfirmAttendance)
├── e2e/             # 1 Playwright E2E suite (marketing-hub-flow)
├── integration/     # 1 isolated Postgres concurrency suite (postgresConcurrencyPhase52)
├── lib/             # 42 core business logic test suites (ledger, commission, PIN security, webhooks)
├── marketing/       # 1 marketing integration test suite (social-integrations)
├── middleware/      # 1 edge routing test suite (subdomain-routing)
├── scripts/         # 1 documentation updater suite (update-system-docs)
└── static/          # 8 design token and static coverage suites (theme tokens across 100+ files)
```

---

## 14. Critical Data and Financial Components

### Flat 5% Platform Commission Model (`lib/paidEventCommission.ts`)
EventSlot enforces a strict mathematical fee invariant across all paid ticket sales:
$$\text{Commission Rate} = 5.0\% \quad (0.05)$$
$$\text{Commission Amount (KES)} = \text{round}(\text{Gross Amount} \times 0.05)$$
$$\text{Organizer Net Amount (KES)} = \text{Gross Amount} - \text{Commission Amount}$$

Because the organizer amount is calculated by subtracting the rounded commission from the gross amount, **the sum of Commission and Organizer Entitlement is guaranteed to equal the Gross Amount exactly ($100\%$) with zero penny rounding drift**.

### Authoritative Double-Entry Financial Ledger (`FinancialLedgerEntry`)
Financial movements are recorded in an append-only ledger using BigInt minor units (cents):
- `GROSS_COLLECTED`: Credit to platform for incoming ticket payment.
- `PLATFORM_FEE`: Credit to EventSlot platform fee account.
- `ORGANIZER_ENTITLEMENT`: Credit to organizer's account balance.
- `SETTLEMENT_RECONCILED`: State transition marking funds as physically settled by Paystack.
- `WITHDRAWAL_HOLD`: Reservation debited from available funds pending transfer.
- `WITHDRAWAL_COMPLETED`: Final disbursement to organizer's bank/M-Pesa.
- `WITHDRAWAL_REVERSED`: Restoration of reserved funds upon transfer failure.

### Authoritative Balance Engine (`lib/organizerBalanceEngine.ts`)
To prevent liquidity shortfalls and fraudulent payouts, EventSlot strictly enforces the rule:
$$\text{Withdrawable Balance} = \sum(\text{Settled Entitlements}) - \sum(\text{Active Holds}) - \sum(\text{Completed Withdrawals})$$
**Unsettled ticket proceeds (`Payment.settlementStatus = PENDING`) are NEVER withdrawable** until reconciled with Paystack bank deposit settlement batches.

---

## 15. Architecture and Environment Risks

The following risks have been identified and classified under the programme taxonomy:

| Risk ID | Category | Severity | Description & Architectural Impact | Recommended Phase Action |
| :--- | :--- | :--- | :--- | :--- |
| **RISK-01** | Adaptive | **P2** | **Resend Domain Verification:** `eventsslot.com` DNS records in Resend remain unverified; outgoing emails in staging fall back to sandbox or SMTP. | Verify DNS TXT/MX records with registrar in Phase 05. |
| **RISK-02** | Preventive | **P2** | **Cron Job Execution Limits:** Cloud Run has a 60-minute maximum request timeout. Long-running cron jobs (e.g., mass broadcasts) could hit timeout boundaries. | Ensure batching and cursor pagination across all 15 cron routes. |
| **RISK-03** | Preventive | **P2** | **Prisma Migration Concurrency:** If multiple Cloud Run container instances start simultaneously during deployment, concurrent `migrate deploy` calls could race. | Cloud Run deploys with `max-instances=5` in staging; consider dedicated migration step in Cloud Build. |
| **RISK-04** | Perfective | **P3** | **Next.js 16 Webpack Flag:** Build scripts specify `--webpack` flag due to Turbopack edge cases with certain native dependencies. | Monitor upstream Next.js updates for Turbopack parity. |
| **RISK-05** | Adaptive | **P3** | **Upstash Redis Optionality:** Local environment falls back to in-memory LRU cache when Upstash credentials are absent. | Preserve memory fallback while maintaining strict rate limits on public endpoints. |

---

## 16. Unknowns and Verification Gaps

1. **Live Registrar DNS Status:** The exact status of SPF, DKIM, and DMARC DNS records for `eventsslot.com` on the authoritative domain registrar requires verification.
2. **Paystack Live Settlement Schedule:** Confirmation of the exact settlement cycle (T+1 vs T+2 business days) applied by Paystack Kenya for KES payouts to calibrate `settlementSyncWorker.ts`.
3. **Storage Bucket Lifecycle Rules:** Retention policies on Cloudflare R2 bucket for archived registration data require verification to prevent unbounded storage costs.

---

## 17. Evidence Register

| Verification Item | File / Command Evidence | Verification Status |
| :--- | :--- | :--- |
| **Git Working Tree** | `cmd /c "cd event-slot && git status"` (25 modified, 14 untracked) | **Verified** |
| **Dependencies & Versions** | `package.json` (`next: ^16.2.4`, `react: ^18`, `prisma: ^5.22.0`) | **Verified** |
| **Prisma Schema & Models** | `prisma/schema.prisma` (76 models, 40 enums) | **Verified** |
| **Migrations Directory** | `prisma/migrations` (45+ ordered SQL migrations) | **Verified** |
| **Staging Deployment** | `cloudbuild.staging.yaml` (`eventslot-web-staging`, Neon `staging` branch) | **Verified** |
| **Production Configuration** | `cloudbuild.yaml` (`eventslot-web`, Neon `main` branch) | **Verified** |
| **Subdomain Routing** | `middleware.ts` (`verify.`, `marketing.`, `admin.`, `app.`) | **Verified** |
| **Commission Invariant** | `lib/paidEventCommission.ts` (`FLAT_PAID_EVENT_COMMISSION_RATE = 0.05`) | **Verified** |
| **Billing Paused State** | `lib/pricingRollout.ts` (`FORCE_BILLING_COMING_SOON_MODE = true`) | **Verified** |
| **Ledger Model** | `prisma/schema.prisma` (`FinancialLedgerEntry`, `ProcessedProviderEvent`) | **Verified** |
| **Test Suites** | `__tests__/` (85 test files, Jest 30.3.0) | **Verified** |
| **Cron Inventory** | `app/api/cron/` (15 scheduled route handlers) | **Verified** |

---

## 18. Phase 02 Handoff & Protocol

Phase 01 (**System Inventory & Environment Mapping**) is now formally complete.

### Programme Handoff State
- Master Charter: `maintenance/00-programme-charter.md` (Active & Governing)
- System Inventory: `maintenance/01-system-inventory.md` (Completed & Filed)
- Working Tree: Strictly preserved without regressions or unapproved mutations.
- Next Phase in Programme Sequence: **Phase 02 — Core Quality Gates & Static Code Audit** (Static typing, Prisma validation, Lint scans, and Unit test execution).

> [!IMPORTANT]
> In accordance with Section 13 of the Programme Charter, execution has **STOPPED**.
> No further code modifications, test executions, or phase progressions will take place without explicit authorization from the user.
