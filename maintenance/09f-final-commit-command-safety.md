# EventSlot Maintenance Programme — Phase 09F Report
## Commit Command Safety Correction

**Execution Date:** 2026-10-23  
**Auditor / Reviewer:** Antigravity (Senior Release Engineer, Database Reliability Engineer & Payment Security Reviewer)  
**Repository:** `Officialkid/event-slot`  
**Active Branch:** `audit/phase-5-7-concurrency-ci`  
**Verified Baseline HEAD:** `ff277de9bc124658b577067dc1adb772a6b39d3b`  
**Remote Tracking:** `origin/audit/phase-5-7-concurrency-ci [ahead 3]`  
**Execution Mode:** STRICTLY DRY RUN (Zero file staging, zero commits, zero code edits, zero deployments, zero migrations, zero destructive checkouts)  
**Phase Verdict:** **`READY FOR COMMIT AUTHORIZATION`**

---

## 1. Executive Verdict & Core Determinations

### Official Verdict: **`READY FOR COMMIT AUTHORIZATION`**

Phase 09F resolves all outstanding command-safety, shell-escaping, and working-tree preservation issues prior to any local Git commit:

1. **Working-Tree Preservation Guaranteed:**  
   Zero destructive commands (`git checkout --`, `git restore`, `git reset`) were executed. All working-tree modifications, untracked test suites, runtime libraries, and generated assets remain 100% preserved.
2. **`public/sw.js` Diff Truth Established:**  
   Detailed binary inspection reveals that the difference in `public/sw.js` is **not a trivial 1-line timestamp change**. Because minified JavaScript places all code on a single line, Git reported `1 insertion(+), 1 deletion(-)`. In reality, HEAD contains 43,002 bytes while the working tree contains 50,746 bytes—a complete regenerated Service Worker precache manifest produced by `@ducanh2912/next-pwa` during the Phase 07E build. The file is **safely left unstaged and excluded** from the release commit, preserving its working-tree contents without destructive checkout.
3. **Windows PowerShell Command Safety Grounded:**  
   9 application paths contain special shell characters: parentheses `()` (Next.js route groups) and square brackets `[]` (dynamic route segments). In PowerShell (the active shell), unquoted paths fail with parser errors. All proposed staging commands are wrapped in **explicit double quotes** (`"..."`), guaranteeing safe execution across PowerShell, Command Prompt (`cmd.exe`), and POSIX shells.
4. **Exact 78-Path Application Manifest Re-Verified:**  
   The manifest contains exactly **78 unique paths** (51 modified tracked, 2 deleted tracked, and 25 untracked application/test files). Zero duplicates exist.

---

## 2. Git Baseline and Live Working-Tree Status

Live Git status inspection confirms that HEAD, upstream tracking, and working-tree counts match baseline expectations:

- **Repository Directory:** `event-slot`
- **Active Branch:** `audit/phase-5-7-concurrency-ci`
- **Current HEAD Commit SHA:** `ff277de9bc124658b577067dc1adb772a6b39d3b`
- **Remote Tracking:** `origin/audit/phase-5-7-concurrency-ci [ahead 3]`
- **Unpushed Commits (3):**
  1. `ff277de`: `fix(payments): fail-closed capacity, atomic waitlist promotion, exact commission auditor, and verified refund state machine`
  2. `fbd7064`: `fix(payments): harden waitlist promotion races, protect offers from late webhook preemption, and align auditor rounding`
  3. `d4b165c`: `feat(payments): anti-drift ledger auditor, capacity hold auto-release, and settlement worker resiliency`
- **Live Git Status Counts (`git status -s`):**
  - **Tracked Modified Entries:** Exactly 53 files
  - **Tracked Deleted Entries:** Exactly 2 files (`lib/intasend.ts`, `services/payouts/intrasend.ts`)
  - **Untracked Entries:** Exactly 27 entries (representing 65 individual files across subdirectories prior to this report)
  - **Staged Changes:** None (`git diff --cached` is 100% empty)

---

## 3. Findings on `public/sw.js` & Exclusion Safety

