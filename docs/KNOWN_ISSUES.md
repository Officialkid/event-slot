# EventSlot — Known Issues & Status

_Last updated: April 14, 2026_  
_Legend: 🔴 Critical | 🟡 Important | 🟢 Minor | ✅ Resolved_

---

## Critical (Blocks Launch)

### KI-001 — No Rate Limiting on Signup Endpoint
**Status:** ✅ Resolved  
**Severity:** 🔴 Critical  
**Affected:** POST /api/auth/signup  
**Symptom:** Anyone can create unlimited accounts with no throttle
**Root cause:** Rate limiting (Upstash Redis) is only applied to POST /api/register, not to the signup flow  
**Fix:** Add Upstash rateLimit wrapper to /api/auth/signup (same pattern as /api/register)  
**Risk:** Email bombing, database spam, Resend quota exhaustion

### KI-002 — No Rate Limiting on /api/billing/unlock
**Status:** ✅ Resolved  
**Severity:** 🔴 Critical  
**Affected:** POST /api/billing/unlock  
**Symptom:** Credits can potentially be double-spent if two unlock requests fire simultaneously  
**Root cause:** Idempotency check is not atomic (read-then-write, no database transaction)  
**Fix:** Wrap the check + create in a Prisma transaction; add request throttle per user  
**Risk:** Credits drained by race condition

### KI-003 — R2 Env Vars Not Validated at Startup
**Status:** ✅ Resolved  
**Severity:** 🔴 Critical  
**Affected:** POST /api/upload  
**Symptom:** Image upload silently fails if R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, or R2_PUBLIC_URL are missing from Vercel  
**Fix:** Add startup validation or graceful 503 response when R2 env vars missing  
**Risk:** Users upload images, get no error, but images are lost

---

## Important (Fix Before Launch)

### KI-004 — Paystack Subscription Renewal Webhook Not Fully Handled
**Status:** In progress (webhook route exists)  
**Severity:** 🟡 Important  
**Affected:** /api/billing/webhook  
**Symptom:** The webhook handles subscription.create and invoice.payment_failed but the ongoing charge.success renewal flow needs verification that planEndDate is correctly extended  
**Fix:** Test with Paystack test mode webhook events; confirm planEndDate is bumped on each successful renewal charge  
**Priority:** Must be verified before charging real users

### KI-005 — NEXTAUTH_URL Not Validated in Email Templates
**Status:** ✅ Resolved  
**Severity:** 🟡 Important  
**Affected:** lib/email.ts, team invite emails, password reset emails  
**Symptom:** If NEXTAUTH_URL is not set on Vercel, email links contain `undefined/team/accept?token=...`  
**Fix:** Add fallback or startup guard for NEXTAUTH_URL; validate in email functions  
**Risk:** Password reset and team invite links are broken for users

### KI-006 — No CSRF Protection on Non-Auth API Routes
**Status:** Not started  
**Severity:** 🟡 Important  
**Affected:** All PATCH/POST/DELETE routes  
**Symptom:** Routes rely only on NextAuth session cookies (SameSite) with no explicit CSRF token  
**Fix:** Acceptable for SameSite=Strict mode; verify cookie SameSite policy in NextAuth config  
**Priority:** Low risk if NextAuth SameSite cookie is correctly configured

### KI-007 — Console.error Left in Production API Routes
**Status:** Not started  
**Severity:** 🟡 Important  
**Affected:** All API routes (30+ instances)  
**Symptom:** Error details logged to Vercel function logs (not a user-facing bug, but leaks internal info to log aggregators)  
**Fix:** Replace with structured ErrorLog writes to DB (already modelled) or integrate Sentry  
**Priority:** Important for security and observability

### KI-008 — Fire-and-Forget Emails Have No Retry
**Status:** Not started  
**Severity:** 🟡 Important  
**Affected:** sendWelcomeEmail(), sendPasswordResetEmail(), team invite emails  
**Symptom:** If Resend is temporarily down, emails are silently dropped with no retry  
**Fix:** Queue failed emails (BullMQ or Upstash Queue) or log failures to ErrorLog for manual retry  
**Risk:** Users never receive welcome or password reset emails

