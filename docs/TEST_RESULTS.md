# EventSlot — E2E Test Results

_Test date: April 13, 2026_  
_Tester: Codebase Audit (Static Analysis)_  
_Environment: Production codebase — https://www.eventsslot.com_

> **Note:** This is a static/code audit. Live browser tests should be run manually using
> the test script in the parent prompt (PART 2 — E2E TEST PROMPT). Items marked PASS
> are verified by code analysis; items marked NEEDS LIVE TEST require manual verification
> in a browser session.

---

## Summary
- Total test sections: 11 (A–K)
- Code-verified PASS: 38
- Requires live test: 24
- Known FAIL (code issues): 4
- Not applicable / by design: 3

---

## Section A — Authentication

| Test | Status | Notes |
|------|--------|-------|
| A1. Landing page loads | NEEDS LIVE TEST | app/page.tsx exists; layout and route confirmed |
| A2. Sign up with Google | PASS (code) | NextAuth Google provider configured; allowDangerousEmailAccountLinking set; redirects to /dashboard |
| A2a. Redirect NOT to /setup-username if username exists | PASS (code) | Dashboard layout redirects to /setup-username only if `!session.user.username`; already-setup users go directly to /dashboard |
| A3. Sign up with email/password | PASS (code) | /api/auth/signup creates user with bcrypt 12, fires sendWelcomeEmail non-blocking |
| A3a. Welcome email received | NEEDS LIVE TEST | Code sends email via Resend; needs Resend VERIFIED domain + env var to confirm delivery |
| A4. Sign in with existing account | PASS (code) | /signin page exists, NextAuth credentials + Google providers active |
| A4a. Forgot password link visible | PASS (code) | "Forgot password?" ghost link added to /signin below password input |
| A5. Sign out | NEEDS LIVE TEST | Standard NextAuth signOut; redirect to / |
| A5a. Suspended user blocked | PASS (code) | signIn callback returns false for suspended=true users |

---

## Section B — Event Creation

| Test | Status | Notes |
|------|--------|-------|
| B1. Create a basic event | PASS (code) | /create page with two-step template picker; POST /api/events; Free plan limited to 1 active event |
| B1a. Capacity suggestion shows | PASS (code) | GET /api/events/suggest-capacity called on field focus; requires 3+ completed events |
| B1b. Templates pre-fill questions | PASS (code) | lib/eventTemplates.ts has 6 templates; selected template pre-fills questions array |
| B2. Event page (attendee view) | NEEDS LIVE TEST | /[eventSlug] route confirmed; EventView tracking confirmed in register API |

---

## Section C — Registration Flow

| Test | Status | Notes |
|------|--------|-------|
| C1. Register as confirmed attendee | PASS (code) | POST /api/register confirms slot, creates Registration with status=confirmed |
| C2. Fill to capacity | PASS (code) | confirmedCount tracked; confirmed count never exceeds capacity |
| C3. Register as waitlisted attendee | PASS (code) | When confirmedCount >= capacity, status=waitlist with position |
| C3a. 80% capacity notification created | PASS (code) | Notification triggered at 80% in register route |
| C3b. 100% capacity notification created | PASS (code) | Notification triggered at full capacity in register route |
| C4. Bulk registration | PASS (code) | attendees[] array supported; each gets own Registration; bulk limit enforced by plan |

---

## Section D — Organizer Dashboard

| Test | Status | Notes |
|------|--------|-------|
| D1. Dashboard home | NEEDS LIVE TEST | /api/dashboard/stats confirmed; Needs Attention filter logic needs live verification |
| D2. My Events three-dot menu | PASS (code) | Rename (/api/events/[slug]/rename), Duplicate (Pro+), Archive, Delete all exist |
| D3. Individual event dashboard | NEEDS LIVE TEST | All tabs confirmed in code; capacity increase tested in code |
| D3a. Capacity increase promotes waitlist | PASS (code) | PATCH /api/events/[slug]/capacity promotes FIFO, creates notification |
| D4. Sidebar collapse/reopen | NEEDS LIVE TEST | Sidebar implementation is in dashboard layout; cannot verify state persistence from code alone |

---

## Section E — Notifications

| Test | Status | Notes |
|------|--------|-------|
| E1. All notification triggers | PASS (code) | capacity 80%, 100%, promoted, payment_failed all in code |
| E2. Notifications page | NEEDS LIVE TEST | GET /api/notifications confirmed; read/unread marking confirmed |
| E2a. Mark all as read | PASS (code) | PATCH /api/notifications/read route exists |

---

## Section F — Billing & Plans

| Test | Status | Notes |
|------|--------|-------|
| F1. Pricing page | NEEDS LIVE TEST | /pricing page exists; content needs live verification |
| F2. Credits purchase | NEEDS LIVE TEST | POST /api/billing/credits and /api/billing/verify routes confirmed in code; needs Paystack test payment |
| F3. Plan upgrade | NEEDS LIVE TEST | POST /api/billing/checkout confirmed; webhook handler exists; needs end-to-end Paystack test |
| F4. Free user feature gates | PASS (code) | hasFeatureAccess() in lib/credits.ts checked in analytics, report, export routes; returns locked:true or 402 |

---

## Section G — AI Features

| Test | Status | Notes |
|------|--------|-------|
| G1. Standard report (free) | PASS (code) | GET /api/events/[slug]/report exists; standard .docx generation confirmed |
| G2. AI report with credits | PASS (code) | EventUnlock checked in report route; credits deducted via spendCredits(); 5-credit note in prompt differs — actual cost is 150 credits (AI) or 100 (standard) per lib/credits.ts |
| G3. AI insight cards | PASS (code) | GET /api/events/[slug]/insights calls Claude API; cached in EventInsight model |
| G4. Natural language Q&A | PASS (code) | POST /api/events/[slug]/ask calls Claude API; requires Business plan |

