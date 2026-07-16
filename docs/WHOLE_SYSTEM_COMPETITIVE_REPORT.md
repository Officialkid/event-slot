# EventSlot — Whole-System Competitive Report
**Date:** May 22, 2026  
**Purpose:** Full system audit + competitor map + prioritised roadmap to dominate in all areas  
**Scope:** Every feature surface, every competitor, every strategic opportunity

---

## 1. Full System Capability Map

A complete audit of every surface in EventSlot today. Status: ✅ Live | ⚠️ Partial | ❌ Missing

### 1.1 Event Creation
| Feature | Status | Notes |
|---|---|---|
| Title, description, date, location, capacity | ✅ | |
| Custom registration questions (text, select, checkbox, multi) | ✅ | |
| Event image upload (R2 CDN) | ✅ | |
| Physical vs virtual event type | ✅ | |
| Google Meet virtual link (encrypted at rest) | ✅ | Only Google Meet — no Zoom/Teams |
| Paid events with ticket price | ✅ | Payments disabled in prod (PAYMENTS_ENABLED=false) |
| Community link (WhatsApp/Telegram/Discord) | ✅ | |
| Registration deadline | ✅ | |
| Join-opens-at window (30-min default before event) | ✅ | |
| Event duplication | ✅ | |
| Event archiving | ✅ | |
| Slug auto-generation + manual rename | ✅ | |
| Bulk registration (register multiple attendees at once) | ✅ | |
| Manual registration by organizer | ✅ | |
| Recurring/series events | ❌ | Weekly standup, monthly meetup — not supported |
| Multi-session / conference tracks | ❌ | No parallel sessions or timed slots |
| Reserved seating | ❌ | No seat map / table assignment |
| Event embed widget (for external sites) | ❌ | No `<iframe>` or JS embed |
| Event landing page custom branding (colours/fonts) | ❌ | All pages use EventSlot dark theme |
| Custom domain per event or organizer | ❌ | Schema says `canUseCustomDomain: true` but not implemented |
| Zoom / Teams / custom meeting link | ❌ | Hardcoded to Google Meet regex |

### 1.2 Attendee Registration Experience
| Feature | Status | Notes |
|---|---|---|
| No account required to register | ✅ | |
| Confirmation email with ticket | ✅ | |
| Waitlisted email with position | ✅ | |
| Waitlist promotion email (🎉 with event details + ticket link) | ✅ | Recently added |
| QR code ticket | ✅ | |
| Ticket download (PDF) | ✅ | |
| Bulk registration (group sign-up) | ✅ | |
| Multiple attendee answers (per-person questions in bulk) | ✅ | |
| Registration cancellation by attendee | ❌ | Attendees cannot self-cancel (organizer only) |
| Calendar add-to-calendar (Google/Outlook/iCal) | ❌ | No `.ics` link or calendar widget |
| Waitlisted: opt-out of waitlist (attendee removes themselves) | ❌ | |
| Post-registration landing page customisation | ❌ | Fixed success page |
| Social proof on event page ("12 people registered") | ❌ | |
| Referral/invite link per attendee | ❌ | |
| Guest (+1) support | ❌ | |
| SMS confirmation | ❌ | Email only |
| WhatsApp confirmation | ❌ | |

### 1.3 Waitlist System
| Feature | Status | Notes |
|---|---|---|
| Automatic queuing past capacity | ✅ | |
| Auto-promote on cancellation or capacity increase | ✅ | |
| Waitlist position shown to attendee | ✅ | |
| Promotion email with ticket + event details | ✅ | |
| Waitlist analytics (promoted count, still waiting) | ❌ | Data exists but not surfaced in dashboard |
| Message all waitlisted attendees | ❌ | Can't warm up people on the list |
| Waitlist close date | ❌ | Waitlist stays open indefinitely |
| Capacity prediction (AI) | ✅ | `/api/events/predict-capacity` exists |
| Waitlist intelligence widget (dashboard) | ❌ | "You have 12 waiting — add 5 slots to promote them" |

### 1.4 Check-in
| Feature | Status | Notes |
|---|---|---|
| Name / email manual lookup check-in | ✅ | |
| QR code ticket verification (entry logs) | ✅ | Via `/api/events/[slug]/verify-entry` |
| QR code scanner in app (camera) | ❌ | Was removed — code was dead |
| Check-in dashboard (who's in, who's not) | ✅ | |
| Check-in count vs capacity display | ✅ | |
| Check-in analytics (rate %) | ❌ | Not in the Analytics tab |
| Offline check-in (no internet) | ❌ | |
| Multiple check-in operators (team members) | ✅ | Via per-event team |
| Door sales (sell at the door) | ❌ | |

### 1.5 Email & Communication
| Feature | Status | Notes |
|---|---|---|
| Transactional emails (confirmation, waitlist, promotion) | ✅ | SMTP via Nodemailer, with Resend fallback during migration |
| Email campaigns dashboard per event | ✅ | |
| Campaign types: Reminder, Update, Thank You, Custom | ✅ | |
| Campaign history / status tracking | ✅ | |
| Email templates with placeholders ({{name}}, {{event}}) | ✅ | |
| Preview before send | ✅ | |
| Recipient count display | ✅ | |
| Email design (HTML rich emails) | ❌ | Plain text template layout only |
| Campaign scheduling (send later) | ❌ | Send immediately only |
| Automated drip emails (7 days before, 1 day before, day-of) | ❌ | Manual only |
| Email open/click tracking | ❌ | No engagement analytics |
| Unsubscribe management (per-event opt-out) | ❌ | |
| SMS campaigns | ❌ | |
| WhatsApp campaign integration | ❌ | |

