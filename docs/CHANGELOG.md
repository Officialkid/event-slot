# EventSlot — Changelog

## [0.4.3] — April 18, 2026

### Feature: Confirm My Attendance (Public Self-Lookup)

- **New component: `components/attendance/ConfirmAttendance.tsx`** — Client-side "Already Registered?" panel embedded on the public event page. Accepts an email address, queries the attendance lookup API, and displays one of: confirmed ticket (inline `ConfirmationTicket` card with PDF download), waitlist status message, or not-found message. No login required.
- **New API: `POST /api/attendance/confirm`** — Looks up a registration by email + eventId. Returns ticket data for confirmed registrations, waitlist position message, or not-found. Rate-limited to 5 lookups per IP per 10 minutes via Upstash Redis.
- **Updated: `app/[username]/page.tsx`** — Public event page now renders a two-column grid on large screens (registration form + "Already Registered?" panel side-by-side). Single-column on mobile.
- **Updated: `lib/ratelimit.ts`** — Added `attendanceLookupRatelimit` (5 per 10 min sliding window).


## [0.4.2] — April 18, 2026

### Feature: Confirmation Ticket Card with QR Code & PDF Download

- **Schema:** Added `confirmationCode String? @unique` to Registration model
- **New: `lib/confirmationCode.ts`** — Generates unique `EVT-XXXXXXXX` confirmation codes
- **New: `components/tickets/ConfirmationTicket.tsx`** — Client component displaying attendee ticket with QR code (via `qrcode`) and PDF download (via `html2canvas` + `jspdf`)
- **New: `app/register/success/[confirmationCode]/page.tsx`** — Post-registration success page showing the ticket; no login required
- **New: `app/verify/[confirmationCode]/page.tsx`** — QR scan check-in verification page showing green ✓ (valid) or red ✗ (invalid)
- **Updated: `app/api/register/route.ts`** — Generates and stores confirmation code on confirmed registration
- **Updated: `app/api/events/[slug]/capacity/route.ts`** — Generates confirmation codes when waitlisted attendees are promoted
- **Updated: `app/api/events/[slug]/manual-register/route.ts`** — Generates confirmation code for manually added confirmed registrants
- **Updated: `lib/email.ts`** — `sendSlotConfirmedEmail` now includes optional ticket URL button
- **Updated: `app/(attendee)/[username]/RegistrationForm.tsx`** — Shows "View & Download Ticket →" link on successful confirmed registration


## [0.4.1] — April 15, 2026

### UI/UX Fixes & Accuracy Pass

- **Navbar active state** — Added `id="how-it-works"` to the Feature Highlights section and `id="get-started"` to the CTA band section so the IntersectionObserver in Nav correctly highlights Features and Get Started links when those sections are in view
- **Pricing page — Business plan price corrected** — Monthly: $100 (was incorrectly showing $19); Annual: $80/month billed $960/year, saving $240/year (not $48)
- **Pricing page — Pro team members corrected** — Updated from "2 team members" to "10 team members" in feature list
- **Pricing page — Business team members corrected** — Updated from "5 team members" to "20 team members" in feature list
- **Pricing page — Business feature list updated** — Added AI event reports, AI insight cards, Natural language Q&A, Event Insights Tracker; removed inaccurate "Custom domain" entry
- **Pricing page — Pro feature list updated** — Added "AI insight cards" (included in Pro); corrected registrations label to "500 included (pay-as-you-go beyond)"
- **Pricing page — Comparison table corrected** — Team members (Free: 1, Pro: 10, Business: 20); Registrations (Free: 100 included, Pro: 500 included, Business: Unlimited); Analytics & AI section expanded with AI insight cards, AI reports, Q&A, Insights Tracker, demographics, feedback; Bulk registration (Free: Up to 3)
- **Pricing page — `id="ai-features"` anchor added** — "See all AI features →" link on homepage now scrolls to the credits/AI section on /pricing
- **Home page — "See all AI features" link** — Changed from `/pricing` to `/pricing#ai-features`
- **Home page — Trust stat updated** — "Loved by organizers in 5+ countries" changed to "Used across Kenya, Nigeria, Uganda & beyond"
- **Home page — Smart CTAs** — Hero "Start for free", Feature 1 CTA, and CTA band buttons now use `SmartCTA` component: signed-in users are sent to `/dashboard`, others to `/signup`
- **Home page — Pro plan preview updated** — Added "AI insight cards" to Pro plan feature list; "Up to 500 registrations" → "500 registrations included"
- **Signup page** — Already-signed-in users are immediately redirected to `/dashboard` instead of being shown the signup form
- **Signin page** — Already-signed-in users are immediately redirected to `/dashboard`
- **New component: `components/SmartCTA.tsx`** — Session-aware CTA link component



