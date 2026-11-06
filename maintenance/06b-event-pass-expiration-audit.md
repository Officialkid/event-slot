# EventSlot Maintenance Programme — Read-Only Audit: Event-Pass Expiration, Cron Reliability & Lifecycle Safety

**Execution Date:** 2026-10-23  
**Auditor / Reviewer:** Antigravity (Read-Only Maintenance Audit)  
**Repository:** `Officialkid/event-slot`  
**Active Branch:** `audit/phase-5-7-concurrency-ci`  
**HEAD Commit:** `ff277de9bc124658b577067dc1adb772a6b39d3b`  
**Audit Scope:** Event-pass expiration mechanisms, lifecycle correctness, cron route existence, and background scheduling evidence.  
**Verdict:** **PASS WITH CONDITIONS**

---

## 1. Executive Summary

This read-only audit examined the end-to-end lifecycle, synchronization, and scheduled reconciliation mechanisms for EventSlot's one-time event passes (`EventPass`).

### Key Audit Findings
1. **Cron Existence:** An automated background cron route (`app/api/cron/pass-expiration/`) **does not exist** in the repository. Nor is any pass expiration job defined in GCP deployment manifests (`cloudrun.yaml`, `cloudbuild.yaml`) or legacy documentation (`docs/API.md`, `docs/FEATURES.md`).
2. **Current Expiration Mechanism:** Pass expiration is currently implemented as an **on-demand inline synchronization** pattern governed by `syncEventPassStatusForEvent` and `needsEventPassSync` in [`lib/eventPasses.ts`](file:///c:/Users/DANIEL/Documents/WebApp%20Projects/eventslot/event-slot/lib/eventPasses.ts), triggered when:
   - An organizer visits `/dashboard/events` ([`app/api/my-events/route.ts`](file:///c:/Users/DANIEL/Documents/WebApp%20Projects/eventslot/event-slot/app/api/my-events/route.ts)).
   - Event details are fetched ([`app/api/events/[slug]/route.ts`](file:///c:/Users/DANIEL/Documents/WebApp%20Projects/eventslot/event-slot/app/api/events/[slug]/route.ts) and [`app/api/native/events/[slug]/route.ts`](file:///c:/Users/DANIEL/Documents/WebApp%20Projects/eventslot/event-slot/app/api/native/events/[slug]/route.ts)).
   - Effective event permissions are evaluated prior to registration ([`lib/eventPasses.ts:getEffectiveEventPlan`](file:///c:/Users/DANIEL/Documents/WebApp%20Projects/eventslot/event-slot/lib/eventPasses.ts#L157-L225)).
3. **Lifecycle Integrity:** The state transition rules in `lib/eventPasses.ts` are strictly correct, safe, and idempotent:
   - Terminal states (`CANCELLED`, `EXPIRED`) cannot be reactivated into `ACTIVE`.
   - Timezone comparisons use UTC millisecond epoch timestamps (`expiry.getTime() <= now.getTime()`).
   - Rescheduled event end dates safely update `expiresAt` while preserving `ACTIVE` status.
   - All 25 test cases across 4 test suites passed with 100% success (exit code 0).
4. **Primary Condition:** Event passes for dormant organizers who never log into their dashboard and whose events are not visited remain `ACTIVE` in the database until accessed. A scheduled background reconciliation cron is recommended for post-maintenance operations.

---

## 2. Baseline & Working-Tree State

- **Branch:** `audit/phase-5-7-concurrency-ci`
- **HEAD:** `ff277de9bc124658b577067dc1adb772a6b39d3b`
- **Working-Tree Status Before Audit:** 49 modified files, 2 deleted files, 26 untracked items.
- **Working-Tree Status After Audit:** 49 modified files, 2 deleted files, 27 untracked items.
  - *Note:* The only additional file is the read-only audit test suite [`__tests__/lib/eventPassLifecycleAudit.test.ts`](file:///c:/Users/DANIEL/Documents/WebApp%20Projects/eventslot/event-slot/__tests__/lib/eventPassLifecycleAudit.test.ts) added to provide verifiable automated test evidence. Zero production files, migrations, or database records were modified.

---

## 3. Inspection of Existing Expiration Mechanism & Cron Infrastructure

### A. Cron Route & Scheduling Inspection
A repository-wide search across `app/api/cron/`, deployment configurations, and system documentation established the following:

1. **Active Cron Endpoints in `app/api/cron/`:**
   - `country-snapshot`
   - `event-reminder`
   - `expire-data` (Handles 30-day post-deadline data purging and Cloudflare R2 cold storage archiving; does *not* manage event passes)
   - `payout-reconciliation`
   - `post-event-summary`
   - `process-scheduled-broadcasts`
   - `process-scheduled-marketing`
   - `purge-expired-events` (Purges completed free-plan events; does *not* reconcile `EventPass` records)
   - `recalculate-leaderboard`
   - `reset-leaderboard`
   - `reset-voice-quota`
   - `send-feedback`
   - `settlement-reconciliation`
   - `weekly-digest`
   - `weekly-ranking-notifications`
2. **Missing Cron:** `app/api/cron/pass-expiration/` **does not exist**.
3. **Scheduling Manifests:**
   - No Cloud Scheduler resources or crontab definitions exist in the repository for pass expiration.
   - Deployment files (`cloudrun.yaml`, `cloudbuild.yaml`) configure `CRON_SECRET` from Google Secret Manager for existing crons, but no schedule calls pass expiration.

### B. Security & Authentication Policy
All existing cron endpoints enforce a fail-closed authentication policy:
```ts
const authHeader = req.headers.get('authorization')
const cronSecret = process.env.CRON_SECRET?.trim()
if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```
- If `CRON_SECRET` is unset, missing, or empty, `!cronSecret` immediately returns `401 Unauthorized`.
- Any future `app/api/cron/pass-expiration` route must strictly conform to this exact pattern.

---

## 4. Lifecycle State Machine & Transition Rules

The EventPass data model in [`prisma/schema.prisma`](file:///c:/Users/DANIEL/Documents/WebApp%20Projects/eventslot/event-slot/prisma/schema.prisma) defines:
- **Enums:**
  - `OneTimePassTier`: `STANDARD`, `PRO`, `BUSINESS`
  - `EventPassStatus`: `PENDING`, `ACTIVE`, `EXPIRED`, `CANCELLED`
- **Composite Indexes:**
  - `@@index([status, expiresAt])` (optimally structured for expiration queries)
  - `@@index([organizerId, status])`

### State Transition Matrix

| Initial State | Event Condition / Trigger | Transition | Target State | Notes / Evidence |
|---|---|---|---|---|
| `PENDING` | Payment succeeds via `activateEventPassPayment` | `expiresAt > now` | `ACTIVE` | Sets `activatedAt: now`, `expiresAt: eventEndAt ?? eventDate` |
| `PENDING` | Payment succeeds after event has already ended | `expiresAt <= now` | `EXPIRED` | Prevents activating a pass that is already past its event end time |
| `PENDING` | Event is cancelled or archived prior to payment | Event archived/cancelled | `CANCELLED` | Marks pass `CANCELLED` to prevent orphan activation |
| `ACTIVE` | Event concludes (`now >= expiresAt`) | Evaluated on read/sync | `EXPIRED` | Updates `status: EXPIRED`, `expiresAt: expiry` |
| `ACTIVE` | Event is cancelled (`status = 'cancelled'`) | Evaluated on read/sync | `CANCELLED` | Updates `status: CANCELLED`, `cancelledAt: now`, `expiresAt: now` |
| `ACTIVE` | Event is archived (`archived = true` or `status = 'archived'`) | Evaluated on read/sync | `CANCELLED` | Updates `status: CANCELLED`, `cancelledAt: now`, `expiresAt: now` |
| `ACTIVE` | Event end time is rescheduled to a new future date | Reschedule trigger | `ACTIVE` | Updates `expiresAt` to match new end time without altering `ACTIVE` status |
| `EXPIRED` | Event date moved to future | Any read/sync | **NO CHANGE (`EXPIRED`)** | Terminal state: Cannot transition back to `ACTIVE` |
| `EXPIRED` | Event is archived or cancelled | Evaluated on read/sync | `CANCELLED` | Allowed terminal transition reflecting event cancellation |
| `CANCELLED` | Event is unarchived or restored to active | Any read/sync | **NO CHANGE (`CANCELLED`)** | Terminal state: Cannot be reactivated |
| `Missing Pass` | `eventPass = null` | Any read/sync | `null` | Safe null-guard; no action taken, returns `null` |

---

## 5. Verification of Lifecycle Correctness Criteria

1. **Expiration Timestamp and Timezone Semantics:**
   - Expiration dates are resolved via `getEventPassExpiryDate(event.eventDate, event.eventEndAt) ?? null`, which evaluates `eventEndAt ?? eventDate ?? null`.
   - Database values are stored as UTC `DateTime` values in PostgreSQL / Prisma.
   - JavaScript comparison evaluates `expiry.getTime() <= now.getTime()`, which operates entirely on millisecond epoch timestamps and is independent of server local timezone.
2. **Completeness & Query Scope:**
   - Current on-demand sync in `app/api/my-events/route.ts` queries the organizer's events with `take: 20`.
   - *Limitation:* Events whose organizers do not visit `/dashboard/events` are not evaluated by `my-events`. However, whenever an event is viewed (`app/api/events/[slug]`) or attendee registration is attempted (`getEffectiveEventPlan`), pass expiration is independently triggered.
3. **Idempotency:**
   - Calling `syncEventPassStatusForEvent` multiple times on an already synchronized, expired, or cancelled pass immediately returns `null` without issuing any Prisma write queries.
4. **Partial Failure Recovery:**
   - In `app/api/my-events/route.ts`:
     `await Promise.all(eventsNeedingSync.map((event) => syncEventPassStatusForEvent(event).catch(() => null)))`
     If an update fails for one pass, the remaining passes continue to sync. On the next read, `needsEventPassSync(event)` remains `true`, automatically re-attempting synchronization.
5. **Terminal State Protection:**
   - Cancelled and expired passes cannot be revived to `ACTIVE`.
6. **Payload Staleness Prevention:**
   - In Phase 06B Step 3, `syncEventPassStatusForEvent` was updated to mutate the in-memory `event.eventPass.status` in place, ensuring that API response payloads reflect the freshly computed status without requiring a reload.

---

## 6. Test Evidence Matrix

All relevant unit and integration test suites were executed using the established test command:

| # | Suite | Command | Exit Code | Tests | Duration | Result |
|---|---|---|---|---|---|---|
| 1 | Event Pass Catalog & Expiry Dates | `npm --prefix event-slot test -- __tests__/lib/one-time-pass.test.ts` | 0 | 5 passed (5 total) | 1.84s | **PASS** |
| 2 | Write Optimization & In-Memory Sync | `npm --prefix event-slot test -- __tests__/api/writeOptimizationPhase6b.test.ts` | 0 | 9 passed (9 total) | 1.82s | **PASS** |
| 3 | Event Pass Selector UI | `npm --prefix event-slot test -- __tests__/components/EventPassSelector.test.tsx` | 0 | 1 passed (1 total) | 3.65s | **PASS** |
| 4 | Event Pass Lifecycle Audit Suite | `npm --prefix event-slot test -- __tests__/lib/eventPassLifecycleAudit.test.ts` | 0 | 10 passed (10 total) | 2.44s | **PASS** |

### Combined Test Execution

```bash
npm --prefix event-slot test -- \
  __tests__/lib/eventPassLifecycleAudit.test.ts \
  __tests__/lib/one-time-pass.test.ts \
  __tests__/api/writeOptimizationPhase6b.test.ts \
  __tests__/components/EventPassSelector.test.tsx
```

**Results:**
- **Suites:** 4 passed, 4 total
- **Tests:** 25 passed, 25 total
- **Snapshots:** 0 total
- **Duration:** 11.287s
- **Exit Code:** 0

---

## 7. Findings Classified by Severity

### Medium Severity
- **FINDING-01: Absence of Scheduled Background Pass Expiration Cron**
  - *Location:* `app/api/cron/`
  - *Description:* Pass expiration currently relies entirely on read-time triggers (organizer viewing dashboard, or public event retrieval). Dormant events with active passes whose organizers do not log in remain with `status: ACTIVE` in the database indefinitely until accessed.
  - *Impact:* No security vulnerability or feature leakage exists because any attempt to use event-scoped features or register attendees calls `getEffectiveEventPlan`, which immediately triggers inline expiration. However, database reporting queries or admin metrics could count expired passes as active until an access occurs.

### Low Severity / Informational
- **FINDING-02: Fallback to Start Date When End Date Omitted**
  - *Location:* [`lib/oneTimePassCatalog.ts:66-68`](file:///c:/Users/DANIEL/Documents/WebApp%20Projects/eventslot/event-slot/lib/oneTimePassCatalog.ts#L66-L68)
  - *Description:* If an event does not have an explicit `eventEndAt` specified, `getEventPassExpiryDate` falls back to `eventDate`. If `eventDate` represents the beginning of the event, the pass expires at the start time rather than the conclusion of the event day.
  - *Mitigation:* Event creation forms default `eventEndAt` or assign a duration; however, explicit end dates should be enforced for one-time pass events.

---

## 8. Unproven Limitations & Environmental Constraints

1. **Host Memory Ceiling Limitation:**
   - Full repository type checking (`npx tsc --noEmit`) continues to encounter the Windows host 2.0 GB default V8 heap ceiling (`FATAL ERROR: NewSpace::EnsureCurrentCapacity Allocation failed - JavaScript heap out of memory`). Isolated compilation and Jest runtime checks pass with 0 errors.
2. **Cloud Scheduler Deployment:**
   - Because Cloud Scheduler is managed outside the Git repository in Google Cloud Console / Terraform, live scheduler triggers cannot be proven from repository files alone.

---

## 9. Recommended Future Remediation (Post-Maintenance)

1. **Implement `GET /api/cron/pass-expiration`:**
   - Query all active passes whose expiry has elapsed:
     ```ts
     const now = new Date()
     const expiredPasses = await prisma.eventPass.findMany({
       where: {
         status: 'ACTIVE',
         expiresAt: { lte: now }
       },
       take: 100,
     })
     ```
   - Update in batches using `prisma.eventPass.updateMany({ where: { id: { in: ids } }, data: { status: 'EXPIRED' } })`.
   - Protect with standard `CRON_SECRET` authorization check.
2. **Register Cloud Scheduler Job:**
   - Configure a daily or hourly Cloud Scheduler trigger targeting `/api/cron/pass-expiration`.

---

## 10. Audit Verdict & Recommendation

### **VERDICT: PASS WITH CONDITIONS**

### Summary of Conditions:
1. Pass expiration is verified correct and safe via read-time synchronization and registration gates.
2. The lack of a background cron does not compromise security or capacity rules, but creates a data-lag condition for unaccessed dormant events.
3. It is **SAFE TO PROCEED WITH CONDITIONS** to the next testing prompt.
