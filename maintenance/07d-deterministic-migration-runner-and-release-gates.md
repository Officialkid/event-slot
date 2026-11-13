# EventSlot Maintenance Programme — Phase 07D Report
## Deterministic Migration Runner & Staging Release Gate Preparation

**Execution Date:** 2026-10-23  
**Auditor / Reviewer:** Antigravity (Senior Release Engineer, Database Reliability Engineer & Payment-Security Reviewer)  
**Repository:** `Officialkid/event-slot`  
**Active Branch:** `audit/phase-5-7-concurrency-ci`  
**HEAD Commit:** `ff277de9bc124658b577067dc1adb772a6b39d3b`  
**Execution Mode:** LOCAL REPOSITORY WORK ONLY (Zero builds submitted, zero deployments, zero live database migrations, zero git commits/pushes)  
**Verdict:** **`PASS WITH CONDITIONS`**

---

## 1. Executive Summary & Verdict

Phase 07D completes the operational and architectural preparation required before any staging rollout is authorized. Building upon the decoupling established in Phase 07B and the audit findings in Phase 07C, this phase eliminates non-deterministic network execution during database migrations, tightens failure propagation, hardens staging isolation, and formalizes explicit payment-security release gates.

### Official Verdict: **`PASS WITH CONDITIONS`**

The release candidate's migration runner has been made fully deterministic, self-contained, and fail-closed:
1. **Deterministic Runner Architecture:** Container Stage 3 (`runner`) now packages the locked `node_modules/prisma` CLI package and `node_modules/.bin` alongside `@prisma/client` and schema migrations. Cloud Build Step 3 executes `npx --no-install prisma migrate deploy`, which guarantees that the CLI is resolved locally from container assets and strictly prohibits dynamic network downloads from the npm registry.
2. **Fail-Closed Migration Barrier:** Cloud Build Step 3 runs sequentially before Cloud Run deployment. If migration execution fails, times out, or encounters a lock conflict, the step exits with a non-zero code, immediately halting the Cloud Build pipeline and aborting deployment.
3. **Staging Environment Isolation Preserved:** The staging pipeline exclusively binds `DATABASE_URL` and `DIRECT_URL` to `EVENTSLOT_STAGING_DATABASE_URL`. Production configuration (`cloudbuild.yaml`) remains completely untouched.
4. **Conditional Status Justification:** Live authorization is withheld pending mandatory operator verification of two infrastructure-side release gates:
   - **Payment Credential Mode Gate:** Authorized verification that the Secret Manager secret `PAYSTACK_SECRET_KEY` resolved by the staging service account is an isolated test-mode credential (`sk_test_...`) and not shared with production live funds.
   - **Production Migration Decoupling Port:** Acknowledgment that production (`cloudbuild.yaml`) still couples migrations to startup and must be refactored prior to any production promotion.

---

## 2. Verified Baseline & Working-Tree State

A pre- and post-implementation inspection of Git working-tree status confirms:
- **Current Branch:** `audit/phase-5-7-concurrency-ci`
- **HEAD Commit:** `ff277de9bc124658b577067dc1adb772a6b39d3b`
- **Working Tree Classification:**
  - Modified files: 50 (including `Dockerfile` and `cloudbuild.staging.yaml`)
  - Deleted files: 2 (`lib/intasend.ts`, `services/payouts/intrasend.ts`)
  - Untracked files: 28 (including tests, migration files, and maintenance reports)
- **Safety Boundary Adherence:** Zero git resets, stashes, checkouts, commits, pushes, or destructive actions were performed.

---

## 3. Files Changed and Rationale

