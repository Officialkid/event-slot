# EventSlot — Feature Reference

_Last updated: April 13, 2026_

---

## Registration System

### Event Creation
**Where:** /create  
**Who:** Any signed-in organizer (username required)  
**What it does:** Two-step flow — organizer picks a template first (6 options:
Community Meetup, Corporate Training, Workshop, Conference, Church/Faith,
Blank), which pre-fills the question set. Then fills title, description,
capacity, deadline, event date, location, community link, cover image,
and custom form questions. Capacity suggestion shown on first focus if
organizer has 3+ completed past events.  
**API:** POST /api/events

### Confirm My Attendance (Self-Lookup)
**Where:** /[eventSlug] — "Already Registered?" panel beside the registration form  
**Who:** Anyone (no account needed)  
**What it does:** Attendees enter their email to look up their registration for the event. On confirmed match, shows an inline `ConfirmationTicket` card with a PDF download button. If waitlisted, shows their position. If not found, shows an error message.  
**API:** POST /api/attendance/confirm  
**Rate limit:** 5 lookups per IP per 10 minutes (Upstash Redis)

### Confirmation Ticket Card
**Where:** /register/success/[confirmationCode] (post-registration redirect) and inline in the self-lookup panel  
**Who:** Anyone with the confirmation code link (no account needed)  
**What it does:** Shows a styled ticket card with event details, attendee info, and a QR code. QR encodes `/verify/[confirmationCode]` for door check-in scanning. Supports one-click PDF download via html2canvas + jspdf.  
**Component:** `components/tickets/ConfirmationTicket.tsx`

### Attendee Registration
**Where:** /[eventSlug]  
**Who:** Anyone with the link (no account needed)  
**What it does:** Shows event details and a dynamic form built from the
organizer's custom questions. On submit, assigns confirmed or waitlist
status based on current capacity. Supports bulk registration. Event views
tracked automatically. Duplicate detection flags re-registrations from
the same email.  
**API:** POST /api/register  
**Rate limit:** 10 requests per IP per minute (Upstash Redis)

### Waitlist Promotion
**Where:** Organizer dashboard → Overview tab → Increase capacity  
**Who:** Organizer or team member  
**What it does:** When capacity is increased, the system automatically
promotes waitlisted registrations in FIFO order. Promoted attendees
receive an email notification if they consented to transactional emails.  
**API:** PATCH /api/events/[slug]/capacity

### Registration Status Page
**Where:** /registration/[registrationId]  
**Who:** Attendee (link provided after registration)  
**What it does:** Shows confirmed status or waitlist position. Editable
draft mode supported.  
**API:** GET /api/registrations/[registrationId], PATCH /api/registrations/[registrationId]

### Bulk Registration
**Where:** /[eventSlug]  
**What it does:** Attendee can add multiple people in one form submission.
Each gets their own registration record.  
**Limits:** Free: 3, Pro: 20, Business: unlimited

---

## Organizer Dashboard

### Dashboard Home
**Where:** /dashboard  
**What it does:** Stat cards (total events, registrations, active events,
waitlist count) with monthly delta indicators. Needs Attention section
(events near capacity or approaching deadline — filtered to active events
only). Recent activity feed. Upcoming events list. Plan badge with
upgrade CTA. Quick actions grid.

### My Events
**Where:** /dashboard/events  
**Tabs:** Active | Past | Archived  
**Three-dot menu per event:** Rename, Duplicate (Pro+), Archive, Delete

### Individual Event Dashboard
**Where:** /dashboard/events/[slug]  
**Tabs:**
- **Overview** — Stats, capacity management, Export CSV panel
- **Confirmed** — Table of confirmed registrations with answers
- **Waitlist** — Table with position numbers
- **Analytics** — Charts, insight cards, Q&A (plan/credits gated)
- **Settings** — Edit event description, date, location, deadline
- **Feedback** — Attendee feedback inbox (Business plan only)

