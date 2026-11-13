# EventSlot Technologies — Full System Maintenance Programme
## Phase 00 — Programme Initialization & Master Safety Controls Charter

**Document Version:** 1.0.0  
**Effective Date:** 23 October 2026  
**Programme Lead:** Chief Technology Officer (CTO) & Technical Audit Board  
**Target Repository:** `Officialkid/event-slot`  
**Base Branch:** `audit/phase-5-7-concurrency-ci`  
**Current HEAD Commit:** `ff277de`  
**Status:** **OFFICIALLY INITIALIZED — IMPLEMENTATION ON HOLD PENDING EXPLICIT PHASE AUTHORIZATION**

---

## 1. Executive Summary

This Master Charter establishes the official governance, quality controls, safety constraints, and execution methodology for the **EventSlot Full System Maintenance Programme**.

Following the successful implementation and local verification of Phases 1 through 8 (free and paid event registration, capacity reservation holds, 5% platform commission, 95% organizer entitlement, authoritative ledger accounting, safe Paystack withdrawals, and staging deployment), EventSlot has reached product baseline maturity. 

The application is now transitioning from active feature expansion into a structured, highly disciplined **System Maintenance Cycle**. This programme does not build speculative new features, does not rewrite operational codebases, and does not redesign working UI flows. Instead, it systematically audits, stabilizes, hardens, documents, and refines the entire application ecosystem across the four internationally recognized software maintenance dimensions: **Corrective**, **Preventive**, **Adaptive**, and **Perfective** maintenance.

Every future maintenance phase (Phase 01 through completion) is strictly governed by the rules, severity frameworks, environment boundaries, and authorization protocols set forth in this document.

---

## 2. Programme Objectives

The primary objective of the Full System Maintenance Programme is to achieve enterprise-grade stability, mathematical financial integrity, robust test coverage, and seamless developer operations across all EventSlot services.

Specifically, the programme mandates:
1. **Defect Remediation (Corrective):** Identify and resolve verified functional bugs, edge-case race conditions, broken links, stale state mutations, and unhandled errors without introducing regressions.
2. **Technical Debt & Risk Mitigation (Preventive):** Eliminate dead code, unused dependencies, memory leaks, missing database indexes, unhandled promise rejections, and insecure defaults before they manifest in production.
3. **Ecosystem & API Alignment (Adaptive):** Guarantee flawless interoperability with external providers (Paystack API, Neon PostgreSQL, Google Cloud Run, Google Cloud Storage / Cloudflare R2, Resend SMTP) across SDK version bumps and runtime shifts.
4. **Experience, Maintainability & Performance Hardening (Perfective):** Polish UI/UX responsiveness, accessibility (WCAG AA), Core Web Vitals (LCP/FID/CLS), theme variable consistency, documentation completeness, and test automation coverage.
5. **Absolute Environment Safeguards:** Enforce strict isolation between Development, Staging, and Production environments, eliminating cross-environment contamination and unauthorized production mutations.

---

## 3. Programme Scope

The scope of this maintenance programme encompasses all code, configuration, database schemas, and infrastructure definitions within `Officialkid/event-slot`:

- **Organizer Dashboard & Event Management:** Creation wizard, question builder, ticket tier configuration, event editing, and status lifecycles.
- **Attendee Registration & Ticketing:** Public event pages, multi-step registration wizard, waitlist promotion engine, QR ticket issuance, PDF ticket generation, and door walk-in check-in.
- **Financial & Payment Infrastructure:**
  - Flat 5% platform commission calculation engine (`lib/paidEventCommission.ts`).
  - 95% net organizer entitlement rules.
  - Paystack hosted checkout initialization and status verification (`lib/paystack.ts`).
  - Timing-safe HMAC-SHA512 webhook dispatching (`lib/paystackWebhookDispatcher.ts`).
  - Processed provider event deduplication and idempotent replay protection.
  - Double-entry authoritative financial ledger (`FinancialLedgerEntry`).
  - Settlement reconciliation worker (`SettlementReconciliation`).
  - Withdrawable balance calculation based exclusively on settled funds (`lib/organizerBalanceEngine.ts`).
  - Safe withdrawal requests, balance holds, reversals, and PIN verification (`lib/withdrawalService.ts`).
- **Communication & Marketing:** Email broadcasting, Resend integration, unsubscribe handling, and community referral tracking.
- **AI & Platform Intelligence:** EventSlot Assistant widget, conversation memory, audio transcription, and quota management.
- **Administrative Portals:** `/admin` health monitoring, system diagnostics, audit logging, and privileged account security.
- **DevOps, CI/CD & Testing:** Cloud Run configurations, Cloud Build pipelines, Jest unit/integration test suites (85 suites, 574+ tests), and Playwright E2E specifications.

