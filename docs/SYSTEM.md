# EventSlot — System Documentation

_Last updated: April 15, 2026_
_Version: 0.4.0_
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
- Pricing: https://www.eventsslot.com/pricing
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
| AI            | Anthropic Claude API (Sonnet)       |
| Rate Limiting | Upstash Redis                       |
| Hosting       | Vercel                              |
| PWA           | next-pwa                            |

---

## User Roles

### Attendee
- No account required
- Opens registration link, fills form, submits
- Receives confirmed or waitlist status
- Notified by email if promoted from waitlist
- Can submit post-event feedback (Business plan events only)

### Organizer
- Creates account (Google OAuth or email/password)
- Requires username setup on first sign-in
- Public profile page at `/[username]` showing their active events
- Creates events, manages registrations, views analytics
- Can be on Free, Pro, or Business plan
- Can purchase credits for pay-as-you-go feature access
- Can invite team members (plan dependent)

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

## Plan Tiers

### Free — KSH 0/month
- 1 active event at a time
- 100 free registrations per event
- Unlimited waitlist
- Unlimited form questions
- Data deleted 30 days after event ends
- 1 team member
- EventSlot watermark on event pages
- Standard Word report (pay-as-you-go unlock required)
- Analytics pay-as-you-go (150 credits)
- CSV export pay-as-you-go (15 credits base)

### Pro — KSH 2,600/month or KSH 25,000/year
- Unlimited active events
- 500 free registrations per event
- Data stored forever
- Export attendees CSV (included)
- Word report (included)
- Event analytics (included)
- AI insight cards
- Duplicate events
- 10 team members
- Bulk registration up to 20
- Remove EventSlot watermark (included)
- Intelligent capacity suggestions

### Business — KSH 13,000/month or KSH 125,000/year
- Everything in Pro
- Unlimited registrations per event
- 20 team members
- Attendee feedback forms
- Event Insights Tracker (cross-event demographics)
- Natural language analytics Q&A
- No pay-as-you-go costs (all features included at no extra cost)

### Credits — Pay As You Go
- Bundles: 100 credits = KSH 1,000 | 500 credits = KSH 4,500 | 1,000 credits = KSH 8,000
- Standard report: Free
- AI report (AI version): 50 credits per event
- Event analytics: 10 credits per event
- AI insight cards: 20 credits per event
- Analytics Q&A: 60 credits per query
- CSV export: 15 credits base + (confirmedCount / 100) × cost
- Remove watermark: 10 credits per event
- Custom thank you: 10 credits per event
- Duplicate event: 5 credits per event
- Team members: 10 credits per member/month
- Insight Tracker: 50 credits
- Feedback forms: 30 credits
- Predictive capacity: 25 credits
- Access records last 30 days per feature per event (EventUnlock)

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
| ANTHROPIC_API_KEY               | AI insight cards and analytics Q&A    |
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
| /api/cron/send-feedback   | 9AM daily   | Send feedback emails after Business events end|
| /api/cron/expire-data     | 2AM daily   | Delete free user registration data after 30d  |

---

## Key Business Rules

1. Waitlist is always unlimited regardless of plan
2. Confirmed count never exceeds capacity
3. Capacity can only be increased via the dashboard
4. Data expiry runs 30 days after event DEADLINE, not creation date
5. Credits are non-refundable once spent
6. EventUnlock records last 30 days from purchase per feature per event
7. Super admin access returns 404 to all non-admin users
8. Transactional emails require consentTransactional = true
9. Marketing emails require consentMarketing = true
10. Team members access the owner's events, not their own
11. Organizer must set a username before accessing the dashboard
12. QR code and checkedIn fields exist on Registration (check-in feature stubbed)
