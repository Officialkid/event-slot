# EventSlot Maintenance Programme — Phase 07A Report
## Staging Deployment Parity & Migration Execution Readiness

**Execution Date:** 2026-10-23  
**Auditor / Reviewer:** Antigravity (Phase 07A Pre-Deployment Parity Audit)  
**Repository:** `Officialkid/event-slot`  
**Active Branch:** `audit/phase-5-7-concurrency-ci`  
**HEAD Commit:** `ff277de9bc124658b577067dc1adb772a6b39d3b`  
**Mode:** STRICT READ-ONLY EVIDENCE & READINESS REVIEW (Zero deployments, zero database migrations, zero git commits/pushes)  
**Verdict:** **PASS WITH CONDITIONS**

---

## 1. Executive Summary & Verdict

Phase 07A established the deployment parity between the local maintenance working tree and the currently active Cloud Run Staging revision (`eventslot-web-staging`).

### Key Verdict Findings
1. **Staging Parity Status: ZERO MAINTENANCE CODE DEPLOYED**
   - The active staging revision is `eventslot-web-staging-00020-7b2`, deployed on **2026-10-22T22:04:22Z** from container image `staging-phase8`.
   - Empirical network probes confirm staging is running pre-maintenance code:
     - Staging static chunks return `cache-control: no-store, must-revalidate` (proving Phase 06A immutable chunk caching is absent).
     - Staging IntaSend webhook returns `HTTP 405 Method Not Allowed` on GET (proving Phase 04B HTTP 410 Gone retirement is absent).
   - All 49 modified, 2 deleted, and 27 untracked files from Phases 04B–06B exist **strictly in the local working tree** on the developer workstation.
2. **Migration Execution Status: SAFE, PENDING APPLICATION**
   - Migration `20261023030000_add_registration_paid_order_and_attendee_email_indexes` has **not** been applied to the staging database.
   - The migration is 100% additive (`CREATE INDEX`), contains zero drops or rewrites, and is fully backward-compatible with the schema.
3. **Migration Startup Coupling (Identified Condition):**
   - In `Dockerfile` line 53 and `cloudbuild.staging.yaml` line 42, `RUN_DB_MIGRATIONS=true` triggers `prisma migrate deploy` inside container startup.
   - Decoupling migration execution into a dedicated Cloud Build pre-traffic job is recommended prior to staging promotion.

---

## 2. Baseline & Local Source Identity

- **Branch:** `audit/phase-5-7-concurrency-ci`
- **HEAD Commit:** `ff277de9bc124658b577067dc1adb772a6b39d3b` (`fix(payments): fail-closed capacity, atomic waitlist promotion, exact commission auditor, and verified refund state machine`, committed Tue Oct 20 23:11:21 2026).
- **Working Tree Inventory:**
  - Modified tracked files: 49
  - Deleted tracked files: 2 (`lib/intasend.ts`, `services/payouts/intrasend.ts`)
  - Untracked files: 27 (unit test suites, maintenance reports, migration file)
  - Working tree is 100% uncommitted locally. None of the Phase 04B–06B fixes have been committed or pushed to any remote Git repository.

---

## 3. Actual Staging Revision & Metadata Audit

Live read-only metadata retrieved from Google Cloud Run confirmed:

| Metadata Attribute | Live Value on Staging | Assessment |
|---|---|---|
| **Service Name** | `eventslot-web-staging` | Correct staging service |
| **Active Revision** | `eventslot-web-staging-00020-7b2` | Active revision |
| **Deployment Timestamp** | `2026-10-22T22:04:22.055309Z` | Deployed **prior** to Phase 04B–06B work |
| **Container Image** | `us-central1-docker.pkg.dev/project-d46be384-233e-47fb-bb5/eventslot/eventslot-web-staging:staging-phase8` | Image tag: `staging-phase8` |
| **Traffic Allocation** | `100%` to `eventslot-web-staging-00020-7b2` | Single active revision |
| **Database Secret** | `EVENTSLOT_STAGING_DATABASE_URL` | Segregated from production |
| **Startup Migration Flag**| `RUN_DB_MIGRATIONS: 'true'` | Coupled to container boot |

### Empirical Probe Evidence (Live Network Proof)

1. **Static Asset Caching Probe:**
   ```http
   GET https://staging.eventsslot.com/_next/static/chunks/webpack-3dab1d9735a3889d.js
   HTTP/1.1 200 OK
   cache-control: no-store, must-revalidate
   last-modified: Thu, 22 Oct 2026 22:00:43 GMT
   ```
   *Proof:* The local Phase 06A change in `next.config.mjs` restores `public, max-age=31536000, immutable`. Staging still serves `no-store, must-revalidate`, proving Phase 06A is absent on staging.

