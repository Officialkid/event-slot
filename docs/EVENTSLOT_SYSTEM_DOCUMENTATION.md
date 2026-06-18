# EventSlot — Live System Documentation
**Version:** Auto-stamped on deploy
**Last Updated:** 2026-06-18T01:05:35Z â€” Commit: ae39a00 â€” Revision: eventslot-web-00121-kbv
**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS · Neon PostgreSQL · Prisma ORM · NextAuth · Paystack · Google Cloud Run · GitHub Actions
**Owner:** EventSlot
**Primary Market:** Kenya

> **Living Document Policy:** This file is the single source of truth for EventSlot. Product behavior, schema changes, API changes, pricing adjustments, and infrastructure changes should be reflected here first. Supporting docs in `docs/` may summarize or deep-link into this file, but they should not compete with it.

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Architecture](#2-architecture)
3. [Design System](#3-design-system)
4. [Feature Inventory](#4-feature-inventory)
5. [Database Schema](#5-database-schema)
6. [API Reference](#6-api-reference)
7. [Pricing & Tier Logic](#7-pricing--tier-logic)
8. [Authentication & Authorization](#8-authentication--authorization)
9. [Infrastructure & Deployment](#9-infrastructure--deployment)
10. [Compliance — Kenya Data Protection Context](#10-compliance--kenya-data-protection-context)
11. [GitHub Actions Auto-Update Hook](#11-github-actions-auto-update-hook)
12. [AI Prompt — Future Feature Documentation](#12-ai-prompt--future-feature-documentation)
13. [Decision Log](#13-decision-log)
14. [Known Limitations & Deferred Features](#14-known-limitations--deferred-features)
15. [Changelog](#15-changelog)

---

## 1. Product Overview

**EventSlot** is an event registration and waitlist platform designed for organizers running slot-limited events, with Kenya as the primary launch market and KES as the billing currency.

### Core Value Proposition
- Organizers create events and share one public registration link.
- Attendees register without needing their own account.
- When confirmed slots are exhausted, registrations move to a waitlist automatically.
- Organizers manage registrations, reports, feedback, QR assets, analytics, and team access from a protected dashboard.
- Core platform features are open access; paid usage is limited to report-download bundles.

### User Types

| User Type | Description |
|---|---|
| Guest | Unauthenticated visitor viewing marketing pages, organizer profiles, or public event registration pages |
| Attendee | Person registering for an event; no EventSlot account is required for the normal registration flow |
| Organizer | Authenticated user creating and managing events |
| Team Member | Authenticated collaborator invited by an organizer to manage selected events |
| Super Admin | Privileged operator identified by environment-variable email or `isAdmin=true` in the database |

---

## 2. Architecture

### Runtime Topology

```text
Browser / PWA
   |
   v
Next.js App Router (Cloud Run)
   |
   +-- NextAuth (Google OAuth + credentials)
   +-- Prisma ORM
   +-- Route Handlers under /app/api
   |
   +--> Neon PostgreSQL
   +--> Paystack (report-download payments)
   +--> Resend (transactional email)
   +--> Cloudflare R2 (uploaded images)
   +--> Upstash Redis (distributed rate limiting)
   +--> Groq / OpenRouter / Anthropic (AI features and reports)
```

### Key Architectural Decisions

| Decision | Current Choice | Reason |
|---|---|---|
| Hosting | Google Cloud Run | Container-based deployment with explicit runtime control |
| Database | Neon PostgreSQL | Serverless Postgres with Prisma support |
| ORM | Prisma | Typed data access and migration workflow |
| Auth | NextAuth v4 | Supports Google OAuth and credentials in one stack |
| Payments | Paystack | KES-native checkout for report-download purchases |
| Email | Resend | Transactional email delivery |
| Storage | Cloudflare R2 | Public asset hosting for event and profile imagery |
| AI Providers | Groq, OpenRouter, Anthropic | Multi-provider fallback model for insights and reports |
| CI/CD | GitHub Actions + Cloud Build + Cloud Run | Automated checks and container deployment |

### Application Structure

```text
app/
  (auth)/           Sign-in, sign-up, password reset
  (organizer)/      Protected organizer workspace
  (attendee)/       Attendee registration shell
  admin/            Super-admin surfaces
  api/              Route handlers
  [username]/       Public organizer profile or public event registration slug
components/         Shared UI and feature components
lib/                Auth, payments, AI, permissions, email, rate limiters
prisma/             Schema and migrations
docs/               Product and engineering documentation
scripts/            Operational scripts
```

---

## 3. Design System

### Theme Tokens

The active design tokens are defined in `app/globals.css`.

| Token | Value | Usage |
|---|---|---|
| `--page-bg` | `#0A0A0A` | Application background |
| `--surface` | `#141414` | Cards, panels, forms |
| `--surface-hover` | `#1A1A1A` | Hovered elevated surfaces |
| `--text-primary` | `#F0EDE6` | Main content |
| `--text-muted` | `rgba(240, 237, 230, 0.45)` | Secondary content |
| `--text-hint` | `rgba(240, 237, 230, 0.25)` | Placeholder and low-emphasis text |
| `--accent` | `#C8F55A` | Primary CTA and highlights |
| `--accent-muted` | `rgba(200, 245, 90, 0.15)` | Soft accent surfaces |
| `--border` | `rgba(240, 237, 230, 0.08)` | Standard border |
| `--border-emphasis` | `rgba(240, 237, 230, 0.15)` | Focus and stronger dividers |
| `--error` | `#FF6B6B` | Destructive/error state |
| `--success` | `#C8F55A` | Success state |

### Typography

| Role | Font | Usage |
|---|---|---|
| Display | Instrument Serif | Hero headings and section titles |
| Body | DM Sans | Body copy, labels, buttons, dashboards |
| Fallback utility fonts | System sans-serif stack | Runtime fallback only |

### UI Direction

- Dark mode only.
- Accent-first CTA styling with rounded controls.
- PWA-capable shell with install metadata and offline document fallback.
- Production build strips most console output and disables browser source maps.

---

## 4. Feature Inventory

### 4.1 Public Features

| Feature | Route | Status |
|---|---|---|
| Landing page | `/` | Live |
| Public organizer profile | `/[username]` when slug resolves to a user | Live |
| Public event registration page | `/[eventSlug]` when slug resolves to an event | Live |
| How it works | `/how-it-works` | Live |
| Universities page | `/for-universities` | Live |
| Privacy policy | `/privacy` | Live |
| Terms of service | `/terms` | Live |
| Public feedback page | `/feedback` | Live |

### 4.2 Attendee Journeys

| Feature | Route | Auth Requirement |
|---|---|---|
| Register for an event | `/[eventSlug]` | None |
| Bulk registration | `/[eventSlug]` | None |
| Confirm existing registration by email lookup | `/[eventSlug]` side panel | None |
| Registration status view/edit | `/registration/[registrationId]` | Link-based access |
| Confirmation ticket / verification page | `/verify/[confirmationCode]` | Link-based access |
| Waitlist placement and promotion | System-managed | None |

### 4.3 Organizer Features

| Feature | Route | Status |
|---|---|---|
| Email/password sign-up | `/signup` | Live |
| Google or credentials sign-in | `/signin` | Live |
| Create event | `/create` | Live |
| Organizer dashboard home | `/dashboard` | Live |
| My events | `/dashboard/events` and `/my-events` | Live |
| Event dashboard | `/dashboard/events/[slug]` | Live |
| Event settings/edit | `/dashboard/events/[slug]` and `/edit/[slug]` | Live |
| Analytics and AI Q&A | `/dashboard/events/[slug]` | Live |
| AI insights | `/dashboard/insights` and event-level API | Live |
| QR code export | `/dashboard/events/[slug]` | Live |
| CSV export | `/dashboard/events/[slug]` | Live |
| Report preview and paid DOCX download | `/dashboard/events/[slug]` and `/dashboard/billing` | Live |
| Billing and download balance | `/dashboard/billing` | Live |
| Notifications inbox | `/dashboard/notifications` | Live |
| Team management | `/dashboard/team` | Live |
| Profile management | `/dashboard/profile` | Live |
| Organizer feedback submission | `/dashboard/feedback` | Live |

### 4.4 Super Admin Features

| Feature | Route | Status |
|---|---|---|
| Admin overview | `/admin` | Live |
| User management | `/admin/users` | Live |
| Event oversight | `/admin/events` | Live |
| Broadcasts | `/admin/broadcast` | Live |
| Message inbox | `/admin/messages` | Live |
| Feedback review | `/admin/feedback` | Live |
| Health and error views | `/admin/health` | Live |
| Launch checklist | `/admin/launch` | Live |
| Generate report by public link | `/admin` plus `/api/admin/generate-report` | Live |

### 4.5 System / Background Features

| Feature | Trigger | Status |
|---|---|---|
| Waitlist promotion | Capacity increase | Live |
| Registration and operational email | Event and registration actions | Live |
| Feedback dispatch cron | `/api/cron/send-feedback` | Live |
| Event reminder cron | `/api/cron/event-reminder` | Live |
| Data expiry cron | `/api/cron/expire-data` | Live |
| Health endpoint | `/api/health` | Live |
| Service worker / offline support | App shell | Live |
| DevTools warning banner | Client-side detection | Live |

---

## 5. Database Schema

**Canonical source:** `prisma/schema.prisma`

The current schema models core behavior with string status fields and JSON payloads rather than Prisma enums for most business state.

### Authentication and Identity

| Model | Purpose | Notable Fields |
|---|---|---|
| `User` | Organizer, collaborator, and admin account record | `plan`, `isAdmin`, `suspended`, `username`, `creditBalance`, `paystack*`, onboarding flags |
| `UserOnboarding` | Tutorial and feature-usage progress | `completedSteps`, `usedFeatures`, `tutorialCompleted`, `tutorialSkipped` |
| `Account` | OAuth provider linkage | NextAuth adapter model |
| `Session` | Active session records | NextAuth adapter model |
| `VerificationToken` | Verification and token-based auth support | NextAuth adapter model |

### Event and Registration Domain

| Model | Purpose | Notable Fields |
|---|---|---|
| `Event` | Core event record | `slug`, `capacity`, `confirmedCount`, `waitlistCount`, `dashboardToken`, `questions`, `archived`, `status`, `imageUrl` |
| `Registration` | Attendee submission | `answers`, `status`, `waitlistPosition`, `attendeeEmail`, consent flags, `checkedIn`, `qrCode`, `confirmationCode` |
| `EventView` | Public page view analytics | `eventId`, `viewedAt`, `source` |
| `EventInsight` | Cached AI insight cards | `cards`, `generatedAt` |
| `AttendeeFeedback` | Post-event attendee feedback | rating and qualitative response fields |

### Collaboration and Messaging

| Model | Purpose | Notable Fields |
|---|---|---|
| `TeamMember` | Organizer-to-collaborator invitation | `ownerId`, `memberId`, `email`, `status`, `inviteToken` |
| `TeamMemberEvent` | Event-level collaborator access | unique pairing between team member and event |
| `Notification` | In-app organizer/admin notifications | `type`, `message`, `read` |
| `Message` | Contact and inbox submissions | sender metadata, body, rating, archive state |
| `OrganizerFeedback` | Organizer-to-platform feedback | `type`, `subject`, `message`, `status` |

### Billing, Access, and Operations

| Model | Purpose | Notable Fields |
|---|---|---|
| `CreditTransaction` | Legacy credit ledger | amount, type, description, optional reference |
| `EventUnlock` | Legacy per-event unlocks | `feature`, `unlockedAt` |
| `FeatureAccess` | Time-bound access records | `feature`, `expiresAt`, `usedAt` |
| `FeatureInterest` | Waitlist for requested product features | `email`, `featureName` |
| `ReportDownload` | Current report-download wallet | `downloadsRemaining`, `totalPurchased` |
| `ReportDownloadTransaction` | Verified report-download purchases | `bundleKey`, `amountKsh`, `downloads`, `reference` |
| `ErrorLog` | Operational error tracking | `route`, `message`, `createdAt` |

---

## 6. API Reference

### Authentication

| Method | Path | Notes |
|---|---|---|
| `POST` | `/api/auth/signup` | Create email/password account |
| `POST` | `/api/auth/forgot-password` | Begin password reset |
| `POST` | `/api/auth/reset-password` | Complete password reset |
| `GET` / `POST` | `/api/auth/[...nextauth]` | NextAuth handler for Google OAuth and credentials |

### User and Profile

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/me` | Current user snapshot |
| `GET` / `PATCH` / `DELETE` | `/api/profile` | Read, update, or delete account |
| `PATCH` | `/api/profile/password` | Change password for credentials accounts |
| `POST` | `/api/profile/photo` | Upload profile image |
| `GET` | `/api/users/check-username` | Public username availability check |
| `PATCH` | `/api/users/username` | Set or update username |
| `GET` / `PATCH` | `/api/user/onboarding` | Tutorial status and completion |
| `GET` | `/api/user/credits` | Legacy credit balance |
| `GET` | `/api/user/credits/history` | Legacy credit ledger |

### Events and Organizer Operations

| Method | Path | Notes |
|---|---|---|
| `POST` | `/api/events` | Create event |
| `GET` / `PUT` / `DELETE` | `/api/events/[slug]` | Fetch, update, or delete event |
| `POST` | `/api/events/[slug]/rename` | Rename event |
| `PATCH` | `/api/events/[slug]/archive` | Archive or unarchive |
| `PATCH` | `/api/events/[slug]/capacity` | Increase capacity and promote waitlist |
| `POST` | `/api/events/[slug]/close` | Toggle event open/closed state |
| `GET` | `/api/events/[slug]/settings` | Settings editor payload |
| `GET` | `/api/events/[slug]/analytics` | Event analytics |
| `GET` | `/api/events/[slug]/insights` | AI-generated insight cards |
| `POST` | `/api/events/[slug]/ask` | Natural-language analytics question |
| `GET` | `/api/events/[slug]/report` | Free preview or paid report download |
| `GET` | `/api/events/[slug]/export` | CSV export |
| `GET` | `/api/events/[slug]/feedback` | Event feedback results |
| `GET` | `/api/events/[slug]/duplicates` | Duplicate registration view |
| `GET` | `/api/events/[slug]/qr` | Event QR export |
| `POST` | `/api/events/[slug]/claim` | Claim token-created event |
| `POST` | `/api/events/[slug]/duplicate` | Duplicate existing event |
| `POST` | `/api/events/[slug]/manual-register` | Organizer-assisted registration |
| `POST` | `/api/events/[slug]/verify-ticket` | Check-in / verification |
| `GET` | `/api/events/suggest-capacity` | Capacity recommendation |
| `POST` | `/api/events/predict-capacity` | Predictive capacity helper |
| `GET` | `/api/my-events` | Organizer event list |
| `GET` | `/api/dashboard/stats` | Organizer dashboard summary |

### Registration, Attendance, and Public Event Flows

| Method | Path | Notes |
|---|---|---|
| `POST` | `/api/register` | Public registration submission |
| `POST` | `/api/attendance/confirm` | Public self-lookup by email |
| `GET` / `PATCH` / `DELETE` | `/api/registrations/[registrationId]` | Status, edit, or delete registration |

### Team and Notifications

| Method | Path | Notes |
|---|---|---|
| `POST` | `/api/team/invite` | Invite collaborator |
| `GET` | `/api/team/members` | List team members |
| `POST` | `/api/team/resend` | Resend invite |
| `GET` | `/api/team/events` | List accessible team events |
| `GET` / `DELETE` | `/api/team/[memberId]` | Team member detail or removal |
| `GET` / `PATCH` | `/api/team/[memberId]/events` | Event assignment management |
| `GET` | `/api/notifications` | Notification list |
| `POST` | `/api/notifications/read` | Mark all as read |
| `POST` | `/api/notifications/[id]/read` | Mark one as read |

### Billing and Report Downloads

| Method | Path | Notes |
|---|---|---|
| `POST` | `/api/report-downloads/purchase` | Active Paystack purchase flow for report bundles |
| `GET` | `/api/report-downloads/verify` | Verify report purchase and credit wallet |
| `GET` | `/api/billing/status` | Billing snapshot |
| `GET` | `/api/billing/transactions` | Billing activity |
| `GET` | `/api/billing/report-downloads` | Report-download balance detail |
| `POST` | `/api/billing/checkout` | Deprecated subscription checkout; returns `410` |
| `POST` | `/api/billing/cancel` | Legacy subscription cancellation path |
| `POST` | `/api/billing/webhook` | Paystack webhook receiver |
| `POST` | `/api/billing/credits` | Legacy credit purchase route |
| `POST` | `/api/billing/unlock` | Legacy feature unlock route |
| `GET` | `/api/billing/invoices` | Billing history |
| `GET` | `/api/billing/portal` | Billing portal helper |
| `GET` | `/api/billing/verify` | Legacy verification path |

### Admin, Cron, and Health

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/admin/stats` | Admin overview metrics |
| `GET` | `/api/admin/users` | User list |
| `PATCH` | `/api/admin/users/[id]` | User management |
| `GET` | `/api/admin/events` | Event oversight |
| `GET` | `/api/admin/feedback` | Feedback review |
| `PATCH` | `/api/admin/feedback/[id]` | Feedback moderation |
| `GET` | `/api/admin/messages` | Inbox/messages |
| `GET` | `/api/admin/health` | Health dashboard data |
| `GET` | `/api/admin/revenue` | Revenue summary |
| `GET` | `/api/admin/stakeholder-report` | DOCX stakeholder report |
| `POST` / `GET` | `/api/admin/generate-report` | Generate event report from pasted link or slug |
| `POST` | `/api/admin/broadcast` | Broadcast send |
| `GET` | `/api/admin/broadcast/count` | Broadcast targeting counts |
| `GET` | `/api/admin/launch-checklist` | Launch checklist data |
| `POST` | `/api/cron/send-feedback` | Scheduled feedback workflow |
| `POST` | `/api/cron/event-reminder` | Scheduled reminders |
| `POST` | `/api/cron/expire-data` | Scheduled retention cleanup |
| `GET` | `/api/health` | Health probe |

---

## 7. Pricing & Tier Logic

### Current Commercial Model

- Core product access is open. `lib/plans.ts` currently treats organizer-facing product capabilities as available without subscription-tier gating.
- Paid usage is limited to **report-download bundles**.
- Currency is **KES**.

### Report Download Bundles

| Bundle Key | Price | Downloads |
|---|---|---|
| `single` | KSh 100 | 1 |
| `bundle3` | KSh 285 | 3 |
| `bundle6` | KSh 500 | 6 |
| `bundle15` | KSh 1,000 | 15 |

### Tier Logic Reality Check

The codebase still contains legacy plan, credits, and unlock concepts:

- `User.plan` remains on the schema.
- Legacy billing endpoints still exist.
- Subscription webhook handling still normalizes users back to `free`.

Operationally, the current product stance is:

| Area | Current Behavior |
|---|---|
| Event creation | Open access |
| Analytics and insights | Open access |
| CSV export | Open access |
| Team collaboration | Open access with safety cap |
| Report preview | Free |
| Report DOCX download | Paid via bundle balance |
| Subscription checkout | Deprecated |

---

## 8. Authentication & Authorization

### Authentication Modes

| Mode | Implementation |
|---|---|
| Google OAuth | NextAuth Google provider |
| Email/password | NextAuth credentials provider backed by hashed passwords |
| Session strategy | JWT session via NextAuth |

### Session Enrichment

The session callback adds:

- `user.id`
- `user.isAdmin`
- `user.username`
- onboarding flags
- suspension state

### Authorization Model

| Access Surface | Enforcement |
|---|---|
| Organizer areas | `middleware.ts` requires authenticated session |
| Admin pages | `app/admin/layout.tsx` enforces admin email or `isAdmin=true` |
| Event collaboration | `lib/permissions.ts` resolves owner, admin, team member, or dashboard-token access |
| Public registration | No attendee account required |

### Protected Route Matcher

`middleware.ts` currently protects:

- `/dashboard/*`
- `/my-events`
- `/create`
- `/edit/*`
- `/admin/*`
- selected reserved paths prepared for future use

---

## 9. Infrastructure & Deployment

### Deployment Pipeline

1. GitHub Actions runs install, Prisma generation, typecheck, lint, tests, and build.
2. On `main`, the deploy job authenticates to Google Cloud.
3. Docker image is built and pushed to Artifact Registry.
4. Cloud Run is updated with the new image and secret bindings.
5. Production smoke check hits `https://www.eventsslot.com`.

### Active Runtime Components

| Area | Current Setup |
|---|---|
| App runtime | Cloud Run service `eventslot-web` |
| Container source | `Dockerfile` |
| Build config | `cloudbuild.yaml` |
| Workflow | `.github/workflows/deploy.yml` |
| Database secrets | Cloud Run secret bindings |
| Public asset host | Cloudflare R2 |
| Rate limiting backend | Upstash Redis when configured, in-memory fallback otherwise |

### Config Notes

- `next.config.mjs` uses `output: 'standalone'`.
- PWA support is enabled via `@ducanh2912/next-pwa`.
- Security headers include CSP, HSTS, `X-Frame-Options`, and `Referrer-Policy`.
- The repo currently has **Cloud Run configuration drift** between `cloudrun.yaml` and `cloudbuild.yaml` for values such as min instances and CPU. Production deployment is driven by the GitHub Actions workflow plus `gcloud run deploy`, so these files should be kept aligned.

---

## 10. Compliance — Kenya Data Protection Context

This section documents the current code-level privacy posture. It should not be read as legal advice.

| Requirement Area | Current Repo Status | Notes |
|---|---|---|
| Registration consent capture | Implemented | `Registration` stores `consentTransactional` and `consentMarketing` |
| Public privacy notice | Implemented | `/privacy` is public |
| Terms access | Implemented | `/terms` is public |
| Account deletion | Implemented | `DELETE /api/profile` |
| Retention cleanup | Implemented | `/api/cron/expire-data` exists |
| Self-service personal data export | Partial / not exposed as dedicated current route | No current equivalent to the older `data-export` draft endpoint |
| Formal audit log model | Partial | Current operational history is distributed across notifications, messages, error logs, and admin views; there is no dedicated `AuditLog` model in the active schema |

### Operational Interpretation

- The repo captures attendee consent flags at registration time.
- The repo exposes account deletion for authenticated users.
- The repo includes automated retention cleanup infrastructure.
- Privacy/export workflows beyond the current route set should be treated as manual or future work until implemented.

---

## 11. GitHub Actions Auto-Update Hook

The deploy workflow should update this document automatically after a successful production deploy.

### Implemented Approach

- Workflow file: `.github/workflows/deploy.yml`
- Script: `scripts/update-system-docs.mjs`
- Update target: `docs/EVENTSLOT_SYSTEM_DOCUMENTATION.md`

### Expected Metadata

The updater stamps:

- UTC deploy time
- short commit SHA
- Cloud Run revision name

It updates the `Last Updated` line and prepends a row to the auto-managed portion of the changelog table in §15.

---

## 12. AI Prompt — Future Feature Documentation

Use this prompt when shipping a new feature:

```text
You are maintaining the canonical EventSlot documentation at docs/EVENTSLOT_SYSTEM_DOCUMENTATION.md.

Document the new feature using the current repo truth, not legacy pricing-tier assumptions.

Feature name: [NAME]
What it does: [DESCRIPTION]
Who uses it: [Guest / Attendee / Organizer / Team Member / Super Admin]
Routes involved: [ROUTES]
API endpoints added or changed: [METHOD + PATH + AUTH]
Database changes: [MODELS / FIELDS / MIGRATIONS]
Pricing impact: [Open access / Report-download billing / Deprecated legacy billing / Other]
Privacy impact: [CONSENT / RETENTION / EXPORT / DELETE / NONE]
Infrastructure impact: [DEPLOYMENT / SECRETS / CRON / STORAGE / AI PROVIDER / NONE]

Update:
1. Feature Inventory
2. Database Schema
3. API Reference
4. Pricing & Tier Logic
5. Compliance — Kenya Data Protection Context
6. Decision Log if the feature introduces a meaningful architectural or product decision
7. Changelog with today's date

Output only the changed sections.
```

---

## 13. Decision Log

| Date | Decision | Rationale |
|---|---|---|
| 2026-05 | Canonical documentation moved to this file | Reduce drift between `SYSTEM.md`, `FEATURES.md`, and `API.md` |
| 2026-05 | Open-access core feature model retained | Product direction shifted away from subscription gating |
| 2026-05 | Report downloads remain the only paid action | Align monetization with current Paystack bundle flow |
| 2026-05 | Cloud Run remains the deployment target | Existing CI/CD and secret management are already wired for it |
| 2026-05 | Admin access uses env emails plus DB flag | Allows bootstrap access while retaining server-side control |

---

## 14. Known Limitations & Deferred Features

| Area | Status | Notes |
|---|---|---|
| Deploy config normalization | Needs cleanup | `cloudbuild.yaml` and `cloudrun.yaml` are not fully aligned |
| Legacy billing codepaths | Transitional | Subscription and credit routes still exist even though report-download bundles are the active model |
| Dedicated self-service data export | Not currently exposed | Would be needed for stronger privacy tooling parity |
| Formal audit log model | Not implemented as standalone model | Operational visibility is spread across admin surfaces and error logs |
| Native mobile app | Not planned | PWA/TWA path is the current mobile strategy |
| Multi-language support | Deferred | UI is English-first today |

---

## 15. Changelog

| Date | Commit | Revision | Description |
|---|---|---|---|
| 2026-05-06T00:00:00Z | manual | canonical-doc-bootstrap | Established this canonical live system documentation and deploy-update contract |
<!-- AUTO-DEPLOY-CHANGELOG:START -->
| 2026-06-18T01:05:35Z | ae39a00 | eventslot-web-00121-kbv | Auto-deploy metadata update |
| 2026-06-18T00:23:36Z | 3193b5e | eventslot-web-00119-9tt | Auto-deploy metadata update |
| 2026-06-17T19:02:57Z | 315db6c | eventslot-web-00117-ppx | Auto-deploy metadata update |
| 2026-06-16T19:45:01Z | 74f4aea | eventslot-web-00115-bpn | Auto-deploy metadata update |
| 2026-06-16T17:00:34Z | cdc30f1 | eventslot-web-00113-k2g | Auto-deploy metadata update |
| 2026-06-04T12:38:00Z | e877d1b | eventslot-web-00110-p6q | Auto-deploy metadata update |
| 2026-06-04T10:47:10Z | 9f6a27c | eventslot-web-00109-s2x | Auto-deploy metadata update |
| 2026-06-04T10:41:57Z | 9689d37 | eventslot-web-00108-j2l | Auto-deploy metadata update |
| 2026-06-04T10:29:17Z | bab028b | eventslot-web-00107-wrk | Auto-deploy metadata update |
| 2026-06-04T10:07:54Z | 3a03fe2 | eventslot-web-00106-p6j | Auto-deploy metadata update |
| 2026-06-04T08:22:28Z | bbc6873 | eventslot-web-00105-c59 | Auto-deploy metadata update |
| 2026-06-04T08:01:44Z | 62ed98d | eventslot-web-00104-mnf | Auto-deploy metadata update |
| 2026-06-02T19:26:24Z | e5e0a9c | eventslot-web-00103-kgw | Auto-deploy metadata update |
| 2026-06-02T18:12:19Z | d254c66 | eventslot-web-00102-mfk | Auto-deploy metadata update |
| 2026-05-27T06:51:30Z | 5a832d3 | eventslot-web-00101-989 | Auto-deploy metadata update |
| 2026-05-26T20:13:23Z | 09befdd | eventslot-web-00100-crj | Auto-deploy metadata update |
| 2026-05-26T20:00:34Z | bd9c72d | eventslot-web-00099-fqc | Auto-deploy metadata update |
| 2026-05-25T18:00:36Z | 1d8465d | eventslot-web-00098-l7b | Auto-deploy metadata update |
| 2026-05-25T16:26:36Z | 1b0d814 | eventslot-web-00097-jz4 | Auto-deploy metadata update |
| 2026-05-25T15:47:36Z | de32673 | eventslot-web-00096-qkh | Auto-deploy metadata update |
| 2026-05-25T15:13:13Z | 93186ff | eventslot-web-00095-ppm | Auto-deploy metadata update |
| 2026-05-23T13:08:10Z | 9f6b2a2 | eventslot-web-00093-gld | Auto-deploy metadata update |
| 2026-05-23T05:05:48Z | 9f6b2a2 | eventslot-web-00091-swj | Auto-deploy metadata update |
| 2026-05-22T09:44:52Z | 1cb1b2e | eventslot-web-00090-rvm | Auto-deploy metadata update |
| 2026-05-22T07:31:46Z | 540e4c7 | eventslot-web-00089-dzt | Auto-deploy metadata update |
| 2026-05-22T07:02:44Z | 95749e8 | eventslot-web-00088-dj8 | Auto-deploy metadata update |
| 2026-05-22T04:05:56Z | 4ec6cea | eventslot-web-00087-pv6 | Auto-deploy metadata update |
| 2026-05-19T13:02:26Z | 3cbca15 | eventslot-web-00086-6k8 | Auto-deploy metadata update |
| 2026-05-19T12:50:13Z | 0261629 | eventslot-web-00085-6pz | Auto-deploy metadata update |
| 2026-05-18T23:24:23Z | 07b9ad1 | eventslot-web-00084-dxm | Auto-deploy metadata update |
| 2026-05-18T23:15:10Z | fd44a57 | eventslot-web-00082-8v7 | Auto-deploy metadata update |
| 2026-05-18T22:51:18Z | 10339da | eventslot-web-00081-9nn | Auto-deploy metadata update |
| 2026-05-18T21:48:30Z | 0abf315 | eventslot-web-00077-5d5 | Auto-deploy metadata update |
| 2026-05-18T16:01:36Z | 71e7216 | eventslot-web-00072-zz8 | Auto-deploy metadata update |
| 2026-05-18T15:41:20Z | 23c7a27 | eventslot-web-00070-rsf | Auto-deploy metadata update |
| 2026-05-18T14:38:49Z | 41aa43e | eventslot-web-00068-942 | Auto-deploy metadata update |
| 2026-05-18T13:49:04Z | 163fbaf | eventslot-web-00066-lrn | Auto-deploy metadata update |
| 2026-05-18T12:58:43Z | f6424e3 | eventslot-web-00064-mds | Auto-deploy metadata update |
| 2026-05-15T22:14:19Z | 5e50a8d | eventslot-web-00059-sq4 | Auto-deploy metadata update |
| 2026-05-15T19:06:53Z | c1fe7af | eventslot-web-00058-zcg | Auto-deploy metadata update |
| 2026-05-15T00:52:41Z | 76f163b | eventslot-web-00057-nlc | Auto-deploy metadata update |
| 2026-05-15T00:26:23Z | 2487e1d | eventslot-web-00056-72k | Auto-deploy metadata update |
| 2026-05-14T23:40:09Z | 5bd2c86 | eventslot-web-00055-d4f | Auto-deploy metadata update |
| 2026-05-14T19:18:28Z | 312bfeb | eventslot-web-00054-jjm | Auto-deploy metadata update |
| 2026-05-14T19:11:25Z | 469b9f0 | eventslot-web-00053-zxc | Auto-deploy metadata update |
| 2026-05-14T18:53:55Z | 33b6c19 | eventslot-web-00052-gk8 | Auto-deploy metadata update |
| 2026-05-14T18:17:55Z | 98802e7 | eventslot-web-00051-cgm | Auto-deploy metadata update |
| 2026-05-14T17:26:10Z | f10bc07 | eventslot-web-00049-6hz | Auto-deploy metadata update |
| 2026-05-12T05:21:43Z | 3672646 | eventslot-web-00048-mhq | Auto-deploy metadata update |
| 2026-05-11T17:31:03Z | 8e2da3a | eventslot-web-00044-gpb | Auto-deploy metadata update |
| 2026-05-11T11:58:32Z | f1be75d | eventslot-web-00043-42v | Auto-deploy metadata update |
| 2026-05-11T10:19:31Z | f93d467 | eventslot-web-00042-hjd | Auto-deploy metadata update |
| 2026-05-11T09:49:05Z | a3c5b00 | eventslot-web-00041-249 | Auto-deploy metadata update |
| 2026-05-11T08:58:15Z | dda1009 | eventslot-web-00040-wjr | Auto-deploy metadata update |
| 2026-05-11T05:15:07Z | f3120e1 | eventslot-web-00039-r2k | Auto-deploy metadata update |
| 2026-05-11T04:57:53Z | e8db407 | eventslot-web-00038-btd | Auto-deploy metadata update |
| 2026-05-09T10:23:14Z | 20bc5ba | eventslot-web-00028-jvt | Auto-deploy metadata update |
| 2026-05-08T04:45:36Z | 088ac4b | eventslot-web-00026-hkc | Auto-deploy metadata update |
| 2026-05-07T11:01:18Z | 42b10bf | eventslot-web-00023-lln | Auto-deploy metadata update |
| 2026-05-07T10:50:15Z | e886619 | eventslot-web-00022-zwk | Auto-deploy metadata update |
| 2026-05-07T10:18:52Z | 927976c | eventslot-web-00021-8mc | Auto-deploy metadata update |
| 2026-05-07T09:15:17Z | 1231343 | eventslot-web-00020-vvq | Auto-deploy metadata update |
| 2026-05-07T08:55:53Z | dea0f60 | eventslot-web-00018-98p | Auto-deploy metadata update |
| 2026-05-06T18:57:19Z | 3a138ae | eventslot-web-00010-zvc | Auto-deploy metadata update |
| 2026-05-06T18:25:47Z | 8091eb1 | eventslot-web-00009-nsc | Auto-deploy metadata update |
<!-- AUTO-DEPLOY-CHANGELOG:END -->

---

**End of EventSlot System Documentation**
*This file is auto-maintained after successful deploys. Manual edits should preserve the `Last Updated` line prefix and the auto-deploy changelog markers.*