---

## 4. Out of Scope

To prevent scope creep, accidental architectural destabilization, and commercial disruption, the following areas are **STRICTLY OUT OF SCOPE** for this maintenance programme:

1. **Subscription Billing Activation:**
   - `FORCE_BILLING_COMING_SOON_MODE = true` in `lib/pricingRollout.ts` must remain **LOCKED**.
   - No recurring subscription charges, automatic credit-card debits, plan upgrade checkout flows, or subscription activation will be built or deployed.
   - Open access for organizers remains in effect until the publicly stated rollout date (1 July 2026).
2. **Commercial Model Modifications:**
   - The flat 5% platform commission on paid tickets is immutable.
   - The 95% organizer net entitlement is immutable.
   - Free event registration remains permanently free.
3. **Architectural Rewrites & Framework Migrations:**
   - No migration from Next.js App Router to alternative frameworks.
   - No replacement of Prisma ORM, Tailwind CSS, or NextAuth.
4. **Speculative Feature Creation:**
   - No unrequested product features, experimental modules, or secondary business models.

---

## 5. Maintenance Categories

Every finding, task, test failure, and code improvement within this programme must be formally categorized under one or more of the four ISO/IEC 14764 software maintenance classifications:

```
┌────────────────────────────────────────────────────────────────────────┐
│               EVENTSLOT MAINTENANCE TAXONOMY (ISO/IEC 14764)            │
├────────────────────┬───────────────────────────────────────────────────┤
│ Category           │ Definition & Scope in EventSlot                   │
├────────────────────┼───────────────────────────────────────────────────┤
│ 1. CORRECTIVE      │ Reactive remediation of verified defects, broken  │
│                    │ flows, test regressions, API errors, or math bugs.│
├────────────────────┼───────────────────────────────────────────────────┤
│ 2. PREVENTIVE      │ Proactive mitigation of latent risks, memory      │
│                    │ bloat, race conditions, edge cases, and tech debt.│
├────────────────────┼───────────────────────────────────────────────────┤
│ 3. ADAPTIVE        │ Modifications to ensure harmony with third-party  │
│                    │ APIs (Paystack, Neon), hosting, and node runtimes.│
├────────────────────┼───────────────────────────────────────────────────┤
│ 4. PERFECTIVE      │ Enhancements to speed, accessibility, clarity,    │
│                    │ responsive layouts, logging, and test coverage.   │
└────────────────────┴───────────────────────────────────────────────────┘
```

---

## 6. Environment Protection Rules

EventSlot operates across three distinct tiers. Maintenance activities must strictly respect these immutable boundary controls:

```
[ Local Development ]  ──(Isolated Docker / Mock)──> No shared DB connection
         │
         ▼
  [ Staging ]          ──(Neon 'staging' Branch)───> https://staging.eventsslot.com
         │
         ▼
 [ Production (LIVE) ] ──(STRICT LOCKOUT)──────────> https://www.eventsslot.com
```

### Environment Invariants
1. **Production Lockout:**
   - **ZERO** production code deployments.
   - **ZERO** production database migrations or schema adjustments.
   - **ZERO** live financial transactions, live Paystack API calls, or payouts.
   - **ZERO** production branch merges (`main` / `master`) without formal, signed CTO authorization.
2. **Database Isolation:**
   - Local development must **NEVER** connect to `ep-little-butterfly-...aws.neon.tech` (Production Neon).
   - Staging must execute exclusively against the dedicated Neon `staging` branch (`br-frosty-glitter-amhn6cza`, endpoint `ep-morning-silence-amb5ua6q`).
   - Any test migrations, schema pushes, or test seeds must run only against ephemeral local databases or the isolated staging branch.
3. **Secret Separation:**
   - Staging uses `EVENTSLOT_STAGING_DATABASE_URL` and `PAYSTACK_TEST_SECRET_KEY` (`sk_test_...`).
   - Production secrets (`EVENTSLOT_DATABASE_URL`, `PAYSTACK_SECRET_KEY`) must never be loaded into local or staging runtimes.

---

## 7. Risk Classification

Risks identified during any phase of maintenance must be evaluated against EventSlot's core operational pillars:

- **Financial Risk:** Inaccuracies in commission calculation, double withdrawals, ledger imbalance, or unauthorized balance releases.
- **Data Integrity Risk:** Schema drift, lost registrations, capacity overselling, or corrupted audit logs.
- **Availability Risk:** Container startup crashes, unhandled SSR errors, database connection pool exhaustion, or memory exhaustion.
- **Security & Privacy Risk:** Exposed API secrets, broken HMAC webhook signatures, missing CSRF/timing protection, or unauthorized admin access.
- **User Experience Risk:** Form submission failures, unresponsive layout breakpoints, or unhandled loading states.