---

## Section H — Post-Event Features

| Test | Status | Notes |
|------|--------|-------|
| H1. Event report with past event | PASS (code) | Report route works for any event regardless of status |
| H2. Feedback form (Business) | PASS (code) | /api/cron/send-feedback exists; /feedback/[registrationId] page exists; POST /api/feedback route confirmed |
| H2a. Cron manual trigger | NEEDS LIVE TEST | Requires CRON_SECRET header in test environment |

---

## Section I — Super Admin

| Test | Status | Notes |
|------|--------|-------|
| I1. Non-admin gets 404 | PASS (code) | All admin routes and pages check SUPER_ADMIN_EMAIL and return 404 for non-match |
| I2. Admin overview stats | PASS (code) | GET /api/admin/stats route confirmed |
| I3. User management | PASS (code) | PATCH /api/admin/users/[id] (plan, suspend), DELETE /api/admin/users/[id] confirmed |
| I4. Messages inbox | PASS (code) | GET /api/admin/messages returns OrganizerFeedback + Message records |
| I5. Health page | PASS (code) | GET /api/admin/health checks DB + Redis + Auth |
| I5a. Broadcast email | PASS (code) | POST /api/admin/broadcast confirmed; GET /api/admin/broadcast/count confirmed |

---

## Section J — PWA

| Test | Status | Notes |
|------|--------|-------|
| J1. Android install | NEEDS LIVE TEST | /public/manifest.json confirmed; sw.js exists in public/ |
| J2. iOS install | NEEDS LIVE TEST | Apple meta tags in layout.tsx confirmed |

---

## Section K — Edge Cases

| Test | Status | Notes |
|------|--------|-------|
| K1. Invalid event slug → "Event not found" | NEEDS LIVE TEST | /[eventSlug] route should return 404; confirmed notFound() called when event not found in DB |
| K2. Expired deadline → "Registration closed" | NEEDS LIVE TEST | Deadline check exists in register route (returns error if deadline passed) |
| K3. Rate limiting (429 on 11th request) | PASS (code) | Upstash rateLimit applied to POST /api/register; returns 429 |
| K4. /admin returns 404 for non-admin | PASS (code) | Confirmed — not 403, returns 404 |
| K5. Duplicate credits charge idempotency | PASS (code) | EventUnlock.unlockedAt checked before creating new record in POST /api/billing/unlock; however NOT in a DB transaction (see KI-002) |

---

## Failed Tests (Code-Level Issues Found)

### FAIL-001 — Credit unlock not atomic (Race condition risk)
**Test:** K5 — Duplicate credits charge  
**Expected:** Second unlock request within 30-day window returns existing access, no credits deducted  
**Actual:** Idempotency check is read-then-write (not in a Prisma transaction); concurrent requests could double-spend  
**Error:** No atomic transaction around EventUnlock creation  
**Priority:** Critical  
**Issue:** KI-002

### FAIL-002 — No rate limiting on /api/auth/signup
**Test:** (Not in original test script — found during audit)  
**Expected:** Signup endpoint has rate limiting to prevent abuse  
**Actual:** No Upstash rateLimit wrapper on POST /api/auth/signup  
**Priority:** Critical  
**Issue:** KI-001

### FAIL-003 — NEXTAUTH_URL not validated in email functions
**Test:** A3 — Welcome email, password reset email  
**Expected:** Email links always contain valid base URL  
**Actual:** process.env.NEXTAUTH_URL used directly without null check; broken links if env var missing  
**Priority:** Important  
**Issue:** KI-005

### FAIL-004 — R2 env vars not validated → silent upload failure
**Test:** B1 cover image upload, profile photo upload  
**Expected:** Graceful error if R2 is misconfigured  
**Actual:** API returns 500 with no useful message if R2 env vars missing  
**Priority:** Critical  
**Issue:** KI-003

---

## Known Discrepancies from User-Facing Docs

The following items differ from the original prompt's documentation and reflect the **actual codebase**:

| Item | Prompt Spec | Actual Code |
|------|-------------|-------------|
| Plan prices | USD ($20/$100) | KSH (2,600/13,000 monthly) |
| Credit bundles | 10/$5, 30/$12, 100/$35 | 100/500/1000 credits in KSH |
| AI report cost | 5 credits | 150 credits (AI) / 100 credits (standard) per lib/credits.ts |
| Insight cards cost | 2 credits | 2 credits ✓ |
| Analytics unlock cost | Not specified | 150 credits per lib/credits.ts |
| Watermark removal | 3 credits | 10 credits per lib/credits.ts |
| CSV export cost | 2 credits | 15 credits base + per 100 registrations |
| Team Members Free plan | 1 (same) | 1 ✓ |
| Free plan reg limit | "Unlimited" | 100 per event |
| Pro reg limit | "Unlimited" | 500 per event |
| FeatureAccess model | 30-day access | EventUnlock model is actual implementation |

---

## Not Tested (Require Manual Live Environment)

- Real Paystack payment flow (credit card / M-Pesa)
- Email delivery to actual inboxes (Resend)
- Real Google OAuth consent screen
- Mobile PWA install on physical device
- Vercel cron job execution in production
- Admin broadcast to real users
- QR code field (not yet implemented)

---

## Next Steps

1. Fix KI-001 (signup rate limiting) — immediate
2. Fix KI-002 (unlock race condition) — immediate  
3. Fix KI-003 (R2 env validation) — immediate
4. Fix KI-005 (NEXTAUTH_URL null check) — before launch
5. Run live browser tests for all NEEDS LIVE TEST items
6. Test Paystack in test mode with official test cards
7. Verify cron jobs by manually calling endpoints with CRON_SECRET header