### Documentation & System Updates
- **Documentation System** — Updated all docs files post-build completion
- **`docs/FEATURES.md`** — Updated credit costs and plan access logic to reflect v0.3.7 changes
- **`docs/AI_CONTEXT.md`** — Verified feature matrix table with current credit pricing
- **`docs/SYSTEM.md`** — Updated version to 0.4.0; refreshed plan tiers section
- **`docs/KNOWN_ISSUES.md`** — Marked KI-001, KI-002, KI-003, KI-005 as ✅ Resolved
- **Landing Page** — Integrated hero background and dashboard mockup images from `/public/assets/`
- **Visual Assets** — Added dashboard-laptop.jpg, hero-bg.png, event-checkin.jpg, organizer-mobile.jpg to enhance landing page UX

## [Unreleased]

## [0.3.7] — April 14, 2026

### Credit Cost Restructure
- **`lib/credits.ts`** — Replaced `CREDIT_COSTS` object entirely with new keys and values:
  - `ai_report`: 150 → 50 credits
  - `ai_insights`: 2 → 20 credits
  - `ai_query` (renamed `ask_your_data`): 1 → 60 credits per query
  - `word_report` (renamed `standard_report`): 100 → 0 (now free)
  - `analytics_unlock` (renamed `event_analytics`): 150 → 10 credits
  - `export_csv`: 15 (unchanged)
  - `remove_watermark`: 10 (unchanged)
  - `custom_thank_you`: 20 → 10 credits
  - New: `duplicate_event` (5), `team_members` (10), `insight_tracker` (50), `feedback_forms` (30), `predictive_capacity` (25)
  - Updated `hasFeatureAccess` plan check: `ai_query` → `ask_your_data`
- **`lib/plans.ts`** — Updated `PAYG_PRICING` to match: `wordReportBase` 100 → 0, `analyticsUnlock` 150 → 10, `customThankYou` 20 → 10
- **`app/api/events/[slug]/ask/route.ts`** — Updated `CREDIT_COSTS.ai_query` → `CREDIT_COSTS.ask_your_data` (2 references)
- **`app/(organizer)/dashboard/page.tsx`** — FEATURES array: AI event report cost 150 → 50, AI insight cards cost 2 → 20; hardcoded `creditBalance >= 150` → `>= 50`; featureModal `credits: 150` → 50; badge `>150 cr` → `>50 cr`
- **`app/pricing/page.tsx`** — Credits table fully rewritten: 5 old rows → 13 rows with new costs including all new features; "points" → "credits" terminology; standard report shown as Free
- **`docs/FEATURES.md`** — Updated AI feature tier descriptions with new credit costs; feature access matrix already reflected new values
- **`docs/AI_CONTEXT.md`** — Credits section rewritten with itemised costs for all 13 credit-purchasable features



### Security Fixes — KI-001 / KI-002 / KI-003 / KI-005
- **KI-001** — Added `signupRatelimit` (5 req / 1 h per IP, sliding window) via Upstash Redis to `POST /api/auth/signup`; prevents email bombing and Resend quota exhaustion
- **KI-002** — Rewrote `/api/billing/unlock` to execute the idempotency check, balance check, credit deduction, `EventUnlock` create, and `CreditTransaction` create inside a single `prisma.$transaction`; eliminates double-spend race condition; added per-user rate limit (10 req / 1 min)
- **KI-003** — Created `lib/validateEnv.ts` with `validateR2Env()` helper; `POST /api/upload` now calls it before authentication and returns a clean `503 Service Unavailable` when R2 environment variables are missing instead of an unhandled 500
- **KI-005** — Added `const BASE_URL = process.env.NEXTAUTH_URL ?? 'https://www.eventsslot.com'` in `lib/email.ts`; all 4 email template URL references now use `BASE_URL` so password-reset and team-invite links never contain `undefined/...`