### 1.6 Analytics
| Feature | Status | Notes |
|---|---|---|
| Per-event: views, registrations, conversion rate | ✅ | |
| Per-event: 30-day line chart | ✅ | |
| Per-event: registrations by hour of day | ✅ | |
| Per-event: AI insight cards (3 cards, credit-gated) | ✅ | Paywall at first view |
| Global: cross-event question/audience breakdown | ✅ | |
| Global: registrations by month (12mo) | ✅ | |
| Global: registrations by day of week | ✅ | |
| Global: AI summary | ✅ | |
| Check-in rate stat card | ❌ | Data exists, not surfaced |
| Waitlist funnel (promoted/remaining) | ❌ | |
| Email campaign open/click rates | ❌ | |
| Registration source tracking (where did they find the event?) | ❌ | `EventView.source` field exists but not used |
| Revenue analytics (paid events) | ❌ | |
| Feedback score on Analytics tab | ❌ | Separate tab only |
| MoM % trend on stat cards | ❌ | |
| Event leaderboard (top events) | ❌ | |
| Date range filter | ❌ | All-time only |
| Export to CSV | ✅ | Registrations export exists |
| Export to Word/PDF report | ✅ | Pay-per-download |

### 1.7 AI Features
| Feature | Status | Notes |
|---|---|---|
| AI assistant (chat) | ✅ | Full page + floating widget |
| AI voice input | ✅ | Browser microphone → transcribe |
| AI image analysis | ✅ | Upload images in chat |
| AI memory (opt-in, rolling summary) | ✅ | |
| AI per-event insight cards | ✅ | Credit-gated |
| AI cross-event summary | ✅ | |
| AI capacity prediction | ✅ | |
| AI event report (Word/PDF) | ✅ | Pay-per-download |
| AI Swahili language support | ✅ | Auto-detected |
| AI "ask about this event" (event-scoped Q&A) | ✅ | `/api/events/[slug]/ask` |
| AI audience profile card | ❌ | Data exists, not rendered |
| AI suggested next action | ❌ | Insight cards don't include actionable recommendations |
| AI email subject line suggestions | ❌ | |
| AI event description writer | ❌ | |
| AI session comparison (this event vs your average) | ❌ | |

### 1.8 Team & Collaboration
| Feature | Status | Notes |
|---|---|---|
| Global team management page | ✅ | `/dashboard/team` |
| Per-event team tab (invite to specific event) | ✅ | Recently added |
| Up to 10 team members | ✅ | |
| Invite by email, resend invite, remove member | ✅ | |
| Event access scoping (member sees only their events) | ✅ | |
| Role-based access (admin vs read-only vs editor) | ❌ | All team members have full edit access |
| Team member activity log | ❌ | Who changed what, when |
| Commenter / view-only role for sponsors | ❌ | |

### 1.9 Payments & Monetisation
| Feature | Status | Notes |
|---|---|---|
| Paid events (ticket price in KSh) | ✅ Schema | PAYMENTS_ENABLED=false in production |
| Paystack integration | ✅ Schema | Not live |
| Pay-per-download for reports | ✅ | Live, KSh 100–1,000 |
| Credit/token economy (for AI features) | ✅ | |
| Referral token rewards | ✅ | |
| Subscription plan codes | ✅ Schema | Plan tiers exist in schema, all features free now |
| Partial refunds / cancellation for paid tickets | ❌ | |
| Multi-currency support | ❌ | KSh only |
| Promo codes / discount codes | ❌ | |
| Group discounts | ❌ | |
| Early bird pricing (time-limited tiers) | ❌ | |
| Revenue split for co-organizers | ❌ | |
| Payout dashboard (when did I get paid) | ❌ | |

### 1.10 Public Presence & Discovery
| Feature | Status | Notes |
|---|---|---|
| Public organizer profile page (`/[username]`) | ✅ | Shows active events |
| Public event page (`/[username]/[slug]`) | ✅ | Registration form embedded |
| OG meta tags per event | ✅ | |
| Dynamic OG images | ⚠️ | `/api/og` exists but not verified on event pages |
| SEO landing pages (how-it-works, for-universities, waitlist-system) | ✅ | |
| Event discovery / marketplace | ❌ | No browse-all-events page |
| Social sharing buttons on event page | ❌ | No one-tap share UI |
| "Notify me when spots open" (for fully closed events) | ❌ | |
| Event search (by category, date, location) | ❌ | |
| Trending / popular events feed | ❌ | |
| Public attendee social proof ("John, Priya, +48 others going") | ❌ | |

### 1.11 Community & Gamification
| Feature | Status | Notes |
|---|---|---|
| Referral link system with token rewards | ✅ | |
| Leaderboard (weekly/monthly/all-time) | ✅ | |
| Pioneer badge (first 150 users) | ✅ | |
| Growth Builder / Community Champion / Hall of Fame badges | ✅ | |
| Community leaderboard page | ✅ | |
| Achievement notifications | ✅ | |
| Public badge display on organizer profile | ❌ | Badges not shown on `/[username]` |
| Community forum / discussion board | ❌ | |
| Event-specific attendee community (post-event chat) | ❌ | |

