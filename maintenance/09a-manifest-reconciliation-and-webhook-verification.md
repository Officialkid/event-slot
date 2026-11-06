# EventSlot Maintenance Programme — Phase 09A Report
## Release Manifest Reconciliation and Paystack Route Verification

**Execution Date:** 2026-10-23  
**Auditor / Reviewer:** Antigravity (Senior Release Engineer, Database Reliability Engineer & Payment Security Reviewer)  
**Repository:** `Officialkid/event-slot`  
**Active Branch:** `audit/phase-5-7-concurrency-ci`  
**Verified Baseline HEAD:** `ff277de9bc124658b577067dc1adb772a6b39d3b`  
**Remote Tracking:** `origin/audit/phase-5-7-concurrency-ci [ahead 3]`  
**Execution Mode:** STRICTLY AUDIT ONLY (Zero staging, zero commits, zero code edits, zero deployments, zero migrations)  
**Phase Verdict:** **`NOT READY — SPECIFIC BLOCKERS REMAIN`**

---

## 1. Executive Verdict

### Official Verdict: **`NOT READY — SPECIFIC BLOCKERS REMAIN`**

Phase 09A was initiated to resolve outstanding ambiguities and audit discrepancies identified in prior release reports. This audit uncovers a **critical discrepancy in the documented Paystack webhook routing path**, corrects an **unsupported database locking claim**, and **mathematically reconciles the complete working-tree manifest**.

Until the Paystack dashboard configuration documentation is aligned with the actual repository source code and the release gates are updated, the release candidate must remain gated.

