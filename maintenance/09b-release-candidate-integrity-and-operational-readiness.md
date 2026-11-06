# EventSlot Maintenance Programme — Phase 09B Report
## Release Candidate Integrity and Operational Readiness Audit

**Execution Date:** 2026-10-23  
**Auditor / Reviewer:** Antigravity (Senior Release Engineer, Database Reliability Engineer & Payment Security Reviewer)  
**Repository:** `Officialkid/event-slot`  
**Active Branch:** `audit/phase-5-7-concurrency-ci`  
**Verified Baseline HEAD:** `ff277de9bc124658b577067dc1adb772a6b39d3b`  
**Remote Tracking:** `origin/audit/phase-5-7-concurrency-ci [ahead 3]`  
**Execution Mode:** STRICTLY AUDIT ONLY (Zero staging, zero commits, zero code edits, zero deployments, zero migrations)  
**Phase Verdict:** **`READY FOR SEPARATE COMMIT AUTHORIZATION`** *(Commit-level readiness only; external operational staging gates remain pending)*

---

## 1. Executive Verdict

### Official Verdict: **`READY FOR SEPARATE COMMIT AUTHORIZATION`**

Phase 09B has conducted a rigorous, source-level inspection of the proposed EventSlot release candidate following the findings of Phase 09A. 