### Notifications
**Where:** /dashboard/notifications  
**Triggers:**
- Event reaches 80% capacity → notification created
- Event reaches 100% capacity → notification created
- Waitlist attendees promoted → notification created
- Payment failure → notification created
- Data expiry warning (10 days before Free plan deletion)
- Organizer feedback request appears after event ends

### Profile
**Where:** /dashboard/profile  
**Features:** Edit name, profile photo (uploaded to Cloudflare R2),
change password (email/password users only), delete account

### Billing
**Where:** /dashboard/billing  
**Features:**
- Current plan card (badge, billing cycle, renewal date, cancel subscription button)
- Live credits balance from /api/billing/status
- Buy credits: 3 bundles (100 credits / 500 credits / 1,000 credits)
- Collapsible PAYG pricing reference table
- Upgrade section with monthly/annual toggle (hidden for Business users)
- Credit transaction history (last 20 with running balance)
**Provider:** Paystack

### Team Members
**Where:** /dashboard/team  
**Features:** Invite by email (token link sent via Resend), accept at
/team/accept, resend invite, remove members  
**Limits:** Free: 1, Pro: 10, Business: 20

### Insights Tracker
**Where:** /dashboard/insights  
**Tier:** Business only  
**What it does:** Cross-event audience analytics. Aggregates form answers
across all events to surface demographic patterns, peak registration days,
repeat attendees, and location trends.  
**API:** GET /api/insights

---

## AI Features

### AI Event Report
**Tier:** Pro/Business (included), Free (standard Word report free, 50 credits AI version)  
**Where:** /dashboard/events/[slug] → Download Report  
**What it does:** Generates a Word document (.docx). Standard report
contains attendee data tables. AI version adds Claude-written narrative:
executive summary, audience profile, registration behaviour, waitlist
analysis, recommendations.  
**API:** GET /api/events/[slug]/report

### AI Insight Cards
**Tier:** Pro/Business (included), or 20 credits  
**Where:** /dashboard/events/[slug] → Analytics tab  
**What it does:** Generates 3 personalised insight cards using Claude and
actual event data. Cached per event. Can be regenerated.  
**API:** GET /api/events/[slug]/insights

### Natural Language Q&A
**Tier:** Business (included), or 60 credits per query  
**Where:** /dashboard/events/[slug] → Analytics tab  
**What it does:** Chat interface for asking questions about event data.
Claude answers using real registration and analytics data.  
**API:** POST /api/events/[slug]/ask

### Intelligent Capacity Suggestions
**Tier:** All plans (requires 3+ completed past events)  
**Where:** /create → capacity field (on first focus)  
**What it does:** Analyses last 5 completed events, calculates average
confirmed count × 1.2 buffer, returns suggested capacity with message
adapted to fill rate (≥85%, 50–84%, <50%).  
**API:** GET /api/events/suggest-capacity

---

## Post-Event Features

### Feedback Form
**Tier:** Business plan events only  
**Where:** /feedback/[registrationId]  
**Trigger:** Auto-sent via cron to consenting confirmed attendees  
**What it does:** Star rating plus three open text fields (enjoyed, improve,
complaint). Responses visible in Organizer Dashboard Feedback tab.  
**API:** POST /api/feedback, GET /api/events/[slug]/feedback

### Event Report Download
**Tier:** All plans (Standard Word doc free on all plans),
Pro/Business included for AI report  
**Format:** Word document (.docx). Cover page, summary stats, confirmed
table, waitlist table, AI narrative (if AI version unlocked).  
**API:** GET /api/events/[slug]/report

### CSV Export
**Tier:** Pro/Business (included), Free (15 credits base + per 100
registrations)  
**Where:** /dashboard/events/[slug] → Overview tab  
**Format:** UTF-8 BOM CSV with dynamic question headers, Status,
Registered At columns  
**API:** GET /api/events/[slug]/export

---

## Payments

### Subscriptions
**Provider:** Paystack (recurring subscription)  
**Plans:** Pro monthly (KSH 2,600), Pro annual (KSH 25,000),
Business monthly (KSH 13,000), Business annual (KSH 125,000)  
**Webhook events handled:** subscription.create, charge.success,
invoice.payment_failed, subscription.disable, subscription.not_renew  
**API:** POST /api/billing/checkout, POST /api/billing/webhook,
POST /api/billing/cancel

