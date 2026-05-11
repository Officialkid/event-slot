# EventSlot — System Documentation

> Canonical source: `docs/EVENTSLOT_SYSTEM_DOCUMENTATION.md`
> 
> This file remains as a supporting summary. Update the canonical document first when product, schema, API, pricing, or infrastructure behavior changes.

_Last updated: May 4, 2026_
_Version: 0.4.20_
_Status: Pre-launch_

---

## What Is EventSlot

EventSlot is a smart event registration platform that allows organizers
to create events with fixed capacity, share a registration link, and
automatically manage overflow via a waitlist system.

When slots fill up, additional registrations join a waitlist automatically.
When the organizer increases capacity, waitlisted attendees are promoted
to confirmed status and notified by email.

---

## Live URLs

- Production: https://www.eventsslot.com
- Admin panel: https://www.eventsslot.com/admin
- Downloads: https://www.eventsslot.com/dashboard/billing
- Documentation: internal /docs folder

---

## Tech Stack

| Layer         | Technology                          |
|---------------|-------------------------------------|
| Framework     | Next.js 14 (App Router)             |
| Language      | TypeScript                          |
| Styling       | Tailwind CSS + CSS variables        |
| Database      | Neon (PostgreSQL)                   |
| ORM           | Prisma                              |
| Auth          | NextAuth.js (Google OAuth + Email)  |
| Email         | Resend                              |
| Payments      | Paystack                            |
| File Storage  | Cloudflare R2 (event/profile images)|
| AI            | Groq + OpenRouter + Claude fallback |
| Rate Limiting | Upstash Redis                       |
| Hosting       | Google Cloud Run                    |
| PWA           | next-pwa                            |

---

## User Roles

### Attendee
- No account required
- Opens registration link, fills form, submits
- Receives confirmed or waitlist status
- Notified by email if promoted from waitlist
- Can submit post-event feedback

### Organizer
- Creates account (Google OAuth or email/password)
- Requires username setup on first sign-in
- Public profile page at `/[username]` showing their active events
- Creates events, manages registrations, views analytics
- Can invite team members (up to platform safety cap)

### Team Member
- Invited by organizer via email
- Accepts invite via token link
- Can view and manage the owner's events
- Cannot create their own events or manage billing

### Super Admin
- Single account: danielmwaliliofficial@gmail.com
- Full platform visibility
- Can change user plans, suspend accounts, delete content
- Sees all messages, feedback, platform health, revenue stats
- Access via /admin (returns 404 to all other users)

---

## Access Model

### Core Product Access
- All features are free.
- There are no subscription plan gates for event creation, analytics, insights, tracker, feedback, CSV export, duplicate event, or team collaboration.

### Report Download Pricing
- Report generation and in-browser preview are free.
- Report file download pricing:
	- KSh 100 single download
	- KSh 300 bundle of 3
	- KSh 500 bundle of 6
	- KSh 1,000 bundle of 15

### AI Provider Order
- Groq (primary)
- OpenRouter (fallback)
- Claude (reports only)

---

## Database Models

| Model               | Purpose                                            |
|---------------------|----------------------------------------------------|
| User                | Organizer accounts, plan, credits, username        |
| Account             | OAuth provider links (NextAuth)                    |
| Session             | Active sessions (NextAuth)                         |
| VerificationToken   | Email verification (NextAuth)                      |
| Event               | Event data, capacity, questions, status, imageUrl  |
| Registration        | Registrations, status, answers, QR code, checkedIn |
| EventView           | Page view tracking for analytics                   |
| EventInsight        | Cached AI insight cards per event                  |
| Notification        | In-app notifications for organizers                |
| TeamMember          | Team invite records with token-based acceptance    |
| CreditTransaction   | Credits purchase and spend ledger                  |
| EventUnlock         | Per-event PAYG feature unlock records (30-day)     |
| FeatureAccess       | Alternative credit-unlock records                  |
| AttendeeFeedback    | Post-event star ratings and comments (Business)    |
| OrganizerFeedback   | Organizer-to-EventSlot satisfaction feedback       |
| Message             | Inbox messages from organizers and attendees       |
| ErrorLog            | API error tracking for admin health view           |

---

## Environment Variables Required

| Variable                        | Purpose                               |
|---------------------------------|---------------------------------------|
| DATABASE_URL                    | Neon PostgreSQL connection            |
| NEXTAUTH_URL                    | Production base URL                   |
| NEXTAUTH_SECRET                 | JWT signing secret                    |
| GOOGLE_CLIENT_ID                | Google OAuth                          |
| GOOGLE_CLIENT_SECRET            | Google OAuth                          |
| RESEND_API_KEY                  | Email sending                         |
| RESEND_FROM                     | Sender email address                  |
| PAYSTACK_SECRET_KEY             | Payment processing                    |
| PAYSTACK_PRO_MONTHLY_PLAN_CODE  | Paystack plan code                    |
| PAYSTACK_PRO_ANNUAL_PLAN_CODE   | Paystack plan code                    |
| PAYSTACK_BUSINESS_MONTHLY_PLAN_CODE | Paystack plan code                |
| PAYSTACK_BUSINESS_ANNUAL_PLAN_CODE  | Paystack plan code                |
| UPSTASH_REDIS_REST_URL          | Rate limiting                         |
| UPSTASH_REDIS_REST_TOKEN        | Rate limiting                         |
| GROQ_API_KEY                    | Primary AI provider                   |
| OPENROUTER_API_KEY              | AI fallback provider                  |
| ANTHROPIC_API_KEY               | Claude provider (reports only)        |
| CRON_SECRET                     | Protect cron job endpoints            |
| SUPER_ADMIN_EMAIL               | Admin panel access control            |
| R2_ACCOUNT_ID                   | Cloudflare R2 file storage            |
| R2_ACCESS_KEY_ID                | Cloudflare R2 file storage            |
| R2_SECRET_ACCESS_KEY            | Cloudflare R2 file storage            |
| R2_BUCKET_NAME                  | Cloudflare R2 file storage            |
| R2_PUBLIC_URL                   | Cloudflare R2 public URL prefix       |

---

## Cron Jobs

| Job                       | Schedule    | Purpose                                       |
|---------------------------|-------------|-----------------------------------------------|
| /api/cron/send-feedback   | 9AM daily   | Process feedback workflow for completed events |
| /api/cron/expire-data     | 2AM daily   | Delete free user registration data after 30d  |

---

## Key Business Rules

1. Waitlist is always unlimited
2. Confirmed count never exceeds capacity
3. Capacity can only be increased via the dashboard
4. Data expiry runs 30 days after event DEADLINE, not creation date
5. Report-download purchases are non-refundable once consumed
6. Paid usage is limited to report file downloads
7. Super admin access returns 404 to all non-admin users
8. Transactional emails require consentTransactional = true
9. Marketing emails require consentMarketing = true
10. Team members access the owner's events, not their own
11. Organizer must set a username before accessing the dashboard
12. QR code and checkedIn fields exist on Registration (check-in feature stubbed)