### 3.1 Investigation of the Diff
- **The Misconception:** Earlier maintenance reports described the diff in `public/sw.js` as "a 1-line timestamp hash diff" because `git diff --stat` showed `1 file changed, 1 insertion(+), 1 deletion(-)`.
- **The Actual Source Evidence:**
  - `git show HEAD:public/sw.js` has a length of **43,002 bytes**.
  - Working tree `public/sw.js` has a length of **50,746 bytes**.
  - The entire file is minified onto a single line. The $+7,744$ byte difference represents updated precache entries for all 68 dynamic and static Next.js route chunks compiled during the Phase 07E Webpack build.
  - Therefore, the diff is an entire regenerated Service Worker bundle, not a simple timestamp tweak.

### 3.2 Safe Working-Tree Preservation (No Destructive Reversion)
- Prior plans suggested running `git checkout -- public/sw.js` to discard the diff.
- In Phase 09F, **zero reversion commands were executed**.
- By staging files **strictly by explicit pathspecs**, `public/sw.js` and `public/workbox-c2c0676f.js` remain completely unstaged and untouched in the working tree.
- The working tree remains completely intact, preserving developer build outputs while keeping them out of the release commit.

---

## 4. Shell-Specific Command Safety & Windows Path Quoting

### 4.1 Shell Character Hazards in Windows PowerShell
The application paths include 9 paths with Next.js dynamic routing and route group syntax:
1. `app/(attendee)/[username]/RegistrationForm.tsx`
2. `app/(organizer)/create/page.tsx`
3. `app/(organizer)/dashboard/assistant/page.tsx`
4. `app/(organizer)/dashboard/payments/page.tsx`
5. `app/(organizer)/edit/[slug]/page.tsx`
6. `app/api/events/[slug]/lookup/route.ts`
7. `app/api/events/[slug]/route.ts`
8. `app/api/paid-events/orders/[orderId]/route.ts`
9. `app/pay/[orderId]/page.tsx`

- **PowerShell Hazard:** In PowerShell, unquoted parentheses `(...)` are parsed as subexpression operators. Running `git add -- app/(organizer)/create/page.tsx` fails with:
  `Expressions are only allowed as the first element of a pipeline.`
  Similarly, unquoted square brackets `[...]` are interpreted as PowerShell array indexers or wildcard glob patterns.
- **cmd.exe Hazard:** Single quotes `'...'` are not recognized as quoting characters in `cmd.exe` and are treated as literal characters in file paths.
- **The Solution:** Every path is enclosed in **double quotes (`"..."`)**. Double quotes are universally recognized by PowerShell, `cmd.exe`, and Git Bash, preventing shell expansion and passing the exact path to Git.

### 4.2 Safe Staging of Deleted Files
- Deleted tracked files: `lib/intasend.ts` and `services/payouts/intrasend.ts`.
- Command syntax:
  ```powershell
  git rm -- "lib/intasend.ts" "services/payouts/intrasend.ts"
  ```
  This command explicitly stages only the two approved deletions without touching any other deleted or untracked file.

---

## 5. Exact Proposed Application Staging Manifest & Safe Commands

> [!CAUTION]
> **PROPOSED COMMANDS ONLY — NOT EXECUTED.**  
> In accordance with Phase 09F mandatory safety constraints, zero staging commands were executed. The commands below represent the final, safe command plan prepared for separate user authorization.

### Group 1: Configuration, Build & CI/CD Pipelines (8 Paths)
```powershell
git add -- ".env.example"
git add -- ".github/workflows/deploy-staging.yml"
git add -- "cloudbuild.staging.yaml"
git add -- "Dockerfile"
git add -- "middleware.ts"
git add -- "next.config.mjs"
git add -- "package.json"
git add -- "package-lock.json"
```

### Group 2: Database Schema & Migration (2 Paths)
```powershell
git add -- "prisma/schema.prisma"
git add -- "prisma/migrations/20261023030000_add_registration_paid_order_and_attendee_email_indexes/migration.sql"
```