### KI-009 — Admin Auth Is Email-Match Only (No RBAC)
**Status:** Not started  
**Severity:** 🟡 Important  
**Affected:** All /api/admin/* routes, /admin/* pages  
**Symptom:** Admin privileges granted to any session user whose email matches SUPER_ADMIN_EMAIL env var  
**Fix:** Acceptable for single-admin platform; document that SUPER_ADMIN_EMAIL must be kept secret and match exactly  
**Priority:** Acceptable as-is for single-admin use case

### KI-010 — Capacity Decrease Not Possible (By Design)
**Status:** Won't fix  
**Severity:** 🟡 Important  
**Affected:** /api/events/[slug]/capacity  
**Note:** Per business rules, capacity can only increase. This is intentional to protect confirmed attendees. Document clearly in UI.

---

## Minor (Fix After Launch)

### KI-011 — QR Code / Check-in Not Fully Implemented
**Status:** Not started — `qrCode` and `checkedIn` fields exist on Registration model  
**Severity:** 🟢 Minor  
**Affected:** Registration model, attendee check-in flow  
**Symptom:** Fields are in the schema but no check-in UI or QR generation route exists  
**Fix:** Build QR generation on registration confirmation + check-in endpoint  
**Note:** Listed as "coming soon" on pricing page

### KI-012 — Custom Domain Feature Stubbed Only
**Status:** Not started  
**Severity:** 🟢 Minor  
**Affected:** Business tier  
**Symptom:** Custom domain listed in Business plan features but routing not implemented  
**Fix:** Implement Vercel domain routing + per-user domain mapping table

### KI-013 — Follow Button Is Disabled (Coming Soon)
**Status:** Not started  
**Severity:** 🟢 Minor  
**Affected:** /[username] public profile  
**Symptom:** Follow button is rendered but disabled with no backend  
**Fix:** Build follower/following model and subscription flow or remove button until ready

### KI-014 — Admin Broadcast Has No Preview
**Status:** Not started  
**Severity:** 🟢 Minor  
**Affected:** /admin/broadcast  
**Symptom:** Admin can send broadcast email with no preview of rendered HTML  
**Fix:** Add preview pane showing rendered email before send

### KI-015 — Duplicate Event Does Not Copy Date/Location
**Status:** Not started  
**Severity:** 🟢 Minor  
**Affected:** Three-dot menu → Duplicate  
**Symptom:** Duplicated event may not copy eventDate, location, and communityLink fields  
**Fix:** Verify POST /api/events/[slug]/duplicate includes all fields in the new event object

### KI-016 — Registration Editing Blocked After Deadline
**Status:** By design  
**Severity:** 🟢 Minor  
**Affected:** /registration/[registrationId]/edit, PATCH /api/registrations/[registrationId]  
**Note:** Registration edits are blocked for closed/archived events. This is intentional. Document in FAQ.

### KI-017 — No Unsubscribe Link in Marketing Emails
**Status:** Not started  
**Severity:** 🟢 Minor  
**Affected:** Marketing email templates  
**Symptom:** No unsubscribe mechanism in CAN-SPAM/GDPR required format  
**Fix:** Add unsubscribe endpoint honouring consentMarketing=false per Registration

### KI-018 — seedPrivilegedAccounts Silently Swallows Errors
**Status:** Not started  
**Severity:** 🟢 Minor  
**Affected:** app/layout.tsx  
**Symptom:** `seedPrivilegedAccounts()` called on every layout render; catch block is empty  
**Fix:** Log errors from seed function to ErrorLog or console.warn at minimum

---

## Verified Working ✅

- [x] Event creation with shareable registration link
- [x] Attendee registration (confirmed + waitlist with position)
- [x] Capacity increase with automatic waitlist promotion
- [x] Google OAuth sign-in
- [x] Email/password sign-in and sign-up
- [x] Password reset flow (forgot-password + reset-password)
- [x] Welcome email on signup
- [x] Username setup flow (required before dashboard)
- [x] Organizer public profile at /[username]
- [x] Dashboard home with stats and activity feed
- [x] My Events with three-dot menu (rename, duplicate, archive, delete)
- [x] Individual event dashboard (Overview, Confirmed, Waitlist tabs)
- [x] CSV export (Pro/Business or credits)
- [x] Word report download (standard)
- [x] Event analytics (plan/credits gated)
- [x] AI insight cards
- [x] Natural language Q&A
- [x] Intelligent capacity suggestions (3+ past events)
- [x] Event creation templates (6 options)
- [x] Notifications system (80%, 100%, promoted, payment failure, expiry)
- [x] Profile edit (name, photo, password)
- [x] Billing page (plan badge, credits balance, buy credits, upgrade, history)
- [x] Paystack subscription checkout and webhook
- [x] Credits purchase via Paystack
- [x] Feature unlock (EventUnlock, 30-day expiry)
- [x] Team members (invite, accept, remove)
- [x] Attendee feedback forms (Business plan)
- [x] Organizer feedback to EventSlot
- [x] Pricing page with monthly/annual toggle
- [x] EventSlot watermark on free event pages (credits unlock available)
- [x] Consent checkboxes on registration forms
- [x] Registration status page
- [x] PWA manifest and installable
- [x] 404 and error pages
- [x] Rate limiting on registration API (10/min per IP)
- [x] Privacy policy and terms pages
- [x] Super admin panel (404 for non-admin)
- [x] Admin users: plan management, suspend/delete
- [x] Admin health check
- [x] Admin broadcast email
- [x] Admin launch checklist
- [x] Data expiry cron job (30 days, Free plan)
- [x] Feedback request cron job (Business events)
- [x] Duplicate registration detection
- [x] OG image generation
- [x] Cloudflare R2 image upload for events and profiles
- [x] Insights Tracker (Business plan)
- [x] Event edit page
- [x] Event cover image upload

---

## Documentation Update Rule

After completing any fix or build prompt, update:
- `/docs/FEATURES.md` — update or add the relevant feature entry
- `/docs/API.md` — update or add changed/new endpoints
- `/docs/CHANGELOG.md` — add entry: [date] | [feature name] | [brief description]
- `/docs/KNOWN_ISSUES.md` — mark fixed issues as ✅ Resolved with the fix date
