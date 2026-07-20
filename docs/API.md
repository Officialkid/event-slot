# EventSlot — API Reference

> Canonical source: `docs/EVENTSLOT_SYSTEM_DOCUMENTATION.md`
> 
> This file can keep endpoint-level detail, but the canonical document owns the live API surface summary.

_Last updated: July 19, 2026_
_Base URL: https://www.eventsslot.com/api_  
_Auth: NextAuth session cookie unless otherwise noted_

---

## Authentication

### POST /api/auth/signup
Create a new email/password account.  
**Auth:** None  
**Body:** `{ name, email, password, privacyAccepted, preferredLanguage? }`
**Returns:** `{ success, message }`  
**Side effect:** Fires welcome/verification email flow (non-blocking where possible)

### POST /api/auth/forgot-password
Request a password reset email.  
**Auth:** None  
**Body:** `{ email }`  
**Returns:** Always `200` (enum security — never reveals if email exists)  
**Side effect:** Generates SHA-256 hashed UUID token with 1-hour expiry, sends reset link via Resend

### POST /api/auth/reset-password
Reset password using a token from email.  
**Auth:** None  
**Body:** `{ token, password }`  
**Returns:** `{ success }` or `{ error }` if token invalid/expired  
**Note:** Hashes incoming token (SHA-256), matches against DB, updates with bcrypt 12 rounds, clears token fields

### GET/POST /api/auth/[...nextauth]
NextAuth handler — Google OAuth and Credentials (email/password).  
**Auth:** None  
**Notes:**
- Suspended users blocked at `signIn` callback
- `session` callback injects `user.id` and `user.username`
- Redirect after auth goes to `/dashboard`

---

## User & Profile

### GET /api/me
Get current user's profile including credit balance.  
**Auth:** Required  
**Returns:** `{ id, name, email, image, plan, creditBalance, username }`

### GET /api/profile
Get user profile details.  
**Auth:** Required  
**Returns:** `{ id, name, email, image, hasPassword, calendarConnected, twoFactorEnabled, preferredLanguage }`

### PATCH /api/profile
Update profile settings.
**Auth:** Required  
**Body:** `{ name?, twoFactorEnabled?, preferredLanguage? }`
**Returns:** `{ success, user }`

### DELETE /api/profile
Delete account and all associated data.  
**Auth:** Required  
**Returns:** `{ success }`

### PATCH /api/profile/password
Change password (email/password accounts only).  
**Auth:** Required  
**Body:** `{ currentPassword, newPassword }`  
**Returns:** `{ success }` or `{ error }`

### POST /api/profile/photo
Upload a profile photo to Cloudflare R2.  
**Auth:** Required  
**Body:** `FormData` with `file`  
**Returns:** `{ url }`

### GET /api/user/credits
Get current credit balance.  
**Auth:** Required  
**Returns:** `{ balance: number }`

### GET /api/user/credits/history
Get credit transaction history.  
**Auth:** Required  
**Returns:** `{ transactions[] }` (amount, description, createdAt, running balance)

### GET /api/users/check-username
Check if a username is available.  
**Auth:** None (rate limited)  
**Query:** `?username=xxx`  
**Returns:** `{ available: boolean, message }`

### PATCH /api/users/username
Set or update the organizer's username.  
**Auth:** Required  
**Body:** `{ username }`  
**Rules:** 3–20 chars, alphanumeric + hyphens, reserved words blocked  
**Returns:** `{ success, username }`

---

## Events

### POST /api/events
Create a new event.  
**Auth:** Required  
**Plan check:** Free plan limited to 5 active events  
**Body:** `{ title, description?, capacity?, deadline?, eventDate?, location?, communityLink?, questions[], organizerEmail }`  
**Returns:** `{ success, event: { id, title, slug, dashboardToken } }`

### GET /api/events/[slug]
Get event data including all registrations.  
**Auth:** Session ownership OR `?token=` dashboard token  
**Returns:** `{ success, event, confirmed[], waitlist[] }`

### POST /api/events/[slug]/translate-description
Translate the public event description for attendee viewing.
**Auth:** None
**Body:** `{ targetLanguage }` where `targetLanguage` is one of the supported EventSlot language codes.
**Returns:** `{ translation, targetLanguage, provider }` or `{ error }`
**Notes:** Only active, non-archived public events are eligible. The translation prompt preserves dates, names, phone numbers, prices, URLs, emojis, spacing, and line breaks.

### PUT /api/events/[slug]
Update full event data (title, capacity, deadline, questions, image, communityLink).  
**Auth:** Session ownership required  
**Body:** Partial event fields  
**Returns:** `{ success, event }`

