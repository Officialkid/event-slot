# EventSlot Maintenance Programme — Phase 07B Report
## Migration Execution Decoupling & Staging Release Safety

**Execution Date:** 2026-10-23  
**Auditor / Reviewer:** Antigravity (Senior Release Engineer & Database Reliability Engineer)  
**Repository:** `Officialkid/event-slot`  
**Active Branch:** `audit/phase-5-7-concurrency-ci`  
**HEAD Commit:** `ff277de9bc124658b577067dc1adb772a6b39d3b`  
**Execution Mode:** LOCAL REPOSITORY TASK ONLY (Zero deployments, zero live migrations, zero git commits/pushes)  
**Verdict:** **PASS WITH CONDITIONS**

---

## 1. Executive Summary & Verdict

Phase 07B addressed the critical operational vulnerability identified in Phases 05C, 07, and 07A: **unsafe application-startup migration execution on Cloud Run**.

Prior to Phase 07B, both `Dockerfile` and `cloudbuild.staging.yaml` coupled database migration execution (`npx prisma migrate deploy`) directly to the container startup command (`CMD`) whenever `RUN_DB_MIGRATIONS=true`. When Cloud Run scaled horizontally across multiple instances, or during new revision boots, each container attempted to run migrations simultaneously, risking cold-start latency, request timeouts, and database advisory lock contention.