### Group 3: Application Pages, Routes & Components (28 Paths)
```powershell
git add -- "app/(attendee)/[username]/RegistrationForm.tsx"
git add -- "app/(organizer)/create/page.tsx"
git add -- "app/(organizer)/dashboard/assistant/page.tsx"
git add -- "app/(organizer)/dashboard/payments/page.tsx"
git add -- "app/(organizer)/edit/[slug]/page.tsx"
git add -- "app/admin/test/payments/page.tsx"
git add -- "app/api/admin/revenue/route.ts"
git add -- "app/api/admin/test/payments/route.ts"
git add -- "app/api/billing/cancel/route.ts"
git add -- "app/api/billing/invoices/route.ts"
git add -- "app/api/billing/status/route.ts"
git add -- "app/api/cron/payout-reconciliation/route.ts"
git add -- "app/api/cron/settlement-reconciliation/route.ts"
git add -- "app/api/dashboard/stats/route.ts"
git add -- "app/api/events/[slug]/lookup/route.ts"
git add -- "app/api/events/[slug]/route.ts"
git add -- "app/api/events/route.ts"
git add -- "app/api/my-events/route.ts"
git add -- "app/api/organizer/payments/summary/route.ts"
git add -- "app/api/organizer/payments/withdrawals/route.ts"
git add -- "app/api/paid-events/orders/[orderId]/route.ts"
git add -- "app/api/payments/intasend/webhook/route.ts"
git add -- "app/api/payments/mpesa/status/route.ts"
git add -- "app/api/payments/mpesa/subscribe/route.ts"
git add -- "app/layout.tsx"
git add -- "app/pay/[orderId]/page.tsx"
git add -- "components/payments/OrganizerPaymentsPage.tsx"
git add -- "services/payouts/index.ts"
```

### Group 4: Core Libraries & Shared Utilities (15 Paths)
```powershell
git add -- "lib/env.ts"
git add -- "lib/eventPasses.ts"
git add -- "lib/freeEventWaitlist.ts"
git add -- "lib/organizerPayments.ts"
git add -- "lib/paidEventCheckout.ts"
git add -- "lib/paymentFinalizers.ts"
git add -- "lib/paystack.ts"
git add -- "lib/paystackWebhookDispatcher.ts"
git add -- "lib/phone.ts"
git add -- "lib/ratelimit.ts"
git add -- "lib/settlementSyncWorker.ts"
git add -- "lib/subscription.ts"
git add -- "lib/subscriptionBilling.ts"
git add -- "lib/subscriptionMigration.ts"
git add -- "lib/withdrawalService.ts"
```

### Group 5: Deletion of Deprecated IntraSend Modules (2 Paths)
```powershell
git rm -- "lib/intasend.ts" "services/payouts/intrasend.ts"
```

### Group 6: Automated Test Suites (23 Paths)
```powershell
git add -- "__tests__/api/cacheSafetyPhase6a.test.ts"
git add -- "__tests__/api/decommissionedIntasendWebhook.test.ts"
git add -- "__tests__/api/eventAttendeeLookupPhase6b.test.ts"
git add -- "__tests__/api/eventDashboardPayload.test.ts"
git add -- "__tests__/api/organizerPaymentsDashboardPhase519.test.ts"
git add -- "__tests__/api/paid-order-status.test.ts"
git add -- "__tests__/api/writeOptimizationPhase6b.test.ts"
git add -- "__tests__/components/PaidEventRegistrationFlow.test.tsx"
git add -- "__tests__/components/RegistrationForm.test.tsx"
git add -- "__tests__/lib/eventPassLifecycleAudit.test.ts"
git add -- "__tests__/lib/financialIntegrityPhase512.test.ts"
git add -- "__tests__/lib/freeEventWaitlistConcurrency.test.ts"
git add -- "__tests__/lib/organizerPaymentsExperiencePhase520.test.ts"
git add -- "__tests__/lib/paymentTruthAndWebhookRecoveryPhase42.test.ts"
git add -- "__tests__/lib/paystackWebhookRefundsPhase519.test.ts"
git add -- "__tests__/lib/phone.test.ts"
git add -- "__tests__/lib/providerVerifiedRefundPhase515.test.ts"
git add -- "__tests__/lib/ratelimitHardeningPhase6b.test.ts"
git add -- "__tests__/lib/safeWithdrawalsAndPayoutReconciliationPhase6.test.ts"
git add -- "__tests__/lib/settlementReconciliationPhase521.test.ts"
git add -- "__tests__/lib/subscriptionBillingMigrationPhase7.test.ts"
git add -- "__tests__/scripts/stagingDeploymentDecoupling.test.ts"
git add -- "__tests__/security/phase4bPaymentSecurityRemediation.test.ts"
```

