# EventSlot — Feature Reference
*Updated with every prompt build. Last updated: April 9, 2026*

---

## Core Features

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
| CSV export | Export event registrations as CSV (PAYG on Free, included on Pro/Business) | Pro+ / PAYG | `GET /api/events/[slug]/report` |
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