| File | Change Details | Architectural Rationale |
|---|---|---|
| [`Dockerfile`](file:///c:/Users/DANIEL/Documents/WebApp%20Projects/eventslot/event-slot/Dockerfile#L44-L45) | Added `COPY --from=builder /app/node_modules/prisma ./node_modules/prisma` and `COPY --from=builder /app/node_modules/.bin ./node_modules/.bin` to `runner` stage; updated line 56 CMD fallback to `npx --no-install prisma migrate deploy`. | Bundles the pinned 28.66 MB Prisma CLI into the runner image. Eliminates reliance on external npm network access during migration execution. |
| [`cloudbuild.staging.yaml`](file:///c:/Users/DANIEL/Documents/WebApp%20Projects/eventslot/event-slot/cloudbuild.staging.yaml#L23) | Updated Step 3 args to `npx --no-install prisma migrate deploy`. | Enforces fail-closed local execution. If the CLI is not present, `npx` immediately throws error code 1 instead of fetching from npm registry. |
| [`__tests__/scripts/stagingDeploymentDecoupling.test.ts`](file:///c:/Users/DANIEL/Documents/WebApp%20Projects/eventslot/event-slot/__tests__/scripts/stagingDeploymentDecoupling.test.ts) | Expanded test suite to 8 tests covering CLI version pinning, `--no-install` argument verification, runner container packaging, and payment release gates. | Provides continuous regression assertions for deployment decoupling and environment isolation. |

---

## 4. Migration Runner Architecture & Evaluation

### Evaluated Alternatives

1. **Approach 1: Dedicated Separate Migration Container Image**
   - *Design:* Add a multi-stage Docker target `FROM node:22-alpine AS migration-runner` and add a Cloud Build step `docker build --target migration-runner ...` followed by `docker push ...`.
   - *Evaluation:* Redundant build time (compiling two separate images in Cloud Build) and doubles Artifact Registry storage usage. Rejected as overly complex.
2. **Approach 2: Self-Contained Application Container Runner (Chosen)**
   - *Design:* Copy `node_modules/prisma` (28.66 MB) and `.bin` from the `builder` stage into `runner`. Cloud Run instances default to `node server.js` (`RUN_DB_MIGRATIONS=false`). The Cloud Build migration step invokes this same built image with `npx --no-install prisma migrate deploy`.
   - *Evaluation:* Minimal, robust, uses 100% locked dependencies from `package-lock.json`, requires zero additional build steps, and ensures the exact same schema and migration files built with the application are executed.
3. **Approach 3: Host-Level Cloud Build Execution**
   - *Design:* Run `npm ci` on the Cloud Build host workspace.
   - *Evaluation:* Incurs massive network overhead (downloading >1GB of dependencies on every build). Rejected.

### CLI Pinning & File Availability Evidence
- `package.json` devDependencies: `prisma: "^5.22.0"`
- `package-lock.json` packages: `node_modules/prisma` locked at `5.22.0`
- `Dockerfile` builder stage: `RUN npx prisma generate` succeeds during build.
- `Dockerfile` runner stage: Copies `/app/prisma` (schema & migrations), `/app/node_modules/.prisma`, `/app/node_modules/@prisma`, `/app/node_modules/prisma`, and `/app/node_modules/.bin`.
- Target working directory: `/app` with non-root ownership `nextjs:nodejs`.

---

## 5. Migration Failure-Handling Behavior

Cloud Build executes steps in strict serial order:
```yaml
steps:
  - id: Build container image (Step 1)
  - id: Push container image (Step 2)
  - id: Run Database Migrations (Pre-Deploy) (Step 3)
  - id: Deploy to Cloud Run Staging (Step 4)
```

1. **Failure Propagation:**
   - If `npx --no-install prisma migrate deploy` exits with a non-zero exit code (e.g., database connection failure, lock timeout, bad connection string, syntax error), the shell process exits with code 1.
   - Cloud Build marks Step 3 as `FAILURE`.
   - Step 4 (`Deploy to Cloud Run Staging`) is **never reached**.
2. **Credential Masking:**
   - Cloud Build injects secrets via `secretEnv: ['DATABASE_URL', 'DIRECT_URL']`. Secret values are masked in Cloud Build execution logs and are not exposed as shell command arguments.
   - Prisma CLI natively suppresses credentials in its log output.

---

## 6. Staging and Production Configuration Separation

```
[Staging Pipeline: cloudbuild.staging.yaml]
  ├── Image: eventslot-staging/eventslot-web-staging:staging-phase8
  ├── Migration Secret: EVENTSLOT_STAGING_DATABASE_URL
  ├── Cloud Run Service: eventslot-web-staging
  ├── Runtime Environment: RUN_DB_MIGRATIONS=false
  └── Status: DECOUPLED & DETERMINISTIC

[Production Pipeline: cloudbuild.yaml]
  ├── Image: eventslot/eventslot-web:manual
  ├── Migration Secret: EVENTSLOT_DATABASE_URL
  ├── Cloud Run Service: eventslot-web
  ├── Runtime Environment: RUN_DB_MIGRATIONS=true
  └── Status: UNTOUCHED (Decoupling scheduled for dedicated production phase)
```

Staging configuration cannot reach or mutate production databases:
- `cloudbuild.staging.yaml` has zero references to `EVENTSLOT_DATABASE_URL`.
- Staging substitution `_SERVICE` is locked to `eventslot-web-staging`.

---

## 7. Mandatory Payment-Safety Release Gates

The Phase 07C audit established that both staging and production manifests pass `PAYSTACK_SECRET_KEY=PAYSTACK_SECRET_KEY:latest`. This introduces an operational risk if the underlying secret in Secret Manager is set to a live production key.

### Outstanding Operator Verification Checklist
Before authorizing staging deployment, an authorized GCP operator must verify:

1. **Gate P-1: Secret Manager Value Verification**
   - **Verification Requirement:** Confirm via GCP Console or authorized CLI (`gcloud secrets versions access latest --secret=PAYSTACK_SECRET_KEY`) that the staging Cloud Run service account resolves a **Paystack Test Key** (starts with `sk_test_`).
   - **Remediation if Live:** If `PAYSTACK_SECRET_KEY` in GCP Secret Manager contains a live key (`sk_live_`), provision an isolated secret `EVENTSLOT_STAGING_PAYSTACK_SECRET_KEY` containing the test key and update `cloudbuild.staging.yaml` accordingly before release.
2. **Gate P-2: Webhook Endpoint Isolation**
   - **Verification Requirement:** Confirm in Paystack Dashboard (Settings -> API Keys & Webhooks) that the live webhook URL is configured exclusively for `https://www.eventsslot.com/api/webhooks/paystack` and that no test webhooks route to production or vice versa.
3. **Gate P-3: Smoke Test Safety Guarantee**
   - **Verification Requirement:** Ensure any staging end-to-end checkout testing utilizes Paystack test card numbers (e.g. `4084 0840 0000 0000`) and test OTPs (`123456`) to ensure real customer accounts or credit lines are never charged.

*Attestation: These gates cannot be verified from the local repository alone and are formally documented as prerequisite conditions for live release.*

---

## 8. Index-Migration Execution Safety Review

### Migration Details
- **File:** `prisma/migrations/20261023030000_add_registration_paid_order_and_attendee_email_indexes/migration.sql`
- **Statements:**
  ```sql
  CREATE INDEX "Registration_paidOrderId_idx" ON "Registration"("paidOrderId");
  CREATE INDEX "Registration_eventId_attendeeEmail_idx" ON "Registration"("eventId", "attendeeEmail");
  ```

### Structural & Locking Analysis
1. **Target Engine:** PostgreSQL (Neon serverless).
2. **Functional Justification:**
   - `Registration_paidOrderId_idx`: Enables $O(\log N)$ index scans during payment finalization, webhook reconciliation, and refund verification (previously sequential full table scans).
   - `Registration_eventId_attendeeEmail_idx`: Powers the public attendee lookup endpoint (`/api/events/[slug]/lookup`), eliminating in-memory filtration of all event registrations.
3. **Locking Impact:**
   - Standard PostgreSQL `CREATE INDEX` takes a `SHARE` lock on table `Registration`.
   - Reads (`SELECT`) continue without interruption.
   - Writes (`INSERT`, `UPDATE`, `DELETE`) are queued until the index build completes.
   - *Staging Suitability:* Highly suitable. Table row count is small and staging write volume during maintenance is zero.
   - *Production Pre-Condition:* In high-traffic production environments, `CREATE INDEX CONCURRENTLY` or off-peak scheduling with explicit lock timeouts must be planned, as `CREATE INDEX CONCURRENTLY` cannot execute within Prisma's transactional migration wrapper.
4. **Rollback Immutability:**
   - Shifting Cloud Run traffic backward to a previous revision does **not** revert database schema changes. The indexes and the `_prisma_migrations` row persist in the database.
   - Rollback of the migration itself requires an explicit DDL command (`DROP INDEX IF EXISTS "Registration_paidOrderId_idx"; DROP INDEX IF EXISTS "Registration_eventId_attendeeEmail_idx"; DELETE FROM _prisma_migrations WHERE migration_name = '...';`). Because the migration is purely additive, leaving the indexes in place is backward-compatible with older code revisions.

---

## 9. Local Test Evidence Matrix

### 1. Targeted Decoupling & Deterministic Runner Suite
**Command:** `npm --prefix event-slot test -- __tests__/scripts/stagingDeploymentDecoupling.test.ts`
- **Exit Code:** `0`
- **Result:** 1 suite passed, 8 tests passed (2.35s)
  - `√ cloudbuild.staging.yaml decouples migration execution into a dedicated pre-deploy step using deterministic --no-install execution`
  - `√ cloudbuild.staging.yaml maps migrations strictly to staging database secret and avoids production secrets`
  - `√ cloudbuild.staging.yaml configures Cloud Run container with RUN_DB_MIGRATIONS=false`
  - `√ Dockerfile configures deterministic runner with pinned prisma CLI, bin symlinks, and RUN_DB_MIGRATIONS=false`
  - `√ package.json and package-lock.json strictly pin Prisma CLI to 5.22.0`
  - `√ production cloudbuild.yaml remains untouched and isolated`
  - `√ verifies pending registration index migration is purely additive and syntax-valid`
  - `√ identifies shared PAYSTACK_SECRET_KEY as an outstanding staging payment safety release gate`

### 2. Full Maintenance Regression Test Suite
**Command:**
```powershell
npm --prefix event-slot test -- stagingDeploymentDecoupling decommissionedIntasendWebhook paymentTruthAndWebhookRecoveryPhase42 financialIntegrityPhase512 paid-order-status freeEventWaitlistConcurrency eventAttendeeLookupPhase6b ratelimitHardeningPhase6b cacheSafetyPhase6a writeOptimizationPhase6b eventPassLifecycleAudit eventDashboardPayload
```
- **Exit Code:** `0`
- **Result:** 12 suites passed, 12 total; 86 tests passed, 86 total (0 failed, 0 skipped)
- **Execution Time:** 17.236s

---

## 10. Ordered Staging Release Checklist

An authorized release engineer must execute the following sequence:

- [ ] **Step 1: Release Scope Audit:** Verify working tree includes only Phases 04–07D changes.
- [ ] **Step 2: Clean Git Baseline:** Verify working branch `audit/phase-5-7-concurrency-ci` is in a clean, commit-ready state.
- [ ] **Step 3: Source & Image Tag Confirmation:** Confirm target substitution `_IMAGE_TAG: staging-phase8` matches the intended deployment artifact.
- [ ] **Step 4: Database Secret Access Gate (Operator Gate):** Confirm Cloud Build service account has `Secret Manager Secret Accessor` permission for `EVENTSLOT_STAGING_DATABASE_URL`.
- [ ] **Step 5: Payment Credential Mode Gate (Operator Gate):** Confirm `PAYSTACK_SECRET_KEY` resolved in staging starts with `sk_test_`.
- [ ] **Step 6: Packaging Verification:** Confirm Docker build caches and copies `node_modules/prisma` without errors.
- [ ] **Step 7: Separation Approval:** Secure technical signoff to trigger pre-deploy migration on staging.
- [ ] **Step 8: Cloud Build Submission:** Trigger `gcloud builds submit --config=cloudbuild.staging.yaml .`
- [ ] **Step 9: Migration Log Verification:** Check Cloud Build Step 3 logs to confirm `20261023030000_add_registration_paid_order_and_attendee_email_indexes` applied cleanly.
- [ ] **Step 10: Revision Verification:** Confirm Cloud Run revision deployed with `RUN_DB_MIGRATIONS=false` and instances are healthy.
- [ ] **Step 11: Staging Smoke Verification:** Validate attendee lookup endpoint, dashboard stats, and registration flows.
- [ ] **Step 12: Production Preparation:** Document staging results before initiating production decoupling planning.

---

## 11. Explicit Operational Attestation

During Phase 07D:
- **No Cloud Build triggers or Cloud Run deployments were initiated.**
- **No database migrations were executed against staging or production databases.**
- **No connections were established to live databases, Redis instances, or payment gateways.**
- **No secrets, tokens, or credentials were accessed, retrieved, or printed.**
- **No Git commits, pushes, merges, resets, or stashes were performed.**
- **Production configuration (`cloudbuild.yaml`) was preserved without modification.**