## [0.3.5] — April 13, 2026

### Documentation System — Full E2E Audit & Live Docs
- Created `/docs/API.md` — complete API reference for all 60+ endpoints (auth, events, registration, billing, team, admin, cron)
- Created `/docs/KNOWN_ISSUES.md` — honest codebase audit of 18 tracked issues (3 critical, 7 important, 8 minor); verified working list of 46 confirmed features
- Created `/docs/AI_CONTEXT.md` — AI chatbot training knowledge base covering all features, plans, FAQs, feature matrix
- Created `/docs/TEST_RESULTS.md` — E2E test results from static codebase audit; 38 code-verified PASS, 4 FAIL flagged, 24 requiring live browser test
- Updated `/docs/SYSTEM.md` — full rewrite with live URLs, complete tech stack table, all user roles, accurate plan pricing (KSH), complete DB model table (17 models), all env vars including R2
- Updated `/docs/FEATURES.md` — full rewrite replacing old table-based format with structured feature entries; accurate credit costs from lib/credits.ts; complete feature access matrix
- Issues found during audit: KI-001 (signup rate limiting missing), KI-002 (unlock race condition), KI-003 (R2 env validation), KI-005 (NEXTAUTH_URL null check in emails)

## [0.3.4] — April 9, 2026

### CSV Export with Pay-as-you-go Unlock
- `GET /api/events/[slug]/export` — new route; validates session owner or dashboard token; returns UTF-8 BOM CSV of all confirmed registrations with dynamic question headers + Status + Registered At columns; values containing commas/quotes/newlines are properly escaped; if organizer is on Free plan without a `csv` EventUnlock, returns 402 with `{ cost, eventId, upgradeRequired: true }` so the client can present the purchase flow
- `calculateCSVCost` from `lib/plans.ts` used to compute cost: `csvExportBase ($2) + ceil(confirmedCount / 100) × $1`
- `app/(organizer)/dashboard/events/[slug]/page.tsx` — Overview tab now includes an **Export Registrations** panel:
  - On Pro/Business (or after unlock): "Export CSV" button downloads the file directly via `<a>` blob trick
  - On Free without unlock: shows cost preview "Export this data for $X.XX credits" with **Buy & Export** and Cancel buttons
  - **Buy & Export** POSTs to `POST /api/billing/unlock` with `{ eventId, feature: "csv" }`; on `insufficientCredits` (402) redirects to `/dashboard/billing`; on success re-triggers export
  - Button disabled when there are 0 confirmed registrations
  - State variables added: `csvExporting`, `csvCost`, `csvEventId`, `csvUnlockLoading`, `csvError`

## [0.3.3] — April 9, 2026

### Auth — Welcome Email, Forgot Password, Reset Password
- `lib/email.ts` — added `sendWelcomeEmail` and `sendPasswordResetEmail` functions (dark-themed HTML, lime CTA, EventSlot brand)
- `POST /api/auth/signup` — now fires `sendWelcomeEmail` after account creation (fire-and-forget, does not block response)
- `prisma/schema.prisma` — added `resetToken String?` and `resetTokenExpiry DateTime?` to User model; pushed via `prisma db push`
- `POST /api/auth/forgot-password` — finds user by email, generates a UUID raw token, hashes it (SHA-256) and stores the hash + 1-hour expiry; sends reset email with raw token; always returns 200 even if email is not registered (enum security)
- `POST /api/auth/reset-password` — hashes incoming token, finds user where hash matches and expiry is in the future; updates password (bcrypt 12 rounds), clears token fields; returns 400 with message if link invalid or expired
- `app/(auth)/forgot-password/page.tsx` — new page: card, back link, Instrument Serif heading, email input, "Send reset link" button; always shows same success message after submit regardless of outcome
- `app/(auth)/reset-password/page.tsx` — new page: reads `?token` from search params; new password + confirm fields; client-side match/length validation; on success redirects to `/signin?reset=success`
- `app/(auth)/signin/page.tsx` — added "Forgot password?" ghost link below password input; added lime banner shown when `?reset=success` is in the URL; page now wrapped in `Suspense` for `useSearchParams`