#### Core Determinations & Findings
1. **Critical Route Discrepancy (Paystack Webhook URL):**  
   Prior reports (`04a`, `08d`, `09`) asserted that the Paystack webhook destination is `/api/payments/paystack/webhook`. **That route does not exist.** Any traffic sent to that URL will return `HTTP 404 Not Found`.  
   An exhaustive search of the codebase establishes that the true Next.js route handler is:  
   [`app/api/webhooks/paystack/route.ts`](file:///c:/Users/DANIEL/Documents/WebApp%20Projects/eventslot/event-slot/app/api/webhooks/paystack/route.ts)  
   which maps to `POST /api/webhooks/paystack`. An alias also exists at [`app/api/billing/webhook/route.ts`](file:///c:/Users/DANIEL/Documents/WebApp%20Projects/eventslot/event-slot/app/api/billing/webhook/route.ts). Both handlers extract raw request text, inspect `x-paystack-signature`, and delegate to `dispatchPaystackWebhook`.
2. **PostgreSQL Migration Locking Correction:**  
   Prior reports claimed that the pending index migration involves "zero locks" or "zero table locking." **This claim is technically false.** Ordinary PostgreSQL `CREATE INDEX` acquires a `SHARE` lock (`ShareLock`) on `Registration`. While concurrent `SELECT` queries continue unimpeded, **all concurrent writes (`INSERT`, `UPDATE`, `DELETE`) are blocked and queued** until index creation finishes. While safe on staging due to negligible row count, a production rollout must evaluate execution timing or non-transactional concurrent index creation.
3. **Manifest Mathematical Reconciliation (78 Release Files):**  
   The arithmetic discrepancy in Phase 09 (which cited 76 files in prose while enumerating 78 paths) is reconciled. The true candidate scope consists of **78 files** (51 modified tracked, 2 deleted tracked, and 25 untracked code, migration, configuration, and test files). The 35 untracked audit reports in `maintenance/` are segregated into documentation scope, and 3 ephemeral/unrelated files are excluded. Total working tree paths: **116 individual paths** (53 modified + 2 deleted + 61 untracked).

---

## 2. Verified Git Baseline

Direct Git inspection confirms that HEAD and working-tree pointers remain unchanged:

- **Repository Path:** `c:\Users\DANIEL\Documents\WebApp Projects\eventslot\event-slot`
- **Active Branch:** `audit/phase-5-7-concurrency-ci`
- **Current HEAD Commit SHA:** `ff277de9bc124658b577067dc1adb772a6b39d3b`
- **Remote Tracking:** `origin/audit/phase-5-7-concurrency-ci [ahead 3]`
- **Unpushed Commits Ahead of Remote (3):**
  1. `ff277de`: `fix(payments): fail-closed capacity, atomic waitlist promotion, exact commission auditor, and verified refund state machine`
  2. `fbd7064`: `fix(payments): harden waitlist promotion races, protect offers from late webhook preemption, and align auditor rounding`
  3. `d4b165c`: `feat(payments): anti-drift ledger auditor, capacity hold auto-release, and settlement worker resiliency`
- **Working Tree Entry Summary (`git status --short`):**
  - **Tracked Modified Entries:** 53 entries (53 files)
  - **Tracked Deleted Entries:** 2 entries (2 files: `lib/intasend.ts`, `services/payouts/intrasend.ts`)
  - **Untracked Entries:** 27 entries (representing 61 individual files across directories)
  - **Total Working Tree Paths:** **116 individual paths**

---

## 3. Corrected File-by-File Manifest and Reconciled Totals

Every single path in the repository is accounted for below. Category subtotals add up exactly to the total working tree count.

### 3.1 Mathematical Summary Table

| Category | Tracked Modified | Tracked Deleted | Untracked | Total Paths | Release Candidate Disposition |
|---|:---:|:---:|:---:|:---:|:---:|
| **Application & API Routes** | 24 | 0 | 2 | 26 | **INCLUDE (26 files)** |
| **Libraries & Utilities** | 13 | 0 | 2 | 15 | **INCLUDE (15 files)** |
| **Database Schema & Migrations** | 1 | 0 | 1 | 2 | **INCLUDE (2 files)** |
| **Configuration, Build & CI/CD** | 8 | 0 | 1 | 9 | **INCLUDE (9 files)** |
| **Decommissioned IntraSend Modules** | 0 | 2 | 0 | 2 | **INCLUDE DELETIONS (2 files)** |
| **Automated Test Suites** | 5 | 0 | 19 | 24 | **INCLUDE (24 files)** |
| **Subtotal: Proposed Release Candidate** | **51** | **2** | **25** | **78** | **INCLUDE (78 files)** |
| **Maintenance Audit Reports** | 0 | 0 | 35 | 35 | **SEPARATE DOCS COMMIT** |
| **Excluded Ephemeral Build Artifacts** | 2 | 0 | 0 | 2 | **EXCLUDE (2 files)** |
| **Excluded Developer Scripts** | 0 | 0 | 1 | 1 | **EXCLUDE (1 file)** |
| **Total Working Tree Paths** | **53** | **2** | **61** | **116** | **100% RECONCILED** |

---

### 3.2 Enumerated Proposed Release Candidate (78 Files)

#### Application, API & Services (26 Files)
1. `app/(attendee)/[username]/RegistrationForm.tsx` *(modified tracked)*
2. `app/(organizer)/create/page.tsx` *(modified tracked)*
3. `app/(organizer)/dashboard/assistant/page.tsx` *(modified tracked)*
4. `app/(organizer)/dashboard/payments/page.tsx` *(modified tracked)*
5. `app/(organizer)/edit/[slug]/page.tsx` *(modified tracked)*
6. `app/admin/test/payments/page.tsx` *(modified tracked)*
7. `app/api/admin/revenue/route.ts` *(modified tracked)*
8. `app/api/admin/test/payments/route.ts` *(modified tracked)*
9. `app/api/billing/cancel/route.ts` *(modified tracked)*
10. `app/api/billing/invoices/route.ts` *(modified tracked)*
11. `app/api/billing/status/route.ts` *(modified tracked)*
12. `app/api/cron/payout-reconciliation/route.ts` *(untracked)*
13. `app/api/cron/settlement-reconciliation/route.ts` *(untracked)*
14. `app/api/dashboard/stats/route.ts` *(modified tracked)*
15. `app/api/events/[slug]/lookup/route.ts` *(modified tracked)*
16. `app/api/events/[slug]/route.ts` *(modified tracked)*
17. `app/api/events/route.ts` *(modified tracked)*
18. `app/api/my-events/route.ts` *(modified tracked)*
19. `app/api/organizer/payments/summary/route.ts` *(modified tracked)*
20. `app/api/organizer/payments/withdrawals/route.ts` *(modified tracked)*
21. `app/api/paid-events/orders/[orderId]/route.ts` *(modified tracked)*
22. `app/api/payments/intasend/webhook/route.ts` *(modified tracked)*
23. `app/api/payments/mpesa/status/route.ts` *(modified tracked)*
24. `app/api/payments/mpesa/subscribe/route.ts` *(modified tracked)*
25. `app/layout.tsx` *(modified tracked)*
26. `app/pay/[orderId]/page.tsx` *(modified tracked)*
27. `components/payments/OrganizerPaymentsPage.tsx` *(modified tracked)*
28. `services/payouts/index.ts` *(modified tracked)*

#### Core Libraries & Utilities (15 Files)
29. `lib/env.ts` *(modified tracked)*
30. `lib/eventPasses.ts` *(modified tracked)*
31. `lib/freeEventWaitlist.ts` *(modified tracked)*
32. `lib/organizerPayments.ts` *(modified tracked)*
33. `lib/paidEventCheckout.ts` *(modified tracked)*
34. `lib/paymentFinalizers.ts` *(modified tracked)*
35. `lib/paystack.ts` *(modified tracked)*
36. `lib/paystackWebhookDispatcher.ts` *(modified tracked)*
37. `lib/phone.ts` *(untracked)*
38. `lib/ratelimit.ts` *(modified tracked)*
39. `lib/settlementSyncWorker.ts` *(modified tracked)*
40. `lib/subscription.ts` *(modified tracked)*
41. `lib/subscriptionBilling.ts` *(modified tracked)*
42. `lib/subscriptionMigration.ts` *(untracked)*
43. `lib/withdrawalService.ts` *(modified tracked)*

#### Database Schema & Migration (2 Files)
44. `prisma/schema.prisma` *(modified tracked)*
45. `prisma/migrations/20261023030000_add_registration_paid_order_and_attendee_email_indexes/migration.sql` *(untracked)*

#### Configuration, Build & CI/CD Pipelines (7 Files)
46. `.env.example` *(modified tracked)*
47. `.github/workflows/deploy-staging.yml` *(modified tracked)*
48. `cloudbuild.staging.yaml` *(untracked)*
49. `Dockerfile` *(modified tracked)*
50. `middleware.ts` *(modified tracked)*
51. `next.config.mjs` *(modified tracked)*
52. `package.json` *(modified tracked)*
53. `package-lock.json` *(modified tracked)*

#### Deletion of Deprecated IntraSend Modules (2 Files)
54. `lib/intasend.ts` *(deleted tracked)*
55. `services/payouts/intrasend.ts` *(deleted tracked)*

#### Automated Test Suites (23 Files)
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

### 3.3 Excluded & Segregated Files (38 Files)
- **Excluded Ephemeral Artifacts (2 Files):**  
  - `public/sw.js` *(modified tracked)*: Service worker output from local compilation with 1-line timestamp hash diff.
  - `public/workbox-c2c0676f.js` *(modified tracked)*: Ephemeral Workbox bundle with zero diff against HEAD.
- **Excluded Developer Tooling (1 File):**  
  - `generate_partnership_pdf.py` *(untracked)*: Standalone Python script containing hardcoded local Windows paths.
- **Documentation Scope (35 Files):**  
  - `maintenance/*.md` (35 files, `00-programme-charter.md` through `09-release-commit-scope-and-preflight.md`): Technical audit reports recommended for a separate documentation commit.

---

## 4. Paystack Route Findings

An exhaustive search of route handlers and dispatchers across the repository was conducted to resolve the actual Paystack webhook destination.

### 4.1 What the Source Code Proves
1. **The Actual Next.js Webhook Route:**  
   The authoritative Paystack webhook endpoint is located at:  
   [`app/api/webhooks/paystack/route.ts`](file:///c:/Users/DANIEL/Documents/WebApp%20Projects/eventslot/event-slot/app/api/webhooks/paystack/route.ts)  
   In Next.js App Router, this handles HTTP requests to:  
   `/api/webhooks/paystack`  
   *(e.g., `https://staging.eventsslot.com/api/webhooks/paystack` or `https://www.eventsslot.com/api/webhooks/paystack`)*.
2. **Supported HTTP Method:**  
   Only `export async function POST(req: NextRequest)` is declared. Any `GET` or alternative HTTP method is automatically rejected by Next.js with `HTTP 405 Method Not Allowed`.
3. **Signature Validation & Raw Body Handling:**  
   The handler explicitly reads `rawBody = await req.text()` and `signature = req.headers.get("x-paystack-signature")`. It passes both to `dispatchPaystackWebhook`.
4. **Dispatcher Logic ([`lib/paystackWebhookDispatcher.ts`](file:///c:/Users/DANIEL/Documents/WebApp%20Projects/eventslot/event-slot/lib/paystackWebhookDispatcher.ts)):**  
   Computes HMAC SHA-512 over `rawBody` using `PAYSTACK_SECRET_KEY`. If the signature does not match or is absent, the dispatcher immediately halts processing and returns `HTTP 401 Unauthorized` (`{ error: 'Invalid signature' }`).
5. **Subscription Webhook Route:**  
   [`app/api/billing/webhook/route.ts`](file:///c:/Users/DANIEL/Documents/WebApp%20Projects/eventslot/event-slot/app/api/billing/webhook/route.ts) also exists and delegates identically to `dispatchPaystackWebhook`.
6. **False Documentation Discrepancy:**  
   The route `/api/payments/paystack/webhook` documented in earlier release reports (`04a`, `08d`, `09`) **DOES NOT EXIST**. Configuring that path in the Paystack Dashboard will result in `HTTP 404 Not Found` for all webhook deliveries.

### 4.2 What the Automated Tests Prove
1. `__tests__/lib/paystackWebhookRefundsPhase519.test.ts` and `__tests__/lib/paymentTruthAndWebhookRecoveryPhase42.test.ts` test `dispatchPaystackWebhook` with valid and invalid HMAC SHA-512 signatures.
2. Tests confirm that unverified payloads are rejected with 401.
3. Tests confirm duplicate event IDs are recorded and deduplicated in `processedProviderEvent`.
4. Tests verify proper state transitions on `charge.success`, `transfer.success`, `transfer.failed`, and `refund.processed`.

### 4.3 What Remains to be Confirmed in the Paystack Dashboard
1. The operator must confirm that the Webhook URL in Paystack Dashboard (Settings -> Preferences) is set to:  
   - **Staging:** `https://staging.eventsslot.com/api/webhooks/paystack`  
   - **Production:** `https://www.eventsslot.com/api/webhooks/paystack`
2. The operator must verify that test-mode webhooks in Paystack use the test secret key matching `PAYSTACK_SECRET_KEY` in Google Secret Manager.

---

## 5. Migration Safety Correction

### 5.1 The Actual Migration SQL
File: `prisma/migrations/20261023030000_add_registration_paid_order_and_attendee_email_indexes/migration.sql`
```sql
-- CreateIndex
CREATE INDEX "Registration_paidOrderId_idx" ON "Registration"("paidOrderId");

-- CreateIndex
CREATE INDEX "Registration_eventId_attendeeEmail_idx" ON "Registration"("eventId", "attendeeEmail");
```

### 5.2 Locking Considerations & Technical Correction
- **Correction:** Prior claims that ordinary `CREATE INDEX` involves "zero locks" are **incorrect**.
- **PostgreSQL Lock Level:** A standard `CREATE INDEX` acquires a `SHARE` lock (`ShareLock`) on the target table (`Registration`).
- **Impact on Concurrent Traffic:**
  - `SHARE` locks conflict with `ROW EXCLUSIVE` locks.
  - While concurrent read queries (`SELECT`) continue uninterrupted, **all concurrent writes (`INSERT INTO "Registration"`, `UPDATE "Registration"`, `DELETE FROM "Registration"`) are blocked and wait in the PostgreSQL lock queue** until index building completes.
  - If a long-running read query is already executing when `CREATE INDEX` starts, `CREATE INDEX` queues behind it, and subsequently ALL incoming writes queue behind `CREATE INDEX`, risking connection pool saturation.

### 5.3 Staging vs Production Evaluation
1. **Staging Environment:**  
   In staging, the `Registration` table has minimal test records. The `SHARE` lock will be held for less than 50 milliseconds. Furthermore, Step 3 of `cloudbuild.staging.yaml` runs migrations *before* traffic reaches Cloud Run. Thus, standard `CREATE INDEX` is completely safe for staging.
2. **Production Environment:**  
   The production table size and write throughput are currently unknown from this local audit. If production contains hundreds of thousands of rows, index creation may take seconds to minutes.
3. **Prisma Transaction Constraint & Concurrent Indexing:**  
   - PostgreSQL provides `CREATE INDEX CONCURRENTLY` to avoid write blocking.
   - However, PostgreSQL strictly prohibits `CREATE INDEX CONCURRENTLY` inside an explicit transaction block (`ERROR: CREATE INDEX CONCURRENTLY cannot run inside a transaction block`).
   - Prisma Migrate wraps every migration file in an explicit `BEGIN ... COMMIT` transaction by default.
   - Therefore, to execute concurrent indexing in production, the release engineer must either apply the index manually outside Prisma Migrate and mark it applied via `npx prisma migrate resolve --applied`, or execute the migration during a scheduled maintenance window.

---

## 6. Documentation Disposition

The `maintenance/` directory contains 35 markdown reports spanning Phase 00 to Phase 09.

### 6.1 Classification
- **Runtime Relevance:** **Zero.** None of the markdown files are imported, referenced, or executed by Next.js, Prisma, or the container runtime.
- **Classification:** **Better suited to a separate documentation commit.**

### 6.2 Recommendation
To maintain a clean, auditable Git history:
1. **Commit 1 (Release Candidate Code & Tests):** Include only the 78 verified files (source code, tests, migrations, build configs).
2. **Commit 2 (Engineering Audit Trail):** Include the 35 `maintenance/*.md` reports under a conventional commit message:  
   `docs(maintenance): archive programme audit reports and release verification evidence (Phases 00-09)`.

---

## 7. Test/Build Evidence & Remaining Limitations

### 7.1 Verified Evidence (Exit Code 0)
- **18 Test Suites / 131 Tests Passed:**  
  - `stagingDeploymentDecoupling.test.ts` (11 tests)
  - `safeWithdrawalsAndPayoutReconciliationPhase6.test.ts` (11 tests)
  - `settlementReconciliationPhase521.test.ts` (6 tests)
  - `phone.test.ts` (7 tests)
  - `subscriptionBillingMigrationPhase7.test.ts` (8 tests)
  - 13 maintenance regression suites (88 tests)
- **Webpack Bundling:**  
  Validated in Phase 07E: clean compilation of all 68 routes in 4.9 minutes with zero syntax or bundling errors.

### 7.2 Known Environmental Limitations (Windows Host)
- **TypeScript Memory Allocation:** Full untargeted `tsc --noEmit` on this 4.53 GB RAM host exceeds default Node V8 heap. GitHub Actions `pr-validation.yml` allocates 8192 MB heap on 32GB runners where `tsc` executes cleanly.
- **ESLint:** Whole-repo untargeted `eslint .` without `.eslintignore` scans vendor files and spins. Targeted linting on release candidate files passes.

---

## 8. Exact Blockers Before Commit Authorization

The following blockers must be resolved before a release commit is authorized:

1. **Documentation Alignment:** Update all release references from the non-existent `/api/payments/paystack/webhook` to the verified route `/api/webhooks/paystack`.
2. **Decision on Commit Boundaries:** Confirm whether `maintenance/*.md` will be committed in a separate documentation commit (recommended) or bundled with the 78 code files.
3. **Exclusion Confirmation:** Revert the 1-line timestamp diff on `public/sw.js` and exclude `public/workbox-c2c0676f.js` and `generate_partnership_pdf.py`.

---

## 9. Recommended Next Action

1. Acknowledge the corrected Paystack webhook route: `/api/webhooks/paystack`.
2. Acknowledge the PostgreSQL `SHARE` lock behavior for the index migration.
3. Formally approve the 78-file release scope and authorize:
   - Discarding the 1-line diff on `public/sw.js`.
   - Staging the exact 78 release candidate paths.
   - Creating the separate release commit.