---

## 8. Issue Severity Matrix

Any discovered defect, discrepancy, or improvement opportunity must be prioritized according to the following 4-tier matrix:

| Severity Level | Definition | Response / Resolution SLA |
| :--- | :--- | :--- |
| **P0 — Critical Blocker** | Financial discrepancy, ledger imbalance, live transaction error, security breach, production database hazard, or total crash of core journey. | Immediate halt of maintenance progression. Fix and verify before all else. |
| **P1 — High Severity** | Core user journey impaired (e.g. registration blocked, webhook deduplication failure, withdrawal hold failure) with no workaround. | Must be scheduled and resolved in the immediate phase. |
| **P2 — Medium Severity** | Secondary feature defect (e.g. export formatting bug, non-critical notification delay, minor UI theme inconsistency, test failure). | Resolved during standard phase execution. |
| **P3 — Low / Quality** | Cosmetic alignment, typographical polish, code comment clarity, non-blocking warning log, or minor performance optimization. | Addressed as time permits or batched into perfective polish. |

---

## 9. Reporting Standards

Every maintenance phase must yield a structured, versioned audit report adhering to the following standardization rules:
1. **Header Identification:** Phase identifier, title, author role, date, git commit hash, and branch.
2. **Audit Inventory:** Exact list of files inspected, lines reviewed, and test suites executed.
3. **Categorized Findings:** Findings mapped explicitly to Corrective, Preventive, Adaptive, or Perfective categories with assigned P0–P3 severity.
4. **Verification Evidence:** Unambiguous evidence (terminal output, test passes, curl responses, HTTP status codes) proving claims.
5. **Phase Conclusion:** Explicit status: `PHASE COMPLETED — READY FOR NEXT PHASE REVIEW` or `BLOCKED`.

---

## 10. Evidence Requirements

Subjective claims or unverified assumptions are strictly prohibited across all maintenance phases:
- **"Tests pass"** requires actual Jest CLI output showing suite count, test count, and runtime.
- **"Types pass"** requires `tsc --noEmit` exit code 0.
- **"Schema is valid"** requires `prisma validate` output confirmation.
- **"Endpoint is healthy"** requires HTTP status code and response payload from live probes.
- **"Ledger is balanced"** requires exact mathematical formula validation:
  $$\text{Gross Amount} = \text{Commission (5\%)} + \text{Organizer Net (95\%)}$$
  $$\text{Withdrawable Balance} = \sum(\text{Settled Credits}) - \sum(\text{Settled Debits}) - \sum(\text{Active Holds})$$

---

## 11. Testing Standards

Maintenance phases that evaluate or touch code must run the three-tier testing hierarchy:
1. **Tier 1 — Static Analysis & Validation:**
   - TypeScript compiler validation: `npx tsc --noEmit`.
   - Prisma schema validation: `npx prisma validate`.
   - ESLint code quality scan: `npm run lint`.
2. **Tier 2 — Automated Jest Unit & Mock Integration:**
   - 85 test suites covering financial math, ledger entries, webhook signatures, rate limiters, PIN lockouts, and registration wizards.
   - Passing threshold: **100% of runnable suites must pass (0 failures allowed)**.
3. **Tier 3 — Isolated Concurrency & Integration:**
   - Real PostgreSQL engine concurrency tests (`postgresConcurrencyPhase52.test.ts`) executed only when `TEST_POSTGRES_DATABASE_URL` is set to an isolated disposable container.

---

## 12. Phase Progress Tracking

The maintenance programme will execute sequentially across clearly defined milestones:

```
[ Phase 00 ]  Programme Initialization & Master Safety Controls (CURRENT)
     │
     ▼
[ Phase 01 ]  Core Quality Gates & Build Verification
     │
     ▼
[ Phase 02 ]  Financial Engine, Ledger & Commission Reconciliation Audit
     │
     ▼
[ Phase 03 ]  Attendee Registration & Capacity Reservation Integrity Audit
     │
     ▼
[ Phase 04 ]  Organizer Dashboard, Payments Center & Assistant Surface Audit
     │
     ▼
[ Phase 05 ]  Staging Verification & Pre-Production Hardening Review
     │
     ▼
[ Phase 06 ]  Final Programme Wrap-up & Executive Sign-off
```

---

## 13. Continuation Rules

To maintain rigorous quality control, the following rules govern phase transitions:
1. **Single Phase Execution:** Each prompt or invocation must focus exclusively on its assigned phase.
2. **Stop Condition:** Upon completing a phase's deliverables, execution must **STOP**. Do not bleed into subsequent phases.
3. **Explicit Authorization:** Progression to the next phase requires explicit user instruction.
4. **Zero Regression Invariant:** A phase cannot be marked complete if any previously passing test suite regressed.

---

