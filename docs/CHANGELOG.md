# EventSlot — Changelog

## [Unreleased]

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