2. **IntaSend Decommissioning Probe:**
   ```http
   GET https://staging.eventsslot.com/api/payments/intasend/webhook
   HTTP/1.1 405 Method Not Allowed
   ```
   *Proof:* The local Phase 04B route [`app/api/payments/intasend/webhook/route.ts`](file:///c:/Users/DANIEL/Documents/WebApp%20Projects/eventslot/event-slot/app/api/payments/intasend/webhook/route.ts) responds with `HTTP 410 Gone`. Staging returns `HTTP 405`, proving Phase 04B is absent on staging.

---

## 4. Maintenance Changes Parity Matrix

| Feature / Domain | Local Implementation | Active on Staging? | Verification Evidence |
|---|---|---|---|
| **IntaSend Webhook Decommission** | Returns HTTP 410 Gone | **ABSENT** | Staging returns HTTP 405 |
| **Paystack Timing-Safe HMAC & Leases** | Consolidated dispatcher | **ABSENT** | Deployed pre-maintenance image |
| **Waitlist Row Locking & Atomic Capacity** | Conditional atomic update | **ABSENT** | Code uncommitted locally |
| **Registration Index Migration** | Migration `20261023030000` | **UNAPPLIED** | Migration uncommitted & unapplied |
| **Static Chunk Immutable Caching** | Fixed in `next.config.mjs` | **ABSENT** | Staging serves `no-store` |
| **Sensitive API `no-store` Headers** | Injected in API routes | **ABSENT** | Code uncommitted locally |
| **O(1) Attendee Lookup Query** | Fast-path B-tree lookups | **ABSENT** | Code uncommitted locally |
| **Write Backfill Elimination** | Removed `updateMany` on GET | **ABSENT** | Code uncommitted locally |
| **Rate Limiter LRU Hardening** | `LRUCache(10,000)` & namespaces | **ABSENT** | Code uncommitted locally |

---

## 5. Migration Execution & Startup Ordering Audit

### Current Startup Sequence (`Dockerfile` Line 53)
```dockerfile
CMD ["sh", "-c", "if [ \"$RUN_DB_MIGRATIONS\" = \"true\" ]; then npx prisma@5.22.0 migrate deploy; fi && node server.js"]
```

### Critical Architectural Observations
1. **Startup Coupling Risk:**
   When `cloudbuild.staging.yaml` deploys with `RUN_DB_MIGRATIONS=true`, the Cloud Run container runs `prisma migrate deploy` on boot before launching `node server.js`.
2. **Horizontal Scaling Impact:**
   If multiple Cloud Run instances spin up simultaneously, each attempts to run `migrate deploy`. While Prisma uses advisory locks on `_prisma_migrations`, instances waiting on migration locks increase cold-start latency and can trigger HTTP 504 gateway timeouts.
3. **Recommended Decoupling:**
   Prior to live staging deployment, separate migration execution into a dedicated Cloud Build step:
   ```yaml
   - id: Run Database Migrations
     name: node:22-alpine
     entrypoint: sh
     args:
       - -c
       - npx prisma migrate deploy
     secretEnv: ['DATABASE_URL']
   ```
   and update Cloud Run with `--update-env-vars=RUN_DB_MIGRATIONS=false`.

---

## 6. Proposed Safe Staging Rollout Sequence

When a staging deployment is explicitly authorized, the following ordered sequence should be followed:

```
┌────────────────────────────────────────────────────────────────────────┐
│               RECOMMENDED STAGING ROLLOUT SEQUENCE                     │
├──────┬──────────────────────────────┬──────────────────────────────────┤
│ Step │ Action                       │ Validation / Gate                │
├──────┼──────────────────────────────┼──────────────────────────────────┤
│ 1    │ Git Commit Local Changes     │ Clean commit on maintenance br.  │
│ 2    │ Run Full Local Regression    │ 11 test suites (78 tests pass)   │
│ 3    │ Standalone Migration Run     │ Apply 20261023030000 to Staging  │
│ 4    │ Verify Migration Table       │ Verify status in _prisma_migr.   │
│ 5    │ Build & Push Staging Image   │ Cloud Build container tag build  │
│ 6    │ Deploy Cloud Run Revision    │ eventslot-web-staging (RUN_DB=F) │
│ 7    │ Post-Deploy Smoke Tests      │ node scripts/cloudrun-smoke...   │
│ 8    │ Verify Parity Probes         │ Confirm HTTP 410 & immutable hdr │
└──────┴──────────────────────────────┴──────────────────────────────────┘
```

### Immediate Stop & Rollback Conditions
- If `prisma migrate deploy` encounters a lock timeout or error: stop immediately, do not route traffic to the new revision.
- If smoke tests fail post-deploy: execute one-click revision rollback:
  ```bash
  gcloud run services update-traffic eventslot-web-staging \
    --to-revisions=eventslot-web-staging-00020-7b2=100 --region=us-central1
  ```

---

## 7. Confirmation of Safety Constraints

In compliance with Phase 07A rules:
- **Zero code, schema, or configuration files were modified.**
- **Zero database migrations were executed.**
- **Zero deployments, builds, or traffic shifts were initiated.**
- **Zero Git commits, pushes, merges, or resets were performed.**
- Working tree remains completely intact (49 modified, 2 deleted, 27 untracked).

---

## 8. Final Decision & Recommendation

### **VERDICT: PASS WITH CONDITIONS**

### Summary of Conditions:
1. **Parity Gap Confirmed:** Staging is confirmed to be running pre-maintenance code; all Phase 04B–06B fixes currently reside exclusively in the local working tree.
2. **Migration Decoupling:** Decoupling `prisma migrate deploy` from container startup into a dedicated pre-deploy Cloud Build step is strongly recommended.
3. **Authorization Requirement:** Staging deployment and migration application require separate explicit authorization.

**Recommendation:** Proceed to user consultation for explicit authorization of the staged rollout sequence.