## 14. Completion Definition

A maintenance phase is formally complete **ONLY** when:
- All required inspections have been performed against actual code.
- All findings are classified by maintenance category and severity level.
- The corresponding phase report has been written and saved under `maintenance/`.
- The repository working tree remains clean, intact, and preserved.
- No unauthorized git mutations, deployments, or migrations occurred.

---

## 15. Authorization Requirements

Any action that transitions beyond inspection and documentation requires explicit authorization:
- **Code Modification:** Requires authorized Phase specification.
- **Git Commits / Branches:** Requires explicit user sign-off.
- **Staging Deployment:** Requires explicit authorization and isolated database verification.
- **Production Deployment:** STRICTLY PROHIBITED in maintenance cycles unless emergency hotfix protocol is enacted by the executive stakeholder.

---

## 16. Known Product Constraints

All maintenance engineers must respect these existing product boundaries:
1. **Subscription Rollout Postponed:** Free open access is active; commercial subscription billing is intentionally postponed to 1 July 2026.
2. **Commission Rate:** Fixed at flat 5.0% (`0.05`) for all paid ticket sales.
3. **Withdrawable Balance:** Derived strictly from settled funds. Unsettled transactions cannot increase withdrawable amounts.
4. **Resend Sender Domain:** `eventsslot.com` DNS records in Resend remain unverified; test emails are subject to sandbox routing.
5. **Postgres Concurrency Tests:** Skipped when `TEST_POSTGRES_DATABASE_URL` is unset to safeguard remote databases.

---

## 17. Current Product Status

The EventSlot platform currently features:
- **Public & Discovery:** Landing page, responsive event catalog, searchable date windows, category filters, and SEO sitemaps.
- **Organizer Workspace:** Multi-event overview, real-time ticket sales metrics, waitlist caps, door check-in QR scanner, email broadcast campaign manager, team collaboration, and EventSlot Assistant.
- **Attendee Flow:** Multi-step wizard, ticket tier selector, walk-in registration, Paystack checkout, instant confirmation codes, and PDF ticket generator.
- **Financial Center:** Real-time ledger audit, settled vs. pending balance cards, safe withdrawal requests with PIN validation, and Paystack transfer tracking.

---

## 18. Current Financial Architecture

The financial ecosystem relies on an immutable double-entry ledger architecture:
- **Payment Ingestion:** Paystack hosted checkout $\to$ Webhook received at `/api/webhooks/paystack`.
- **Webhook Hardening:** Timing-safe HMAC-SHA512 verification (`lib/paystack.ts`) $\to$ Idempotent deduplication in `ProcessedProviderEvent`.
- **Commission Split:**
  - Gross: 100%
  - Platform Fee: Flat 5% recorded in ledger as credit to platform account.
  - Organizer Net: 95% recorded in ledger as credit to organizer account.
- **Settlement Lifecycle:** Funds remain in `PENDING_SETTLEMENT` until `settlementSyncWorker.ts` reconciles with Paystack settlement reports, transitioning funds to `SETTLED`.
- **Withdrawals:** Deducted from settled balance, held under reservation (`PENDING`), and disbursed via Paystack Transfer API. Reversals or failures cleanly refund reserved balances via unique idempotency keys.

---

## 19. Current Deployment Architecture

- **Hosting Platform:** Google Cloud Run (Region: `us-central1`, Managed).
- **GCP Project:** `project-d46be384-233e-47fb-bb5`.
- **Services:**
  - Production: `eventslot-web` $\to$ `https://www.eventsslot.com`
  - Staging: `eventslot-web-staging` $\to$ `https://staging.eventsslot.com`
- **Database Architecture:**
  - Production Database: Neon PostgreSQL (`ep-little-butterfly-...aws.neon.tech`)
  - Staging Database: Neon PostgreSQL Isolated Branch `staging` (`br-frosty-glitter-amhn6cza`, endpoint `ep-morning-silence-amb5ua6q`)
- **Container Build:** Google Cloud Build (`cloudbuild.staging.yaml` and `cloudbuild.yaml`) pushing to Artifact Registry.
- **Asset Storage:** Cloudflare R2 / Google Cloud Storage for ticket QR codes and event imagery.

---

## 20. Current Maintenance Strategy

The strategy for this maintenance programme follows a **Zero-Disruption, Safety-First Mandate**:
1. Every phase begins with an inspection of the working tree to guarantee zero accidental modifications.
2. Analysis is performed using static tooling, type checking, and unit testing without connecting to live databases.
3. Findings are categorized and documented with file references, exact function names, and root-cause explanations.
4. Corrective and preventive actions are verified locally, audited for regressions, tested against staging, and never deployed live without explicit authorization.

---

*Charter approved and established by EventSlot CTO & Senior Leadership.*
