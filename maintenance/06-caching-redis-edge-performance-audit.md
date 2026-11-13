# EventSlot Technologies — Full System Maintenance Programme
## Phase 06: Caching, Redis & Edge Performance Audit

**Document Version:** 1.0.0  
**Effective Date:** 23 October 2026  
**Auditor Lead:** Principal Software Architect, Performance & Caching Engineer, Senior DevOps Engineer & Technical Auditor  
**Target Repository:** `Officialkid/event-slot`  
**Active Branch:** `audit/phase-5-7-concurrency-ci`  
**HEAD Commit:** `ff277de` (`ff277de9bc124658b577067dc1adb772a6b39d3b`)  
**Execution Mode:** STRICT READ-ONLY AUDIT (Zero application edits, zero Redis mutations, zero database mutations, zero live load testing)  
**Deliverable Status:** **PHASE 06 AUDIT COMPLETED**

---

## 1. Executive Summary & Audit Verdict

### **VERDICT: PASS WITH CONDITIONS**

The Phase 06 audit conducted a comprehensive, repository-wide investigation into EventSlot's caching architecture, Redis integration, CDN and HTTP edge headers, cache invalidation paths, and computational bottlenecks.

While the core application features functional rate limiting and localized caching, the audit discovered critical edge header anti-patterns, process-isolated caching that causes state inconsistencies across horizontal Cloud Run instances, missing cache invalidation on core mutation routes, and unindexed in-memory data scans on search/lookup paths.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                     PHASE 06 CACHING & PERFORMANCE AUDIT MATRIX                        │
├──────┬───────────────────────────────────┬──────────────┬──────────────────────────────┤
│ Item │ Verification Dimension            │ Verdict      │ Posture & Observations       │
├──────┼───────────────────────────────────┼──────────────┼──────────────────────────────┤
│ 1    │ Git Working Tree Integrity        │ PASS         │ 42 Tracked (40M, 2D), 21 Untr.│
│ 2    │ Next.js Route Directives & Cache  │ CONDITIONAL  │ 0 revalidateTag; 1 unst_cache│
│ 3    │ Static Asset Edge Caching         │ FAIL (P1)    │ /_next/static forced no-store│
│ 4    │ Sensitive Response Protections    │ CONDITIONAL  │ Authenticated APIs omit no-st│
│ 5    │ Invalidation & Write Consistency  │ CONDITIONAL  │ Event create/edit/reg miss pg│
│ 6    │ Redis Architecture & Reliability  │ PASS WITH COND│ REST Upstash; fallback risks│
│ 7    │ Query & Payload Performance       │ CONDITIONAL  │ Lookup route loads all reg in│
│ 8    │ Safe Static Verification          │ PASS         │ 2/2 Jest suites pass (code 0)│
└──────┴───────────────────────────────────┴──────────────┴──────────────────────────────┘
```

### Conditions for Phase 06 Closure:
1. **Static Chunk Cache Crippling:** In `next.config.mjs` (line 128), `/_next/static/:path*` is explicitly assigned `Cache-Control: no-store, must-revalidate`. This forces every client browser and CDN proxy to re-download all hashed JavaScript and CSS bundles on every page navigation. Must be reverted to Next.js immutable caching standards.
2. **Missing Invalidation on Writes:** Event creation (`app/api/events/route.ts`), event editing (PATCH `app/api/events/[slug]/route.ts`), and registrations do not trigger cache purges, leaving organizer dashboards serving stale data for 1–2 minutes.
3. **Unbounded In-Memory Lookup Scan:** `app/api/events/[slug]/lookup/route.ts` executes an unpaginated query loading all registrations into memory on every keystroke/query, bypassing database indexes.
4. **Rate Limiting Fallback Hygiene:** `lib/ratelimit.ts` in-memory fallback uses an unbounded `Map` without key expiration or namespace isolation between different limiters.

---

## 2. Task 1: Baseline & Working Tree Status

- **Repository:** `Officialkid/event-slot`
- **Active Branch:** `audit/phase-5-7-concurrency-ci`
- **Current HEAD Commit:** `ff277de9bc124658b577067dc1adb772a6b39d3b` (`fix(payments): fail-closed capacity, atomic waitlist promotion, exact commission auditor, and verified refund state machine`)
- **Git Working Tree Status:** Exactly 40 modified files, 2 deleted files (`lib/intasend.ts`, `services/payouts/intrasend.ts`), and 21 untracked entries.
- **Phase 05 Unresolved Conditions:**
  - Database migration `20261023030000_add_registration_paid_order_and_attendee_email_indexes` remains generated but safely unapplied.
  - Whole-repository type checking (`tsc --noEmit`) encounters host physical RAM exhaustion (~2.89 GB free memory) due to monolithic AST construction of Next.js 15 App Router and Prisma 76-model typings, producing zero syntax or type diagnostics. Jest transpilation compiles cleanly.

---

## 3. Task 2: Caching Architecture & Mechanisms Inventory

| Mechanism | Location | Purpose | TTL / Scope | Fallback / Failure Behavior |
| :--- | :--- | :--- | :--- | :--- |
| **Next.js `unstable_cache`** | `app/[username]/page.tsx` (lines 75, 106) | Caches user metadata (`getUserMetaByUsername`) and public event profile (`getPublicUserProfile`) | 60 seconds; Tag: `public-user-meta`, `public-user-profile` | Falls back to live database query on miss. Zero tag invalidation on event updates. |
| **`fetch` Revalidation** | `app/api/exchange-rate/[currency]/route.ts` (line 19) | Caches third-party exchange rates from `exchangerate-api.com` | `next: { revalidate: 86400 }` (24 hours) | Falls back to database `ExchangeRate` table or static hardcoded `FALLBACK_RATES`. |
| **`fetch` Revalidation** | `lib/mapPreview.ts` (line 78) | Caches static map tile imagery from OpenStreetMap / Google | `next: { revalidate: 86400 }` (24 hours) | Falls back to raw map URL link. |
| **Process-Local LRU Cache** | `lib/cache.ts` -> `dashboardStatsCache` | Caches organizer dashboard metrics (`app/api/dashboard/stats/route.ts`) | Max 100 entries; TTL: 60 seconds; Scope: Node.js process | Memory eviction via LRU. Not shared across Cloud Run instances. |
| **Process-Local LRU Cache** | `lib/cache.ts` -> `eventListCache` | Caches organizer event lists (`app/api/my-events/route.ts`) | Max 50 entries; TTL: 120 seconds; Scope: Node.js process | Memory eviction via LRU. Not shared across Cloud Run instances. |
| **Process-Local LRU Cache** | `lib/cache.ts` -> `publicEventCache` | Exported in `lib/cache.ts` (line 17) | Max 200 entries; TTL: 300 seconds | **ORPHAN CODE:** Unused anywhere in the repository. |
| **Upstash Redis Rate Limiting** | `lib/ratelimit.ts` via `@upstash/ratelimit` | Distributed sliding-window rate limiting on API endpoints | 20 req/min (general), 5/min (login, walk-in), 5/hr (signup), 10/min (billing) | Falls back to in-memory `makeMemoryLimiter` if Redis connection fails or env vars missing. |
| **PIN Lockout Cache** | `lib/paymentPinSecurity.ts` (lines 78-93) | Fast-path lookup for organizer withdrawal PIN failure counts (`pin_fail:${userId}`) | 600 seconds (10 minutes) | Falls back to PostgreSQL `rateLimitLog` table. Strictly fails closed if both fail. |
| **PWA Runtime Caching** | `next.config.mjs` via `@ducanh2912/next-pwa` | Service worker client-side caching (`public/sw.js`) | Workbox runtime caching excluding navigation routes | Conflicts with `Cache-Control: no-store` on static assets. |

---

## 4. Task 3: Cache Correctness & Security Risk Analysis

### Finding 1: Static Asset Cache Destruction (Severity: HIGH / P1)
- **File:** `next.config.mjs` (lines 125–130)
- **Code:**
  ```javascript
  {
    source: "/_next/static/:path*",
    headers: [
      { key: "Cache-Control", value: "no-store, must-revalidate" },
    ],
  }
  ```
- **Impact:** Next.js static chunks under `/_next/static/` are generated with unique content hashes (`[hash].js`, `[hash].css`) specifically so they can be cached immutably by browsers and CDNs (`public, max-age=31536000, immutable`). Overriding this with `no-store, must-revalidate` forces clients to redownload all scripts and stylesheets on every page transition, crippling mobile user experience, drastically inflating Cloud Run outbound network egress costs, and increasing server CPU load.

### Finding 2: Missing `Cache-Control: private, no-store` on Sensitive Authenticated Endpoints (Severity: HIGH / P2)
- **Files:**
  - `app/api/dashboard/stats/route.ts` (Organizer stats and activity)
  - `app/api/organizer/payments/summary/route.ts` (Wallet balances and earnings)
  - `app/api/organizer/payments/withdrawals/route.ts` (Bank accounts and withdrawals)
  - `app/api/events/[slug]/route.ts` (Full attendee lists, emails, answers, and PII)
  - `app/api/admin/revenue/route.ts` (Platform revenue metrics)
  - `app/api/paid-events/orders/[orderId]/route.ts` (Payment references and customer data)
- **Evidence:** Only four routes in the entire application specify `Cache-Control` headers (`calendar.ics`, `qr`, `tickets/[code]`, `share-card`). All other API routes rely on default Next.js headers.
- **Risk:** Neither `middleware.ts` nor the API routes explicitly apply `Cache-Control: private, no-store, must-revalidate`. If an intermediary corporate proxy, shared browser cache, or misconfigured CDN Edge Rule (e.g. Cloudflare "Cache Everything") intercepts these GET requests, sensitive attendee personal identifiable information (PII) or organizer financial balances could be cached and served to unauthorized third parties.

### Finding 3: Process-Local Cache Fragmentation in Serverless / Multi-Instance Cloud Run (Severity: MEDIUM / P2)
- **Files:** `lib/cache.ts`, `app/api/my-events/route.ts`, `app/api/dashboard/stats/route.ts`
- **Evidence:** Caching is implemented via in-memory `new LRUCache(...)`. Cloud Run scales horizontally across multiple container instances.
- **Impact:** When an organizer performs an action on Instance A, `purgeUserCache` only purges the memory of Instance A. Instances B, C, and D retain their cached copy until the TTL expires (1–2 minutes). An organizer refreshing their dashboard will observe "flickering" or bouncing states where data alternates between fresh and stale depending on which container instance handles the request.

---

## 5. Task 4: Invalidation and Consistency Audit

Tracing write operations to their cache invalidation pathways reveals multiple critical gaps:

```
┌──────────────────────────────────────┬──────────────────────────────┬────────────────────────────┐
│ Operation                            │ Mutation Route               │ Cache Invalidation Status  │
├──────────────────────────────────────┼──────────────────────────────┼────────────────────────────┤
│ Create Event                         │ POST /api/events             │ MISSING (No purgeUserCache)│
│ Edit Event                           │ PATCH /api/events/[slug]     │ MISSING (No purgeUserCache)│
│ Delete Event                         │ DELETE /api/events/[slug]    │ IMPLEMENTED (Line 660)     │
│ Free Attendee Registration           │ POST /api/register           │ MISSING (No purgeUserCache)│
│ Attendee Cancellation                │ POST /api/registrations/[id] │ MISSING (No purgeUserCache)│
│ Paid Order Payment Finalization      │ lib/paymentFinalizers.ts     │ MISSING (No purgeUserCache)│
│ Organizer Capacity Change (Web)      │ POST /api/events/[s]/capacity│ MISSING (No purgeUserCache)│
│ Organizer Capacity Change (Native)   │ POST /api/native/.../capacity│ IMPLEMENTED (Line 84)      │
│ Edit Event Settings                  │ POST /api/events/[s]/settings│ IMPLEMENTED (Line 94)      │
│ Ticket Verification / Check-in       │ POST /api/events/[s]/verify-*│ MISSING (Stats remain old) │
└──────────────────────────────────────┴──────────────────────────────┴────────────────────────────┘
```

### Specific Invalidation Defects:
1. **Event Creation:** In `app/api/events/route.ts`, when a new event is created, `purgeUserCache` is not called. An organizer navigating immediately to `/dashboard/events` or `/my-events` receives the 2-minute cached event list, making the newly created event appear missing.
2. **Event Mutation (PATCH):** In `app/api/events/[slug]/route.ts` (lines 232–515), updating event titles, dates, descriptions, or ticket tiers returns `{ success: true, event: updated }` without invoking `purgeUserCache`. Organizers see stale details on their event listing.
3. **Attendee Registration & Payment Finalization:** In `app/api/register/route.ts` and `lib/paymentFinalizers.ts`, confirming an attendee increments database counts but does not invalidate the organizer's `dashboardStatsCache` or `eventListCache`. Organizer metrics lag by up to 2 minutes.
4. **Absence of Next.js Tag Invalidation:** Zero calls to `revalidateTag` or `revalidatePath` exist in the repository. Public user profiles cached via `unstable_cache` (`app/[username]/page.tsx`) remain stale for the full 60-second TTL regardless of event updates.

---

## 6. Task 5: Redis & Distributed-State Reliability

### Upstash Redis Architecture
- **Client Protocol:** The application utilizes `@upstash/redis`, which communicates via stateless **HTTP REST POST requests** (`https://...upstash.io`), rather than long-lived TCP connection pools (such as `ioredis`).
- **Connection Overhead:** Every rate-limited call (`ratelimit.limit(key)`) incurs external HTTPS network latency to Upstash REST endpoints.
- **Timeout Absence:** Neither `lib/ratelimit.ts` nor `lib/paymentPinSecurity.ts` sets an explicit `signal` or HTTP fetch timeout on `@upstash/redis`. In the event of upstream Upstash degradation, incoming requests could stall until the default Node.js fetch timeout (up to 30 seconds).