### Credits (Pay As You Go)
**Provider:** Paystack (one-time payment)  
**Bundles:** 100 credits = KSH 1,000 | 500 credits = KSH 4,500 |
1,000 credits = KSH 8,000  
**Credit Costs:**
- Standard report: Free
- AI-enhanced report: 50 credits
- Event analytics: 10 credits
- AI insight cards: 20 credits
- Analytics Q&A: 60 credits per query
- CSV export: 15 credits base + (confirmedCount / 100) × cost
- Remove watermark: 10 credits
- Custom thank you: 10 credits
- Duplicate event: 5 credits
- Team members: 10 credits per member/month
- Insight Tracker: 50 credits
- Feedback forms: 30 credits
- Predictive capacity: 25 credits  
**API:** POST /api/billing/credits, POST /api/billing/verify

### Feature Unlock (EventUnlock)
**What it does:** Spending credits creates an EventUnlock record for a
specific feature + event combination. Valid 30 days.  
**Features:** analytics, watermark, csv, report, ai_report, thankYou  
**API:** POST /api/billing/unlock

---

## Auth & Accounts

### Google OAuth
**Provider:** NextAuth.js + Google OAuth  
**Flow:** Sign in → account linked or created → username setup (if new)
→ redirect to /dashboard

### Email/Password
**Flow:** /signup → bcrypt 12 rounds → /signin  
**Forgot password:** /forgot-password → SHA-256 hashed UUID token (1h
expiry) → email link → /reset-password → new bcrypt hash stored

### Username Setup
**Where:** /setup-username (required before accessing dashboard)  
**Rules:** 3–20 chars, alphanumeric + hyphens, reserved words blocked  
**API:** PATCH /api/users/username, GET /api/users/check-username

---

## Public Pages

### Organizer Public Profile
**Where:** /[username]  
**What it does:** Server-rendered profile showing organizer's upcoming
active events with slot-fill progress bars and Register CTAs. SEO
metadata generated. Follow button present (disabled, coming soon).

### Landing Page
**Where:** /  
**Contents:** Hero section, features grid, testimonials, pricing CTA, footer.
PWA splash header shown on /signin in standalone mode.

### Pricing Page
**Where:** /pricing  
**Contents:** Plan cards, monthly/annual toggle, feature comparison table,
credit bundle cards, FAQ accordion.

---

## PWA