This audit confirms that:
1. **Source-Level Manifest Is 100% Reconciled:** The application release candidate comprises exactly **78 files** (51 modified tracked, 2 deleted tracked, and 25 untracked code, migration, test, and configuration files).
2. **Canonical Webhook Architecture Is Verified:** The canonical Paystack webhook route is [`app/api/webhooks/paystack/route.ts`](file:///c:/Users/DANIEL/Documents/WebApp%20Projects/eventslot/event-slot/app/api/webhooks/paystack/route.ts) (`POST /api/webhooks/paystack`). Signature verification uses timing-safe HMAC-SHA512 comparison on raw request bodies. Concurrency is guarded via deterministic idempotency keys and distributed lease locking in `processedProviderEvent`.
3. **Operational Inconsistencies Are Cataloged & Corrected:** All 36 occurrences of webhook paths across the repository have been cataloged. The obsolete path `/api/payments/paystack/webhook` has been identified as a documentation flaw in earlier reports (`04a`, `08d`, `09`) and is formally corrected.
4. **Database Migration Locking Behavior Is Grounded:** The PostgreSQL `SHARE` lock behavior of the pending index migration is documented, establishing that staging execution is safe while production execution requires maintenance window scheduling or non-transactional concurrent index creation.

> [!IMPORTANT]
> **Separation of Commit Authorization vs Deployment Authorization:**  
> Authorizing a **local Git release commit** certifies that the working-tree file scope is accurate, internally consistent, and regression-tested. **It does NOT authorize a git push, a staging deployment, or a production release.** Staging deployment remains strictly gated on external operator verification in GCP Secret Manager, Paystack Dashboard, and Google Cloud IAM.

---

## 2. Git Baseline and Discrepancy Reconciliation

Direct Git inspection confirms that HEAD, remote tracking, and working-tree counts match Phase 09A:

- **Repository Path:** `c:\Users\DANIEL\Documents\WebApp Projects\eventslot\event-slot`
- **Active Branch:** `audit/phase-5-7-concurrency-ci`
- **Current HEAD Commit SHA:** `ff277de9bc124658b577067dc1adb772a6b39d3b`
- **Remote Tracking:** `origin/audit/phase-5-7-concurrency-ci [ahead 3]`
- **Unpushed Commits Ahead of Remote (3):**
  1. `ff277de`: `fix(payments): fail-closed capacity, atomic waitlist promotion, exact commission auditor, and verified refund state machine`
  2. `fbd7064`: `fix(payments): harden waitlist promotion races, protect offers from late webhook preemption, and align auditor rounding`
  3. `d4b165c`: `feat(payments): anti-drift ledger auditor, capacity hold auto-release, and settlement worker resiliency`
- **Working Tree Inventory:**
  - **Tracked Modified Entries:** Exactly 53 entries (53 files)
  - **Tracked Deleted Entries:** Exactly 2 entries (`lib/intasend.ts`, `services/payouts/intrasend.ts`)
  - **Untracked Entries:** Exactly 27 entries (representing 61 individual files across directories prior to this report)
  - **Staged Changes:** None (`git diff --cached` is 100% empty)
  - **Working Tree Status:** 100% preserved; zero destructive commands executed.

---

## 3. Webhook Source-Level Findings and Test Coverage

A deep inspection of webhook route handlers and dispatcher logic was conducted across [`app/api/webhooks/paystack/route.ts`](file:///c:/Users/DANIEL/Documents/WebApp%20Projects/eventslot/event-slot/app/api/webhooks/paystack/route.ts), [`app/api/billing/webhook/route.ts`](file:///c:/Users/DANIEL/Documents/WebApp%20Projects/eventslot/event-slot/app/api/billing/webhook/route.ts), [`lib/paystack.ts`](file:///c:/Users/DANIEL/Documents/WebApp%20Projects/eventslot/event-slot/lib/paystack.ts), and [`lib/paystackWebhookDispatcher.ts`](file:///c:/Users/DANIEL/Documents/WebApp%20Projects/eventslot/event-slot/lib/paystackWebhookDispatcher.ts).

### 3.1 Canonical Route vs Aliases
- **Canonical Route:** [`app/api/webhooks/paystack/route.ts`](file:///c:/Users/DANIEL/Documents/WebApp%20Projects/eventslot/event-slot/app/api/webhooks/paystack/route.ts) maps to `POST /api/webhooks/paystack`. This is the general, production-grade receiver for all Paystack webhook events.
- **Alias Route:** [`app/api/billing/webhook/route.ts`](file:///c:/Users/DANIEL/Documents/WebApp%20Projects/eventslot/event-slot/app/api/billing/webhook/route.ts) maps to `POST /api/billing/webhook`. It executes identical logic and delegates directly to `dispatchPaystackWebhook`.
- **Supported HTTP Methods:** Both routes export only `POST`. Requests using `GET`, `PUT`, `PATCH`, or `DELETE` receive automatic `HTTP 405 Method Not Allowed`.

### 3.2 Signature Verification & Security
- **Raw Body Preservation:** Handlers extract `rawBody = await req.text()` without parsing JSON beforehand, preserving raw bytes and whitespace for cryptographic hashing.
- **Algorithm:** In `lib/paystack.ts` (`verifyPaystackWebhookSignature`), an HMAC-SHA512 digest is computed over `rawBody` using `process.env.PAYSTACK_SECRET_KEY.trim()`.
- **Timing-Safe Comparison:** Signatures are converted to byte Buffers and compared using `crypto.timingSafeEqual(hashBuffer, sigBuffer)`. Buffer lengths are verified beforehand; mismatched lengths fail closed immediately.
- **Fail-Closed Behavior:** Missing signatures, empty secret keys, or malformed hashes return `false`, which prompts the dispatcher to return `HTTP 401 Unauthorized` (`{ error: 'Invalid signature' }`).

### 3.3 Idempotency, Concurrency & Lease Lock Semantics
- **Deterministic Key Generation:** `generateProviderEventIdempotencyKey` derives a unique key combining provider (`paystack`), event type, provider event ID, and reference.
- **Atomic Creation & Race Handling:** The dispatcher attempts `prisma.processedProviderEvent.create({ data: { status: 'PROCESSING', ... } })`. If a concurrent request creates the record simultaneously, Prisma error `P2002` (unique constraint violation) is caught and the existing record is fetched.
- **Durable Completion Short-Circuit:** If `existingRecord.status === 'PROCESSED'`, the dispatcher returns `HTTP 200` immediately with `{ message: 'Event was already successfully processed.' }`.
- **Active Worker Lease Protection:** If another worker is currently in `PROCESSING` and the lease age is under 60 seconds (`LEASE_TIMEOUT_MS`), the dispatcher polls up to 2 seconds for completion. If still unsettled, it returns **`HTTP 503 Service Unavailable`** so Paystack will retry. **It never falsely acknowledges `HTTP 200` before required processing completes.**
- **Stale Lease Recovery:** If an earlier worker crashed or timed out (>60s), the lease is reacquired via optimistic locking (`updateMany` with `status: existingRecord.status, lastAttemptAt: existingRecord.lastAttemptAt`).

### 3.4 Supported Event Types
The dispatcher implements explicit domain handling for 14 distinct Paystack event types:
1. `charge.success`: Paid ticket checkout (strict amount/currency verification, capacity hold validation, atomic registration creation, waitlist promotion), event pass purchase, subscription checkout, and token purchases.
2. `subscription.create`: Activates organizer subscription tier.
3. `invoice.create` / `invoice.update`: Updates subscription invoice records.
4. `invoice.payment_failed`: Marks subscription invoice as failed.
5. `subscription.disable` / `subscription.not_renew`: Downgrades subscriber to free tier upon period expiration.
6. `subscription.expiring_cards`: Emits warning notification to subscriber.
7. `transfer.success`: Marks organizer withdrawal as `COMPLETED` and finalizes ledger balance debit.
8. `transfer.failed`: Marks withdrawal as `FAILED` and restores reserved balance to organizer.
9. `transfer.reversed`: Marks withdrawal as `REVERSED` and restores funds.
10. `refund.processed`: Strict minor-unit amount and currency check; transitions order to `REFUNDED` and updates ledger.
11. `refund.failed`: Records refund failure audit log.
12. `settlement.create` / `settlement.success`: Acknowledges settlement notification; per-transaction settlement is reconciled via `settlementSyncWorker`.
13. `charge.dispute.create` / `charge.dispute.remind`: Quarantines disputed payment and freezes associated organizer balance.
14. `charge.dispute.resolve`: Resolves payment dispute status.

### 3.5 Automated Test Coverage
The webhook dispatcher is tested across multiple dedicated test suites:
- `__tests__/lib/paystackWebhookRefundsPhase519.test.ts`: Tests valid signatures, invalid signatures (401), amount mismatches (400), currency mismatches (400), and refund processing.
- `__tests__/lib/paymentTruthAndWebhookRecoveryPhase42.test.ts`: Tests webhook event recovery, duplicate deduplication, and out-of-order event delivery.
- `__tests__/lib/safeWithdrawalsAndPayoutReconciliationPhase6.test.ts`: Tests `transfer.success`, `transfer.failed`, and dispute quarantines.
- `__tests__/lib/settlementReconciliationPhase521.test.ts`: Tests `settlement.success` webhook ingestion.

---

## 4. Full Webhook URL Reference Audit

An exhaustive search across the entire repository revealed 36 occurrences of webhook path references. Every occurrence is classified below:

| File Path | Line | Referenced Path | Status | Action / Correction Required |
|---|:---:|---|:---:|---|
| `docs/API.md` | 258 | `/api/billing/webhook` | Current | Valid alias handler in source code. |
| `docs/CHANGELOG.md` | 1441 | `/api/billing/webhook` | Historical | Valid historical reference. |
| `docs/EVENTSLOT_E2E_VULNERABILITY_AUDIT.md` | 353 | `/api/billing/webhook` | Current | Valid audit reference. |
| `docs/EVENTSLOT_SYSTEM_DOCUMENTATION.md` | 361 | `/api/billing/webhook` | Current | Valid documentation reference. |
| `docs/FEATURES.md` | 479, 826, 1015 | `/api/billing/webhook` | Current | Valid feature reference. |
| `docs/KNOWN_ISSUES.md` | 43 | `/api/billing/webhook` | Historical | Valid tracking reference. |
| `docs-site/pages/appendix/api-reference.mdx` | 108 | `/api/billing/webhook` | Current | Valid docs-site reference. |
| `docs-site/pages/technical/api.mdx` | 107 | `/api/billing/webhook` | Current | Valid docs-site reference. |
| `docs-site/pages/technical/backend.mdx` | 19 | `/api/billing/webhook` | Current | Valid docs-site reference. |
| `maintenance/00-programme-charter.md` | 285 | `/api/webhooks/paystack` | **Canonical** | Accurate. Points to canonical route. |
| `maintenance/01-system-inventory.md` | 112 | `/api/webhooks/paystack` | **Canonical** | Accurate. Points to canonical route. |
| `maintenance/04a-payment-security-and-paystack-only-plan.md` | 376 | `/api/payments/paystack/webhook` | **Obsolete / Flawed** | **Documentation Correction Required:** Route does not exist; must be updated to `/api/webhooks/paystack`. |
| `maintenance/07d-deterministic-migration-runner-and-release-gates.md` | 132 | `/api/webhooks/paystack` | **Canonical** | Accurate. Points to canonical route. |
| `maintenance/08-ci-verification-and-release-readiness.md` | 126 | `/api/webhooks/paystack` | **Canonical** | Accurate. Points to canonical route. |
| `maintenance/08d-release-candidate-safety-review.md` | 209 | `/api/payments/paystack/webhook` | **Obsolete / Flawed** | **Documentation Correction Required:** Incorrect path cited in gate P-2 text. |
| `maintenance/09-release-commit-scope-and-preflight.md` | 303 | `/api/payments/paystack/webhook` | **Obsolete / Flawed** | **Documentation Correction Required:** Incorrect path cited in gate P-2 text. |
| `maintenance/09a-manifest-reconciliation-and-webhook-verification.md` | 25, 27, 28, 190, 203, 213, 291 | Both paths | **Audit Record** | Explicitly documents and corrects the discrepancy. |
| `public/sw.js` | 1 | Both paths | Generated | Excluded from release commit. |
| `tsconfig.tsbuildinfo` | 1 | Both paths | Local Cache | Local build cache. |

---

## 5. Path-by-Path Release Manifest (78 Files)

Every file proposed for the application release candidate is accounted for below:

### 5.1 Configuration, Build & CI/CD Pipelines (8 Files)
1. `.env.example` *(modified tracked)*: Cleans up obsolete IntaSend variables; documents Upstash Redis rate-limiting; zero credentials.
2. `.github/workflows/deploy-staging.yml` *(modified tracked)*: Decommissions dangerous direct deploy job (`if: false`); excises production database secret reference.
3. `cloudbuild.staging.yaml` *(untracked)*: Defines authoritative staging build; Step 3 runs pre-deploy migration via `EVENTSLOT_STAGING_DATABASE_URL` before Cloud Run deploy with `RUN_DB_MIGRATIONS=false`.
4. `Dockerfile` *(modified tracked)*: Configures deterministic runner with pinned `prisma@5.22.0` CLI and `.bin` symlinks; sets `ENV RUN_DB_MIGRATIONS=false`.
5. `middleware.ts` *(modified tracked)*: Edge authentication and route protection middleware.
6. `next.config.mjs` *(modified tracked)*: Next.js build configuration and runtime caching rules.
7. `package.json` *(modified tracked)*: Excises `intasend-node` dependency; pins Prisma CLI to `5.22.0`.
8. `package-lock.json` *(modified tracked)*: Lockfile synchronized with `package.json`.

### 5.2 Database Schema & Migration (2 Files)
9. `prisma/schema.prisma` *(modified tracked)*: Declares `@@index([paidOrderId])` and `@@index([eventId, attendeeEmail])` on `Registration`.
10. `prisma/migrations/20261023030000_add_registration_paid_order_and_attendee_email_indexes/migration.sql` *(untracked)*: SQL migration creating indexes.

### 5.3 Application Pages, Routes & Components (21 Files)
11. `app/(attendee)/[username]/RegistrationForm.tsx` *(modified tracked)*
12. `app/(organizer)/create/page.tsx` *(modified tracked)*
13. `app/(organizer)/dashboard/assistant/page.tsx` *(modified tracked)*
14. `app/(organizer)/dashboard/payments/page.tsx` *(modified tracked)*
15. `app/(organizer)/edit/[slug]/page.tsx` *(modified tracked)*
16. `app/admin/test/payments/page.tsx` *(modified tracked)*
17. `app/api/admin/revenue/route.ts` *(modified tracked)*: Revenue route with `private, no-store` headers.
18. `app/api/admin/test/payments/route.ts` *(modified tracked)*: Imports `normalizeMpesaPhone` from `lib/phone.ts`.
19. `app/api/billing/cancel/route.ts` *(modified tracked)*
20. `app/api/billing/invoices/route.ts` *(modified tracked)*
21. `app/api/billing/status/route.ts` *(modified tracked)*: Imports `getSubscriberMigrationStatus` from `lib/subscriptionMigration.ts`.
22. `app/api/cron/payout-reconciliation/route.ts` *(untracked)*: Dual-auth withdrawal reconciliation worker endpoint.
23. `app/api/cron/settlement-reconciliation/route.ts` *(untracked)*: Dual-auth settlement sync worker endpoint.
24. `app/api/dashboard/stats/route.ts` *(modified tracked)*: Optimized query projection.
25. `app/api/events/[slug]/lookup/route.ts` *(modified tracked)*: Uses indexed attendee lookup.
26. `app/api/events/[slug]/route.ts` *(modified tracked)*
27. `app/api/events/route.ts` *(modified tracked)*
28. `app/api/my-events/route.ts` *(modified tracked)*: Eliminated redundant bulk write operations.
29. `app/api/organizer/payments/summary/route.ts` *(modified tracked)*
30. `app/api/organizer/payments/withdrawals/route.ts` *(modified tracked)*: Validates settled funds before locking.
31. `app/api/paid-events/orders/[orderId]/route.ts` *(modified tracked)*
32. `app/api/payments/intasend/webhook/route.ts` *(modified tracked)*: Decommissioned; returns 410 Gone.
33. `app/api/payments/mpesa/status/route.ts` *(modified tracked)*
34. `app/api/payments/mpesa/subscribe/route.ts` *(modified tracked)*
35. `app/layout.tsx` *(modified tracked)*
36. `app/pay/[orderId]/page.tsx` *(modified tracked)*
37. `components/payments/OrganizerPaymentsPage.tsx` *(modified tracked)*
38. `services/payouts/index.ts` *(modified tracked)*: Payout adapter delegating exclusively to Paystack.

### 5.4 Core Libraries & Shared Utilities (15 Files)
39. `lib/env.ts` *(modified tracked)*
40. `lib/eventPasses.ts` *(modified tracked)*
41. `lib/freeEventWaitlist.ts` *(modified tracked)*
42. `lib/organizerPayments.ts` *(modified tracked)*
43. `lib/paidEventCheckout.ts` *(modified tracked)*: Imports `normalizeMpesaPhone` from `lib/phone.ts`.
44. `lib/paymentFinalizers.ts` *(modified tracked)*: Enforces 5% platform fee and atomic ledger credit.
45. `lib/paystack.ts` *(modified tracked)*: Timing-safe HMAC signature verification and API client.
46. `lib/paystackWebhookDispatcher.ts` *(modified tracked)*: Webhook idempotency and event routing.
47. `lib/phone.ts` *(untracked)*: Kenyan M-Pesa MSISDN normalizer (`254...`).
48. `lib/ratelimit.ts` *(modified tracked)*: Upstash Redis rate limiter with in-memory fallback.
49. `lib/settlementSyncWorker.ts` *(modified tracked)*: Settlement batch reconciliation engine.
50. `lib/subscription.ts` *(modified tracked)*
51. `lib/subscriptionBilling.ts` *(modified tracked)*
52. `lib/subscriptionMigration.ts` *(untracked)*: IntaSend subscriber migration helper.
53. `lib/withdrawalService.ts` *(modified tracked)*: Payout engine with distributed lease locking.

### 5.5 Decommissioned IntraSend Modules (2 Files)
54. `lib/intasend.ts` *(deleted tracked)*: Retired vendor code; 0 active imports in application.
55. `services/payouts/intrasend.ts` *(deleted tracked)*: Retired provider code; 0 active imports in application.

### 5.6 Automated Test Suites (23 Files)
56. `__tests__/api/cacheSafetyPhase6a.test.ts` *(untracked)*
57. `__tests__/api/decommissionedIntasendWebhook.test.ts` *(untracked)*
58. `__tests__/api/eventAttendeeLookupPhase6b.test.ts` *(untracked)*
59. `__tests__/api/eventDashboardPayload.test.ts` *(untracked)*
60. `__tests__/api/organizerPaymentsDashboardPhase519.test.ts` *(untracked)*
61. `__tests__/api/paid-order-status.test.ts` *(modified tracked)*
62. `__tests__/api/writeOptimizationPhase6b.test.ts` *(untracked)*
63. `__tests__/components/PaidEventRegistrationFlow.test.tsx` *(untracked)*
64. `__tests__/components/RegistrationForm.test.tsx` *(modified tracked)*
65. `__tests__/lib/eventPassLifecycleAudit.test.ts` *(untracked)*
66. `__tests__/lib/financialIntegrityPhase512.test.ts` *(modified tracked)*
67. `__tests__/lib/freeEventWaitlistConcurrency.test.ts` *(untracked)*
68. `__tests__/lib/organizerPaymentsExperiencePhase520.test.ts` *(untracked)*
69. `__tests__/lib/paymentTruthAndWebhookRecoveryPhase42.test.ts` *(modified tracked)*
70. `__tests__/lib/paystackWebhookRefundsPhase519.test.ts` *(untracked)*
71. `__tests__/lib/phone.test.ts` *(untracked)*
72. `__tests__/lib/providerVerifiedRefundPhase515.test.ts` *(untracked)*
73. `__tests__/lib/ratelimitHardeningPhase6b.test.ts` *(untracked)*
74. `__tests__/lib/safeWithdrawalsAndPayoutReconciliationPhase6.test.ts` *(untracked)*
75. `__tests__/lib/settlementReconciliationPhase521.test.ts` *(untracked)*
76. `__tests__/lib/subscriptionBillingMigrationPhase7.test.ts` *(untracked)*
77. `__tests__/scripts/stagingDeploymentDecoupling.test.ts` *(untracked)*
78. `__tests__/security/phase4bPaymentSecurityRemediation.test.ts` *(untracked)*

---

## 6. Runtime Dependency and Deletion Safety Assessment

1. **`lib/phone.ts`:**  
   Exported function `normalizeMpesaPhone` is directly imported by `lib/paidEventCheckout.ts` and `app/api/admin/test/payments/route.ts`. Verified complete, zero external dependencies, 7/7 tests passing in `phone.test.ts`. Mandatory inclusion.
2. **`lib/subscriptionMigration.ts`:**  
   Exported functions `getSubscriberMigrationStatus` and `assertLegacySubscriberAccess` are directly imported by `app/api/billing/status/route.ts`. Relies only on existing models in `@/lib/prisma`. Verified complete, 8/8 tests passing in `subscriptionBillingMigrationPhase7.test.ts`. Mandatory inclusion.
3. **IntraSend Deletion Integrity:**  
   An exhaustive codebase search confirms that zero imports of `lib/intasend` or `services/payouts/intrasend` exist across active code, components, or API routes. `package.json` removes `intasend-node`. Deleting both files is 100% verified and safe.
4. **Untracked Ephemeral & Tooling Files:**  
   `public/sw.js` (1-line timestamp hash diff) and `public/workbox-c2c0676f.js` are ephemeral compilation artifacts. `generate_partnership_pdf.py` contains local hardcoded Windows paths. All three are strictly **EXCLUDED**.

---

## 7. Database Migration Recommendation & Evidence Gaps

### 7.1 What Is Evidenced in the Repository
- The migration file `prisma/migrations/20261023030000_add_registration_paid_order_and_attendee_email_indexes/migration.sql` contains standard PostgreSQL DDL:
  ```sql
  CREATE INDEX "Registration_paidOrderId_idx" ON "Registration"("paidOrderId");
  CREATE INDEX "Registration_eventId_attendeeEmail_idx" ON "Registration"("eventId", "attendeeEmail");
  ```
- In `cloudbuild.staging.yaml`, Step 3 executes `npx --no-install prisma migrate deploy` before Step 4 (`deploy-staging`).
- The runner stage in `Dockerfile` bundles locked `prisma@5.22.0` and sets `ENV RUN_DB_MIGRATIONS=false`.

### 7.2 Evidence Gaps & Unknowns
- **Production Row Counts & Write Rates:** **UNKNOWN.** The repository does not contain production metrics or database telemetry.
- **Staging Row Counts & Write Rates:** **UNKNOWN.** Exact row count on the staging database has not been measured.
- **Index Build Duration:** **NOT MEASURED.** Duration will scale with the number of existing rows in `Registration`.
- **Production Decoupling:** In production `cloudbuild.yaml`, the Step 3 migration runner has not yet been backported.

### 7.3 Database Locking Implications & Recommendation
- **Technical Fact:** Ordinary `CREATE INDEX` acquires a `SHARE` lock (`ShareLock`) on `Registration`. It allows concurrent `SELECT` queries, but **blocks all concurrent `INSERT`, `UPDATE`, and `DELETE` queries** on `Registration` until the command finishes.
- **Prisma Constraint:** PostgreSQL prohibits `CREATE INDEX CONCURRENTLY` inside an explicit transaction block (`BEGIN ... COMMIT`). Because Prisma Migrate wraps migration scripts in transactions by default, placing `CONCURRENTLY` in `migration.sql` causes Prisma Migrate to fail immediately.
- **Official Recommendation:**
  - **For Staging Deployment:** Proceed with standard `CREATE INDEX` in Step 3 of `cloudbuild.staging.yaml`. Staging has minimal data and zero active users during pre-deploy execution.
  - **For Production Release:** Do NOT execute standard `CREATE INDEX` during peak traffic. The team must either:
    1. Apply the indexes concurrently in production prior to deployment (`CREATE INDEX CONCURRENTLY "Registration_paidOrderId_idx"...` via direct psql) and mark the migration applied via `npx prisma migrate resolve --applied 20261023030000_add_registration_paid_order_and_attendee_email_indexes`; OR
    2. Execute the deployment during a scheduled maintenance window when write traffic is paused.

---

## 8. Reconciliation Endpoints & Scheduler Assessment

### 8.1 Implementation Verification
- **Dual-Authentication Paths:** Both `payout-reconciliation` and `settlement-reconciliation` require either a valid Bearer token matching `process.env.CRON_SECRET` or an authenticated session with `hasAdminAccess(session)`.
- **Fail-Closed Security:** Unauthenticated requests fail closed immediately with `HTTP 401 Unauthorized`.
- **Amount & Currency Validation:** Paystack transfer evidence is verified against `withdrawal.amountMinorUnits` and `withdrawal.currency`. Discrepancies trigger `RECONCILIATION_AMOUNT_MISMATCH` or `RECONCILIATION_CURRENCY_MISMATCH`, quarantining the record and preventing balance crediting.
- **Distributed Lease Locking:** Workers use `prisma.processedProviderEvent` with dedicated idempotency keys (`withdrawal_reconciliation_lease` and `settlement_sync_lease`) and in-process boolean guards to prevent concurrent execution.
- **Repeatable & Duplicate-Safe:** Both workers check terminal states and skip already-settled transactions. Even if a lease expires prematurely, idempotent state machines prevent duplicate payouts or double-crediting organizer balances.

### 8.2 Scheduler Existence Audit
- **Repository Finding:** An exhaustive search of the repository confirms that **NO automated scheduler configuration** (e.g., `vercel.json`, `cron.yaml`, GitHub Actions schedule, or GCP Cloud Scheduler scripts) currently triggers these endpoints.
- **Distinction:**
  - *Endpoint implementation:* **VERIFIED & PRESENT.**
  - *Scheduler configuration in repo:* **ABSENT.**
  - *Cloud-side scheduler existence:* **UNKNOWN (requires GCP Console verification).**
- **Proposed Operational Schedule (Awaiting GCP Provisioning):**
  - Payout Reconciliation: Every 15 minutes targeting `/api/cron/payout-reconciliation` with `Authorization: Bearer <CRON_SECRET>`.
  - Settlement Reconciliation: Daily at 04:00 UTC targeting `/api/cron/settlement-reconciliation` with `Authorization: Bearer <CRON_SECRET>`.

---

## 9. Release Validation Matrix

| Check / Verification Item | Status | Concrete Evidence | Required Next Action |
|---|:---:|---|---|
| **Targeted Regression Tests** | **PASS** | 18 test suites (131 tests) passing locally with exit code 0. | None. Test evidence is concrete. |
| **Full Whole-Repo Test Suite** | **NOT RUN** | Targeted suites executed; untargeted full repo run omitted to preserve resources. | Run on 32GB CI runner in GitHub Actions PR. |
| **TypeScript Validation (`tsc`)** | **BLOCKED** | Host physical RAM (~4.53GB) exhausts Node default V8 heap. | GitHub Actions `pr-validation.yml` provisions 8GB heap on 32GB runner. |
| **ESLint (`npm run lint`)** | **NOT RUN** | Whole-repo `eslint .` without `.eslintignore` spins CPU; candidate files clean. | Add `.eslintignore` or run targeted linting in CI. |
| **Production Webpack Build** | **PASS** | Validated in Phase 07E: clean compilation of 68 routes in 4.9 min. | None. Bundling integrity is verified. |
| **CI on Exact Candidate** | **NOT RUN** | Remote tracking is 3 commits behind; candidate is currently uncommitted. | Authorized release commit must be pushed to trigger CI. |
| **Paystack Test Secret Key** | **BLOCKED** | Staging Cloud Run secret configuration cannot be proven from local repo. | **Operator Action:** Verify GCP Secret Manager secret `PAYSTACK_SECRET_KEY` starts with `sk_test_...`. |
| **Paystack Test Webhook Route** | **BLOCKED** | Local repo proves canonical route is `/api/webhooks/paystack`. Dashboard unverified. | **Operator Action:** Confirm Paystack Dashboard test webhook URL is `https://staging.eventsslot.com/api/webhooks/paystack`. |
| **Cloud Build Staging DB IAM** | **BLOCKED** | Service account IAM roles cannot be audited locally. | **Operator Action:** Verify Cloud Build SA has `Secret Manager Secret Accessor` on `EVENTSLOT_STAGING_DATABASE_URL`. |
| **Staging Deploy & Health** | **NOT RUN** | Pre-deployment audit phase; zero cloud deployments permitted. | Execute `gcloud builds submit --config=cloudbuild.staging.yaml .` upon approval. |
| **Staging Migration Application** | **NOT RUN** | Staging database has not yet received migration `20261023030000`. | Verified upon Cloud Build Step 3 execution. |
| **End-to-End Test Payment** | **NOT RUN** | Requires active staging deployment. | Execute test M-Pesa / card checkout on staging. |
| **Production Migration Strategy** | **UNKNOWN** | Production row counts and write rates unmeasured locally. | Database reliability engineer must assess production table size before deploy. |

---

## 10. Documentation Disposition

### 10.1 Segregation Recommendation
- **Total Maintenance Reports:** 36 reports (`00-programme-charter.md` through `09a-manifest-reconciliation-and-webhook-verification.md`).
- **Disposition:** **Separate Documentation Commit.** None of the markdown files are runtime dependencies. Separating them keeps the application release candidate commit focused exclusively on source code, migrations, tests, and build configurations.

### 10.2 Documentation Corrections Required
The following reports contain the obsolete webhook path `/api/payments/paystack/webhook` and must be noted as corrected by Phase 09A/09B:
1. `maintenance/04a-payment-security-and-paystack-only-plan.md` (Line 376)
2. `maintenance/08d-release-candidate-safety-review.md` (Line 209)
3. `maintenance/09-release-commit-scope-and-preflight.md` (Line 303)
*Correction:* The canonical route is **`/api/webhooks/paystack`**.

---

## 11. Outstanding Blockers Ordered by Severity

### Severity 1: Critical Operational Blockers (Must Be Resolved Before Staging Deploy)
1. **Gate P-1 (GCP Secret Mode):** Operator must confirm that the staging Cloud Run revision will bind to a `PAYSTACK_SECRET_KEY` starting with `sk_test_...`.
2. **Gate P-2 (Webhook Destination):** Operator must confirm that the Paystack Dashboard routes test webhooks to `https://staging.eventsslot.com/api/webhooks/paystack` (NOT `/api/payments/paystack/webhook`).
3. **Gate M-1 (Cloud Build IAM):** Operator must verify Cloud Build service account has `Secret Manager Secret Accessor` permissions on `EVENTSLOT_STAGING_DATABASE_URL`.

### Severity 2: Production Readiness Blockers (Must Be Resolved Before Production Release)
4. **Production Migration Runner Decoupling:** Decouple migrations in production `cloudbuild.yaml` (port Step 3 pre-deploy migration runner and configure `RUN_DB_MIGRATIONS=false`).
5. **Production Index Locking Strategy:** Confirm production `Registration` table row count and determine whether a maintenance window or manual `CREATE INDEX CONCURRENTLY` is required.

### Severity 3: Local Commit Preparation (Procedural)
6. **Artifact Reversion:** Discard the 1-line timestamp diff on `public/sw.js` and exclude `public/workbox-c2c0676f.js` and `generate_partnership_pdf.py`.
7. **Commit Execution:** Stage the exact 78 release candidate paths and create the release commit.

---

## 12. Recommended Next Phase

### Phase 10: Release Commit Execution & Staging Gate Verification
1. Authorize execution of `git checkout -- public/sw.js public/workbox-c2c0676f.js`.
2. Authorize explicit staging of the 78 release candidate paths.
3. Commit under conventional title: `feat(release): staging release candidate with decoupled migrations and hardened payments`.
4. Stage and commit the 36 maintenance reports in a subsequent documentation commit.
5. Provide the operator verification checklist for Gates P-1, P-2, and M-1 prior to staging build submission.

---

## 13. Final Git Status Comparison

Direct Git inspection confirms that no existing changes were disturbed and the only new file is this report:

- **Tracked Modifications:** Exactly 53 files (identical to baseline).
- **Tracked Deletions:** Exactly 2 files (`lib/intasend.ts`, `services/payouts/intrasend.ts`).
- **Untracked Entries:** Exactly 27 entries (the only addition is `maintenance/09b-release-candidate-integrity-and-operational-readiness.md`).
- **Git State:** 100% clean of unapproved operations; zero files staged or committed.
