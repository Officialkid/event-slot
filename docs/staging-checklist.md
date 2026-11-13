# EventSlot — Staging Readiness Checklist

> **Last updated:** 2026-11-01  
> **Status:** Pre-staging review complete. Blocked on Google Cloud billing restoration.

---

## Prerequisites (Must Be Met Before Any Staging Deployment)

- [ ] Google Cloud billing account restored and active
- [ ] `DATABASE_URL` points to a staging PostgreSQL database (not production, not local SQLite)
- [ ] All required environment variables set in staging environment (see §2)
- [ ] `npx prisma migrate deploy` run against staging DB (see §3)
- [ ] Domain / `NEXTAUTH_URL` confirmed for staging environment

---

## 1. Environment Variables Required

Set **all** of the following in the staging environment. Never commit real values to source control.

| Variable | Purpose | Required |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | ✅ |
| `NEXTAUTH_SECRET` | NextAuth session signing key (generate with `openssl rand -base64 32`) | ✅ |
| `NEXTAUTH_URL` | Full canonical URL of the staging app (e.g. `https://staging.eventslot.io`) | ✅ |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | ✅ |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | ✅ |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google One Tap client ID (same as above, public) | ✅ |
| `RESEND_API_KEY` | Resend email API key for transactional email | ✅ |
| `APP_URL` | Same as `NEXTAUTH_URL`, used by services for self-links | ✅ |
| `NEXT_PUBLIC_APP_URL` | Public-facing URL for client-side links | ✅ |

> [!CAUTION]
> `ESA_LIVE_EVENT_CREATION_ENABLED` must **NOT** be set to `"true"` in any environment without explicit authorization. Leave it unset or set to `"false"` to keep the EventSlot Assistant in safe/dry-run mode.

---

## 2. Safety Flags

```bash
# REQUIRED: Leave unset or false — enables ESA dry-run mode
# ESA_LIVE_EVENT_CREATION_ENABLED=

# Optional overrides (leave unset for defaults)
# ESA_SESSION_TTL_SECONDS=3600
# ESA_MAX_PROPOSALS_PER_SESSION=5
```

---

## 3. Database Migration

Run migrations against the staging database **before** starting the application:

```bash
# Confirm correct DATABASE_URL is set
echo $DATABASE_URL

# Run all pending migrations (non-destructive)
npx prisma migrate deploy

# Verify schema is in sync
npx prisma validate
```

> [!WARNING]
> Do **not** run `prisma db push` in staging/production — it can silently drop columns. Use `prisma migrate deploy` only.

Current migration history includes 70+ deterministic migrations. The most recent order of application:
1. `20261026214500_add_organiser_followers_and_timed_drops` — `OrganizerFollower` table & relationship indexes
2. `20261027220000_add_assistant_action_proposals` — `AssistantActionProposal` table (session-scoped proposal store)
3. `20261028000000_add_event_side_effect_outbox` — `EventCreationSideEffectOutbox` table with status enum & lease columns

---

## 3.1 Safe Staging-Only Test Data Guidelines

To protect real organizers and attendees:
- Use only synthetic `@example.com` or `@eventslot.test` email addresses for staging test accounts.
- Never import production user databases, attendee registrations, or real phone numbers into staging.
- All follower test broadcasts must target controlled internal test inboxes (or mailcatcher/sandbox).
- Payment gateways (Paystack/Intasend) must remain in TEST/SANDBOX mode with test secret keys.
- Do not trigger live SMS or WhatsApp messages.

---

## 3.2 Unverified External Integrations & Concurrency Boundary

The following areas are verified via offline mocks and unit/integration tests, but remain explicitly unverified against real production infrastructure until staging deployment:
- **Google OAuth**: Verified with NextAuth mock session claims. Real staging requires Google Console redirect URIs (`/api/auth/callback/google`).
- **Resend / SMTP Email**: Verified with test adapters and mocks. Staging requires valid test API key.
- **Google Calendar Sync**: Verified via deterministic mocks. Real two-way sync requires calendar OAuth refresh tokens.
- **PostgreSQL Concurrency Tests**: 8 concurrency tests (`postgresConcurrencyPhase52.test.ts`) are intentionally skipped when `TEST_POSTGRES_DATABASE_URL` is absent to protect shared databases. Run `scripts/run-postgres-concurrency-test.ps1` against an isolated disposable Docker PostgreSQL instance prior to production release.

---

## 4. Build Verification

```bash
# TypeScript check (must exit 0)
npx tsc --noEmit

# Prisma schema validation (must pass)
npx prisma validate

# Production build (must complete without errors)
npm run build

# Unit/integration tests (must all pass)
npx jest --passWithNoTests
```

---

## 5. Smoke Tests (Post-Deployment)

After deploying to staging, verify the following manually:

### Authentication
- [ ] Sign in with Google OAuth works
- [ ] Session persists across page navigation
- [ ] Sign out works cleanly

### Organizer Flows
- [ ] Create a new event (wizard completes, event appears in dashboard)
- [ ] Edit an existing event
- [ ] View registration list for an event
- [ ] Check-in an attendee via QR scan

### Attendee Flows
- [ ] Browse events as unauthenticated user
- [ ] Register for a free event (all question types work)
- [ ] Registration confirmation email received
- [ ] Prefill notice appears for returning attendees
- [ ] Follow an organizer (authenticated)

### Notifications
- [ ] Follower announcement email sent when organizer publishes new event
- [ ] Notification bell shows new items

### EventSlot Assistant (ESA)
- [ ] Chat interface opens
- [ ] Assistant responds to event creation prompts
- [ ] Proposals shown but **not executed** (ESA_LIVE_EVENT_CREATION_ENABLED absent)
- [ ] Confirmation flow works (proposal → confirm → executes only when flag enabled)

### Admin
- [ ] `/admin/health` returns 200
- [ ] System metrics visible to admin users only

---

## 6. Rollback Procedure

If a staging deployment introduces a regression:

1. **Identify the issue** — check application logs, Sentry (if configured), and the build output.
2. **Revert to previous deployment** — redeploy the last known-good Git commit via your hosting provider.
3. **Database rollback (if needed):**
   ```bash
   # List applied migrations
   npx prisma migrate status
   
   # To roll back a specific migration manually:
   # Connect to staging DB and run the corresponding down SQL
   # (Prisma does not have automatic down migrations — write and test rollback SQL first)
   ```
4. **Notify stakeholders** before and after rollback.

---

## 7. Release Gate Decision

| Check | Status |
|---|---|
| TypeScript (tsc --noEmit) | ✅ PASS (exit 0) |
| Prisma schema valid | ✅ PASS |
| Unit + integration tests | ✅ PASS (170+ tests) |
| Production build (npm run build) | ✅ PASS | BUILD_ID: `BIpLMCJE-26SPHfKMKg6t` — 236 static pages, compiled in 8.5min |
| Google Cloud billing | ❌ BLOCKED — restore billing to deploy |
| Staging DB migration | ❌ BLOCKED — requires billing + staging DB |
| Google OAuth (staging credentials) | ❌ Requires staging OAuth client setup |
| Resend email (staging key) | ❌ Requires Resend staging API key |

> [!IMPORTANT]
> **Decision:** The codebase is code-complete and test-verified. Staging deployment is **READY TO PROCEED** once Google Cloud billing is restored and the staging database is provisioned. No further code changes are required to unblock staging.