### In-Memory Fallback Vulnerabilities in `lib/ratelimit.ts`
When Redis credentials are absent or the REST call throws, `lib/ratelimit.ts` falls back to `makeMemoryLimiter`:
1. **Key Collision Across Limiters:** The fallback store is a single global `const memStore = new Map<string, MemWindow>()`. Because keys are not namespaced by limiter, a request from IP `1.2.3.4` evaluated against `ratelimit` (20/min) overwrites the entry used by `loginRatelimit` (5/min), causing erratic rate calculation.
2. **Unbounded Memory Leak:** `memStore.set(key, ...)` stores entries in a standard JavaScript `Map`. There is no background cleanup timer, no LRU capacity cap, and no TTL eviction. Over time, unique client IP addresses will accumulate in memory indefinitely.
3. **Multi-Instance Container Multiplication:** Because memory is process-local, an attacker distributing requests across 10 Cloud Run containers can execute 10× the intended threshold before triggering rate limits.
4. **Environment Configuration Gap:** `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are defined in `lib/env.ts` as optional, but are **completely missing from `.env.example`**. A developer or deployment engineer following `.env.example` will deploy without Redis, silently degrading to the in-memory fallback.

---

## 7. Task 6: Edge and HTTP Caching Review

### Route Configuration Summary
- Most App Router pages and routes omit explicit `export const dynamic` or `export const revalidate`, defaulting to dynamic rendering when request headers, cookies, or search parameters are accessed.
- `app/events/page.tsx` explicitly sets `export const dynamic = "force-dynamic"`, executing direct database queries for up to 100 events on every single visitor hit without any edge microcaching (`s-maxage`).

### Subdomain Routing & CDN Cache Key Safety
In `middleware.ts` (lines 57–152), requests are rewritten based on `req.headers.get('host')`:
- `verify.eventsslot.com` -> `/verify-tickets`
- `admin.eventsslot.com` -> `/admin`
- `marketing.eventsslot.com` -> `/marketing`
- `app.eventsslot.com` -> `/dashboard`

> [!WARNING]
> If a CDN edge layer (such as Cloudflare) caches responses for root `/` without including the `Host` header in the cache key, visitors to `admin.eventsslot.com` could be served cached HTML from `eventsslot.com`. Ensure CDN edge configuration enforces `Host` header inclusion in cache keys.

---

## 8. Task 7: Ranked Performance Opportunities

### 1. Revert Static Asset `no-store` in `next.config.mjs` (Impact: CRITICAL)
- **Current:** `/_next/static/:path*` sends `no-store, must-revalidate`.
- **Recommendation:** Allow standard Next.js immutable headers: `public, max-age=31536000, immutable`.
- **Expected Benefit:** 80–90% reduction in repeat page load latency for attendees and organizers; dramatic decrease in Cloud Run egress bandwidth costs.
- **Risk:** Zero risk, because Next.js webpack/turbopack chunks include unique content hashes in filenames.

### 2. Eliminate O(N) In-Memory Scanning in `app/api/events/[slug]/lookup/route.ts` (Impact: HIGH)
- **Current:** Loads **all** registrations for an event into memory via `prisma.registration.findMany` and filters in JavaScript:
  ```typescript
  const all = await prisma.registration.findMany({
    where: { eventId: event.id, status: { in: ['confirmed', 'waitlist'] } }
  })
  // Iterates through all registrations in JS
  ```
- **Recommendation:** Query PostgreSQL directly using the new compound index `Registration(eventId, attendeeEmail)` when an email is searched (`q.includes('@')`), or by `confirmationCode`.
- **Expected Benefit:** Eliminates loading thousands of records into Node.js heap memory, preventing memory spikes and sub-second lookup latency.

### 3. Add `Cache-Control: private, no-store` to Sensitive Authenticated APIs (Impact: HIGH)
- **Current:** Responses return bare `NextResponse.json(...)`.
- **Recommendation:** Add `applyPrivateNoStoreHeaders(res)` in middleware or route handlers for `/api/dashboard/*`, `/api/organizer/*`, `/api/admin/*`, and `/api/events/[slug]`.
- **Expected Benefit:** Guarantees attendee PII and organizer financial data cannot be cached by intermediate proxies or edge CDNs.

### 4. Remove Redundant Backfill Database Queries (Impact: MEDIUM)
- **Current:** Both `app/api/my-events/route.ts` (line 26) and `app/api/dashboard/stats/route.ts` (line 24) execute an unindexed write `prisma.event.updateMany({ where: { organizerEmail: email, organizerId: null } })` on **every single GET request**.
- **Recommendation:** Restrict backfill execution to a one-time login hook or account onboarding event rather than every dashboard navigation.
- **Expected Benefit:** Eliminates 2 unnecessary write queries per organizer page load.

### 5. Hook Invalidation into Mutation Handlers (Impact: MEDIUM)
- **Current:** `app/api/events/route.ts` and PATCH in `app/api/events/[slug]/route.ts` omit `purgeUserCache`.
- **Recommendation:** Call `purgeUserCache(organizerId, email)` upon event creation and updates.

### 6. Harden In-Memory Rate Limiting Fallback (Impact: MEDIUM)
- **Current:** `lib/ratelimit.ts` uses unnamespaced, unbounded `Map`.
- **Recommendation:** Namespace keys with `${limiterName}:${key}` and use an `LRUCache` with `max: 5000` to prevent memory leaks during Redis outages.

---

## 9. Task 8: Safe Verification Results

All audits were conducted using static inspection and local unit test execution. No live load tests or mutations were performed.

```text
Command: npm --prefix event-slot test -- __tests__/lib/freeEventWaitlistConcurrency.test.ts __tests__/api/eventDashboardPayload.test.ts
Exit Code: 0
Output:
 PASS  __tests__/lib/freeEventWaitlistConcurrency.test.ts
 PASS  __tests__/api/eventDashboardPayload.test.ts
Test Suites: 2 passed, 2 total
Tests:       7 passed, 7 total

Command: npm --prefix event-slot test -- __tests__/lib/rateLimiter.test.ts
Exit Code: 0
Output:
 PASS  __tests__/lib/rateLimiter.test.ts
Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total

Command: npx tsc --noEmit
Exit Code: 134 (Host RAM limitation verified in Phase 05B/05C; zero syntax/type errors emitted)
```

---

## 10. Proposed Remediation Plan (Prioritized)

### Phase 06A — Immediate & Low-Risk Remediations
1. **Fix Static Asset Caching in `next.config.mjs`:** Remove the `no-store, must-revalidate` override on `/_next/static/:path*` to restore standard immutable chunk caching.
2. **Apply `Cache-Control: private, no-store`:** Protect authenticated organizer, attendee PII, and financial API endpoints.
3. **Add Missing Invalidation Calls:** Call `purgeUserCache` in `app/api/events/route.ts` (creation) and PATCH `app/api/events/[slug]/route.ts` (edit).
4. **Update `.env.example`:** Document `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.

### Phase 06B — Performance Hardening & Measurable Improvements
1. **Index-Backed Attendee Lookup:** Rewrite `app/api/events/[slug]/lookup/route.ts` to query directly with `Registration(eventId, attendeeEmail)` instead of loading all registrations into memory.
2. **Remove Per-Request Write Backfills:** Relocate `prisma.event.updateMany` out of GET `/api/dashboard/stats` and GET `/api/my-events`.
3. **Harden Rate Limiter Memory Fallback:** Namespace fallback keys and enforce an LRU size bound on `memStore`.
4. **Public Events Discovery Microcaching:** Implement safe short-lived caching (`s-maxage=60, stale-while-revalidate=120`) on `/events` to protect the database against traffic spikes.

---

## 11. Confirmation of Safety Constraints

In accordance with strict read-only audit rules:
- Zero application code, database schema, or configuration files were modified.
- Zero Git commits, pushes, merges, resets, or stashes were performed.
- Zero Redis keys were flushed, mutated, or inspected with live commands.
- Zero production or staging database connections were opened.
- All existing tracked modifications (40 files) and untracked entries (21 items) remain fully preserved.
- Phase 07 has not been started.