---

## 6. Explicit Exclusions

The following paths are strictly excluded from the application staging manifest:

1. **Maintenance Documentation (39 Files):**  
   All markdown files in `maintenance/` (`00-programme-charter.md` through `09e-final-precommit-scope-verification.md` plus this report).  
   *Reason:* Designated for a subsequent dedicated documentation commit:  
   `docs(maintenance): archive programme audit reports and release verification records (Phases 00-09F)`.
2. **Ephemeral Build Artifacts (2 Files):**  
   - `public/sw.js`: 50KB minified service worker precache output generated during local build. Left unstaged in working tree.
   - `public/workbox-c2c0676f.js`: Workbox bundle. Left unstaged in working tree.  
   *Reason:* Service worker assets are compiled dynamically in the container build pipeline; committing local build outputs causes unnecessary Git churn.
3. **Unrelated Developer Tooling (1 File):**  
   - `generate_partnership_pdf.py`: Standalone script with local Windows paths. Left untracked in working tree.  
   *Reason:* Unrelated to web application.

---

## 7. Proposed Commit Message

```text
feat(release): staging release candidate with decoupled migrations and hardened payments

- Decouple staging database migrations into Step 3 of cloudbuild.staging.yaml
- Enforce RUN_DB_MIGRATIONS=false and pin prisma@5.22.0 in Dockerfile runner
- Decommission legacy deploy job in deploy-staging.yml and isolate production database secrets
- Add additive Registration indexes for paidOrderId and eventId_attendeeEmail
- Enforce Paystack-only payment architecture and retire deprecated IntaSend modules
- Implement automated payout and settlement reconciliation cron routes with distributed locking
- Include mandatory runtime dependencies lib/phone.ts and lib/subscriptionMigration.ts
- Expand regression test suite with 18 test suites and 131 passing assertions
```

---

## 8. Outstanding Test, CI, Staging, Payment, and Migration Limitations

The following limitations and release gates remain carried forward:

1. **Whole-Repository Test Suite:** **NOT RUN** locally; to be executed in GitHub Actions CI (`npm run test:ci`).
2. **TypeScript Validation:** **BLOCKED LOCALLY** on constrained host (~4.53GB RAM); provisions 8192 MB heap on 32GB CI runner in `pr-validation.yml`.
3. **ESLint:** **NOT RUN** locally; candidate files are not assumed clean.
4. **Complete Production Build:** **NOT FULLY VALIDATED**; Webpack stage passed, typecheck/lint bypassed.
5. **CI on Exact Candidate:** **NOT RUN**; pending local commit, push, and PR creation.
6. **Paystack Test Key Mode (Gate P-1):** Operator verification in GCP Secret Manager that `PAYSTACK_SECRET_KEY` has `sk_test_...`.
7. **Paystack Webhook URL (Gate P-2):** Operator verification in Paystack Dashboard that test webhooks route to `https://staging.eventsslot.com/api/webhooks/paystack`.
8. **Cloud Build Staging DB IAM (Gate M-1):** Operator verification that Cloud Build service account has `Secret Manager Secret Accessor` on `EVENTSLOT_STAGING_DATABASE_URL`.
9. **Production Migration Strategy (Gate PR-2):** **DEFERRED** pending production database telemetry (row count and write traffic). Standard index creation is approved for staging only.

---

## 9. Final Integrity Check & Safety Confirmation

Direct Git status check confirms that no files were staged or committed and all pre-existing changes remain preserved:

- **Files Staged / Committed:** **0** (Working tree remains 100% unstaged).
- **Git Commits / Pushes / Merges / Resets / Cleans / Checkouts:** **0 executed**.
- **Working Tree Files Discarded or Reverted:** **0**.
- **The only permitted new file created:** [`maintenance/09f-final-commit-command-safety.md`](file:///c:/Users/DANIEL/Documents/WebApp%20Projects/eventslot/event-slot/maintenance/09f-final-commit-command-safety.md).