### 1.12 Attendee-side Experience (Post-Registration)
| Feature | Status | Notes |
|---|---|---|
| My events / registration history (for logged-in attendees) | ⚠️ | `/my-events` exists for organizers but unclear for attendees |
| Ticket management (view, download, re-send) | ✅ | Via `/tokens` and confirmation code |
| Entry confirmation (JoinEventButton for virtual) | ✅ | Name/email lookup → meet link |
| Post-event feedback form | ✅ | Sent to attendees |
| Attendee profile (interests, bio) | ❌ | |
| Attendee networking (connect with other attendees) | ❌ | |
| Personal event calendar | ❌ | |

### 1.13 Notifications
| Feature | Status | Notes |
|---|---|---|
| In-app notifications | ✅ | |
| Notification with inline feedback (star rating + comment) | ✅ | |
| Unread count badge | ✅ | |
| Event-triggered notifications | ✅ | |
| Push notifications (PWA) | ❌ | PWA install banner exists but no push |
| Email notifications to organizer | ⚠️ | Limited — mainly transactional |
| New registration alert to organizer | ❌ | No real-time alert |

### 1.14 Mobile & PWA
| Feature | Status | Notes |
|---|---|---|
| PWA install banner | ✅ | |
| Mobile-responsive design | ✅ | |
| Offline mode | ❌ | |
| Native mobile app (iOS/Android) | ❌ | |
| Push notifications | ❌ | |

### 1.15 Admin
| Feature | Status | Notes |
|---|---|---|
| Admin panel (user management) | ✅ | `/admin` |
| Admin broadcasts / announcements | ✅ | |
| Super admin roles (two emails) | ✅ | |
| Event audit log | ✅ | `AuditLog` model |
| Error log | ✅ | `ErrorLog` model |
| Cron jobs (waitlist, reminders, data expiry) | ✅ | |
| User suspension | ✅ | |

---

## 2. Competitor Deep-Dive

### 2.1 Eventbrite — The Market Leader

**What makes people still use Eventbrite despite weaknesses:**
- **Discovery marketplace** — millions of people search Eventbrite for things to do. Organisers get organic traffic they never created.
- **Brand trust** — "On Eventbrite" signals legitimacy to attendees unfamiliar with the organiser
- **Payment infrastructure** — built-in, compliant, global payouts (USD, GBP, EUR, AUD)
- **Organiser app** — mobile check-in with barcode scanner built-in
- **Reserved seating** — the ability to sell specific seats is unmatchable for venue events
- **Integrations** — connects to Mailchimp, Salesforce, Zapier, Meta Pixel, Google Analytics

**Critical Eventbrite weaknesses (our exploitation targets):**
- **Pricing crushes small/free events** — 6.95% + $1.79 per ticket. A KSh 500 ticket pays ~KSh 85 to Eventbrite. On EventSlot, that's KSh 0.
- **No AI anywhere** — no AI insights, no AI summaries, no AI assistant
- **No intelligent waitlist** — their waitlist is manual and clunky; you must manually process the list
- **Complex UI** — organiser dashboard requires training; dozens of nested menus
- **No per-event team scoping** — all team members see everything
- **No community/gamification** — zero referral system, no leaderboard
- **Not built for Africa** — USD pricing, US-centric discovery, no mobile money, no KSh
- **No built-in AI reports** — third-party integrations only
- **Email campaigns cost extra** — basic email requires paid Eventbrite plan

**Score vs EventSlot today:** Eventbrite wins on Discovery, Payments, Integrations. EventSlot wins on AI, Waitlist, Price, Africa focus.

---

### 2.2 Luma (lu.ma) — The Beautiful Newcomer

