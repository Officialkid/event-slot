# EventSlot Maintenance Programme — Phase 08A Report
## Staging Workflow Containment and CI Evidence

**Execution Date:** 2026-10-23  
**Auditor / Reviewer:** Antigravity (Senior Release Engineer, Database Reliability Engineer & CI/CD Security Assessor)  
**Repository:** `Officialkid/event-slot`  
**Active Branch:** `audit/phase-5-7-concurrency-ci`  
**HEAD Commit:** `ff277de9bc124658b577067dc1adb772a6b39d3b`  
**Execution Mode:** LOCAL PRE-DEPLOYMENT VERIFICATION & CONTAINMENT (Zero deployments, zero live database migrations, zero git commits/pushes)  
**Verdict:** **`PASS WITH CONDITIONS`**

---

## 1. Executive Summary & Verdict

Phase 08A resolved the critical staging deployment disparity identified in Phase 08. Prior to this phase, two conflicting staging deployment mechanisms existed in the repository:
1. **The Approved Pipeline ([`cloudbuild.staging.yaml`](file:///c:/Users/DANIEL/Documents/WebApp%20Projects/eventslot/event-slot/cloudbuild.staging.yaml)):** Decoupled, deterministic, bound strictly to `EVENTSLOT_STAGING_DATABASE_URL`, and disables application startup migrations.
2. **The Legacy GitHub Actions Workflow ([`.github/workflows/deploy-staging.yml`](file:///c:/Users/DANIEL/Documents/WebApp%20Projects/eventslot/event-slot/.github/workflows/deploy-staging.yml)):** Triggered on pushes to branch `staging`, lacked migration decoupling, and in line 218 dangerously mapped `DATABASE_URL` to the **production database secret** (`EVENTSLOT_DATABASE_URL`).

### Official Verdict: **`PASS WITH CONDITIONS`**

#### Key Containment Actions Accomplished
- **Unsafe Deployment Route Permanently Contained:** Decommissioned the `deploy` job in `.github/workflows/deploy-staging.yml` by setting `if: false`, completely removing `gcloud run deploy`, `docker push`, and the dangerous `EVENTSLOT_DATABASE_URL` secret reference.
- **Fail-Closed Safety Barrier:** Replaced deployment steps with a fail-closed notice step that directs developers to Google Cloud Build (`cloudbuild.staging.yaml`).
- **Non-Deployment CI Checks Retained:** Retained the `test` job in `deploy-staging.yml` so that code pushes to branch `staging` still execute linting, type-checking, and unit tests safely without touching any live environment.
- **Automated Regression Suite Expanded:** Updated [`__tests__/scripts/stagingDeploymentDecoupling.test.ts`](file:///c:/Users/DANIEL/Documents/WebApp%20Projects/eventslot/event-slot/__tests__/scripts/stagingDeploymentDecoupling.test.ts) to 11 tests verifying workflow containment, secret isolation, and decoupling (11/11 passed, exit code `0`).
- **Full Maintenance Regression Suite:** All 12 maintenance suites passed (89 of 89 tests, exit code `0`, 11.81s).

---

## 2. Baseline & Working-Tree State

- **Target Branch:** `audit/phase-5-7-concurrency-ci`
- **HEAD Commit:** `ff277de9bc124658b577067dc1adb772a6b39d3b` (ahead of origin by 3 commits)
- **Initial Working Tree Inventory:**
  - Modified files: 52
  - Deleted files: 2 (`lib/intasend.ts`, `services/payouts/intrasend.ts`)
  - Untracked files: 27
- **Safety Boundary Invariant:** Zero git resets, stashes, checkouts, commits, pushes, merges, or destructive file operations were performed.

---

## 3. Investigation Findings: Legacy Staging Workflow (`deploy-staging.yml`)

A comprehensive audit of `.github/workflows/deploy-staging.yml` confirmed:

1. **Trigger Surface:**
   - Triggered automatically on `push: branches: [staging]`.
   - Triggered manually via `workflow_dispatch`.
   - Pull requests do not trigger deployment.
2. **Secret & Credential Flow:**
   - Line 218 previously passed:
     ```yaml
     --update-secrets=DATABASE_URL=EVENTSLOT_DATABASE_URL:latest,DIRECT_URL=EVENTSLOT_DIRECT_URL:latest,...
     ```
   - **Severe Finding:** The workflow passed `EVENTSLOT_DATABASE_URL` (the live Neon production database) directly into the staging Cloud Run service.
3. **Migration Decoupling Absence:**
   - The workflow contained no pre-deploy migration step.
   - Line 217 did not pass `RUN_DB_MIGRATIONS=false`.
4. **Reference Search:**
   - A repository-wide search confirmed zero other workflows, scripts, or documentation reference `deploy-staging.yml`.

---

## 4. Changes Made and Rationale

| File | Change Details | Architectural Justification |
|---|---|---|
| [`.github/workflows/deploy-staging.yml`](file:///c:/Users/DANIEL/Documents/WebApp%20Projects/eventslot/event-slot/.github/workflows/deploy-staging.yml) | 1. Set `if: false` on `deploy` job.<br>2. Removed `docker build`, `docker push`, and `gcloud run deploy` steps.<br>3. Completely eliminated `EVENTSLOT_DATABASE_URL` reference.<br>4. Added fail-safe exit step referencing `cloudbuild.staging.yaml`.<br>5. Retained `test` job for code checks. | Eliminates the risk of accidental deployment to staging with production database credentials upon pushing to branch `staging`. Establishes `cloudbuild.staging.yaml` as the sole deployment manifest. |
| [`__tests__/scripts/stagingDeploymentDecoupling.test.ts`](file:///c:/Users/DANIEL/Documents/WebApp%20Projects/eventslot/event-slot/__tests__/scripts/stagingDeploymentDecoupling.test.ts) | Added structural assertions verifying `deploy-staging.yml` is decommissioned, `EVENTSLOT_DATABASE_URL` is absent from all staging configs, and PR validation has 8GB memory. | Prevents regressions where legacy deploy steps or production database credentials could be reintroduced. |

---

## 5. Test Coverage, Commands, Exit Codes and Results

### 1. Targeted Containment Test Suite
- **Command:** `npm --prefix event-slot test -- __tests__/scripts/stagingDeploymentDecoupling.test.ts`
- **Exit Code:** `0`
- **Result:** **11 passed, 11 total** (Time: 1.519s)
  - `√ cloudbuild.staging.yaml decouples migration execution into a dedicated pre-deploy step using deterministic --no-install execution`
  - `√ cloudbuild.staging.yaml maps migrations strictly to staging database secret and avoids production secrets`
  - `√ cloudbuild.staging.yaml configures Cloud Run container with RUN_DB_MIGRATIONS=false`
  - `√ Dockerfile configures deterministic runner with pinned prisma CLI, bin symlinks, and RUN_DB_MIGRATIONS=false`
  - `√ package.json and package-lock.json strictly pin Prisma CLI to 5.22.0`
  - `√ production cloudbuild.yaml remains untouched and isolated`
  - `√ verifies pending registration index migration is purely additive and syntax-valid`
  - `√ identifies shared PAYSTACK_SECRET_KEY as an outstanding staging payment safety release gate`
  - `√ legacy deploy-staging.yml workflow is decommissioned and cannot perform an unintended deployment`
  - `√ no staging workflow maps the production database secret into a staging database connection`
  - `√ pr-validation.yml allocates sufficient memory and enforces reproducible CI checks`

### 2. Full Maintenance Regression Test Suite
- **Command:**
  ```powershell
  npm --prefix event-slot test -- stagingDeploymentDecoupling decommissionedIntasendWebhook paymentTruthAndWebhookRecoveryPhase42 financialIntegrityPhase512 paid-order-status freeEventWaitlistConcurrency eventAttendeeLookupPhase6b ratelimitHardeningPhase6b cacheSafetyPhase6a writeOptimizationPhase6b eventPassLifecycleAudit eventDashboardPayload
  ```
- **Exit Code:** `0`
- **Result:** **12 passed, 12 total; 89 passed, 89 total** (Time: 11.81s)

---

## 6. Real CI Evidence & Remote Observation

- **Local Commits Ahead of Remote:** Local branch `audit/phase-5-7-concurrency-ci` is ahead of `origin/audit/phase-5-7-concurrency-ci` by 3 commits (`ff277de`, `fbd7064`, `d4b165c`).
- **Remote CI Run Observation:** In accordance with safety rules, no commits or pushes were made to remote GitHub repositories. The `gh` CLI is not installed in the local environment. Therefore, actual completed remote CI runs for these unpushed commits cannot be observed from the local workstation.
- **Static Verification Guarantee:** All CI workflow YAML definitions have been structurally verified and tested via Jest tests.

---

## 7. Outstanding Environment & Release Gates

1. **Monolithic TypeScript Check:** Local monolithic TypeScript type checking (`tsc --noEmit`) exhausts the V8 heap on the local Windows machine (~4.53 GB free RAM). Handled in GitHub Actions PR validation with `NODE_OPTIONS: --max-old-space-size=8192` on 32GB runners.
2. **Repository Linting:** Repository-wide ESLint (`eslint .`) was previously interrupted due to traversing >2,500 unignored files.
3. **Paystack Operator Gates (Pending Staging Release):**
   - **Gate P-1:** Operator verification that Secret Manager secret `PAYSTACK_SECRET_KEY` accessible by staging contains `sk_test_...`.
   - **Gate P-2:** Paystack Dashboard verification that webhook routing is isolated between production (`www.eventsslot.com`) and staging (`staging.eventsslot.com`).
   - **Gate P-3:** Test-card-only smoke testing guarantee.
4. **Database Migration Step:** Migration `20261023030000_add_registration_paid_order_and_attendee_email_indexes` remains unapplied and ready for authorized execution via Cloud Build Step 3.

---

## 8. Confirmation of Production Isolation

- **Production Manifest [`cloudbuild.yaml`](file:///c:/Users/DANIEL/Documents/WebApp%20Projects/eventslot/event-slot/cloudbuild.yaml):** Verified 100% untouched (`git diff cloudbuild.yaml` produces 0 lines).
- **Production Workflow [`.github/workflows/deploy.yml`](file:///c:/Users/DANIEL/Documents/WebApp%20Projects/eventslot/event-slot/.github/workflows/deploy.yml):** Verified 100% untouched.

---

## 9. Recommended Next Action

With the legacy staging deployment path decommissioned, staging deployment has a single, safe, isolated pipeline (`cloudbuild.staging.yaml`). The safest next action is:
1. Operator completes verification of Paystack test mode in GCP Secret Manager (Gate P-1).
2. Authorize triggering the staging release via Google Cloud Build:
   ```bash
   gcloud builds submit --config=cloudbuild.staging.yaml .
   ```
3. Verify that Step 3 applies migration `20261023030000` to `EVENTSLOT_STAGING_DATABASE_URL` and that Cloud Run revision `eventslot-web-staging` boots with `RUN_DB_MIGRATIONS=false`.

---

## 10. Explicit Operational Attestation

During Phase 08A:
- **No live Cloud Build jobs were submitted.**
- **No Cloud Run services or revisions were deployed.**
- **No database migrations were executed against staging or production databases.**
- **No secrets, tokens, or live credentials were accessed, retrieved, or printed.**
- **No Git commits, pushes, merges, stashes, or resets were performed.**
- **Production configuration (`cloudbuild.yaml`) was preserved without modification.**