### POST /api/events/[slug]/rename
Rename an event title.  
**Auth:** Session ownership required  
**Body:** `{ title: string }`  
**Returns:** `{ success, event }`

### DELETE /api/events/[slug]
Delete event and all registrations permanently.  
**Auth:** Session ownership required  
**Returns:** `{ success }`

### PATCH /api/events/[slug]/archive
Archive (or unarchive) an event.  
**Auth:** Session ownership required  
**Returns:** `{ success, archived: boolean }`

### POST /api/events/[slug]/duplicate
Duplicate an event with a new slug and dashboard token.  
**Auth:** Session ownership required  
**Plan:** Pro or Business  
**Returns:** `{ success, event: { slug, dashboardToken } }`

### PATCH /api/events/[slug]/capacity
Increase event capacity and auto-promote waitlisted users.  
**Auth:** Session ownership OR `?token=` dashboard token  
**Body:** `{ newCapacity: number }`  
**Returns:** `{ success, promoted, newConfirmedCount, newWaitlistCount }`

### GET /api/events/[slug]/settings
Get event settings for the settings tab editor.  
**Auth:** Session ownership  
**Returns:** `{ event: { description, eventDate, location, communityLink, deadline } }`

### GET /api/events/[slug]/analytics
Get analytics data (views, conversion, registrations by day/hour).  
**Auth:** Session ownership + Pro/Business plan or EventUnlock for 'analytics'  
**Returns:** `{ totalViews, conversionRate, registrationsByDay[], registrationsByHour[], waitlistConversionRate }`  
**Returns if locked:** `{ locked: true, cost, eventId }`

### GET /api/events/[slug]/insights
Get or generate AI insight cards.  
**Auth:** Session ownership + Pro/Business plan or EventUnlock for 'ai_insights'  
**Returns:** `{ cards[], generatedAt }` or `{ locked: true }`  
**AI provider:** Anthropic Claude (Sonnet)

### POST /api/events/[slug]/ask
Ask a natural language question about event data.  
**Auth:** Session ownership + Business plan or credits  
**Body:** `{ question: string }`  
**Returns:** `{ answer: string }`  
**AI provider:** Anthropic Claude (Sonnet)

### GET /api/events/[slug]/report
Download Word report (.docx) for an event.  
**Auth:** Session ownership OR `?token=` dashboard token  
**Modes:** `?mode=preview` for browser preview, `?mode=download` for file download  
**Billing check:** Preview and download are currently free for authorised organisers, assigned team members, and super admins while premium report billing is paused.  
**Returns:** Binary `.docx` file with branded cover page, clickable table of contents, analytics sections, attendee tables, and AI narrative content

### GET /api/events/[slug]/export
Download CSV of all confirmed registrations.  
**Auth:** Session ownership OR `?token=` dashboard token  
**Plan/credits check:** Pro/Business included; Free requires EventUnlock for 'csv'  
**Returns:** CSV file (UTF-8 BOM)  
**Returns if locked:** `{ upgradeRequired: true, cost, eventId }` (HTTP 402)

### GET /api/events/[slug]/feedback
Get attendee feedback for an event.  
**Auth:** Session ownership + Business plan  
**Returns:** `{ feedback[], averageRating, responseCount }`

### GET /api/events/[slug]/duplicates
Get duplicate registrations (same email submitted more than once).  
**Auth:** Session ownership  
**Returns:** `{ duplicates[] }`

### POST /api/events/[slug]/claim
Claim an event associated with a dashboard token.  
**Auth:** Required  
**Body:** `{ token }`  
**Returns:** `{ success }` or `{ error }`

### GET /api/events/suggest-capacity
AI capacity suggestion based on organizer's historical events.  
**Auth:** Required  
**Returns:** `{ suggestion: number, fillRate, eventCount, message }` or `{ suggestion: null }` if < 3 events

---

## Registration

### POST /api/register
Submit attendee registration(s).  
**Auth:** None  
**Rate limited:** 10 requests per IP per minute  
**Body:** `{ eventSlug, attendees: [{ answers[] }], consentTransactional, consentMarketing }`  
**Returns:** `{ success, results[], eventTitle }`  
**Logic:** Assigns confirmed or waitlist; triggers 80%/100% capacity notifications; flags duplicates; records EventView

### GET /api/registrations/[registrationId]
Get registration details.  
**Auth:** None (uses registration ID as token)  
**Returns:** `{ registration, event }`