**Manifest:** /public/manifest.json  
**Start URL:** /signin  
**Theme:** Dark (#0A0A0A)  
**Purpose:** Quick dashboard access on mobile  
**Supported:** Android Chrome (Add to Home Screen), iOS Safari

---

## Super Admin Panel

**Access:** /admin (returns 404 to all non-admin users)  
**Auth:** SUPER_ADMIN_EMAIL env var match required  
**Pages:**
- /admin → Platform overview stats
- /admin/users → All users, plan management, suspend/delete
- /admin/events → All platform events with action controls
- /admin/messages → Organizer feedback inbox
- /admin/health → System health (DB, Redis, Auth status)
- /admin/broadcast → Email broadcast to all platform users
- /admin/launch → Launch checklist (env vars, DB, Redis, admin)

---

## Cron Jobs

| Endpoint                 | Schedule  | Auth        | Action                                    |
|--------------------------|-----------|-------------|-------------------------------------------|
| /api/cron/send-feedback  | 9AM daily | CRON_SECRET | Send feedback emails for ended events     |
| /api/cron/expire-data    | 2AM daily | CRON_SECRET | Delete Free plan registrations after 30d  |

---

## Email Templates (Resend)

All emails use dark-themed HTML with lime CTA buttons:
- **Welcome email** — sent after new account signup
- **Password reset** — token link, 1-hour expiry, SHA-256 secured
- **Slot confirmed** — sent when attendee is registered as confirmed
- **Waitlist notification** — sent when attendee is promoted from waitlist
- **Team invite** — invite link with acceptance token
- **Feedback request** — post-event link to /feedback/[registrationId]
- **Data expiry warning** — Free plan deletion notice (10-day heads up)
- **Payment failure** — subscription charge failed notification

---

## Feature Access Matrix

| Feature | Free | Pro | Business | Credits |
|---------|------|-----|----------|---------|
| Active events | 1 | Unlimited | Unlimited | — |
| Registrations per event | 100 | 500 | Unlimited | — |
| Waitlist | ✓ | ✓ | ✓ | — |
| Custom form questions | ✓ | ✓ | ✓ | — |
| Bulk registration | 3 max | 20 max | Unlimited | — |
| Team members | 1 | 10 | 20 | — |
| Data retention | 30 days | Forever | Forever | — |
| EventSlot watermark | Yes | No | No | 10 credits to remove |
| CSV export | — | ✓ | ✓ | 15 credits base |
| Standard report (Word doc) | ✓ | ✓ | ✓ | Free |
| AI report | — | ✓ | ✓ | 50 credits |
| Event analytics | — | ✓ | ✓ | 10 credits |
| AI insight cards | — | ✓ | ✓ | 20 credits |
| Duplicate events | — | ✓ | ✓ | 5 credits |
| Custom thank you | — | ✓ | ✓ | 10 credits |
| Team members | — | ✓ | ✓ | 10 credits/member |
| Ask your data (Q&A) | — | — | ✓ | 60 credits/query |
| Attendee feedback forms | — | — | ✓ | 30 credits |
| Insights Tracker | — | — | ✓ | 50 credits |
| Predictive capacity | — | ✓ | ✓ | 25 credits |
| PAYG costs | Yes | Yes | No | — |

---

## DEPRECATED / REMOVED

_The following table captures old content removed from FEATURES.md:_

| Feature | Description | Plan | Route / Page |
|---------|-------------|------|--------------|
| Event creation | Organizers create events with title, description, capacity, deadline, custom questions | All | `POST /api/events` / `/create` |
| Event registration | Attendees register via shareable link, answers custom questions | All | `POST /api/register` / `/[eventSlug]` |
| Auto waitlist | When event is at capacity, new registrations go to a numbered waitlist | All | `POST /api/register` |
| Waitlist promotion | When capacity increases, waitlisted attendees are confirmed and notified by email | All | `PATCH /api/events/[slug]/capacity` |
| Organizer dashboard | Overview of events, registrations, stats | All | `/dashboard` |
| Event management | View registrations, manage capacity, archive/close events | All | `/dashboard/[slug]` |
| Event editing | Edit event title, description, capacity, deadline, questions | All | `PATCH /api/events/[slug]` / `/edit/[slug]` |
| Event archiving | Archive completed events | All | `PATCH /api/events/[slug]/archive` |
| Registration confirmation | Attendees see a confirmation page with their registration details | All | `/registration/[registrationId]` |
| Registration editing | Attendees can edit their registration answers | All | `/registration/[registrationId]/edit` |
| Notifications | In-app notifications for organizers (slot confirmed, data expiry, etc.) | All | `GET /api/notifications` / `/dashboard/notifications` |
| User profile | Update name, email, profile photo, password | All | `GET/PATCH /api/profile` / `/dashboard/profile` |
| Duplicate detection | Flags registrations from the same email | All | `GET /api/events/[slug]/duplicates` |
| Event image upload | Upload a cover image for events (stored in R2) | All | `POST /api/upload` |
| Event views tracking | Tracks how many times an event page is viewed | All | Auto-tracked in event registration page |
| OG image generation | Dynamic OpenGraph images for event pages | All | `GET /api/og` |
| Pay-as-you-go credits | Buy credits to unlock premium features one event at a time | Free, Pro | `/dashboard/billing` |
| Registration overage | $1/100 registrations above free threshold, charged in credits | Free, Pro | `POST /api/register` |
| CSV export | Export confirmed registrations as CSV with BOM encoding; Free plan requires one-time credit unlock via EventUnlock | Pro+ / PAYG | `GET /api/events/[slug]/export` |
| Word report | Download registration report as Word doc (PAYG on Free, included on Pro/Business) | Pro+ / PAYG | `GET /api/events/[slug]/report` |
| Analytics | View event analytics: views, conversion rate, registration trends | Pro+ / PAYG | `GET /api/events/[slug]/analytics` / `/dashboard/[slug]` |
| Watermark removal | Remove EventSlot branding from event pages (PAYG on Free) | Pro+ / PAYG | `POST /api/billing/unlock` |
| Event duplication | Duplicate an existing event with all settings | Pro+ | `POST /api/events/[slug]/duplicate` |
| Team members | Invite co-managers who can manage events on behalf of the organizer | Pro (10), Business (20) | `POST /api/team/invite` / `/dashboard/team` |
| Email reminders | Automated email reminders to registered attendees | Pro+ | via Resend |
| Event insights tracker | Cross-event analytics and insights | Business | `GET /api/insights` / `/dashboard/insights` |
| Attendee feedback forms | Automatically sends feedback request emails after events | Business | `GET /api/cron/send-feedback` |
| Custom thank you page | Custom post-registration thank you (PAYG) | Business / PAYG | `POST /api/billing/unlock` |
| Subscription billing | Monthly or annual Pro/Business plan via Paystack | Pro, Business | `POST /api/billing/checkout` / `/dashboard/billing` |
| Billing management | View plan status, buy credits, cancel subscription, view transaction history | All | `/dashboard/billing` |
| Data expiry (Free) | Free-plan event registrations auto-deleted 30 days after event deadline | Free | `GET /api/cron/expire-data` |
| Organizer public profile | Public profile page at `/[username]` showing organizer's active events grid, slot bars, register CTA | All | `/[username]` |
| Username setup | Onboarding page to choose a unique organizer username; required before accessing dashboard | All | `/setup-username` |
| Event creation templates | 6 pre-built templates (meetup, corporate, workshop, conference, church, blank) pre-fill registration questions on event creation | All | `/create` |
| Intelligent capacity suggestions | After 3+ completed events, the create form suggests a capacity based on historical fill rate and confirmed attendance | All | `/create` |
| Welcome email | New organizer accounts receive a branded onboarding email after signup | All | auto |
| Forgot / reset password | Full password reset flow: email link with 1-hour expiry, SHA-256 hashed token, bcrypt 12 on update | All | `/forgot-password`, `/reset-password` |
| Admin panel | Super admin view of all users, events, messages, system health | Admin | `/admin` |

---

## API Endpoints

| Method | Path | Auth | Plan | Description |
|--------|------|------|------|-------------|
| POST | `/api/auth/signup` | No | Any | Email/password user signup |
| GET, POST | `/api/auth/[...nextauth]` | No | Any | NextAuth authentication (Google OAuth, credentials) |
| GET | `/api/me` | Yes | Any | Get current user profile + credit balance |
| GET, PATCH | `/api/profile` | Yes | Any | Get/update user profile |
| POST | `/api/profile/photo` | Yes | Any | Upload profile photo |
| PATCH | `/api/profile/password` | Yes | Any | Update password |
| POST | `/api/events` | Yes | Any | Create a new event |
| GET | `/api/events` | Yes | Any | List organizer's events |
| GET | `/api/events/[slug]` | Yes | Any | Get event details |
| PATCH | `/api/events/[slug]` | Yes | Any | Update event details |
| PATCH | `/api/events/[slug]/settings` | Yes | Any | Update event settings |
| PATCH | `/api/events/[slug]/archive` | Yes | Any | Archive an event |
| PATCH | `/api/events/[slug]/close` | Yes | Any | Close/cancel an event |
| PATCH | `/api/events/[slug]/capacity` | Yes | Any | Update capacity (triggers waitlist promotion) |
| PATCH | `/api/events/[slug]/rename` | Yes | Any | Rename event |
| GET | `/api/events/[slug]/report` | Yes | Pro+ / PAYG | Download CSV or Word report |
| GET | `/api/events/[slug]/analytics` | Yes | Pro+ / PAYG | Get event analytics |
| GET | `/api/events/[slug]/feedback` | Yes | Business | Get attendee feedback for event |
| GET | `/api/events/[slug]/edit` | Yes | Any | Get event data for editing |
| GET | `/api/events/[slug]/duplicates` | Yes | Any | List duplicate registrations |
| POST | `/api/events/[slug]/duplicate` | Yes | Pro+ | Duplicate an event |
| POST | `/api/events/[slug]/claim` | No | Any | Claim event ownership with dashboard token |
| POST | `/api/register` | No | Any | Register attendee for an event |
| GET | `/api/registrations/[registrationId]` | No | Any | Get registration details |
| GET | `/api/my-events` | Yes | Any | Get organizer's events (with status filters) |
| GET | `/api/dashboard/stats` | Yes | Any | Get dashboard statistics |
| GET | `/api/insights` | Yes | Business | Get cross-event insights |
| GET | `/api/notifications` | Yes | Any | List user notifications |
| PATCH | `/api/notifications/[id]/read` | Yes | Any | Mark single notification as read |
| PATCH | `/api/notifications/read` | Yes | Any | Mark all notifications as read |
| POST | `/api/upload` | Yes | Any | Upload image to R2 object storage |
| POST | `/api/team/invite` | Yes | Pro+ | Send team member invitation email |
| GET | `/api/team/members` | Yes | Pro+ | List team members |
| POST | `/api/team/resend` | Yes | Pro+ | Resend team invitation |
| DELETE | `/api/team/[memberId]` | Yes | Pro+ | Remove team member |
| POST | `/api/billing/checkout` | Yes | Any | Initiate Paystack subscription checkout |
| POST | `/api/billing/credits` | Yes | Any | Initiate credit top-up via Paystack |
| POST | `/api/billing/unlock` | Yes | Any | Unlock a feature for an event using credits |
| POST | `/api/billing/cancel` | Yes | Pro+ | Cancel active subscription |
| GET | `/api/billing/status` | Yes | Any | Get billing status (plan, balance, subscription) |
| GET | `/api/billing/invoices` | Yes | Pro+ | Fetch payment invoices from Paystack |
| GET | `/api/billing/transactions` | Yes | Any | Get credit transaction history (last 20) |
| POST | `/api/billing/portal` | Yes | Pro+ | Get Paystack customer portal URL |
| POST | `/api/billing/webhook` | No (sig) | Any | Paystack webhook (subscription events, payments) |
| POST | `/api/feedback` | No | Any | Submit attendee event feedback |
| POST | `/api/feedback/organizer` | No | Any | Submit organizer platform feedback |
| GET | `/api/cron/send-feedback` | CRON | Business | Send feedback request emails to attendees |
| GET | `/api/cron/expire-data` | CRON | Any | Delete expired registrations; send expiry warnings |
| GET | `/api/og` | No | Any | Generate dynamic OG image for events |
| GET | `/api/admin/health` | Admin | Admin | System health check |
| GET | `/api/admin/events` | Admin | Admin | List all events on the platform |
| GET | `/api/admin/users` | Admin | Admin | List all users |
| PATCH | `/api/admin/users/[id]` | Admin | Admin | Update user (suspend, change plan, etc.) |
| GET | `/api/admin/messages` | Admin | Admin | List all organizer feedback messages |
| GET | `/api/admin/stats` | Admin | Admin | Platform-wide statistics |
| GET | `/api/admin/launch-checklist` | Admin | Admin | Environment/config completeness check |

---

## Database Models

### Event
| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | Primary key |
| title | String | |
| description | String? | |
| slug | String (unique) | URL identifier |
| capacity | Int? | null = unlimited |
| deadline | DateTime? | |
| confirmedCount | Int | default 0 |
| waitlistCount | Int | default 0 |
| organizerEmail | String | |
| dashboardToken | String (unique) | Token for tokenized dashboard access |
| questions | Json | Custom registration questions |
| createdAt | DateTime | |
| organizerId | String? | FK → User |
| eventDate | DateTime? | |
| location | String? | |
| communityLink | String? | |
| imageUrl | String? | |
| archived | Boolean | default false |
| status | String | default "active" |
| feedbackSent | Boolean | default false |
| dataExpired | Boolean | default false |

### User
| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | Primary key |
| name | String? | |
| email | String? (unique) | |
| emailVerified | DateTime? | |
| image | String? | |
| password | String? | Hashed |
| createdAt | DateTime | |
| plan | String | default "free" |
| planStartDate | DateTime? | |
| planEndDate | DateTime? | |
| isAdmin | Boolean | default false |
| billingCycle | String? | "monthly" or "annual" |
| suspended | Boolean | default false |
| paystackCustomerCode | String? (unique) | |
| paystackSubscriptionCode | String? (unique) | |
| creditBalance | Float | default 0 |

### Registration
| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | Primary key |
| eventId | String | FK → Event (cascade delete) |
| answers | Json | Custom question answers |
| status | String | "confirmed" or "waitlist" |
| waitlistPosition | Int? | |
| registrationNumber | Int? | Sequential per event |
| submittedAt | DateTime | |
| notified | Boolean | default false |
| attendeeEmail | String? | |
| consentTransactional | Boolean | default false |
| consentMarketing | Boolean | default false |
| isDuplicate | Boolean | default false |

### CreditTransaction
| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | Primary key |
| userId | String | FK → User (cascade delete) |
| amount | Float | Positive = credit, negative = debit |
| type | String | e.g. "topup", "debit" |
| description | String | Human-readable description |
| eventId | String? | Associated event (optional) |
| createdAt | DateTime | |

### EventUnlock
| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | Primary key |
| eventId | String | FK → Event (cascade delete) |
| userId | String | |
| feature | String | Feature unlocked (e.g. "analytics", "watermark") |
| unlockedAt | DateTime | |

### Notification
| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | Primary key |
| userId | String | FK → User (cascade delete) |
| type | String | e.g. "registration", "data_expiry_warning" |
| message | String | |
| eventId | String? | |
| read | Boolean | default false |
| createdAt | DateTime | |

### TeamMember
| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | Primary key |
| ownerId | String | FK → User (organizer, cascade delete) |
| memberId | String? | FK → User (member, set null on delete) |
| email | String | Invited email |
| status | String | default "pending" |
| inviteToken | String (unique) | |
| createdAt | DateTime | |

### Message
| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | Primary key |
| senderName | String? | |
| senderEmail | String? | |
| eventId | String? | |
| eventTitle | String? | |
| type | String | "organizer" or "attendee" |
| rating | Int? | |
| body | String | |
| read | Boolean | default false |
| archived | Boolean | default false |
| createdAt | DateTime | |

### ErrorLog
| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | Primary key |
| route | String | |
| message | String | |
| createdAt | DateTime | |

### EventView
| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | Primary key |
| eventId | String | FK → Event (cascade delete) |
| viewedAt | DateTime | |
| source | String? | Referral source |

### AttendeeFeedback
| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | Primary key |
| eventId | String | FK → Event (cascade delete) |
| registrationId | String (unique) | |
| rating | Int | |
| enjoyed | String? | |
| improve | String? | |
| complaint | String? | |
| submittedAt | DateTime | |

### OrganizerFeedback
| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | Primary key |
| userId | String | |
| eventId | String? | |
| rating | Int | |
| message | String | |
| createdAt | DateTime | |

### Account / Session / VerificationToken
Standard NextAuth.js models for OAuth provider linking, session management, and email verification.

---

## Email Templates

| Trigger | Recipient | Subject | Function | Location |
|---------|-----------|---------|----------|----------|
| Registration confirmed (from waitlist) | Attendee | "Your slot for {eventTitle} is confirmed" | `sendSlotConfirmedEmail()` | `lib/email.ts` |
| Event passed, feedback not yet sent | Confirmed attendees (Business plan) | "How was {eventTitle}? Share your feedback" | `sendFeedbackRequestEmail()` | `lib/email.ts` |
| Team member invited | Invited email address | "{inviterName} invited you to join their EventSlot team" | `sendTeamInviteEmail()` | `lib/email.ts` |

---

## Cron Jobs

| Schedule | Endpoint | Auth | Description |
|----------|----------|------|-------------|
| Daily (via Vercel Cron) | `GET /api/cron/send-feedback` | `Bearer CRON_SECRET` | Finds passed events with `feedbackSent: false`; sends feedback request emails to consenting confirmed attendees on Business-plan events; sets `feedbackSent: true` |
| Daily (via Vercel Cron) | `GET /api/cron/expire-data` | `Bearer CRON_SECRET` | Step 1: deletes registrations + views for Free-plan events 30+ days past deadline, sets `dataExpired: true`. Step 2: sends `data_expiry_warning` notifications for Free-plan events 20-29 days past deadline. |

---

## Pay-As-You-Go Pricing

| Feature | Credit Cost |
|---------|-------------|
| Registration overage (per 100 above free limit) | $1 |
| Remove EventSlot watermark (one event) | $5 |
| CSV export | $2 + $1/100 registrations |
| Word report | $3 + $1/100 registrations |
| Analytics unlock (one event) | $4 |
| Custom thank you page (one event) | $2 |
| Extra active event slot (per month) | $3 |

---

## Pages

| URL | File | Auth | Description |
|-----|------|------|-------------|
| `/` | `app/page.tsx` | No | Landing page |
| `/signin` | `app/(auth)/signin/page.tsx` | No | Sign in |
| `/signup` | `app/(auth)/signup/page.tsx` | No | Sign up |
| `/pricing` | `app/pricing/page.tsx` | No | Public pricing page |
| `/privacy` | `app/privacy/page.tsx` | No | Privacy policy |
| `/terms` | `app/terms/page.tsx` | No | Terms of service |
| `/[eventSlug]` | `app/(attendee)/[eventSlug]/page.tsx` | No | Attendee event registration form |
| `/registration/[registrationId]` | `app/registration/[registrationId]/page.tsx` | No | Registration confirmation |
| `/feedback/[registrationId]` | `app/feedback/[registrationId]/page.tsx` | No | Attendee feedback form |
| `/team/accept` | `app/team/accept/page.tsx` | No | Accept team invitation |
| `/dashboard` | `app/(organizer)/dashboard/page.tsx` | Yes | Organizer dashboard home |
| `/dashboard/[slug]` | `app/(organizer)/dashboard/[slug]/page.tsx` | Yes | Event overview |
| `/dashboard/events` | `app/(organizer)/dashboard/events/page.tsx` | Yes | Events list |
| `/dashboard/events/[slug]` | `app/(organizer)/dashboard/events/[slug]/page.tsx` | Yes | Event registrations detail |
| `/dashboard/billing` | `app/(organizer)/dashboard/billing/page.tsx` | Yes | Billing, credits, plan management |
| `/dashboard/team` | `app/(organizer)/dashboard/team/page.tsx` | Yes | Team member management |
| `/dashboard/insights` | `app/(organizer)/dashboard/insights/page.tsx` | Yes (Business) | Cross-event analytics |
| `/dashboard/notifications` | `app/(organizer)/dashboard/notifications/page.tsx` | Yes | Notification center |
| `/create` | `app/(organizer)/create/page.tsx` | Yes | Create event form |
| `/edit/[slug]` | `app/(organizer)/edit/[slug]/page.tsx` | Yes | Edit event form |
| `/my-events` | `app/(organizer)/my-events/page.tsx` | Yes | Organizer's events overview |
| `/admin` | `app/admin/page.tsx` | Admin | Admin dashboard |
| `/admin/events` | `app/admin/events/page.tsx` | Admin | All platform events |
| `/admin/users` | `app/admin/users/page.tsx` | Admin | User management |
| `/admin/messages` | `app/admin/messages/page.tsx` | Admin | Platform feedback messages |
| `/admin/health` | `app/admin/health/page.tsx` | Admin | System health check |
| `/admin/launch` | `app/admin/launch/page.tsx` | Admin | Launch checklist |
