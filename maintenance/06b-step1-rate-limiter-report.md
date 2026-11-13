# EventSlot Maintenance Programme — Phase 06B, Step 1 Report
## Rate-Limiter Hardening: Namespace Isolation & Bounded Memory Fallback

**Repository:** `Officialkid/event-slot`  
**Branch:** `audit/phase-5-7-concurrency-ci`  
**HEAD:** `ff277de` (`ff277de9bc124658b577067dc1adb772a6b39d3b`)  
**Phase:** Phase 06B — Step 1  
**Status:** COMPLETE (Ready for Step 2 authorization)

---

## 1. Executive Summary

In Phase 06B, Step 1, we implemented the approved rate-limiter hardening in [lib/ratelimit.ts](file:///c:/Users/DANIEL/Documents/WebApp%20Projects/eventslot/event-slot/lib/ratelimit.ts). Prior to this change:
1. In-memory fallback tracking was backed by an unbounded JavaScript `Map<string, MemWindow>`. Under Redis degradation or during local development under sustained distinct-client load, entries remained in memory indefinitely without TTL purging or a capacity ceiling, presenting a denial-of-service memory exhaustion vulnerability.
2. The memory store used un-prefixed client keys (e.g., raw IP strings). If a client hit an aggressive threshold on one endpoint (such as `attendanceLookupRatelimit` at 5 req / 10 min), any subsequent memory fallback on another endpoint using the same raw IP would share entry collisions.
3. Upstash Redis instances did not specify a unique `prefix` parameter per rate-limiter namespace, creating potential key collision vectors in multi-limiter environments.

### Actions Taken
- Replaced the unbounded `Map` with `lru-cache` (`max: 10000`, `ttl: windowMs`). Entries auto-expire after their sliding-window TTL, and the total memory footprint is strictly bounded.
- Introduced explicit, mandatory `namespace` parameters across all factory functions (`makeLimiter`, `makeUpstashLimiter`, `makeMemoryLimiter`).
- Implemented key namespacing in both the fallback store (`${namespace}:${key}`) and Upstash Redis (`prefix: 'eventslot:${namespace}'`).
- Fully preserved all 8 existing application limiter policies and thresholds with zero breaking changes to calling routes.
- Created an automated test suite ([__tests__/lib/ratelimitHardeningPhase6b.test.ts](file:///c:/Users/DANIEL/Documents/WebApp%20Projects/eventslot/event-slot/__tests__/lib/ratelimitHardeningPhase6b.test.ts)) with 9 dedicated test cases validating isolation, capacity bounds, eviction, sliding-window reset, and Upstash error failover.

---

## 2. Baseline Repository State

```
Branch: audit/phase-5-7-concurrency-ci
HEAD:   ff277de9bc124658b577067dc1adb772a6b39d3b
Status: 47 modified files, 2 deleted files, 23 untracked items
```

All pre-existing user modifications, untracked test fixtures, migrations, and billing safeguards (`FORCE_BILLING_COMING_SOON_MODE = true`) remain untouched.

---

## 3. Implementation Details

### 3.1 Bounded LRU Fallback Store
The in-memory fallback now imports `{ LRUCache } from 'lru-cache'` (v11.3.5 already present in `node_modules`):
```typescript
export interface MemWindow {
  count: number
  resetAt: number
}

export const fallbackStore = new LRUCache<string, MemWindow>({
  max: 10000,
})
```
When an entry is initialized or reset:
```typescript
fallbackStore.set(namespacedKey, { count: 1, resetAt }, { ttl: windowMs })
```
- **Bound Guarantee:** If an attacker or traffic spike submits >10,000 distinct IP addresses within a window, the least-recently used windows are evicted, preventing Node.js process heap exhaustion.
- **Expiry Guarantee:** Entries expire naturally after `windowMs`, and any subsequent access evaluates `now >= entry.resetAt` to cleanly allocate a fresh sliding window.

### 3.2 Namespace Isolation
All limiters now enforce namespaced keys:
```typescript
export function makeMemoryLimiter(maxRequests: number, windowMs: number, namespace: string): Limiter {
  return {
    limit: async (key: string): Promise<LimitResult> => {
      const namespacedKey = `${namespace}:${key}`
      ...
    }
  }
}
```
For Upstash Redis:
```typescript
new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(maxRequests, `${windowSeconds} s`),
  prefix: `eventslot:${namespace}`,
  analytics: false,
})
```

### 3.3 Preserved Limiter Definitions & Call Signatures
All 8 exported limiters retain identical caller semantics:
| Limiter Identifier | Namespace | Quota / Window | Target Consumers |
| :--- | :--- | :--- | :--- |
| `ratelimit` | `general` | 20 req / 60s | General API routes |
| `signupRatelimit` | `signup` | 5 req / 3600s | `/api/auth/signup` |
| `loginRatelimit` | `login` | 5 req / 60s | `/api/auth/[...nextauth]` |
| `attendanceLookupRatelimit` | `attendance` | 5 req / 600s | `/api/attendance/confirm` |
| `walkInCheckinRatelimit` | `walkin` | 5 req / 60s | `/api/walkin/[slug]/checkin` |
| `aiRatelimit` | `ai` | 10 req / 60s | `/api/ai/*` |
| `reportDownloadRatelimit` | `reports` | 5 req / 60s | Analytics & reports |
| `billingRatelimit` | `billing` | 10 req / 60s | `/api/billing/*`, checkout |

Callers continue to use `const { success } = await ratelimit.limit(identifier)` without needing any refactoring.

---

## 4. Test Verification & Results

### 4.1 Step 1 Test Suite
Command:
```bash
npm --prefix event-slot test -- __tests__/lib/ratelimitHardeningPhase6b.test.ts
```
Output:
```
PASS __tests__/lib/ratelimitHardeningPhase6b.test.ts
  Phase 06B, Step 1: Rate Limiter Hardening
    Bounded LRU Fallback Store Configuration
      √ initializes the fallback store with a 10,000 item capacity bound (18 ms)
      √ successfully evicts least-recently-used entries when capacity is saturated (4 ms)
    Namespace Isolation
      √ isolates rate-limit quotas between distinct namespaces using the same client key (4 ms)
      √ isolates different client keys within the same limiter namespace (3 ms)
    Quota Counting, Decrementing, and Threshold Boundaries
      √ accurately decrements remaining count down to 0 and blocks subsequent requests (6 ms)
    Sliding-Window Expiration and Reset
      √ resets quota when the window timestamp expires (6 ms)
    Upstash Redis Failover Graceful Degradation
      √ gracefully falls back to namespaced memory limiter when Upstash fails or throws (42 ms)
    Export Integrity and Preserved Policy Thresholds
      √ exports all 8 expected limiter instances with valid limit methods (2 ms)
      √ correctly returns LimitResult shape across application limiters (2 ms)

Test Suites: 1 passed, 1 total
Tests:       9 passed, 9 total
Snapshots:   0 total
Time:        2.378 s
Exit Code:   0
```

### 4.2 Regression Verification
Command:
```bash
npm --prefix event-slot test -- __tests__/api/cacheSafetyPhase6a.test.ts __tests__/lib/freeEventWaitlistConcurrency.test.ts
```
Output:
```
PASS __tests__/lib/freeEventWaitlistConcurrency.test.ts
PASS __tests__/api/cacheSafetyPhase6a.test.ts

Test Suites: 2 passed, 2 total
Tests:       15 passed, 15 total
Snapshots:   0 total
Time:        5.174 s
Exit Code:   0
```

---

## 5. Scope Boundary Compliance

In accordance with strict operating boundaries:
- **Modified:** `lib/ratelimit.ts` only.
- **Added:** `__tests__/lib/ratelimitHardeningPhase6b.test.ts` and `maintenance/06b-step1-rate-limiter-report.md`.
- **Zero Modifications to:** Attendee lookup routes (`app/api/events/[slug]/registrations`), write backfill code, database schemas, migrations, deployment configs, or payment code.
- **Zero Execution of:** Production/staging connections, git commits, git pushes, or migrations.

---

## 6. Next Steps

Phase 06B, Step 1 is complete. Awaiting authorization to begin:
- **Phase 06B, Step 2:** Attendee lookup query optimization (`app/api/events/[slug]/registrations/route.ts` & `components/events/EventAttendeesModal.tsx`).