### PATCH /api/registrations/[registrationId]
Edit registration answers (before event deadline).  
**Auth:** Dashboard token required (in header or query)  
**Body:** `{ answers }` — blocked for closed/archived events  
**Returns:** `{ success, registration }`

### DELETE /api/registrations/[registrationId]
Delete a registration.  
**Auth:** Dashboard token or session ownership  
**Returns:** `{ success }`

---

## Billing

### POST /api/billing/checkout
Initiate Paystack subscription checkout for a plan.  
**Auth:** Required  
**Body:** `{ planKey: "pro_monthly" | "pro_annual" | "business_monthly" | "business_annual" }`  
**Returns:** `{ url: string }` — Paystack checkout URL

### POST /api/billing/webhook
Handle Paystack webhook events.  
**Auth:** Paystack signature verification  
**Events handled:** subscription.create, charge.success, invoice.payment_failed, subscription.disable, subscription.not_renew  
**Note:** Updates user plan, planEndDate, sends failure notification

### POST /api/billing/cancel
Cancel the user's active Paystack subscription.  
**Auth:** Required  
**Returns:** `{ success }` — reverts plan to Free

### GET /api/billing/status
Get current subscription and credits status.  
**Auth:** Required  
**Returns:** `{ plan, billingCycle, planEndDate, creditBalance }`

### GET /api/billing/invoices
Fetch invoices from Paystack.  
**Auth:** Required  
**Returns:** `{ invoices[] }`

### GET /api/billing/transactions
Get last 20 credit transactions with running balance.  
**Auth:** Required  
**Returns:** `{ transactions[] }`

### POST /api/billing/portal
Get Paystack customer portal URL.  
**Auth:** Required  
**Returns:** `{ url: string }`

### POST /api/billing/credits
Initiate one-time credit top-up payment via Paystack.  
**Auth:** Required  
**Body:** `{ bundleId: "100" | "500" | "1000" }`  
**Returns:** `{ url: string }` — Paystack checkout URL

### POST /api/billing/verify
Verify Paystack redirect after credits payment and add credits.  
**Auth:** None (called by Paystack redirect)  
**Query:** `?reference=xxx`  
**Returns:** Redirect to `/dashboard/billing?credits=added`

### POST /api/billing/unlock
Unlock a specific feature for an event using credits.  
**Auth:** Required  
**Body:** `{ feature: string, eventId: string }`  
**Features:** analytics, watermark, csv, report, ai_report, thankYou  
**Returns:** `{ success, accessId, creditsRemaining }` or `{ insufficientCredits: true }` (HTTP 402)  
**Note:** Idempotent — re-hit within 30-day window returns existing unlock

---

## Dashboard

### GET /api/dashboard/stats
Get organizer dashboard statistics.  
**Auth:** Required  
**Returns:** `{ totalEvents, totalRegistrations, activeEvents, totalWaitlisted, eventsNearCapacity[], recentActivity[], upcomingEvents[], eventsThisMonth, registrationsThisMonth }`

---

## Notifications

### GET /api/notifications
Get all notifications for current user.  
**Auth:** Required  
**Query:** `?unreadCount=true` to get only the count  
**Returns:** `{ notifications[] }` or `{ count: number }`

### PATCH /api/notifications/read
Mark all notifications as read.  
**Auth:** Required  
**Returns:** `{ success }`

### PATCH /api/notifications/[id]/read
Mark a single notification as read.  
**Auth:** Required  
**Returns:** `{ success }`

---

## Team

### POST /api/team/invite
Invite a team member by email.  
**Auth:** Required  
**Plan:** Pro (10 members) or Business (20 members)  
**Body:** `{ email: string }`  
**Returns:** `{ success, member }` — sends invite email with token

### PATCH /api/team/[memberId]
Update a team member (promote, update role).  
**Auth:** Required (owner only)  
**Returns:** `{ success }`

### DELETE /api/team/[memberId]
Remove a team member.  
**Auth:** Required (owner only)  
**Returns:** `{ success }`

### GET /api/team/members
List team members for the current owner.  
**Auth:** Required  
**Returns:** `{ members[] }`

### POST /api/team/resend
Resend a team invite email.  
**Auth:** Required  
**Body:** `{ memberId }`  
**Returns:** `{ success }`

### GET /api/team/accept
Accept a team invite using the token from email.  
**Auth:** None (token in query)  
**Query:** `?token=xxx`  
**Returns:** Redirect to /dashboard or error page

---

## Feedback