## [0.3.2] — April 9, 2026

### Intelligent Capacity Suggestions
- Added `GET /api/events/suggest-capacity` — analyses the organizer’s last 5 completed events (deadline passed, capacity set) and returns a suggested capacity with an average fill rate, event count, and human-readable message
- Suggestion logic: average confirmed count × 1.2 buffer; message adapts based on fill rate (≥85%, 50–84%, <50%); includes fastest fill time if any event fully filled
- Returns `{ suggestion: null }` if organizer has fewer than 3 qualifying events
- `app/(organizer)/create/page.tsx` — capacity input now fetches the suggestion on first focus; if a suggestion exists and the field is empty, a lime card appears below with a lightbulb icon, the API message, and a “Use this suggestion” ghost button that fills the field

## [0.3.1] — April 9, 2026

### Event Creation Templates
- Added `lib/eventTemplates.ts` — 6 templates: Community Meetup, Corporate Training, Workshop, Conference, Church/Faith Event, Start from scratch, each with pre-built question sets
- `app/(organizer)/create/page.tsx` — two-step flow: template picker shown first (before form); selecting a template pre-fills questions and smooth-scrolls to the form
- Template picker: Instrument Serif heading "Start with a template", auto-fill grid (minmax 172px), cards with icon / name / description, lime border + bg on selected, lime hover on unselected
- Template banner inside Registration Questions card shows icon + "Using [Template Name] template. You can edit the questions below." (hidden for blank/scratch)
- Templates remain visible after selection so organizer can switch templates mid-form

## [0.3.0] — April 9, 2026

### Organizer Public Profiles
- Added `username String? @unique` to User model in Prisma schema; applied via `prisma db push`
- Added `username` to the NextAuth `session` callback (fetched from DB on every session) and to `types/next-auth.d.ts`
- New route `GET /api/users/check-username` — availability check with validation (3–20 chars, alphanumeric + hyphens, reserved words list)
- New route `PATCH /api/users/username` — authenticated endpoint to set/update username
- New page `/setup-username` (`app/(auth)/setup-username/page.tsx`) — centered card with inline "eventslot.co/" prefix input, debounced availability check (400ms), lime green/red availability feedback, "Set username" button → redirects to `/dashboard`
- `app/(organizer)/dashboard/layout.tsx` now redirects to `/setup-username` if `!session.user.username`
- New page `/[username]` (`app/[username]/page.tsx`) — server component public profile with: initials circle, upcoming active events grid (2-col `auto-fill`), slot-fill bar, "Register →" CTA, disabled "Follow" button (Coming soon), `generateMetadata` for SEO; reserved usernames return `notFound()`
- `components/Nav.tsx` — added "My public profile" link above "Sign out" in dropdown (only shown when `session.user.username` exists)

## [0.2.4] — April 9, 2026

### Build Fix
- Rewrote `types/paystack-node.d.ts` to declare `PaystackResource` interface with `[method: string]: (...args: any[]) => Promise<any>` and typed `transaction`, `subscription`, `customer`, `plan` etc. as `PaystackResource` — resolves `'paystack.transaction' is of type 'unknown'` build error
- Ran `prisma generate` locally to clear stale Prisma client (VS Code TypeScript errors for `paystackSubscriptionCode`, `creditBalance`, `creditTransaction`, `eventUnlock` were all stale — fields/models already existed in schema)

## [0.2.3] — April 9, 2026

### Build Fix
- Added `types/paystack-node.d.ts` — local type declaration shim for `paystack-node` which ships no TypeScript types, resolving `Could not find a declaration file for module 'paystack-node'` build error

## [0.2.2] — April 9, 2026

### Build Fix
- Replaced `require('paystack-node')` with `import Paystack from 'paystack-node'` in `lib/paystack.ts` — ESLint rule `@typescript-eslint/no-require-imports` was blocking the Vercel build