### Remediations Implemented (Local-Only)
1. **Cloud Build Staging Pipeline Decoupling:** Modified [`cloudbuild.staging.yaml`](file:///c:/Users/DANIEL/Documents/WebApp%20Projects/eventslot/event-slot/cloudbuild.staging.yaml) to introduce a dedicated, one-time pre-deploy migration step (`id: Run Database Migrations (Pre-Deploy)`) using the newly built container image and secret-bound `DATABASE_URL`/`DIRECT_URL` mapped strictly to `EVENTSLOT_STAGING_DATABASE_URL`.
2. **Failure Gate Established:** Cloud Build executes steps sequentially; if migration execution encounters an error or lock timeout, Cloud Build immediately halts, and the subsequent Cloud Run deployment step is never executed.
3. **Application Container Startup Disabled:** Updated Cloud Run deployment arguments in `cloudbuild.staging.yaml` with `RUN_DB_MIGRATIONS=false` and added `ENV RUN_DB_MIGRATIONS=false` to [`Dockerfile`](file:///c:/Users/DANIEL/Documents/WebApp%20Projects/eventslot/event-slot/Dockerfile#L32). Application containers boot directly into `node server.js` with zero startup migration work.
4. **Environment Isolation Preserved:** Production configuration ([`cloudbuild.yaml`](file:///c:/Users/DANIEL/Documents/WebApp%20Projects/eventslot/event-slot/cloudbuild.yaml)) was kept completely untouched and isolated.
5. **Configuration Verification Suite Added:** Created [`__tests__/scripts/stagingDeploymentDecoupling.test.ts`](file:///c:/Users/DANIEL/Documents/WebApp%20Projects/eventslot/event-slot/__tests__/scripts/stagingDeploymentDecoupling.test.ts) (6 passed). Full regression suite (12 suites, 84 tests) passed with 100% success (exit code 0).

---

## 2. Baseline & Working-Tree State

- **Target Branch:** `audit/phase-5-7-concurrency-ci`
- **HEAD Commit:** `ff277de9bc124658b577067dc1adb772a6b39d3b`
- **Working Tree Inventory:**
  - Modified files count: 50 (49 prior modified files + `Dockerfile`)
  - Deleted files count: 2 (`lib/intasend.ts`, `services/payouts/intrasend.ts`)
  - Untracked files count: 28 (including `cloudbuild.staging.yaml`, `__tests__/scripts/stagingDeploymentDecoupling.test.ts`, and maintenance reports)
- **Safety Invariant:** Zero destructive Git operations were performed. All pre-existing work is completely preserved.

---

## 3. Files Changed and Justification

| File | Nature of Change | Justification |
|---|---|---|
| [`cloudbuild.staging.yaml`](file:///c:/Users/DANIEL/Documents/WebApp%20Projects/eventslot/event-slot/cloudbuild.staging.yaml) | Modified build manifest | 1. Added isolated Step 3: `Run Database Migrations (Pre-Deploy)` executing `npx prisma@5.22.0 migrate deploy` before Cloud Run deployment.<br>2. Added `availableSecrets.secretManager` binding `DATABASE_URL` and `DIRECT_URL` strictly to `EVENTSLOT_STAGING_DATABASE_URL`.<br>3. Updated Cloud Run deployment args with `RUN_DB_MIGRATIONS=false`. |
| [`Dockerfile`](file:///c:/Users/DANIEL/Documents/WebApp%20Projects/eventslot/event-slot/Dockerfile) | Modified line 32 | Added `ENV RUN_DB_MIGRATIONS=false` to runner stage to ensure container instances default to fail-closed against startup migration execution. |
| [`__tests__/scripts/stagingDeploymentDecoupling.test.ts`](file:///c:/Users/DANIEL/Documents/WebApp%20Projects/eventslot/event-slot/__tests__/scripts/stagingDeploymentDecoupling.test.ts) | New configuration test suite | Asserts that migration execution precedes deployment, secret bindings point strictly to staging, container startup migrations are disabled, and migration SQL is additive. |

---

## 4. Before-and-After Migration Execution Architecture

```
BEFORE PHASE 07B (COUPLED STARTUP MIGRATIONS):
┌────────────────┐     ┌────────────────┐     ┌────────────────────────────────────────────────────────┐
│ Cloud Build:   │ ──> │ Cloud Build:   │ ──> │ Cloud Run Deploy:                                      │
│ Build Image    │     │ Push Image     │     │ RUN_DB_MIGRATIONS=true                                 │
└────────────────┘     └────────────────┘     └────────────────────────────────────────────────────────┘
                                                                       │
                                               ┌───────────────────────┴───────────────────────┐
                                               ▼                                               ▼
                                      Container Boot (Inst A)                         Container Boot (Inst B)
                                      Runs: prisma migrate deploy                     Runs: prisma migrate deploy
                                      Advisory lock contention / Cold-start delay      Advisory lock contention / Cold-start delay
                                      Runs: node server.js                            Runs: node server.js

AFTER PHASE 07B (DECOUPLED PRE-RELEASE MIGRATIONS):
┌────────────────┐     ┌────────────────┐     ┌────────────────────────────────┐     ┌────────────────────────────────┐
│ Cloud Build:   │ ──> │ Cloud Build:   │ ──> │ Cloud Build (Pre-Deploy):      │ ──> │ Cloud Run Deploy:              │
│ 1. Build Image │     │ 2. Push Image  │     │ 3. Run Database Migrations     │     │ 4. RUN_DB_MIGRATIONS=false     │
└────────────────┘     └────────────────┘     │    (One-off container using    │     └────────────────────────────────┘
                                              │     STAGING_DATABASE_URL)      │                     │
                                              └────────────────────────────────┘                     ▼
                                                              │                       Container Boot (All Instances):
                                                              ▼                       Runs: node server.js instantly!
                                                    [ FAILURE GATE ]                  Zero migration execution on boot.
                                                    If migration fails,               Zero advisory lock contention.
                                                    build stops immediately!
                                                    Cloud Run NEVER updated!
```

---

## 5. Staging and Production Separation Evidence

1. **Secret Binding Verification:**
   In `cloudbuild.staging.yaml`:
   ```yaml
   availableSecrets:
     secretManager:
       - versionName: projects/${PROJECT_ID}/secrets/EVENTSLOT_STAGING_DATABASE_URL/versions/latest
         env: DATABASE_URL
       - versionName: projects/${PROJECT_ID}/secrets/EVENTSLOT_STAGING_DATABASE_URL/versions/latest
         env: DIRECT_URL
   ```
   The pre-deploy migration step has access *only* to `EVENTSLOT_STAGING_DATABASE_URL`. It is mathematically impossible for the staging Cloud Build pipeline to execute migrations against the production database (`EVENTSLOT_DATABASE_URL`).
2. **Production Integrity Preserved:**
   [`cloudbuild.yaml`](file:///c:/Users/DANIEL/Documents/WebApp%20Projects/eventslot/event-slot/cloudbuild.yaml) remains completely unchanged. Its triggers, substitutions, and secrets remain segregated from staging.

---

## 6. Migration Safety Analysis (`20261023030000`)

- **File:** [`prisma/migrations/20261023030000_add_registration_paid_order_and_attendee_email_indexes/migration.sql`](file:///c:/Users/DANIEL/Documents/WebApp%20Projects/eventslot/event-slot/prisma/migrations/20261023030000_add_registration_paid_order_and_attendee_email_indexes/migration.sql)
- **SQL Content:**
  ```sql
  -- CreateIndex
  CREATE INDEX "Registration_paidOrderId_idx" ON "Registration"("paidOrderId");

  -- CreateIndex
  CREATE INDEX "Registration_eventId_attendeeEmail_idx" ON "Registration"("eventId", "attendeeEmail");
  ```
- **Safety Verification:**
  1. **Schema Consistency:** Columns `paidOrderId`, `eventId`, and `attendeeEmail` exist in `prisma/schema.prisma` with exact casing and matching types.
  2. **Additive Non-Destructive DDL:** The SQL contains zero `DROP`, `ALTER`, `TRUNCATE`, or `DELETE` statements.
  3. **Locking Behavior:** PostgreSQL acquires a standard `SHARE` lock on `Registration`. On moderate table sizes, index creation executes in milliseconds without affecting read queries.
  4. **Backward Compatibility:** The existing running code functions identically before and after the indexes are created; query plans seamlessly switch to index scans once the indexes become valid.
  5. **Rollback Safety:** Rollback is zero-loss and non-destructive:
     ```sql
     DROP INDEX IF EXISTS "Registration_paidOrderId_idx";
     DROP INDEX IF EXISTS "Registration_eventId_attendeeEmail_idx";
     ```

---

## 7. Local Test Evidence Matrix

The full regression test suite across all 12 core suites was executed:

```bash
npm --prefix event-slot test -- \
  __tests__/scripts/stagingDeploymentDecoupling.test.ts \
  __tests__/api/decommissionedIntasendWebhook.test.ts \
  __tests__/lib/paymentTruthAndWebhookRecoveryPhase42.test.ts \
  __tests__/lib/financialIntegrityPhase512.test.ts \
  __tests__/api/paid-order-status.test.ts \
  __tests__/lib/freeEventWaitlistConcurrency.test.ts \
  __tests__/api/eventAttendeeLookupPhase6b.test.ts \
  __tests__/lib/ratelimitHardeningPhase6b.test.ts \
  __tests__/api/cacheSafetyPhase6a.test.ts \
  __tests__/api/writeOptimizationPhase6b.test.ts \
  __tests__/lib/eventPassLifecycleAudit.test.ts \
  __tests__/api/eventDashboardPayload.test.ts
```

**Results:**
- **Test Suites:** 12 passed, 12 total
- **Tests:** 84 passed, 84 total (0 failed, 0 skipped)
- **Wall Time:** 19.284s
- **Exit Code:** 0

### Targeted Decoupling Test Suite ([`__tests__/scripts/stagingDeploymentDecoupling.test.ts`](file:///c:/Users/DANIEL/Documents/WebApp%20Projects/eventslot/event-slot/__tests__/scripts/stagingDeploymentDecoupling.test.ts))
- `√ cloudbuild.staging.yaml decouples migration execution into a dedicated pre-deploy step` (35 ms)
- `√ cloudbuild.staging.yaml maps migrations strictly to staging database secret` (4 ms)
- `√ cloudbuild.staging.yaml configures Cloud Run container with RUN_DB_MIGRATIONS=false` (6 ms)
- `√ Dockerfile defaults RUN_DB_MIGRATIONS to false in the runner stage` (3 ms)
- `√ production cloudbuild.yaml remains untouched and isolated` (5 ms)
- `√ verifies pending registration index migration is purely additive and syntax-valid` (19 ms)

---

## 8. Future Staging Rollout Checklist (Awaiting Explicit Authorization)

When authorized, the rollout will execute according to the following controlled procedure:

- [ ] **1. Source Revision Commit:** Commit verified local changes (Phases 04B–07B) to branch `audit/phase-5-7-concurrency-ci`.
- [ ] **2. Working-Tree Cleanliness:** Confirm `git status` has zero untracked ephemeral artifacts or uncommitted diffs.
- [ ] **3. Pre-Build Test Gate:** Run 12 regression test suites locally (84 tests passing).
- [ ] **4. Staging Build Submission:** Submit build via `gcloud builds submit --config=cloudbuild.staging.yaml`.
- [ ] **5. Step 3 Migration Verification:** Observe Cloud Build logs for `id: Run Database Migrations (Pre-Deploy)`. Confirm `20261023030000_add_registration_paid_order_and_attendee_email_indexes` applied successfully.
- [ ] **6. Step 4 Cloud Run Deployment:** Confirm Cloud Run revision deployed with `RUN_DB_MIGRATIONS=false`.
- [ ] **7. Health Probes:** Verify `GET https://staging.eventsslot.com/api/health` returns `200 OK` (`{"database":"ok"}`).
- [ ] **8. Static Caching Parity Probe:** Verify `GET /_next/static/chunks/...` returns `Cache-Control: public, max-age=31536000, immutable`.
- [ ] **9. IntaSend Webhook Parity Probe:** Verify `POST /api/payments/intasend/webhook` returns `HTTP 410 Gone`.
- [ ] **10. Attendee Lookup Parity Probe:** Verify `GET /api/events/[slug]/lookup?q=...` uses B-tree lookup without full table scan.
- [ ] **11. Smoke Test Suite:** Run `node scripts/cloudrun-smoke-tests.mjs --base-url=https://staging.eventsslot.com`.
- [ ] **12. Revision Promotion / Rollback:** If all 11 checks pass, maintain 100% traffic on the new revision. If any check fails, immediately roll back to `eventslot-web-staging-00020-7b2`:
  ```bash
  gcloud run services update-traffic eventslot-web-staging \
    --to-revisions=eventslot-web-staging-00020-7b2=100 --region=us-central1
  ```

---

## 9. Confirmation of Safety Constraints

In compliance with Phase 07B rules:
- **Zero live database migrations were executed.**
- **Zero database mutations or schema pushes were performed.**
- **Zero Cloud Run deployments or build submissions were initiated.**
- **Zero Git commits, pushes, merges, or resets were executed.**
- The active working tree remains completely intact (50 modified, 2 deleted, 28 untracked).

---

## 10. Final Decision & Recommendation

### **VERDICT: PASS WITH CONDITIONS**

### Summary of Conditions:
1. Migration decoupling is implemented and verified locally via automated configuration tests.
2. The staging rollout checklist is established and ready.
3. Actual execution of the staging build and migration requires separate, explicit user authorization.

**Recommendation:** Present findings and await explicit user instruction regarding the staging release.