**What makes people use Luma despite weaknesses:**
- **Stunning event pages** — best-looking in the industry; social proof (avatar stacks of who's going) drives FOMO
- **Calendar-native** — add-to-calendar at RSVP, automatic reminders via Google/Outlook
- **Referral tracking** — "Who invited you?" tracked per registration; organiser sees their best promoters
- **Social discovery** — follows/interests-based recommendations; feels like a social network
- **Co-host feature** — another person's name + photo appears on the event page (social credibility)
- **Luma Spaces** — recurring community hubs for series of events
- **Apple/Google login** — frictionless sign-in

**Critical Luma weaknesses:**
- **No analytics depth** — beautiful but shallow; no day-of-week charts, no AI analysis, no conversion funnel
- **No waitlist intelligence** — basic waitlist, no auto-promotion logic like EventSlot's
- **No team management** — no per-event team scoping
- **No email campaigns** — no ability to send bulk emails to attendees
- **No check-in system** — you're on your own for door management
- **No paid events** — very limited monetisation; primarily RSVP-based
- **No AI features** — zero
- **No feedback collection** — no post-event forms
- **English only** — no localisation, no Swahili
- **Not Africa-aware** — optimised for US/European social events

**Score vs EventSlot today:** Luma wins on visual design, social proof, calendar integration, and discovery. EventSlot wins on analytics, waitlist intelligence, AI, check-in, email campaigns, team management.

---

### 2.3 Meetup — The Community Platform

**What makes people use Meetup:**
- **Recurring group model** — you build a community group (e.g., "Nairobi JS Developers") and post events under it; attendees follow the group, not individual events
- **Discovery by interest + location** — people find events through category browsing
- **RSVP culture** — established social contract; members expect to RSVP on Meetup
- **Member retention** — group members get notified of every new event automatically

**Critical Meetup weaknesses:**
- **Subscription required to organise** — $9.99–$29.99/month just to run a group
- **No custom forms** — basic RSVP only, no custom registration questions
- **No waitlist** — just yes/no RSVP; no queue management
- **No analytics** — basic attendance count only
- **No email campaigns** — limited message system
- **No AI** — none
- **Ugly outdated UI** — not mobile-first, feels like 2012
- **Not Africa-compatible** — USD pricing, no mobile money

**Score vs EventSlot today:** Meetup wins on community groups and discovery. EventSlot wins on almost everything else.

---

### 2.4 Whova — The Conference Platform

**What makes event pros use Whova:**
- **Agenda builder** — multi-track, multi-day, speaker profiles, session capacity limits
- **Attendee networking** — private attendee profiles, in-app chat, "community board" for posts
- **Sponsor management** — sponsor logos, sponsor booths, ROI tracking
- **Live polls + Q&A during sessions** — engagement tools during the event itself
- **Virtual + hybrid support** — video streams embedded in the app
- **Certificate generation** — PDF certificates of attendance per attendee
- **Mobile app** — iOS + Android with offline agenda

**Critical Whova weaknesses:**
- **Enterprise pricing** — not publicly listed; typically $1,000–$5,000+ per event
- **Overkill complexity** — requires days of setup for a simple event
- **No waitlist system** — session capacity management but no auto-promotion queue
- **No AI** — no AI summaries, no AI insights
- **Very heavy** — app download required, steep learning curve
- **Not for small events** — minimum viable use is a 100+ person conference
- **Not Africa-relevant** — USD, no local payment methods

**Score vs EventSlot today:** Whova wins on conference-specific features (agenda, speakers, networking). EventSlot wins on simplicity, AI, waitlist, price, and Africa fit.

---

### 2.5 Ticket Tailor — The Anti-Eventbrite

**What makes people use Ticket Tailor:**
- **Flat-fee model** — monthly flat fee (from ~£25/mo), unlimited tickets, no per-ticket fee. For high-volume paid events, massive saving vs Eventbrite.
- **Widget embed** — embed ticket sales on your own website with one JS snippet
- **Box office mode** — sell at the door from a tablet
- **Reserved seating** — seating chart builder
- **Dynamic reporting** — clean sales + attendance dashboards

**Critical Ticket Tailor weaknesses:**
- **No AI** — nothing
- **No waitlist** — out of stock = done
- **No community features** — no gamification, no referral
- **No attendee networking** — purely transactional
- **No post-event forms** — no feedback collection
- **Monthly fee required** — no free tier for casual organisers
- **No discovery** — pure white-label; bring your own traffic
- **Not Africa-relevant** — GBP/USD, no mobile money

**Score vs EventSlot today:** Ticket Tailor wins on embed widget and flat-fee paid ticketing. EventSlot wins on everything else including price for free events.

---

### 2.6 Google Forms + Sheets — The Real Competitor in Africa

**Why people still use Google Forms (this is our most important competitor):**
- **Free forever** — no cost, no credit card
- **Familiar** — everyone knows how to use it
- **Flexible** — any question type, any logic
- **Integrated with Google ecosystem** — auto-fills Sheets, sends to Drive
- **Shareable** — link works everywhere

**Why Google Forms loses to EventSlot:**
- **No capacity management** — form accepts responses forever; organisers close manually
- **No waitlist** — no queue, no auto-promotion
- **No confirmation email with ticket** — no PDF ticket, no QR code
- **No check-in tool** — a separate spreadsheet with someone scanning it manually
- **No analytics** — just response counts; no AI, no insights
- **No team collaboration** — shared Google Drive is chaos for multi-person events
- **No community features** — no referral, no badges
- **No event page** — a raw form link with no branding

**This is our main conversion opportunity.** Every organiser currently using Google Forms is a potential EventSlot user. Our messaging should focus relentlessly on this switch.

---

### 2.7 Quicket — Africa's Closest Competitor

**What Quicket has:**
- **South Africa focused** — ZAR pricing, SA-based support
- **Ticket scanning app** — iOS/Android check-in
- **Box office** — sell at the door
- **Seating charts** — for venue events
- **Multi-currency** — ZAR, KES, GHS, NGN
- **Payout in local currencies** — major advantage

**Critical Quicket weaknesses:**
- **No AI features** — none
- **No waitlist** — event shows "sold out," done
- **Per-ticket fees** — similar to Eventbrite model
- **No custom registration questions depth** — basic attendee info only
- **No analytics beyond sales** — no conversion, no timing, no audience insights
- **Outdated UI** — functional but not modern
- **No community/gamification** — no referral, no badges
- **English only** — no Swahili, no local language support
- **No email campaigns** — no bulk communication to attendees

**Score vs EventSlot today:** Quicket wins on mobile app, door sales, and being African. EventSlot wins on AI, waitlist, analytics, community, price, and UI quality.

---

## 3. Strategic Positioning Matrix

### Where EventSlot Wins Outright (Protect + Amplify)

| Advantage | Why It Matters | Who Else Has It |
|---|---|---|
| **Intelligent auto-waitlist** | Converts missed registrations into confirmed attendees | Nobody does this automatically |
| **AI insight cards per event** | Actionable post-event intelligence | No competitor |
| **AI cross-event tracker** | Trends across all events | No competitor |
| **AI assistant with memory** | Feels like a personal events advisor | No competitor |
| **AI voice input** | Organiser can speak to the platform | No competitor |
| **AI Word/PDF reports** | Professional post-event reports in seconds | No competitor |
| **Per-event team scoping** | Collaborators see only their event | No competitor |
| **Token/credit economy** | Sustainable monetisation without per-ticket fees | No competitor |
| **Referral + gamification** | Community growth engine built into the platform | No competitor |
| **Swahili language support** | Serves East Africa natively | No competitor |
| **Free for all free events** | Zero cost to run a free event | Luma, but no analytics/AI |
| **Custom registration questions** | Capture exactly what you need | Eventbrite, Whova (not Luma/Meetup) |
| **Built-in feedback forms** | Post-event sentiment in one click | No competitor |
| **Community link per event** | WhatsApp/Telegram group baked in | No competitor |
| **Email campaigns built-in** | No Mailchimp needed | Eventbrite (paid plan only) |

### Where EventSlot Is Behind (Must Close These Gaps)

| Gap | Competitor With It | Why Users Would Leave For It |
|---|---|---|
| **Event discovery/marketplace** | Eventbrite, Luma, Meetup | Organisers want organic traffic, not just a tool |
| **Mobile app (iOS/Android)** | Eventbrite, Whova, Quicket | Check-in operators need a native app |
| **QR code scanner in app** | All major players | Physical check-in without internet |
| **Calendar add-to-calendar** | Luma, Eventbrite | Attendees forget events without reminders |
| **Social proof on event pages** | Luma | FOMO drives registrations |
| **Attendee self-cancellation** | Eventbrite, Luma | Reduces no-shows, updates waitlist automatically |
| **Automated email drips** | Eventbrite | "7 days before", "1 day before", "day of" |
| **Live payments** | Eventbrite, Quicket, Ticket Tailor | Paid events are a major use case |
| **Registration embed widget** | Ticket Tailor, Eventbrite | Organizers with websites want on-site registration |
| **Zoom/Teams virtual support** | Eventbrite, Whova | Most corporate users use Zoom, not Meet |

---

## 4. The Africa Advantage — Our Untapped Moat

Every major competitor treats Africa as an afterthought. This is our biggest strategic opportunity.

### What Africa needs that nobody provides:
1. **Mobile money payments** — M-Pesa (Kenya), MTN Mobile Money (Uganda/Ghana), Airtel Money. Stripe/Paystack exist but M-Pesa is the actual payment method. **Nobody in the event platform space has native M-Pesa integration.**
2. **WhatsApp-native sharing** — Event links shared on WhatsApp are the primary marketing channel. Our pages need WhatsApp-specific meta tags and a one-tap "Share on WhatsApp" button.
3. **Swahili, Yoruba, Igbo, Pidgin** — 4 of the 10 most spoken African languages. Only EventSlot even acknowledges Swahili.
4. **SMS confirmation fallback** — Many attendees don't check email. SMS to `+254...` number is a must.
5. **Low-data-friendly mode** — Event pages for areas with expensive data / slow connections. Smaller images, no heavy JS.
6. **University-specific features** — Student ID verification, faculty/department segmentation, academic calendar awareness.
7. **Offline check-in** — Data connectivity at event venues in Kenya/Nigeria is unreliable. An offline-first check-in mode is table stakes for physical events.
8. **KSh/NGN/GHS/UGX pricing** — Local currency displays make pricing comprehensible without mental conversion.
9. **Local support hours** — EAT/WAT timezone-aware support.
10. **Multi-institution events** — Events co-organised between two universities/organisations (very common in Africa) need proper co-organiser branding.

---

## 5. Prioritised Improvement Roadmap

### TIER 1 — CRITICAL QUICK WINS (1–3 days each, maximum ROI)

#### Q1. QR Code Scanner — Restore Camera Check-in
**Impact:** Massive. Every physical event needs this. Without it, we lose ground to Eventbrite and Quicket at the door.  
**What:** Re-implement the QR scanner in the check-in tab of the event dashboard using `jsQR`. It was removed but was functional. Place it in the Check-in tab, not the attendee-facing JoinEventButton.  
**Effort:** 1 day  
**Competitive target:** Eventbrite, Quicket  

#### Q2. Add-to-Calendar on Event Pages and Confirmation Emails
**Impact:** High. Luma's biggest conversion advantage is that attendees add the event to calendar immediately. Attendees who add to calendar have a 3x lower no-show rate.  
**What:** On the public event page and in the confirmation email, include:
- Google Calendar link: `https://calendar.google.com/calendar/render?action=TEMPLATE&text=...&dates=...`
- Download `.ics` file link
- "Add to Apple Calendar" link (same `.ics`)  
**Effort:** 4 hours  
**Competitive target:** Luma  

#### Q3. WhatsApp Share Button on Event Pages
**Impact:** Critical for Africa. Our primary distribution channel is WhatsApp.  
**What:** On every public event page, add: `https://wa.me/?text=Register+for+${title}+${url}` as a one-tap button.  
**Effort:** 2 hours  
**Competitive target:** None — nobody does this well for Africa  

#### Q4. Social Proof Count on Event Page
**Impact:** High. Luma's attendee avatar stacks are their #1 conversion feature.  
**What:** On the public event page, show: "**42 people** already registered" — or for waitlisted: "Full — 8 on waitlist". This creates FOMO and signals legitimacy.  
**Effort:** 2 hours (data already in `confirmedCount`)  
**Competitive target:** Luma  

#### Q5. Auto-load Analytics (Remove "Load analytics" Button)
**Impact:** Medium effort, high polish. Every competitor auto-loads their analytics dashboard.  
**Effort:** 30 minutes  
(Already documented in Insights report — carry forward)

#### Q6. Check-in Rate Stat Card in Analytics
**Effort:** 2 hours  
(Already documented in Insights report — carry forward)

#### Q7. Badges Visible on Public Organizer Profile
**Impact:** Medium. Shows community credibility on the `/[username]` page. Pioneer, Growth Builder badges are trust signals.  
**What:** On the `getPublicUserProfile` query, include `badges`. Render badges below organizer name.  
**Effort:** 3 hours  

---

### TIER 2 — HIGH-PRIORITY FEATURES (1 week each)

#### H1. Attendee Self-Cancellation
**Why:** Without this, cancelled attendees just don't show up. The waitlist never gets promoted. No-show rates stay high.  
**What:** On the confirmation email and ticket page, include a "Cancel my registration" button. Clicking it:
1. Moves attendee to `CANCELLED` status
2. Promotes the next waitlisted person (existing logic)
3. Sends a cancellation confirmation email
**Schema:** Registration model already has `status` field — add `CANCELLED` enum value.  
**Effort:** 3 days  
**Competitive target:** Eventbrite, Luma  

#### H2. Automated Email Drip Sequences (Pre-event Reminders)
**Why:** Manual campaigns are underused. Automatic "7 days before" / "1 day before" / "day-of" emails are expected on every platform and reduce no-shows significantly.  
**What:**
- On event creation, allow organiser to toggle "Auto-send reminder emails"
- Three triggers: 7 days before, 24h before, 1h before
- Use existing cron infrastructure (`/api/cron`) to send
- Subject: "Reminder: [Event] is in 7 days" / "Tomorrow: [Event]" / "Today: [Event]"
**Effort:** 4 days  
**Competitive target:** Eventbrite  

#### H3. Zoom / Teams / Custom Meeting Link Support
**Why:** The Google Meet restriction is a significant block for corporate users. Every company-sized team uses Zoom or Teams.  
**What:** 
- Change the virtual link validation from a regex on `meet.google.com` to accept any `https://` URL
- Update the UI label from "Google Meet link" to "Meeting link"
- Keep QR entry flow but pass whatever link is stored
**Effort:** 2 hours (schema already supports it — just regex + UI change)  
**Competitive target:** Whova, Eventbrite  

#### H4. "Notify Me When Spots Open" for Fully Closed Events
**Why:** When an event has no waitlist and is closed, interested people have nowhere to go. This captures intent that would otherwise be lost.  
**What:**
- When `status === "closed"` and no waitlist accepted, show "Notify me if spots open" form (just email)
- Store in a `SpotInterest` table (`eventId`, `email`, `createdAt`)
- On capacity increase, email these people before the waitlist promotion
**Effort:** 2 days  
**Competitive target:** Nobody does this — **pure EventSlot innovation**  

#### H5. Waitlist Intelligence Widget on Overview Tab
**Why:** Organizers don't know they could promote waitlisted people with a small capacity bump.  
**What:** A card on the Overview tab: "12 people are waiting. Adding 5 spots would confirm the next 5 attendees. [Increase capacity →]"  
**Effort:** 4 hours  
**Competitive target:** Nobody — pure differentiation  

#### H6. Role-Based Team Access (View Only vs Editor)
**Why:** Sponsors, read-only stakeholders, and volunteers need to see data without being able to change things.  
**What:** Add `role` field to `TeamMember` enum: `EDITOR | VIEWER`. Viewers can see event data but not edit settings, not send campaigns.  
**Effort:** 3 days  
**Competitive target:** Eventbrite  

#### H7. Email Open/Click Tracking
**Why:** Organisers want to know if their campaign was effective. "Sent to 120 people" is useless without open rate.  
**What:** Use Resend's webhook support to receive `email.opened` and `email.clicked` events. Store in `EmailCampaignEvent` table. Show open rate % on campaign history.  
**Effort:** 3 days  
**Competitive target:** Eventbrite, all email platforms  

---

### TIER 3 — GAME-CHANGERS (2–4 weeks each)

#### G1. Event Discovery Page (Marketplace)
**Why:** This is the single biggest reason people use Eventbrite over us. Organic discovery means organisers get attendees without marketing.  
**What:**
- A public `/discover` or `/events` page listing all public active events
- Filterable by: category (community, tech, sports, church, uni, music), city, date range
- Each event card shows: title, date, organiser avatar, registered count, capacity fill indicator
- "Featured" section for events with high registrations this week
- SEO-optimised (statically generated + ISR)
- Add `isPublic: Boolean @default(true)` and `category: String?` fields to `Event`
**Effort:** 1 week  
**Competitive target:** Eventbrite, Luma, Meetup  
**Note:** This fundamentally changes EventSlot from a tool into a platform. It is the highest-leverage feature in the roadmap.

#### G2. Live Payments — Activate Paystack
**Why:** Paid events are a major use case. Organisers running ticketed events (concerts, workshops, dinners) can't use EventSlot today.  
**What:**
- Enable `PAYMENTS_ENABLED=true`
- Implement the Paystack inline payment flow on the registration form when `isPaid === true`
- On successful payment: confirm registration, generate ticket, send confirmation email
- Build payout dashboard showing: ticket revenue, EventSlot platform fee, net payout
- Add cancellation + refund flow
**Effort:** 2 weeks  
**Competitive target:** Eventbrite, Quicket  
**Revenue impact:** Platform can take 2–3% on paid events — our first direct revenue beyond report downloads

#### G3. M-Pesa Integration (East Africa Superpower)
**Why:** This is our #1 Africa-specific moat. No competitor has this. M-Pesa is how Kenya pays.  
**What:**
- Daraja API (Safaricom M-Pesa) STK Push: attendee enters phone number → M-Pesa prompt on their phone → confirm → payment captured
- On success, registration confirmed
- Organiser sees payment status in attendee list
**Effort:** 2 weeks  
**Competitive target:** Nobody — pure EventSlot moat in East Africa  

#### G4. Registration Embed Widget
**Why:** Organisers with websites (university departments, companies, churches) want registration directly on their site, not a redirect.  
**What:**
- A `<script>` tag + `<div id="eventslot-widget" data-event="slug">` embed code
- Served from `eventsslot.com/widget.js` — renders a compact registration form in an iframe
- Branding footer: "Powered by EventSlot"
- For paid events, Paystack opens in a modal
**Effort:** 1 week  
**Competitive target:** Ticket Tailor, Eventbrite  

#### G5. Recurring Events / Event Series
**Why:** Weekly standups, monthly meetups, semester-long seminar series — this use case is unserved by every platform except Meetup.  
**What:**
- Add `isRecurring: Boolean` and `seriesId: String?` to `Event` model
- When creating an event, option to "Repeat: Weekly / Bi-weekly / Monthly"
- Each occurrence is a separate `Event` but linked via `seriesId`
- Attendees can register for all occurrences at once or per event
- Series-level analytics (attendance trend across all occurrences)
**Effort:** 2 weeks  
**Competitive target:** Meetup (destroys their model)  

#### G6. SMS Confirmation Fallback
**Why:** Email delivery in Kenya/Nigeria has low open rates. SMS is checked immediately.  
**What:**
- Use Africa's Talking API (Kenyan SMS gateway, very affordable)
- On registration confirmed: send SMS to attendee's phone number if provided
- SMS content: "Confirmed for [Event] on [Date]. Download ticket: [link]"
- Optional: allow organisers to send SMS campaigns to confirmed attendees
- Add `phone` as an optional default field on all registration forms
**Effort:** 1 week  
**Competitive target:** Nobody in this category — **pure moat**  

#### G7. Offline Check-in Mode
**Why:** Internet at Kenyan university venues, church halls, and outdoor events is unreliable. Every check-in system that requires connectivity fails in Africa.  
**What:**
- When the organiser opens the check-in tab, sync the confirmed attendee list to IndexedDB (browser storage)
- Check-in against local cache when offline
- Queue scan results locally, sync to server when connectivity returns
- Show "Offline mode" badge in the check-in UI
**Effort:** 1 week  
**Competitive target:** Quicket (app-based) — but we can do this in the browser  

---

### TIER 4 — DIFFERENTIATORS (1–2 months, high long-term value)

#### D1. Native Mobile App (iOS + Android)
**Why:** Eventbrite's mobile organiser app is one of their strongest retention features. Scanning QR codes at the door, seeing live registration updates — these feel like real tools.  
**What:** A React Native / Expo app containing:
- Organiser: event list, per-event stats, check-in scanner
- Team member: assigned events, check-in scanner
- Attendee: my registrations, tickets, upcoming events
- Push notifications for new registrations
**Effort:** 4–6 weeks  
**Competitive target:** Eventbrite, Quicket, Whova  

#### D2. Attendee Networking (Connection Requests)
**Why:** People attend events to meet people. Facilitating post-event connections creates lasting loyalty.  
**What:**
- After an event, attendees (who opted in) can see other attendees' names + "Connect" button
- Connection sends an email to both parties
- Optional: LinkedIn profile link field in registration form
**Effort:** 2 weeks  
**Competitive target:** Whova  

#### D3. Sponsor Management & ROI Reporting
**Why:** Events with sponsors are a massive segment (conferences, hackathons, sports tournaments). Sponsors need visibility data to justify investment.  
**What:**
- Sponsor profiles (logo, tier, description) per event
- Sponsor visibility: logo on event page, tickets, emails
- Post-event sponsor report: total attendees reached, email open rate, event page views
**Effort:** 2 weeks  
**Competitive target:** Whova, Eventbrite  

#### D4. Multi-session / Conference Track Builder
**Why:** Hackathons, conferences, and academic symposiums have parallel tracks. Today this requires 5 separate EventSlot events.  
**What:**
- Sessions with individual capacity limits under a parent event
- Attendees see a schedule grid and register for individual sessions
- Speaker profiles with photos/bios
- Session-level check-in
**Effort:** 3–4 weeks  
**Competitive target:** Whova — finally competes in conference management  

#### D5. AI Event Page Builder
**Why:** Event description writing is a blocker for first-time organisers.  
**What:**
- On the create event form, a "✦ Write with AI" button next to the description field
- Generates a compelling description from: title + location + date + target audience (one line)
- Suggests a cover image prompt for the image upload
**Effort:** 1 week  
**Competitive target:** Nobody — pure AI moat  

#### D6. AI Email Subject Line + Body Suggestions
**Why:** Organisers don't know how to write effective campaign emails.  
**What:**
- In the Email Campaigns dashboard, a "✦ Suggest" button
- Pre-fills subject + body based on campaign type and event context
- Organiser edits, then sends
**Effort:** 3 days  
**Competitive target:** Nobody  

#### D7. Post-event Certificate Generation
**Why:** University events, workshops, and training sessions need attendance certificates. This is a high-value feature for institutional users.  
**What:**
- Organiser enables certificates for an event (with certificate template: name, event, date, organizer signature)
- After the event, attendees who checked in receive a PDF certificate by email
**Effort:** 1 week  
**Competitive target:** Whova  

---

## 6. Revenue Strategy

### Current monetisation:
- Report downloads: KSh 100–1,000 (pay-per-download)
- AI credits/tokens (voice, document analysis)
- Paid events: **not yet live**

### Recommended revenue expansion:

| Model | Description | Timeline |
|---|---|---|
| **Paid event platform fee (2.5%)** | Take 2.5% on paid ticket sales. On KSh 500 ticket, that's KSh 12.50 — still far cheaper than Eventbrite's ~KSh 85. | After Paystack activation |
| **M-Pesa transaction fee** | Take 1% on M-Pesa payments. Very small per transaction, massive volume. | After M-Pesa integration |
| **Pro organiser plan** | KSh 999/mo unlocks: SMS campaigns, embed widget, custom branding, priority support. | 3 months |
| **Institutional plan** | KSh 5,000/mo for universities: unlimited team members, bulk certificate generation, custom domain, branded event pages, SLA. | 3–6 months |
| **Event promotion** | Organisers pay KSh 500 to feature their event on the discovery page for 7 days. | After discovery page launch |
| **AI report upsell** | Current KSh 100/download. Bundle pricing already exists. Introduce subscription: KSh 500/mo for unlimited downloads. | 1 month |

---

## 7. Marketing Position Map

### How to position against each competitor:

| vs. Competitor | Positioning Message |
|---|---|
| **vs. Google Forms** | "Google Forms can't fill a waitlist. EventSlot can." |
| **vs. Eventbrite** | "Keep 100% of your ticket revenue. EventSlot charges nothing for free events — and far less for paid ones." |
| **vs. Luma** | "Luma looks beautiful. EventSlot tells you what happened and why." |
| **vs. Meetup** | "Meetup charges $10/month to run a group. EventSlot is free, and comes with AI insights." |
| **vs. WhatsApp group** | "Stop managing a WhatsApp group with 200 unread messages. One link does it all." |
| **vs. Quicket** | "Quicket is ticketing. EventSlot is your entire event intelligence platform." |

### Target segments by priority:
1. **Kenyan university student organisations** — biggest volume, highest virality potential
2. **Nigerian tech/startup community organisers** — high event frequency, technically savvy
3. **Church event coordinators** — huge volume in East/West Africa; currently using Google Forms
4. **Corporate HR/L&D departments** — training events, workshops; willing to pay
5. **Sports tournament organisers** — registration + check-in use case is perfect fit

---

## 8. Quick Win Summary (Can Ship This Week)

| # | Feature | Effort | Unlock |
|---|---|---|---|
| 1 | QR scanner in Check-in tab | 1 day | Compete at the door |
| 2 | Add-to-calendar links (event page + confirmation email) | 4h | Reduce no-shows |
| 3 | WhatsApp share button on event pages | 2h | Africa distribution |
| 4 | Social proof count on event page | 2h | FOMO + conversions |
| 5 | Badges on public organizer profile | 3h | Community trust signal |
| 6 | Zoom/Teams/custom meeting link support | 2h | Remove corporate blocker |
| 7 | Waitlist intelligence widget (Overview tab) | 4h | Highlight our best feature |
| 8 | Attendee self-cancellation | 3 days | Auto-update waitlist |
| 9 | "Notify me when spots open" | 2 days | Capture lost interest |
| 10 | Auto-load analytics | 30 min | Remove friction |

**Total for all 10: ~8 days of development**

---

## 9. System Vision: What EventSlot Becomes

**12 months from now, EventSlot should be:**

> *The intelligence layer for African events — the only platform where you create an event, the waitlist fills itself, AI tells you what happened, M-Pesa collects the money, and your university community grows around it.*

The platforms that exist today (Eventbrite, Luma, Quicket) are all built for the West. They bolt on Africa support as an afterthought. EventSlot builds Africa-first and scales globally. That is the only sustainable competitive moat — not just features, but **native cultural fit**.

Every competitor has weaknesses. The goal is not to match them feature-for-feature — it is to be so far ahead in the areas that matter to our users (AI, Africa, community, simplicity) that competitors can't catch up even after they notice us.

---

*Report prepared from full codebase audit of `app/`, `components/`, `lib/`, `prisma/schema.prisma`, `lib/plans.ts`, and competitive research of Eventbrite, Luma, Meetup, Whova, Ticket Tailor, Quicket, and Google Forms.*