## [0.2.1] — April 9, 2026

### Build Fix
- Deleted stale `lib/stripe.ts` from git tracking — it was causing a Vercel build failure (`Type '"2024-06-20"' is not assignable to type '"2026-03-25.dahlia"'`) after the Stripe → Paystack migration
- Committed and pushed all prior session work that had not been pushed to GitHub (27 files, 2210 insertions): Paystack billing routes, credits system, billing page rewrite, `lib/credits.ts`, `lib/paystack.ts`, updated plan limits, Prisma schema, and `/docs`

## [0.2.0] — April 9, 2026

### Paystack Billing & Credits System
- Migrated payment provider from Stripe to Paystack
- Replaced `lib/stripe.ts` with Paystack integration via `paystack-node`
- Rewrote `lib/plans.ts` with `PLAN_LIMITS` and `PAYG_PRICING` constants
- Created `lib/credits.ts` for credit deduction, balance checking, and unlock queries
- Added `CreditTransaction` model to Prisma schema (tracks all credit activity with balance)
- Added `EventUnlock` model to Prisma schema (tracks per-event PAYG feature unlocks)
- Updated `User` model with `creditBalance`, `paystackCustomerCode`, `paystackSubscriptionCode`

### New API Routes
- `POST /api/billing/checkout` — Initiate Paystack subscription checkout (accepts plan name + billing cycle)
- `POST /api/billing/credits` — Initiate credit top-up via Paystack one-time payment
- `POST /api/billing/unlock` — Unlock a per-event PAYG feature using credits
- `POST /api/billing/cancel` — Cancel active Paystack subscription
- `GET /api/billing/status` — Return billing status (plan, cycle, end date, credit balance)
- `GET /api/billing/invoices` — Fetch invoices from Paystack
- `GET /api/billing/transactions` — Return last 20 credit transactions with running balance
- `POST /api/billing/portal` — Get Paystack billing portal URL
- `POST /api/billing/webhook` — Handle Paystack subscription and payment webhook events

### Billing Page Rewrite
- Rewrote `/app/(organizer)/dashboard/billing/page.tsx` (replaced Stripe-based UI)
- Current plan card with badge, billing cycle, renewal date, cancel subscription button
- Success banner (from `?success=true&plan=`) and credits-added banner (`?credits=added`) with 5s auto-dismiss
- Credits section: live balance, three buy-credit buttons ($10/$45/$80), collapsible PAYG pricing table
- Upgrade section: monthly/annual toggle, Pro and Business plan cards (hidden for Business users)
- Credit history table: last 20 transactions with date, description, amount (color-coded), running balance

### Dashboard UI
- Added `PlanBadge` component to dashboard sidebar
- Added colored plan indicator dot to mobile bottom navigation bar
- Updated `GET /api/me` to return `creditBalance` in user profile response

### Revised Plan Limits
- Free: 1 active event, 100 free registrations, 30-day data retention, 1 team member
- Pro: $19/mo or $15/mo annual, unlimited events, 500 free registrations, 10 team members
- Business: $49/mo or $39/mo annual, unlimited everything, 20 team members, no PAYG costs

---

## [0.1.0] — March 2026

### Initial V1 Build
- Event creation with title, description, capacity, deadline, and custom questions
- Shareable attendee registration form (`/[eventSlug]`)
- Automatic waitlist when event reaches capacity
- Waitlist promotion and notification when capacity increases
- Organizer dashboard with event management
- Registration number generation per event
- Event archiving and status management
- Auth: Google OAuth and email/password via NextAuth.js
- Email: Resend integration for slot confirmation and team invites
- Team members: invite co-organizers by email
- Attendee feedback forms (Business plan)
- Event analytics and insights tracker
- Admin panel (super admin only)
- Data expiry cron for Free-plan events (30-day retention)
- Feedback request cron for Business-plan events
- Rate limiting via Upstash Redis
- OG image generation for event pages
- Duplicate registration detection
- R2 image upload for event covers and profile photos
- Vercel deployment with `vercel.json` configuration