### POST /api/feedback
Submit attendee post-event feedback.  
**Auth:** None (identified by registrationId)  
**Body:** `{ registrationId, rating, enjoyed?, improve?, complaint? }`  
**Returns:** `{ success }` or `{ error: "already submitted" }`

### POST /api/feedback/organizer
Submit organizer feedback about EventSlot.  
**Auth:** Required  
**Body:** `{ eventId?, rating, message }`  
**Returns:** `{ success }` — creates OrganizerFeedback + Message record

---

## Insights

### GET /api/insights
Get cross-event Insight Tracker data.  
**Auth:** Required + Business plan  
**Returns:** `{ totalEventsAnalysed, totalRespondents, questionInsights[], registrationsByDayOfWeek[], registrationsByMonth[], repeatAttendees }`

---

## Upload

### POST /api/upload
Upload an image to Cloudflare R2.  
**Auth:** Required  
**Body:** FormData with `file`  
**Returns:** `{ url }` — public R2 URL

### POST /api/register/upload
Upload an attendee file answer to Cloudflare R2 before form submission.  
**Auth:** None  
**Body:** FormData with `eventSlug`, `questionId`, and `file`  
**Allowed:** JPEG, PNG, WebP, GIF, PDF, Word, Excel, and text files up to 10 MB  
**Returns:** `{ success, file: { name, type, size, url } }`

---

## OG Image

### GET /api/og
Generate a dynamic OpenGraph image for an event.  
**Auth:** None  
**Query:** `?title=xxx&slug=xxx`  
**Returns:** PNG image

---

## Admin (SUPER_ADMIN_EMAIL Only)

All admin routes check `session.user.email === process.env.SUPER_ADMIN_EMAIL`. Non-admin users receive 404.

### GET /api/admin/stats
Platform-wide statistics.  
**Returns:** `{ totalUsers, totalEvents, totalRegistrations, recentSignups[], planBreakdown }`

### GET /api/admin/users
All users with plan and usage data.  
**Returns:** `{ users[] }`

### GET /api/admin/users/[id]
Get a specific user with their events.  
**Returns:** `{ user, events[] }`

### PATCH /api/admin/users/[id]
Change user plan, suspend, or unsuspend.  
**Body:** `{ plan?, suspended? }`  
**Returns:** `{ success, user }`

### DELETE /api/admin/users/[id]
Delete a user and all their data permanently.  
**Returns:** `{ success }`

### GET /api/admin/events
All platform events.  
**Returns:** `{ events[] }`

### DELETE /api/admin/events
Delete a specific event.  
**Body:** `{ eventId }`  
**Returns:** `{ success }`

### GET /api/admin/messages
All organizer and attendee feedback messages.  
**Returns:** `{ messages[] }`

### PATCH /api/admin/messages
Archive or unarchive a message.  
**Body:** `{ messageId, archived }`  
**Returns:** `{ success }`

### GET /api/admin/health
System health check (DB, Redis, Auth).  
**Returns:** `{ db: "ok"|"error", redis: "ok"|"error", auth: "ok"|"error" }`

### GET /api/admin/launch-checklist
Deployment readiness check.  
**Returns:** `{ checks[] }` — env vars, DB connection, Redis, admin account, auth

### POST /api/admin/broadcast
Broadcast an email to all platform users.  
**Body:** `{ subject, body, filter? }`  
**Returns:** `{ success, sent: number }`

### GET /api/admin/broadcast/count
Count eligible broadcast recipients.  
**Returns:** `{ count: number }`

---

## Cron Jobs (Internal — CRON_SECRET Required)

All cron routes require `Authorization: Bearer {CRON_SECRET}` header. Configured in `vercel.json`.

### GET /api/cron/send-feedback
Sends feedback request emails after events end.  
**Schedule:** 9AM daily  
**Logic:** Finds Business-plan events where deadline passed and feedbackSent=false, sends email to each consenting confirmed attendee, marks feedbackSent=true

### GET /api/cron/expire-data
Deletes registration data for expired Free-plan events.  
**Schedule:** 2AM daily  
**Logic:** Finds Free-plan events where deadline was 30+ days ago and dataExpired=false, sends expiry warning at 10 days, deletes registrations at 30 days, marks dataExpired=true

---

## Error Responses

All API routes return structured JSON on error:

```json
{ "error": "Human-readable message" }
```

Common HTTP status codes used:
- `400` — Invalid input
- `401` — Not authenticated
- `402` — Insufficient credits (feature unlock required)
- `403` — Forbidden (plan restriction)
- `404` — Resource not found
- `429` — Rate limit exceeded
- `500` — Internal server error (logged to ErrorLog)
